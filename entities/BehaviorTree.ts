import AIPlayerEntity from "./AIPlayerEntity";
import SoccerPlayerEntity from "./SoccerPlayerEntity";
import sharedState from "../state/sharedState";
import { type Vector3Like, PlayerEntity } from "hytopia";
import { 
  AI_FIELD_CENTER_Z,
  AI_GOAL_LINE_X_RED,
  AI_GOAL_LINE_X_BLUE,
  AI_FIELD_CENTER_X,
  FIELD_MIN_X,
  FIELD_MAX_X,
  FIELD_MIN_Z,
  FIELD_MAX_Z
} from '../state/gameConfig';

/**
 * Behavior Tree Implementation
 * This provides a structured and maintainable way to organize AI decision making
 */

// Base class for all behavior tree nodes
export abstract class BehaviorNode {
  // Execute the behavior node and return success or failure
  abstract execute(agent: AIPlayerEntity): boolean;
}

// Selector: Executes children until one succeeds (OR logic)
export class Selector extends BehaviorNode {
  constructor(private children: BehaviorNode[]) {
    super();
  }

  execute(agent: AIPlayerEntity): boolean {
    for (const child of this.children) {
      if (child.execute(agent)) {
        return true; // Success if any child succeeds
      }
    }
    return false; // Fail if all children fail
  }
}

// Sequence: Executes children until one fails (AND logic)
export class Sequence extends BehaviorNode {
  constructor(private children: BehaviorNode[]) {
    super();
  }

  execute(agent: AIPlayerEntity): boolean {
    for (const child of this.children) {
      if (!child.execute(agent)) {
        return false; // Fail if any child fails
      }
    }
    return true; // Success if all children succeed
  }
}

// Condition node: Check if a condition is true
export class Condition extends BehaviorNode {
  constructor(private condition: (agent: AIPlayerEntity) => boolean) {
    super();
  }

  execute(agent: AIPlayerEntity): boolean {
    return this.condition(agent);
  }
}

// Action node: Perform an action
export class Action extends BehaviorNode {
  constructor(private action: (agent: AIPlayerEntity) => boolean) {
    super();
  }

  execute(agent: AIPlayerEntity): boolean {
    return this.action(agent);
  }
}

/**
 * Creates a behavior tree for an AI player
 * @param agent The AI player entity
 * @returns The behavior tree root node
 */
export function createBehaviorTree(agent: AIPlayerEntity): BehaviorNode {
  // Create behavior tree based on role and structure outlined in the diagram
  return new Selector([
    // Attack Mode (Has Ball?)
    new Sequence([
      new Condition((agent: AIPlayerEntity) => {
        // Has Ball check
        const attachedPlayer = sharedState.getAttachedPlayer();
        return attachedPlayer === agent;
      }),
      new Selector([
        // Shoot (Within Scoring Range?)
        new Sequence([
          new Condition((agent: AIPlayerEntity) => {
            // Within Shooting Range check
            const opponentGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
            const goalPosition = { x: opponentGoalLineX, y: 1, z: AI_FIELD_CENTER_Z }; // y:1 is a reference height
            
            // Shooting range depends on role (strikers have longer range)
            let maxShootingRange = agent.aiRole === 'striker' ? 20 : 15;
            
            // **STAMINA CONSIDERATION**: Reduce shooting range when stamina is low
            const staminaPercentage = agent.getStaminaPercentage();
            if (staminaPercentage < 30) {
              maxShootingRange *= 0.7; // Reduce range by 30% when stamina is low
            } else if (staminaPercentage < 50) {
              maxShootingRange *= 0.85; // Reduce range by 15% when stamina is moderate
            }
            
            const distanceToGoal = agent.distanceBetween(agent.position, goalPosition);
            
            return distanceToGoal < maxShootingRange;
          }),
          new Action((agent: AIPlayerEntity) => {
            // Shoot Ball action
            const opponentGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
            const goalTargetPoint: Vector3Like = { 
                x: opponentGoalLineX, 
                y: 1, // Reference height for aiming at goal
                z: AI_FIELD_CENTER_Z 
            };
            const shotPower = 1.2; // Increased power multiplier for effective AI shooting
            const success = agent.shootBall(goalTargetPoint, shotPower);
            if (success) {
                console.log(`${agent.player.username} (BT) shooting at goal! Target: (${goalTargetPoint.x.toFixed(1)}, ${goalTargetPoint.z.toFixed(1)})`);
            } else {
                console.log(`${agent.player.username} (BT) failed to execute shootBall command.`);
            }
            return success;
          })
        ]),
        // Pass (Teammate Better Positioned?)
        new Sequence([
          new Condition((agent: AIPlayerEntity) => {
            // Teammate Better Positioned check
            const teammates = sharedState.getAITeammates(agent).filter(t => t.isSpawned && t !== agent); // Ensure not passing to self
            if (teammates.length === 0) return false;
            
            const opponentGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
            const goalPosition = { x: opponentGoalLineX, y: 1, z: AI_FIELD_CENTER_Z };
            
            for (const teammate of teammates) {
              const isForward = (agent.team === 'red' && teammate.position.x > agent.position.x) || 
                              (agent.team === 'blue' && teammate.position.x < agent.position.x);
              if (!isForward) continue; // Only consider forward teammates for this simple check
              
              const teammateDistanceToGoal = agent.distanceBetween(teammate.position, goalPosition);
              const myDistanceToGoal = agent.distanceBetween(agent.position, goalPosition);
              
              if (teammateDistanceToGoal < myDistanceToGoal * 0.9) { // Teammate is noticeably closer
                return true;
              }
            }
            return false;
          }),
          new Action((agent: AIPlayerEntity) => {
            // Pass Ball action
            // Get AI teammates
            const aiTeammates = sharedState.getAITeammates(agent).filter(t => t.isSpawned && t !== agent);
            let allTeammates: SoccerPlayerEntity[] = [...aiTeammates];
            
            // Add human players to teammates list
            if (agent.world) {
              const allPlayerEntities = agent.world.entityManager.getAllPlayerEntities();
              for (const playerEntity of allPlayerEntities) {
                if (playerEntity instanceof SoccerPlayerEntity && 
                    playerEntity !== agent && 
                    playerEntity.team === agent.team && 
                    playerEntity.isSpawned && 
                    !playerEntity.isPlayerFrozen &&
                    !(playerEntity instanceof AIPlayerEntity)) { // Only add human players
                  allTeammates.push(playerEntity);
                }
              }
            }
            
            if (allTeammates.length === 0) return false;
            
            const opponentGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
            let bestTeammate: PlayerEntity | null = null;
            let bestScore = -Infinity;
            
            for (const teammate of allTeammates) {
              if (agent.distanceBetween(agent.position, teammate.position) < 2) continue; // Too close

              const distanceToGoal = agent.distanceBetween(
                teammate.position, 
                { x: opponentGoalLineX, y: 1, z: AI_FIELD_CENTER_Z }
              );
              const forwardProgress = (agent.team === 'red' ? teammate.position.x - agent.position.x : agent.position.x - teammate.position.x);
              if (forwardProgress < 1) continue; // Must be a forward pass for this basic BT logic

              let spaceScore = 10;
              // Get opponents by fetching the correct AI team list from sharedState
              const opponentTeamName = agent.team === 'red' ? 'blue' : 'red';
              const opponents: AIPlayerEntity[] = opponentTeamName === 'red' ? sharedState.getRedAITeam() : sharedState.getBlueAITeam();
              
              for (const opponent of opponents) {
                if (!opponent.isSpawned) continue; // Still good to check if they are spawned
                const distanceToOpponent = agent.distanceBetween(teammate.position, opponent.position);
                if (distanceToOpponent < 5) spaceScore -= 4; // Heavily penalize close opponents
                else if (distanceToOpponent < 10) spaceScore -= 2;
              }
              spaceScore = Math.max(0, spaceScore); // Ensure not negative

              const score = (50 - distanceToGoal) + (forwardProgress * 2) + spaceScore + (Math.random() * 5);
              
              // HUMAN PLAYER PRIORITY: Give human players massive bonus to ensure they always receive passes
              let finalScore = score;
              if (!(teammate instanceof AIPlayerEntity)) {
                finalScore += 200; // Huge bonus for human players - this ensures they're always prioritized
                console.log(`${agent.player.username} (BT) prioritizing human player ${teammate.player.username} for pass`);
              }
              
              if (finalScore > bestScore) {
                bestScore = finalScore;
                bestTeammate = teammate;
              }
            }
            
            if (bestTeammate) {
              // Calculate a point slightly ahead of the teammate to lead the pass
              const leadFactor = 2.5; // How many units ahead to pass
              const dirToTeammateX = bestTeammate.position.x - agent.position.x;
              const dirToTeammateZ = bestTeammate.position.z - agent.position.z;
              const distToTeammate = Math.sqrt(dirToTeammateX * dirToTeammateX + dirToTeammateZ * dirToTeammateZ);
              
              let passToPoint: Vector3Like;
              if (distToTeammate > 0.1) {
                const normDirX = dirToTeammateX / distToTeammate;
                const normDirZ = dirToTeammateZ / distToTeammate;
                passToPoint = {
                  x: bestTeammate.position.x + normDirX * leadFactor,
                  y: bestTeammate.position.y, // Aim for teammate's current y-level
                  z: bestTeammate.position.z + normDirZ * leadFactor,
                };
              } else {
                passToPoint = bestTeammate.position; // Pass directly if very close
              }
              const passPower = 1.0; // Default power multiplier
              const success = agent.forcePass(bestTeammate, passToPoint, passPower);
              if (success) {
                  console.log(`${agent.player.username} (BT) passing to ${bestTeammate.player.username} -> (${passToPoint.x.toFixed(1)}, ${passToPoint.z.toFixed(1)})`);
              } else {
                  console.log(`${agent.player.username} (BT) failed to execute forcePass command to ${bestTeammate.player.username}.`);
              }
              return success;
            }
            
            // If no strategic pass target found by BT, return false. AIPlayerEntity.passBall() is not called from here.
            console.log(`${agent.player.username} (BT) - Pass Action: No suitable teammate found for strategic pass.`);
            return false;
          })
        ]),
        // Dribble Forward
        new Action((agent: AIPlayerEntity) => {
          // Dribble action
          // Calculate direction toward opponent's goal
          const opponentGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
          
          // Dribble slightly diagonally to avoid defenders directly ahead
          const randomZ = Math.random() * 8 - 4; // Random value between -4 and 4
          
          agent.targetPosition = {
            x: opponentGoalLineX,
            y: agent.position.y,
            z: agent.position.z + randomZ
          };
          
          console.log(`${agent.player.username} dribbling forward`);
          return true;
        })
      ])
    ]),
    
    // Defend Mode (Opponent Has Ball?)
    new Sequence([
      new Condition((agent: AIPlayerEntity) => {
        // Opponent Has Ball check
        const attachedPlayer = sharedState.getAttachedPlayer();
        return attachedPlayer instanceof SoccerPlayerEntity && attachedPlayer.team !== agent.team;
      }),
      new Selector([
        // Mark Opponent (Closest to Ball?)
        new Sequence([
          new Condition((agent: AIPlayerEntity) => {
            // Closest to Ball check
            return agent.isClosestTeammateToPosition(
              sharedState.getSoccerBall()?.position || { x: 0, y: 0, z: 0 }
            );
          }),
          new Action((agent: AIPlayerEntity) => {
            // Mark Opponent action
            // Find opponent with ball
            const attachedPlayer = sharedState.getAttachedPlayer();
            if (attachedPlayer instanceof SoccerPlayerEntity && attachedPlayer.team !== agent.team) {
              // Move to position slightly goal-side of opponent with ball
              const goalSideOffset = agent.team === 'red' ? -2 : 2;
              
              agent.targetPosition = {
                x: attachedPlayer.position.x + goalSideOffset,
                y: agent.position.y,
                z: attachedPlayer.position.z
              };
              
              console.log(`${agent.player.username} marking opponent with ball`);
              return true;
            }
            
            // If no opponent has ball, maintain defensive position
            return false;
          })
        ]),
        // SPECIAL CASE: Retrieve Stuck Ball from Corners/Boundaries
        new Sequence([
          new Condition((agent: AIPlayerEntity) => {
            // Check if ball is stuck in corner/boundary area
            const ball = sharedState.getSoccerBall();
            if (!ball) return false;
            
            const ballPosition = ball.position;
            const ballVelocity = ball.linearVelocity;
            
            // Check if ball is near boundaries
            const BOUNDARY_THRESHOLD = 12; // Distance from field edge to consider "near boundary"
            const nearMinX = Math.abs(ballPosition.x - FIELD_MIN_X) < BOUNDARY_THRESHOLD;
            const nearMaxX = Math.abs(ballPosition.x - FIELD_MAX_X) < BOUNDARY_THRESHOLD;
            const nearMinZ = Math.abs(ballPosition.z - FIELD_MIN_Z) < BOUNDARY_THRESHOLD;
            const nearMaxZ = Math.abs(ballPosition.z - FIELD_MAX_Z) < BOUNDARY_THRESHOLD;
            
            const isNearBoundary = nearMinX || nearMaxX || nearMinZ || nearMaxZ;
            const isInCorner = (nearMinX || nearMaxX) && (nearMinZ || nearMaxZ);
            
            // Check if ball is stationary or nearly stationary
            const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
            const isStuck = ballSpeed < 0.5; // Very slow movement indicates stuck ball
            
            // Check if no one has the ball (it's loose)
            const ballIsLoose = !sharedState.getAttachedPlayer();
            
            // Special condition: Ball is stuck near boundary and no one has it
            if (isNearBoundary && isStuck && ballIsLoose) {
              const distanceToBall = agent.distanceBetween(agent.position, ballPosition);
              
              // Allow much more aggressive pursuit for stuck balls
              let maxRetrievalDistance = 35; // Base distance for boundary balls
              if (isInCorner) {
                maxRetrievalDistance = 45; // Even more aggressive for corner balls
              }
              
              // Be one of the closest players to the stuck ball
              const teammates = agent.getVisibleTeammates();
              let playersCloser = 0;
              
              for (const teammate of teammates) {
                if (teammate instanceof AIPlayerEntity && teammate.isSpawned) {
                  const teammateDistance = agent.distanceBetween(teammate.position, ballPosition);
                  if (teammateDistance < distanceToBall) {
                    playersCloser++;
                  }
                }
              }
              
              // Allow up to 2 players to go after stuck balls (closest 2)
              const shouldPursue = playersCloser < 2 && distanceToBall < maxRetrievalDistance;
              
              if (shouldPursue) {
                console.log(`${agent.player.username} (${agent.aiRole}) pursuing stuck ball in ${isInCorner ? 'corner' : 'boundary'} area (distance: ${distanceToBall.toFixed(1)})`);
                return true;
              }
            }
            
            return false;
          }),
          new Action((agent: AIPlayerEntity) => {
            // Retrieve Stuck Ball action
            const ball = sharedState.getSoccerBall();
            if (!ball) return false;
            
            // Go directly to the ball position with no anticipation since it's stuck
            agent.targetPosition = {
              x: ball.position.x,
              y: agent.position.y,
              z: ball.position.z
            };
            
            console.log(`${agent.player.username} retrieving stuck ball at (${ball.position.x.toFixed(1)}, ${ball.position.z.toFixed(1)})`);
            return true;
          })
        ]),
        // Intercept Ball (In Reach?)
        new Sequence([
          new Condition((agent: AIPlayerEntity) => {
            // Ball In Reach check
            const ball = sharedState.getSoccerBall();
            if (!ball) return false;
            
            const distanceToBall = agent.distanceBetween(agent.position, ball.position);
            
            // Different roles have different interception distances
            let interceptDistance = 5; // Default
            
            switch (agent.aiRole) {
              case 'goalkeeper':
                interceptDistance = 4;
                break;
              case 'left-back':
              case 'right-back':
                interceptDistance = 6;
                break;
              case 'central-midfielder-1':
              case 'central-midfielder-2':
                interceptDistance = 8;
                break;
              case 'striker':
                interceptDistance = 10;
                break;
            }
            
            return distanceToBall < interceptDistance;
          }),
          new Action((agent: AIPlayerEntity) => {
            // Intercept Ball action
            const ball = sharedState.getSoccerBall();
            if (!ball) return false;
            
            // Improved ball velocity anticipation with role-specific factors
            const ballVelocity = ball.linearVelocity;
            
            // Determine base anticipation factor by role
            // Forwards anticipate more aggressively, defenders more conservatively
            let BALL_ANTICIPATION_FACTOR = 1.5; // Default value
            
            switch (agent.aiRole) {
              case 'goalkeeper':
                BALL_ANTICIPATION_FACTOR = 1.2; // Goalkeepers are more conservative
                break;
              case 'left-back':
              case 'right-back':
                BALL_ANTICIPATION_FACTOR = 1.4; // Defenders slightly conservative
                break;
              case 'central-midfielder-1':
              case 'central-midfielder-2':
                BALL_ANTICIPATION_FACTOR = 1.7; // Midfielders anticipate more
                break;
              case 'striker':
                BALL_ANTICIPATION_FACTOR = 2.0; // Strikers most aggressive in anticipation
                break;
            }
            
            // Calculate ball speed to adjust anticipation
            const ballSpeed = Math.sqrt(
              ballVelocity.x * ballVelocity.x + 
              ballVelocity.z * ballVelocity.z
            );
            
            // Adjust anticipation based on ball speed
            // For faster balls, increase anticipation to get to where the ball will be
            // For slower balls, reduce anticipation to avoid overshooting
            const speedAdjustedFactor = 
              ballSpeed > 10 ? BALL_ANTICIPATION_FACTOR * 1.2 :  // Fast ball
              ballSpeed > 5 ? BALL_ANTICIPATION_FACTOR :         // Medium ball
              BALL_ANTICIPATION_FACTOR * 0.8;                    // Slow ball
            
            // Determine if the ball is in the air
            const ballInAir = ball.position.y > 1.0;
            
            // Calculate target interception point
            let interceptPosition: Vector3Like;
            
            if (ballVelocity && (Math.abs(ballVelocity.x) > 0.5 || Math.abs(ballVelocity.z) > 0.5)) {
              // Ball is moving - anticipate its path
              interceptPosition = {
                x: ball.position.x + (ballVelocity.x * speedAdjustedFactor),
                y: ballInAir ? ball.position.y : agent.position.y, // Adjust Y if ball in air
                z: ball.position.z + (ballVelocity.z * speedAdjustedFactor)
              };
              
              // Enhanced logic for goalkeepers with improved movement range
              if (agent.aiRole === 'goalkeeper') {
                // Enhanced goalkeeper movement with larger goal area coverage
                const ownGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
                const maxGKDistance = 12; // Increased from 8 to 12 for better coverage
                const direction = agent.team === 'red' ? 1 : -1; // Direction from goal
                
                // Constrain X position to stay within enhanced goal area
                const maxX = ownGoalLineX + (maxGKDistance * direction);
                if ((agent.team === 'red' && interceptPosition.x > maxX) || 
                    (agent.team === 'blue' && interceptPosition.x < maxX)) {
                  interceptPosition.x = maxX;
                }
                
                // Enhanced Z constraint for better goal coverage
                const goalCenterZ = AI_FIELD_CENTER_Z;
                const maxGoalWidth = 10; // Increased from implicit smaller value
                interceptPosition.z = Math.max(goalCenterZ - maxGoalWidth, 
                                             Math.min(goalCenterZ + maxGoalWidth, interceptPosition.z));
              }
            } else {
              // Ball not moving fast - go directly to it with slight lead
              // For attackers, get slightly ahead of the ball
              const attackDirection = agent.team === 'red' ? 1 : -1; // Direction of attack
              const forwardOffset = (agent.aiRole === 'striker') ? 
                                    0.5 * attackDirection : // Strikers get ahead of the ball
                                    0;                      // Others go direct
                                    
              interceptPosition = {
                x: ball.position.x + forwardOffset,
                y: agent.position.y,
                z: ball.position.z
              };
            }
            
            // Consider nearby opponents when intercepting
            const opponentTeamName = agent.team === 'red' ? 'blue' : 'red';
            const opponents = opponentTeamName === 'red' ? 
                               sharedState.getRedAITeam() : 
                               sharedState.getBlueAITeam();
            
            // Check for close opponents - adjust intercept point if needed
            let nearestOpponentDistance = Infinity;
            let nearestOpponent = null;
            
            for (const opponent of opponents) {
              if (!opponent.isSpawned) continue;
              
              const distance = agent.distanceBetween(interceptPosition, opponent.position);
              if (distance < nearestOpponentDistance) {
                nearestOpponentDistance = distance;
                nearestOpponent = opponent;
              }
            }
            
            // If opponent is very close to intercept point, adjust to cut off passing lane
            if (nearestOpponent && nearestOpponentDistance < 3) {
              // Calculate vector from ball to opponent
              const toOpponentX = nearestOpponent.position.x - ball.position.x;
              const toOpponentZ = nearestOpponent.position.z - ball.position.z;
              
              // Normalize the vector (create a unit vector in that direction)
              const distance = Math.sqrt(toOpponentX * toOpponentX + toOpponentZ * toOpponentZ);
              const normalizedX = toOpponentX / distance;
              const normalizedZ = toOpponentZ / distance;
              
              // Position slightly to cut passing lane (perpendicular to opponent direction)
              interceptPosition = {
                x: ball.position.x - normalizedZ, // Perpendicular direction
                y: agent.position.y,
                z: ball.position.z + normalizedX  // Perpendicular direction
              };
            }
            
            // Set final target with all adjustments
            agent.targetPosition = interceptPosition;
            
            console.log(`${agent.player.username} intercepting ball with anticipation factor ${speedAdjustedFactor.toFixed(1)}`);
            return true;
          })
        ])
      ])
    ]),
    
    // Positioning Mode (No Possession)
    new Selector([
      // Move to Open Space (On Attack)
      new Sequence([
        new Condition((agent: AIPlayerEntity) => {
          // In Attacking Phase check
          const ball = sharedState.getSoccerBall();
          if (!ball) return false;
          
          const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
          
          // If red team and ball is past midfield toward blue goal, or
          // if blue team and ball is past midfield toward red goal
          return (agent.team === 'red' && ball.position.x > fieldCenterX) ||
                (agent.team === 'blue' && ball.position.x < fieldCenterX);
        }),
        new Action((agent: AIPlayerEntity) => {
          // Move to Open Space action
          const opponentGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
          const ball = sharedState.getSoccerBall();
          if (!ball) return false;
          
          // Find positioning based on role
          let targetPos: Vector3Like;
          
          // Ball side overloading - determine which side of the field the ball is on
          const ballSide = ball.position.z > AI_FIELD_CENTER_Z ? 'right' : 'left';
          const ballDistance = agent.distanceBetween(agent.position, ball.position);
          
          // Get all teammates for spacing calculations
          const teammates = sharedState.getAITeammates(agent);
          
          // Base position from role
          const basePos = agent.getRoleBasedPosition();
          
          // Overloading factor - how much to shift towards the ball side
          let overloadingFactor = 0.4; // Default shift 
          
          // Adjust based on role - some roles should overload more than others
          if (agent.aiRole === 'striker') {
            overloadingFactor = 0.5; // Strikers overload more to get into scoring positions
          } else if (agent.aiRole === 'central-midfielder-1' || agent.aiRole === 'central-midfielder-2') {
            overloadingFactor = 0.6; // Midfielders overload significantly to control the ball side
          } else if (agent.aiRole === 'left-back' || agent.aiRole === 'right-back') {
            // Fullbacks overload based on which side they play and where the ball is
            const isLeftBack = agent.aiRole === 'left-back';
            const ballOnSameSide = (isLeftBack && ballSide === 'left') || (!isLeftBack && ballSide === 'right');
            
            if (ballOnSameSide) {
              overloadingFactor = 0.7; // Significantly overload when ball is on their side
            } else {
              overloadingFactor = 0.3; // Stay wider when ball is on opposite side for balance
            }
          } else if (agent.aiRole === 'goalkeeper') {
            overloadingFactor = 0.2; // Goalkeepers shift slightly based on ball position
          }
          
          // Calculate Z shift based on ball position and overloading factor
          const zShift = (ball.position.z - AI_FIELD_CENTER_Z) * overloadingFactor;
          
          // Get forward position based on role
          const forwardPositionX = (() => {
            const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
            const attackDirection = agent.team === 'red' ? 1 : -1; // Red attacks positive X, Blue negative X
            
            switch(agent.aiRole) {
              case 'goalkeeper':
                return basePos.x; // Goalkeeper maintains position
              case 'left-back':
              case 'right-back':
                // Backs position based on ball position - move forward if ball is advanced
                const isAttackingHalf = (agent.team === 'red' && ball.position.x > fieldCenterX) || 
                                       (agent.team === 'blue' && ball.position.x < fieldCenterX);
                return isAttackingHalf ? 
                  basePos.x + (10 * attackDirection) : // More advanced when team has possession in attacking half
                  basePos.x; // Base position when defending
              case 'central-midfielder-1':
              case 'central-midfielder-2':
                // Midfielders adjust based on ball position
                return basePos.x + ((ball.position.x - fieldCenterX) * 0.3 * attackDirection);
              case 'striker':
                // Striker makes intelligent runs based on ball position
                const ballMoveForward = (agent.team === 'red' && ball.linearVelocity.x > 0) || 
                                       (agent.team === 'blue' && ball.linearVelocity.x < 0);
                return ballMoveForward ? 
                  basePos.x + (5 * attackDirection) : // Run in behind when ball is moving forward
                  basePos.x - (5 * attackDirection);  // Drop deeper to receive when ball is moving back
              default:
                return basePos.x;
            }
          })();
          
          // Calculate final position with spacing awareness
          let finalZ = basePos.z + zShift;
          
          // Avoid bunching - check if teammates are too close and adjust
          const MIN_TEAMMATE_DISTANCE = 5; // Minimum distance to maintain between teammates
          let needsAdjustment = false;
          
          for (const teammate of teammates) {
            if (!teammate.isSpawned || teammate === agent) continue;
            
            // Check proposed position against teammate positions
            const proposedPosition = { x: forwardPositionX, y: agent.position.y, z: finalZ };
            const distanceToTeammate = agent.distanceBetween(proposedPosition, teammate.position);
            
            if (distanceToTeammate < MIN_TEAMMATE_DISTANCE) {
              needsAdjustment = true;
              break;
            }
          }
          
          // Adjust position if too close to teammates
          if (needsAdjustment) {
            // Try alternative positions with slight offsets
            const offsets = [-MIN_TEAMMATE_DISTANCE, MIN_TEAMMATE_DISTANCE, 
                             -MIN_TEAMMATE_DISTANCE * 1.5, MIN_TEAMMATE_DISTANCE * 1.5];
            
            for (const offset of offsets) {
              const adjustedZ = finalZ + offset;
              let validPosition = true;
              
              // Check each adjusted position against all teammates
              for (const teammate of teammates) {
                if (!teammate.isSpawned || teammate === agent) continue;
                
                const adjustedPosition = { x: forwardPositionX, y: agent.position.y, z: adjustedZ };
                const distanceToTeammate = agent.distanceBetween(adjustedPosition, teammate.position);
                
                if (distanceToTeammate < MIN_TEAMMATE_DISTANCE) {
                  validPosition = false;
                  break;
                }
              }
              
              if (validPosition) {
                finalZ = adjustedZ;
                break;
              }
            }
          }
          
          // Set final target position with all adjustments
          targetPos = {
            x: forwardPositionX,
            y: agent.position.y,
            z: finalZ
          };
          
          // Clamp position to ensure it's within field boundaries
          targetPos.x = Math.max(FIELD_MIN_X + 2, Math.min(FIELD_MAX_X - 2, targetPos.x));
          targetPos.z = Math.max(FIELD_MIN_Z + 2, Math.min(FIELD_MAX_Z - 2, targetPos.z));
          
          agent.targetPosition = targetPos;
          
          console.log(`${agent.player.username} moving to open space at [${targetPos.x.toFixed(1)}, ${targetPos.z.toFixed(1)}]`);
          return true;
        })
      ]),
      // Fall Back to Defense
      new Action((agent: AIPlayerEntity) => {
        // Fall Back to Defense action
        const ownGoalLineX = agent.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
        
        // Calculate defensive position based on role
        let targetPos: Vector3Like;
        
        switch(agent.aiRole) {
          case 'goalkeeper':
            // Stay on goal line
            targetPos = {
              x: ownGoalLineX + (agent.team === 'red' ? 1 : -1),
              y: agent.position.y,
              z: AI_FIELD_CENTER_Z
            };
            break;
          case 'left-back':
          case 'right-back':
            // Get to defensive line
            const side = agent.aiRole === 'left-back' ? -1 : 1;
            targetPos = {
              x: ownGoalLineX + (agent.team === 'red' ? 5 : -5),
              y: agent.position.y,
              z: AI_FIELD_CENTER_Z + (side * 10)
            };
            break;
          default:
            // Return to formation position
            targetPos = agent.getRoleBasedPosition();
        }
        
        // Apply constraints
        agent.targetPosition = agent.constrainToPreferredArea(targetPos, agent.aiRole);
        agent.targetPosition = agent.adjustPositionForSpacing(agent.targetPosition);
        
        console.log(`${agent.player.username} falling back to defense`);
        return true;
      })
    ])
  ]);
} 