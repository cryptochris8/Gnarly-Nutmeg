import { Entity, PlayerEntity, World, EntityEvent, EntityManager, type Vector3Like } from "hytopia";
import AIPlayerEntity, { ROLE_DEFINITIONS, type SoccerAIRole, type RoleDefinition } from "./AIPlayerEntity";
import SoccerPlayerEntity from './SoccerPlayerEntity';
import sharedState from "../state/sharedState";
import {
  AI_FIELD_CENTER_X,
  AI_FIELD_CENTER_Z,
  AI_GOAL_LINE_X_RED,
  AI_GOAL_LINE_X_BLUE,
  FIELD_MIN_X,
  FIELD_MAX_X,
  FIELD_MIN_Z,
  FIELD_MAX_Z
} from '../state/gameConfig';

/**
 * SoccerAgent class
 * Provides high-level soccer AI decision making and actions
 * Works with the behavior tree system in AIPlayerEntity
 */
export class SoccerAgent {
  private entity: AIPlayerEntity;
  private lastPossessionChangeTime: number = 0; // For counter-attack logic
  private readonly COUNTER_ATTACK_WINDOW_MS = 5000; // 5 seconds to initiate a counter
  private opponentHadBallLastTick: boolean = false; // Tracks if opponent had ball in the previous tick

  constructor(entity: AIPlayerEntity) {
    this.entity = entity;
  }
  
  /**
   * Check if this agent has the ball.
   * Updates possession state for counter-attack logic.
   */
  public hasBall(): boolean {
    const attachedPlayer = sharedState.getAttachedPlayer();
    const iHaveBall = attachedPlayer === this.entity;
    
    if (iHaveBall && this.opponentHadBallLastTick) { 
        // Opponent just lost possession to me (or a teammate, and now I have it).
        // This resets the "opponent lost possession recently" state for calculating *my* counter-attack eligibility.
        console.log(`[POSSESSION_CHANGE] ${this.entity.player.username} now has the ball. Opponent lost possession.`);
        // this.lastPossessionChangeTime = 0; // Resetting this might be too aggressive if teammates are countering
    }
    
    if (iHaveBall) {
        this.opponentHadBallLastTick = false; // If I have it, opponent doesn't.
    }
    return iHaveBall;
  }
  
  /**
   * Check if an opponent has the ball.
   * Updates possession state for counter-attack logic.
   */
  public opponentHasBall(): boolean {
    const attachedPlayer = sharedState.getAttachedPlayer();
    // Check if a player has the ball and is from the opposite team
    let opponentCurrentlyHasBall = false;
    if (attachedPlayer instanceof SoccerPlayerEntity && attachedPlayer.team !== this.entity.team) {
        opponentCurrentlyHasBall = true;
    } else if (attachedPlayer instanceof AIPlayerEntity && attachedPlayer.team !== this.entity.team) {
        opponentCurrentlyHasBall = true;
    }

    // If possession just changed to opponent
    if (opponentCurrentlyHasBall && !this.opponentHadBallLastTick) {
        this.lastPossessionChangeTime = Date.now();
        const opponentName = attachedPlayer instanceof PlayerEntity ? attachedPlayer.player.username : 'Unknown Opponent';
        console.log(`[POSSESSION_CHANGE] Opponent ${opponentName} now has the ball. Counter timer started for ${this.entity.player.username}.`);
    }
    this.opponentHadBallLastTick = opponentCurrentlyHasBall;
    return opponentCurrentlyHasBall;
  }
  
  /**
   * Check if the agent is within shooting range of the goal.
   * Enhanced to consider role's offensive contribution and stamina levels.
   */
  public withinShootingRange(): boolean {
    const opponentGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    const goalPosition = { x: opponentGoalLineX, y: 1, z: AI_FIELD_CENTER_Z };
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    
    let maxShootingRange = 15; 
    if (this.entity.aiRole === 'striker') {
      maxShootingRange = 20;
    } else if (this.entity.aiRole === 'central-midfielder-1' || this.entity.aiRole === 'central-midfielder-2') {
      maxShootingRange = 18;
    }
    
    const offensiveFactor = 1 + (roleDef.offensiveContribution - 5) / 25; 
    maxShootingRange *= offensiveFactor;

    // **STAMINA CONSIDERATION**: Reduce shooting range when stamina is low
    const staminaPercentage = this.entity.getStaminaPercentage();
    if (staminaPercentage < 30) {
      maxShootingRange *= 0.7; // Reduce range by 30% when stamina is low
    } else if (staminaPercentage < 50) {
      maxShootingRange *= 0.85; // Reduce range by 15% when stamina is moderate
    }

    const distanceToGoal = this.entity.distanceBetween(this.entity.position, goalPosition);
    return distanceToGoal < maxShootingRange;
  }
  
  /**
   * Check if there's a teammate in a better position.
   * Enhanced to consider passer's supportDistance.
   */
  public teammateBetterPositioned(): boolean {
    const teammates = sharedState.getAITeammates(this.entity).filter(t => t.isSpawned && t !== this.entity);
    if (teammates.length === 0) return false;
    
    const opponentGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    const goalPosition = { x: opponentGoalLineX, y: 1, z: AI_FIELD_CENTER_Z };
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];

    for (const teammate of teammates) {
      const distanceToTeammate = this.entity.distanceBetween(this.entity.position, teammate.position);
      if (distanceToTeammate > roleDef.supportDistance * 1.5) { 
          continue;
      }

      const forwardProgress = this.entity.team === 'red' ? 
        teammate.position.x - this.entity.position.x : 
        this.entity.position.x - teammate.position.x;
      if (forwardProgress < -8 && teammates.length > 2) continue;
      
      const teammateDistanceToGoal = this.entity.distanceBetween(teammate.position, goalPosition);
      const myDistanceToGoal = this.entity.distanceBetween(this.entity.position, goalPosition);
      
      if (teammateDistanceToGoal < myDistanceToGoal * 0.85) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check if the agent is the closest teammate to the ball
   */
  public isClosestToBall(): boolean {
    const ball = sharedState.getSoccerBall();
    if (!ball) return false; // If no ball, cannot be closest
    
    // Get all active teammates
    const teammates = sharedState.getAITeammates(this.entity).filter(t => t.isSpawned);
    if (teammates.length === 0) return true; // If no other teammates, I'm closest
    
    const myDistanceToBall = this.entity.distanceBetween(this.entity.position, ball.position);
    
    // Role-based bias to help determine who should go for the ball
    // More aggressive roles get more bias
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    const roleBias = roleDef.pursuitTendency * 4; // 1-4 units based on pursuit tendency
    
    // Add a small bias to favor this player and a role-based bias
    // This helps prevent the situation where no one goes for the ball
    const biasedDistance = myDistanceToBall - 3 - roleBias;
    
    // Check if any teammate is closer
    for (const teammate of teammates) {
      if (teammate === this.entity) continue; // Skip self
      
      // Calculate opponent's biased distance using their role
      const teammateRoleDef = ROLE_DEFINITIONS[(teammate as AIPlayerEntity).aiRole];
      const teammateRoleBias = teammateRoleDef.pursuitTendency * 4;
      
      const teammateDistance = this.entity.distanceBetween(teammate.position, ball.position);
      const teammateAdjustedDistance = teammateDistance - teammateRoleBias;
      
      if (teammateAdjustedDistance < biasedDistance) {
        return false; // Someone is closer
      }
    }
    
    return true; // I'm the closest (or close enough with bias)
  }
  
  /**
   * Check if the ball is within reach to intercept
   * Enhanced to consider stamina levels for more conservative pursuit when tired
   */
  public ballInReach(): boolean {
    const ball = sharedState.getSoccerBall();
    if (!ball) return false;
    
    const distanceToBall = this.entity.distanceBetween(this.entity.position, ball.position);
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    
    // Extend the intercept distance by an additional factor to improve ball pursuit
    // This makes players more eager to go for balls that are further away
    let extendedInterceptDistance = roleDef.interceptDistance * 1.5;
    
    // **STAMINA CONSIDERATION**: Reduce intercept distance when stamina is low
    const staminaPercentage = this.entity.getStaminaPercentage();
    if (staminaPercentage < 25) {
      extendedInterceptDistance *= 0.6; // Reduce by 40% when stamina is very low
    } else if (staminaPercentage < 40) {
      extendedInterceptDistance *= 0.8; // Reduce by 20% when stamina is low
    }
    
    return distanceToBall < extendedInterceptDistance;
  }
  
  /**
   * Check if the game is in attacking phase (ball is in opponent's half)
   */
  public inAttackingPhase(): boolean {
    const ball = sharedState.getSoccerBall();
    if (!ball) return false;
    
    const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
    
    // Red team attacks towards negative X, Blue team towards positive X
    if (this.entity.team === 'red') {
      return ball.position.x < fieldCenterX; // Ball X is less than center (towards -X)
    } else {
      return ball.position.x > fieldCenterX; // Ball X is greater than center (towards +X)
    }
  }
  
  /**
   * Shoot the ball toward the goal
   */
  public shoot(): boolean {
    if (!this.hasBall()) return false;
    
    const opponentGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    // Define the precise target point for the shot (center of the opponent's goal)
    const goalPosition: Vector3Like = { 
        x: opponentGoalLineX, 
        y: 1, // Aiming for a typical ball height towards goal
        z: AI_FIELD_CENTER_Z 
    };

    // The AIPlayerEntity.shootBall method now handles the direction and impulse.
    // Manual rotation and targetPosition setting are no longer needed here for the shot itself.
    // Consider a power multiplier based on distance or situation if needed.
    const shotPowerMultiplier = 1.0; // Increased from 0.7 to give AI sufficient shooting power

    // Call the updated shootBall method from AIPlayerEntity
    const success = this.entity.shootBall(goalPosition, shotPowerMultiplier);
    
    if (success) {
        console.log(`${this.entity.player.username} (${this.entity.aiRole}) attempting shot at (${goalPosition.x.toFixed(1)}, ${goalPosition.z.toFixed(1)})`);
    } else {
        console.log(`${this.entity.player.username} (${this.entity.aiRole}) failed to execute shootBall command.`);
    }
    return success;
  }
  
  /**
   * Pass the ball to the best positioned teammate
   */
  public passBall(): boolean {
    if (!this.hasBall()) return false;
    
    // Get AI teammates
    const aiTeammates = sharedState.getAITeammates(this.entity).filter(t => t.isSpawned && t !== this.entity);
    let allTeammates: SoccerPlayerEntity[] = [...aiTeammates];
    
    // Add human players to teammates list
    if (this.entity.world) {
      const allPlayerEntities = this.entity.world.entityManager.getAllPlayerEntities();
      for (const playerEntity of allPlayerEntities) {
        if (playerEntity instanceof SoccerPlayerEntity && 
            playerEntity !== this.entity && 
            playerEntity.team === this.entity.team && 
            playerEntity.isSpawned && 
            !playerEntity.isPlayerFrozen &&
            !(playerEntity instanceof AIPlayerEntity)) { // Only add human players
          allTeammates.push(playerEntity);
        }
      }
    }
    
    const opponentGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    let bestTeammate: SoccerPlayerEntity | null = null; 
    let bestScore = -Infinity; 
    
    const isCounterAttackingContext = Date.now() - this.lastPossessionChangeTime < this.COUNTER_ATTACK_WINDOW_MS * 2 && this.opponentHadBallLastTick;

    for (const teammate of allTeammates) {
      const distanceToTeammate = this.entity.distanceBetween(this.entity.position, teammate.position);
      if (!isCounterAttackingContext && distanceToTeammate > roleDef.supportDistance * 2.0) continue;
      if (isCounterAttackingContext && distanceToTeammate > roleDef.supportDistance * 3.5) continue;

      const teammateDistanceToGoal = this.entity.distanceBetween(
        teammate.position, 
        { x: opponentGoalLineX, y: 1, z: AI_FIELD_CENTER_Z }
      );
      
      let forwardProgress = this.entity.team === 'red' ? 
        teammate.position.x - this.entity.position.x : 
        this.entity.position.x - teammate.position.x;

      if (isCounterAttackingContext && forwardProgress < -2) continue; 
      if (!isCounterAttackingContext && forwardProgress < -8 && allTeammates.length > 1) continue;
      
      let score = (70 - teammateDistanceToGoal) + (forwardProgress * (3.0 + roleDef.offensiveContribution / 4));
      const spaceScore = this.calculateTeammateSpaceScore(teammate);
      score += spaceScore;
      
      // HUMAN PLAYER PRIORITY: Give human players massive bonus to ensure they always receive passes
      if (!(teammate instanceof AIPlayerEntity)) {
        score += 100; // Huge bonus for human players - this ensures they're always prioritized
        console.log(`${this.entity.player.username} (SoccerAgent) prioritizing human player ${teammate.player.username} for pass`);
      }
      
      if (isCounterAttackingContext) {
          score += forwardProgress * 3; 
          // console.log(`${this.entity.player.username} considering counter-attack pass to ${teammate.player.username}, score: ${score}`);
      }

      if (score > bestScore) {
        bestScore = score;
        bestTeammate = teammate;
      }
    }

    if (bestTeammate) {
      // Calculate a point slightly ahead of the teammate to lead the pass
      const leadFactor = 3.0; // How many units ahead to pass. Can be adjusted based on teammate speed/distance.
      const dirToTeammateX = bestTeammate.position.x - this.entity.position.x;
      const dirToTeammateZ = bestTeammate.position.z - this.entity.position.z;
      const distToTeammate = Math.sqrt(dirToTeammateX * dirToTeammateX + dirToTeammateZ * dirToTeammateZ);
      
      let passToPoint: Vector3Like;
      if (distToTeammate > 0.1) { // Avoid division by zero if very close
        const normDirX = dirToTeammateX / distToTeammate;
        const normDirZ = dirToTeammateZ / distToTeammate;
        passToPoint = {
          x: bestTeammate.position.x + normDirX * leadFactor,
          y: bestTeammate.position.y, // Aim for teammate's current y-level (ground)
          z: bestTeammate.position.z + normDirZ * leadFactor,
        };
      } else {
        passToPoint = bestTeammate.position; // Pass directly if already on top of teammate
      }

      // Manual rotation setting is no longer needed here for the pass itself.
      // AIPlayerEntity.forcePass will apply impulse in the calculated direction.
      const passPowerMultiplier = 1.0; // Default power for now

      const success = this.entity.forcePass(bestTeammate, passToPoint, passPowerMultiplier);
      if (success) {
        console.log(`${this.entity.player.username} (${this.entity.aiRole}) attempting pass to ${bestTeammate.player.username} at (${passToPoint.x.toFixed(1)}, ${passToPoint.z.toFixed(1)})`);
      } else {
        console.log(`${this.entity.player.username} (${this.entity.aiRole}) failed to execute forcePass command to ${bestTeammate.player.username}.`);
      }
      return success;
    }
    
    // If no best teammate found, try a generic forward pass using AIPlayerEntity's passBall logic
    // console.log(`${this.entity.player.username} (${this.entity.aiRole}) - SoccerAgent.passBall: No specific best teammate, attempting generic AIPlayerEntity.passBall()`);
    // return this.entity.passBall(); // This will call the AIPlayerEntity's passBall which has its own fallback logic
    // UPDATE: AIPlayerEntity.passBall() now finds its own target. If SoccerAgent doesn't find one, it means no strategic pass from agent level.
    // We can let AIPlayerEntity.passBall() make its own decision or return false if agent decides no good pass here.
    // For now, if agent doesn't find a specific target, let's return false, implying agent decided against a pass.
    console.log(`${this.entity.player.username} (${this.entity.aiRole}) - SoccerAgent.passBall: No strategic teammate found by agent.`);
    return false;
  }
  
  /**
   * Helper method to calculate how much space a teammate has
   * @param teammate The teammate to check space for
   * @returns A score representing how much space the teammate has
   */
  private calculateTeammateSpaceScore(teammate: SoccerPlayerEntity): number {
    // For human players, we'll use a simplified space calculation since we can't get AI opponents easily
    if (!(teammate instanceof AIPlayerEntity)) {
      return 8; // Give human players a good base space score
    }
    
    const opponents = sharedState.getAITeammates(teammate).filter(t => t.team !== teammate.team);
    let spaceScore = 10; // Base space score
    
    for (const opponent of opponents) {
      const distanceToOpponent = teammate.distanceBetween(teammate.position, opponent.position);
      if (distanceToOpponent < 5) {
        spaceScore -= 3;
      } else if (distanceToOpponent < 10) {
        spaceScore -= 1;
      }
    }
    
    return Math.max(spaceScore, 0); // Ensure score doesn't go negative
  }
  
  /**
   * Dribble the ball forward
   */
  public dribble(): boolean {
    if (!this.hasBall()) return false;
    
    const opponentGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    
    const offensiveFactor = roleDef.offensiveContribution / 10; 
    const randomZOffset = (Math.random() * 8 - 4) * (1.5 - offensiveFactor); 

    const targetX = opponentGoalLineX - ( (opponentGoalLineX - this.entity.position.x) * (0.1 * (1 - offensiveFactor)) ); 

    let targetPos = {
      x: targetX,
      y: this.entity.position.y,
      z: AI_FIELD_CENTER_Z + randomZOffset 
    };

    targetPos = this.entity.constrainToPreferredArea(targetPos, this.entity.aiRole);
    targetPos = this.entity.adjustPositionForSpacing(targetPos);

    this.entity.targetPosition = targetPos; 
    
    // Only set rotation if we have the ball and are actually dribbling
    // This prevents rotation conflicts when the AI doesn't have possession
    if (this.hasBall()) {
      // Calculate the full movement direction vector from current position to target position
      const currentPos = this.entity.position;
      const movementX = targetPos.x - currentPos.x;
      const movementZ = targetPos.z - currentPos.z;
      const movementDistance = Math.sqrt(movementX * movementX + movementZ * movementZ);
      
      if (movementDistance > 0.1) {
        // Calculate rotation based on the actual movement direction (both X and Z components)
        const normalizedMovementX = movementX / movementDistance;
        const normalizedMovementZ = movementZ / movementDistance;
        
        // Use atan2(x, z) for proper directional rotation (per Hytopia SDK docs)
        // Add π to flip direction since model faces opposite to coordinate system
        let targetYaw = Math.atan2(normalizedMovementX, normalizedMovementZ) + Math.PI;
        const halfYaw = targetYaw / 2;
        
        this.entity.setRotation({
          x: 0,
          y: Math.sin(halfYaw),
          z: 0,
          w: Math.cos(halfYaw)
        });
        this.entity.hasRotationBeenSetThisTick = true; 
        console.log(`${this.entity.player.username} dribbling: rotation set to face movement direction, yaw=${targetYaw.toFixed(2)}`);
      }
    }
    
    console.log(`${this.entity.player.username} dribbling forward towards goal center`);
    return true;
  }
  
  /**
   * Mark the closest opponent player
   */
  public markOpponent(): boolean {
    const attachedPlayerRaw = sharedState.getAttachedPlayer(); 
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];

    if (attachedPlayerRaw instanceof SoccerPlayerEntity && attachedPlayerRaw.team !== this.entity.team) {
      const opponentPlayer = attachedPlayerRaw as SoccerPlayerEntity; // Cast for type safety
      const ownGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
      
      const goalSideFactor = 1 + (roleDef.defensiveContribution / 10); 
      const goalSideOffset = (this.entity.team === 'red' ? -goalSideFactor : goalSideFactor) * 1.5; 

      let targetX = opponentPlayer.position.x + goalSideOffset;
      
      if (this.entity.team === 'red') { 
        targetX = Math.max(targetX, ownGoalLineX + 2); 
        targetX = Math.min(targetX, opponentPlayer.position.x - 1); 
      } else { 
        targetX = Math.min(targetX, ownGoalLineX - 2);
        targetX = Math.max(targetX, opponentPlayer.position.x + 1); 
      }
      
      const zShiftFactor = 0.3; 
      let targetZ = opponentPlayer.position.z + (AI_FIELD_CENTER_Z - opponentPlayer.position.z) * zShiftFactor;
      
      let targetPos = {
        x: targetX,
        y: this.entity.position.y,
        z: targetZ
      };

      targetPos = this.entity.constrainToPreferredArea(targetPos, this.entity.aiRole);
      targetPos = this.entity.adjustPositionForSpacing(targetPos);

      this.entity.targetPosition = targetPos;
      console.log(`${this.entity.player.username} (${this.entity.aiRole}) marking opponent ${opponentPlayer.player.username}. DefCont: ${roleDef.defensiveContribution}`);
      return true;
    }
    return false;
  }
  
  /**
   * Move to intercept the ball
   */
  public interceptBall(): boolean {
    const ball = sharedState.getSoccerBall();
    if (!ball) return false;
    
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];

    const ballVelocity = ball.linearVelocity;
    const anticipationFactor = 1.0 + (roleDef.offensiveContribution + roleDef.defensiveContribution) / 20; 

    let targetPos: Vector3Like; 
    
    if (ballVelocity && (Math.abs(ballVelocity.x) > 0.5 || Math.abs(ballVelocity.z) > 0.5)) {
      targetPos = {
        x: ball.position.x + (ballVelocity.x * anticipationFactor),
        y: this.entity.position.y, 
        z: ball.position.z + (ballVelocity.z * anticipationFactor)
      };
    } else {
      targetPos = { 
          x: ball.position.x,
          y: this.entity.position.y, 
          z: ball.position.z
      };
    }

    targetPos = this.entity.constrainToPreferredArea(targetPos, this.entity.aiRole);
    targetPos = this.entity.adjustPositionForSpacing(targetPos); 

    this.entity.targetPosition = targetPos; 
    
    console.log(`${this.entity.player.username} intercepting ball (constrained)`);
    return true;
  }
  
  /**
   * Move to open space for attacking
   */
  public moveToOpenSpace(): boolean {
    const opponentGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    const ball = sharedState.getSoccerBall();
    if (!ball) return false;

    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    let targetPos: Vector3Like;

    // Check if currently in a counter-attack phase for this player
    const isCounterAttackingRun = this.opponentHadBallLastTick && // Opponent had it last we checked agent's opponentHasBall
                                 (Date.now() - this.lastPossessionChangeTime < this.COUNTER_ATTACK_WINDOW_MS) &&
                                 (!this.hasBall() && !this.opponentHasBall()); // And ball is now loose

    switch(this.entity.aiRole) {
      case 'striker':
        const leadPassFactor = 10 + roleDef.offensiveContribution; 
        const spaceXBase = this.entity.team === 'red' ? opponentGoalLineX + 5 : opponentGoalLineX - 5; // General area in front of goal
        const spaceXRun = this.entity.team === 'red' ? 
                       Math.min(ball.position.x - leadPassFactor, spaceXBase ) : 
                       Math.max(ball.position.x + leadPassFactor, spaceXBase );
        
        let spaceZ = AI_FIELD_CENTER_Z;
        if (ball.position.z < AI_FIELD_CENTER_Z - 5) { 
            spaceZ = AI_FIELD_CENTER_Z - (5 + Math.random() * 5); 
        } else if (ball.position.z > AI_FIELD_CENTER_Z + 5) { 
            spaceZ = AI_FIELD_CENTER_Z + (5 + Math.random() * 5); 
        } else { 
            spaceZ = AI_FIELD_CENTER_Z + (Math.random() * 10 - 5); 
        }
        targetPos = { x: spaceXRun, y: this.entity.position.y, z: spaceZ };
        if (isCounterAttackingRun) { // Strikers make very direct runs on counter
            targetPos.x = opponentGoalLineX + (this.entity.team === 'red' ? -15 : 15); // Deep run
            targetPos.z = AI_FIELD_CENTER_Z + (Math.random() * 6 - 3); // Central channel
            console.log(`${this.entity.player.username} (${this.entity.aiRole}) making FAST counter-attack run!`);
        }
        break;
      case 'central-midfielder-1':
      case 'central-midfielder-2':
        const offensiveBias = (roleDef.offensiveContribution - roleDef.defensiveContribution) / 10; 
        const supportXBase = ball.position.x + (this.entity.team === 'red' ? -10 : 10); 
        const supportX = supportXBase + (offensiveBias * 8);
        const side = this.entity.aiRole === 'central-midfielder-1' ? -1 : 1;
        const supportZ = ball.position.z + (side * Math.max(5, roleDef.supportDistance / 1.5) );
        targetPos = {
          x: (supportX + opponentGoalLineX) / 2, 
          y: this.entity.position.y,
          z: supportZ
        };
        if (isCounterAttackingRun) { // Midfielders also join counter more aggressively
            targetPos.x = ball.position.x + (this.entity.team === 'red' ? -20 : 20); // Push far forward quickly
            targetPos.z = ball.position.z + (side * 8); 
            console.log(`${this.entity.player.username} (${this.entity.aiRole}) making counter-attack support run!`);
        }
        break;
      case 'left-back':
      case 'right-back':
        if (roleDef.offensiveContribution > 4 && (this.inAttackingPhase() || isCounterAttackingRun) ) {
            const wingSide = this.entity.aiRole === 'left-back' ? -1 : 1;
            let overlapX = ball.position.x + (this.entity.team === 'red' ? - (15 - roleDef.offensiveContribution) : (15 - roleDef.offensiveContribution) );
            if(isCounterAttackingRun) { // Fullbacks join counter less deeply but quickly provide width
                overlapX = ball.position.x + (this.entity.team === 'red' ? -5 : 5); // Quick wide support
                 console.log(`${this.entity.player.username} (${this.entity.aiRole}) making counter-attack width run!`);
            }
            targetPos = {
                x: overlapX, 
                y: this.entity.position.y,
                z: AI_FIELD_CENTER_Z + (wingSide * 18) 
            };
        } else {
            targetPos = this.entity.getRoleBasedPosition(); 
        }
        break;
      default: 
        targetPos = this.entity.getRoleBasedPosition(); 
    }
    
    this.entity.targetPosition = this.entity.constrainToPreferredArea(targetPos, this.entity.aiRole);
    this.entity.targetPosition = this.entity.adjustPositionForSpacing(this.entity.targetPosition);
    
    console.log(`${this.entity.player.username} moving to open space. Target: ${targetPos.x.toFixed(1)}, ${targetPos.z.toFixed(1)}`);
    return true;
  }
  
  /**
   * Fall back to defensive position
   */
  public fallBackToDefense(): boolean {
    const ownGoalLineX = this.entity.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole];
    const ball = sharedState.getSoccerBall();
    let ballPos = ball ? ball.position : this.entity.getRoleBasedPosition();
    
    // Get opposing team players for marking decisions
    const opposingTeam = this.entity.team === 'red' ? 'blue' : 'red';
    const opponents = opposingTeam === 'red' ? sharedState.getRedAITeam() : sharedState.getBlueAITeam();
    
    // Get the attached player if any
    const attachedPlayer = sharedState.getAttachedPlayer();
    const opponentHasBall = attachedPlayer && 
                            (attachedPlayer instanceof SoccerPlayerEntity) && 
                            attachedPlayer.team !== this.entity.team;
    
    // Get all teammates for coordinated defense
    const teammates = sharedState.getAITeammates(this.entity);
    
    // Field center for positioning references
    const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
    
    // Direction from own goal (1 for red team attacking toward positive X, -1 for blue)
    const direction = this.entity.team === 'red' ? 1 : -1;
    
    // Calculate defensive line depth based on ball position
    // When ball is closer to our goal, defensive line drops deeper
    const ballDistanceFromGoal = Math.abs(ballPos.x - ownGoalLineX);
    const fieldLength = Math.abs(AI_GOAL_LINE_X_BLUE - AI_GOAL_LINE_X_RED);
    const defensiveLineDepthFactor = Math.min(0.9, Math.max(0.3, ballDistanceFromGoal / fieldLength));
    
    // Core defensive positioning logic with role-specific behaviors
    let targetPos: Vector3Like;
    const defensiveDepthFactor = roleDef.defensiveContribution / 10;
    
    // Determine if we should man-mark or zonal defend
    let shouldManMark = false;
    let playerToMark = null;
    
    // Only certain roles should consider man-marking
    if (this.entity.aiRole !== 'goalkeeper') {
      // Find threatening opponent to mark if they're in our half
      for (const opponent of opponents) {
        if (!opponent.isSpawned) continue;
        
        // Check if opponent is in our defensive half
        const opponentInOurHalf = (this.entity.team === 'red' && opponent.position.x < fieldCenterX) ||
                                  (this.entity.team === 'blue' && opponent.position.x > fieldCenterX);
                                  
        if (!opponentInOurHalf) continue;
        
        // Calculate threat level
        const distanceToOwnGoal = Math.abs(opponent.position.x - ownGoalLineX);
        const threatLevel = 30 - Math.min(30, distanceToOwnGoal);
        
        // Consider marking if threat is high enough
        if (threatLevel > 15) {
          // Check if this opponent is already being marked
          let alreadyMarked = false;
          for (const teammate of teammates) {
            if (teammate === this.entity) continue;
            if (!teammate.isSpawned) continue;
            
            // Simple distance check - if a teammate is close to this opponent, consider them marked
            if (this.entity.distanceBetween(teammate.position, opponent.position) < 5) {
              alreadyMarked = true;
              break;
            }
          }
          
          if (!alreadyMarked) {
            shouldManMark = true;
            playerToMark = opponent;
            break;
          }
        }
      }
    }
    
    // Apply role-specific defensive positioning
    switch(this.entity.aiRole) {
      case 'goalkeeper':
        const distanceToBallGK = ball ? this.entity.distanceBetween(this.entity.position, ballPos) : Infinity;
        const gkSafeZoneRadius = (roleDef.preferredArea.maxX || 12) * 1.5; // Increased from 5 to 12
        const gkInterceptReach = roleDef.interceptDistance * 1.2;
        
        // Get ball velocity for enhanced positioning
        const ballVelocity = ball ? ball.linearVelocity : { x: 0, y: 0, z: 0 };
        const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
        
        // Enhanced shot detection
        const isMovingTowardsGoal = this.entity.team === 'red' ? ballVelocity.x < -2 : ballVelocity.x > 2;
        const isFastShot = ballSpeed > 8.0;
        const isMediumShot = ballSpeed > 5.0;
        
        // Base position is always the center of goal
        let gkBaseX = ownGoalLineX + (3 * direction); // Increased from 2 to 3 units in front of goal line
        let gkBaseZ = AI_FIELD_CENTER_Z;
        
        // Enhanced positioning logic based on ball speed and direction
        if (isFastShot && isMovingTowardsGoal) {
          // Aggressive positioning for fast shots - use predictive positioning
          const predictionTime = 0.4;
          const predictedBallPos = {
            x: ballPos.x + (ballVelocity.x * predictionTime),
            z: ballPos.z + (ballVelocity.z * predictionTime)
          };
          
          // Position to cut off the angle to predicted ball position
          const ballToGoalZ = AI_FIELD_CENTER_Z - predictedBallPos.z;
          const optimalZ = AI_FIELD_CENTER_Z + (ballToGoalZ * 0.5);
          
          // Clamp to stay within enhanced goal area
          const maxGoalWidth = 9; // Increased from default
          gkBaseZ = Math.max(AI_FIELD_CENTER_Z - maxGoalWidth, Math.min(AI_FIELD_CENTER_Z + maxGoalWidth, optimalZ));
          
        } else if (distanceToBallGK < gkSafeZoneRadius && distanceToBallGK < gkInterceptReach) {
          // Position between ball and center of goal for optimal blocking angle
          const ballToGoalX = ownGoalLineX - ballPos.x;
          const ballToGoalZ = AI_FIELD_CENTER_Z - ballPos.z;
          const distance = Math.sqrt(ballToGoalX*ballToGoalX + ballToGoalZ*ballToGoalZ);
          
          if (distance > 0) {
            // Normalized vector from ball to goal
            const normX = ballToGoalX / distance;
            const normZ = ballToGoalZ / distance;
            
            // Position along this vector, closer to goal
            gkBaseX = ownGoalLineX + (normX * 3); // Increased from 2 to 3 units in front of goal line
            gkBaseZ = AI_FIELD_CENTER_Z + (normZ * 3); // Increased from 2 to 3 for better coverage
          }
        } else {
          // Ball is further away - enhanced positioning toward ball side
          const zOffset = Math.min(4, Math.max(-4, (ballPos.z - AI_FIELD_CENTER_Z) * 0.4)); // Increased response
          gkBaseZ = AI_FIELD_CENTER_Z + zOffset;
        }
        
        targetPos = {
          x: gkBaseX,
          y: this.entity.position.y,
          z: gkBaseZ
        };
        break;
        
      case 'left-back':
      case 'right-back':
        if (shouldManMark && playerToMark) {
          // Man marking - position between opponent and goal
          const toGoalX = ownGoalLineX - playerToMark.position.x;
          const toGoalZ = AI_FIELD_CENTER_Z - playerToMark.position.z;
          const distanceToGoal = Math.sqrt(toGoalX*toGoalX + toGoalZ*toGoalZ);
          
          if (distanceToGoal > 0) {
            const normX = toGoalX / distanceToGoal;
            const normZ = toGoalZ / distanceToGoal;
            
            targetPos = {
              x: playerToMark.position.x + (normX * 1.5), // Position 1.5 units toward goal
              y: this.entity.position.y,
              z: playerToMark.position.z + (normZ * 1.5)
            };
          } else {
            targetPos = playerToMark.position; // Fallback
          }
        } else {
          // Zonal defense - position based on defensive line and preferred width
          const isLeft = this.entity.aiRole === 'left-back';
          
          // Defensive line depth - varies based on ball position
          const defensiveLineX = ownGoalLineX + (15 * direction * defensiveLineDepthFactor);
          
          // Width positioning - shift toward ball side but maintain width
          const preferredZ = isLeft ? 
            AI_FIELD_CENTER_Z - (15 * defensiveLineDepthFactor) : // Left back
            AI_FIELD_CENTER_Z + (15 * defensiveLineDepthFactor);  // Right back
            
          // Shift toward ball but maintain formation
          const ballSideShift = (ballPos.z - AI_FIELD_CENTER_Z) * 0.3;
          
          targetPos = {
            x: defensiveLineX,
            y: this.entity.position.y,
            z: preferredZ + ballSideShift
          };
        }
        break;
        
      case 'central-midfielder-1':
      case 'central-midfielder-2':
        if (shouldManMark && playerToMark) {
          // Similar man marking logic as defenders
          const toGoalX = ownGoalLineX - playerToMark.position.x;
          const toGoalZ = AI_FIELD_CENTER_Z - playerToMark.position.z;
          const distanceToGoal = Math.sqrt(toGoalX*toGoalX + toGoalZ*toGoalZ);
          
          if (distanceToGoal > 0) {
            const normX = toGoalX / distanceToGoal;
            const normZ = toGoalZ / distanceToGoal;
            
            targetPos = {
              x: playerToMark.position.x + (normX * 2), // Position 2 units toward goal
              y: this.entity.position.y,
              z: playerToMark.position.z + (normZ * 2)
            };
          } else {
            targetPos = playerToMark.position; // Fallback
          }
        } else {
          // Zonal midfield defense
          const isFirstMid = this.entity.aiRole === 'central-midfielder-1';
          
          // Midfielders form a second defensive line in front of defenders
          const midFieldDefensiveX = ownGoalLineX + (25 * direction * defensiveLineDepthFactor);
          
          // More compact width for midfielders to control center
          const midFieldZ = isFirstMid ?
            AI_FIELD_CENTER_Z - (8 * defensiveLineDepthFactor) : // Left mid
            AI_FIELD_CENTER_Z + (8 * defensiveLineDepthFactor);  // Right mid
            
          // Strong shift toward ball side for midfield compactness
          const ballSideShift = (ballPos.z - AI_FIELD_CENTER_Z) * 0.4;
          
          targetPos = {
            x: midFieldDefensiveX + ((ballPos.x - midFieldDefensiveX) * 0.3), // Track ball X somewhat
            y: this.entity.position.y,
            z: midFieldZ + ballSideShift
          };
        }
        break;
        
      default: // Striker
        // Even strikers defend, but maintain higher position for counter-attacks
        if (opponentHasBall && attachedPlayer) {
          // If opponent has possession, striker drops deeper but not too deep
          const strikerDefensiveX = ownGoalLineX + (35 * direction * defensiveLineDepthFactor);
          
          // Position to cut passing lanes rather than direct marking
          targetPos = {
            x: strikerDefensiveX,
            y: this.entity.position.y,
            z: ballPos.z + (Math.random() * 6 - 3) // Slight randomization for unpredictability
          };
        } else {
          // Without clear opponent possession, maintain higher position for counters
          const counterAttackX = ownGoalLineX + (40 * direction * defensiveLineDepthFactor);
          
          targetPos = {
            x: counterAttackX,
            y: this.entity.position.y,
            z: AI_FIELD_CENTER_Z + ((ballPos.z - AI_FIELD_CENTER_Z) * 0.3) // Slight shift to ball side
          };
        }
    }
    
    // Ensure target is within field boundaries
    targetPos.x = Math.max(FIELD_MIN_X + 2, Math.min(FIELD_MAX_X - 2, targetPos.x));
    targetPos.z = Math.max(FIELD_MIN_Z + 2, Math.min(FIELD_MAX_Z - 2, targetPos.z));
    
    // Set the target position
    this.entity.targetPosition = targetPos;
    
    return true;
  }
  
  /**
   * Update method to be called from the AIPlayerEntity
   * Uses behavior tree logic to make decisions and execute actions
   */
  public update(): boolean {
    const roleDef = ROLE_DEFINITIONS[this.entity.aiRole]; 

    // Updated counter-attack eligibility: opponent must have lost possession recently
    const opponentJustLostPossession = this.opponentHadBallLastTick && !this.opponentHasBall(); 
    if(opponentJustLostPossession) { // If opponent *just* lost it (might be to me, a teammate, or out of bounds)
        this.lastPossessionChangeTime = Date.now(); // Reset timer if opponent *just* lost it
        console.log(`[COUNTER TRIGGER] Opponent lost possession. Timer reset for ${this.entity.player.username}.`);
    }
    const isEligibleForCounterAttackResponse = (Date.now() - this.lastPossessionChangeTime < this.COUNTER_ATTACK_WINDOW_MS) && !this.hasBall();

    // Attack Mode
    if (this.hasBall()) {
      console.log(`${this.entity.player.username} in Attack Mode`);
      if (this.withinShootingRange()) {
        console.log(`${this.entity.player.username} attempting to shoot.`);
        return this.shoot();
      }
      if (this.teammateBetterPositioned()) {
        console.log(`${this.entity.player.username} attempting to pass.`);
        return this.passBall();
      }
      console.log(`${this.entity.player.username} attempting to dribble.`);
      return this.dribble();
    }
    
    // Defend Mode
    if (this.opponentHasBall()) {
      console.log(`${this.entity.player.username} in Defend Mode`);
      if (roleDef.defensiveContribution > 3) { 
        const opponentEntity = sharedState.getAttachedPlayer();
        if (opponentEntity instanceof SoccerPlayerEntity && // Ensure it's a soccer player
            this.isClosestToBall() && 
            this.entity.distanceBetween(this.entity.position, opponentEntity.position) < roleDef.interceptDistance + 2) {
           console.log(`${this.entity.player.username} attempting to mark opponent ${opponentEntity.player.username}.`);
          return this.markOpponent();
        }
        if (this.ballInReach() && Math.random() < roleDef.pursuitTendency + 0.1) { 
           console.log(`${this.entity.player.username} attempting to intercept ball.`);
          return this.interceptBall();
        }
      }
      console.log(`${this.entity.player.username} falling back to defense.`);
      return this.fallBackToDefense();
    }
    
    // Positioning Mode (Loose Ball)
    console.log(`${this.entity.player.username} in Positioning Mode (Loose Ball)${isEligibleForCounterAttackResponse ? ' (Counter Eligible)' : ''}`);

    const ball = sharedState.getSoccerBall();
    if (ball) {
      const distanceToBall = this.entity.distanceBetween(this.entity.position, ball.position);
      
      // Make players go for the ball more aggressively if:
      // 1. It's the closest to the ball, or
      // 2. It's within immediate reach with higher chance of pursuit
      if (this.isClosestToBall()) {
        // As closest player, high chance to pursue ball
        console.log(`${this.entity.player.username} is closest to ball - pursuing.`);
        return this.interceptBall();
      } else if (this.ballInReach()) {
        // Not closest but ball is within reach - increased pursuit chance
        const pursueChance = roleDef.pursuitTendency + 0.3 + ((5 - roleDef.defensiveContribution) / 40);
        if (Math.random() < pursueChance) {
          console.log(`${this.entity.player.username} pursuing loose ball in reach (Chance: ${pursueChance.toFixed(2)}).`);
          return this.interceptBall();
        } else {
          console.log(`${this.entity.player.username} decided not to pursue loose ball (Chance: ${pursueChance.toFixed(2)}).`);
        }
      } else if (distanceToBall < 30 && roleDef.pursuitTendency > 0.5) {
        // Ball not in immediate reach but close enough - low chance to pursue for offensive players
        const longPursueChance = roleDef.pursuitTendency * 0.4;
        if (Math.random() < longPursueChance) {
          console.log(`${this.entity.player.username} making long pursuit attempt (Chance: ${longPursueChance.toFixed(2)}).`);
          return this.interceptBall();
        }
      }
      
      // For attackers, check if ball is in good position for making offensive runs
      const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
      const ballInOpponentHalf = 
          (this.entity.team === 'red' && ball.position.x < fieldCenterX) || 
          (this.entity.team === 'blue' && ball.position.x > fieldCenterX); 
      
      const tendencyToAttack = (roleDef.offensiveContribution - roleDef.defensiveContribution + 10) / 20;

      // If eligible for counter-attack response (opponent just lost ball, I don't have it), attackers should try to get open
      if (isEligibleForCounterAttackResponse && 
          (this.entity.aiRole === 'striker' || this.entity.aiRole === 'central-midfielder-1' || this.entity.aiRole === 'central-midfielder-2' || 
          ((this.entity.aiRole === 'left-back' || this.entity.aiRole === 'right-back') && roleDef.offensiveContribution >=5))) {
          console.log(`${this.entity.player.username} making counter-attack run/support (Role: ${this.entity.aiRole}).`);
          return this.moveToOpenSpace(); // moveToOpenSpace has role-specific counter logic
      }

      if ((this.inAttackingPhase() || ballInOpponentHalf) && Math.random() < tendencyToAttack + 0.2) {
        console.log(`${this.entity.player.username} moving to open space (Tendency: ${(tendencyToAttack + 0.2).toFixed(2)}).`);
        return this.moveToOpenSpace();
      }
    }
    
    // Default: Fall back to defensive positions
    console.log(`${this.entity.player.username} falling back to defense by default.`);
    return this.fallBackToDefense();
  }
}

export default SoccerAgent; 