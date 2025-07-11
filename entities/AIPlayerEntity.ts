import { Entity, PlayerEntity, World, EntityEvent, type Vector3Like } from "hytopia";
import SoccerPlayerEntity from "./SoccerPlayerEntity";
import sharedState from "../state/sharedState";
import { getDirectionFromRotation } from "../utils/direction";
import PlayerEntityController from "../controllers/SoccerPlayerController";
import SoccerAgent from './SoccerAgent';
import { getCurrentModeConfig } from "../state/gameModes";
// Import the new constants reflecting swapped X/Z
import {
  AI_FIELD_CENTER_X, // Added new Field Center X
  AI_FIELD_CENTER_Z, // Center is now Z
  AI_GOAL_LINE_X_RED, // Goal lines are now X
  AI_GOAL_LINE_X_BLUE,
  AI_DEFENSIVE_OFFSET_X, // Depths/Offsets are now X
  AI_MIDFIELD_OFFSET_X,
  AI_FORWARD_OFFSET_X, 
  AI_WIDE_Z_BOUNDARY_MAX, // Boundaries are now Z
  AI_WIDE_Z_BOUNDARY_MIN,
  AI_MIDFIELD_Z_BOUNDARY_MAX,
  AI_MIDFIELD_Z_BOUNDARY_MIN,
  // Import new global field boundaries
  FIELD_MIN_X,
  FIELD_MAX_X,
  FIELD_MIN_Y,
  FIELD_MAX_Y,
  FIELD_MIN_Z,
  FIELD_MAX_Z,
  SAFE_SPAWN_Y
} from '../state/gameConfig';
// Import the behavior tree components and creation function
import { BehaviorNode, createBehaviorTree } from './BehaviorTree';

// Define the specific roles for the 6v6 setup
export type SoccerAIRole = 
  | 'goalkeeper' 
  | 'left-back' 
  | 'right-back' 
  | 'central-midfielder-1' 
  | 'central-midfielder-2' 
  | 'striker';

/**
 * Enhanced role definitions based on detailed soccer position descriptions
 * These will help guide AI behavior to better match real soccer positions
 */
export interface RoleDefinition {
  name: string;               // Human-readable name
  description: string;        // Brief description of the role
  primaryDuties: string[];    // Main responsibilities
  defensiveContribution: number;  // 0-10 scale, how much they focus on defense
  offensiveContribution: number;  // 0-10 scale, how much they focus on offense
  preferredArea: {            // Areas of the field they prefer to operate in
    minX: number;             // Minimum X value (closest to own goal)
    maxX: number;             // Maximum X value (furthest from own goal) 
    minZ: number;             // Minimum Z value (left side of field)
    maxZ: number;             // Maximum Z value (right side of field)
  };
  pursuitTendency: number;    // 0-1 probability scale for pursuing the ball
  positionRecoverySpeed: number; // 0-1 scale, how quickly they return to position
  supportDistance: number;     // How close they stay to teammates with the ball
  interceptDistance: number;   // How far they'll move to intercept passes
}

// Define role characteristics for each position to guide AI behavior
export const ROLE_DEFINITIONS: Record<SoccerAIRole, RoleDefinition> = {
  'goalkeeper': {
    name: 'Goalkeeper',
    description: 'Defends the goal, organizes defense, initiates counterattacks',
    primaryDuties: [
      'Block shots on goal',
      'Command defensive line',
      'Distribute ball after saves'
    ],
    defensiveContribution: 10,
    offensiveContribution: 1,
    preferredArea: {
      minX: -12,  // Increased from -8 to -12 for better coverage
      maxX: 12,   // Increased from 8 to 12 for better coverage
      minZ: -15,  // Increased goal width coverage
      maxZ: 9     // Increased goal width coverage
    },
    pursuitTendency: 0.7,       // Increased from 0.4 for more aggressive ball pursuit
    positionRecoverySpeed: 1.2, // Increased from 0.95 for faster return to position
    supportDistance: 0.5,        // Stays close to goal
    interceptDistance: 18        // Increased from 10 to 18 for better reach
  },
  'left-back': {
    name: 'Left Back',
    description: 'Defends left flank, supports attacks down left side',
    primaryDuties: [
      'Defend against opposition right winger',
      'Support midfield in build-up play',
      'Provide width in attack occasionally'
    ],
    defensiveContribution: 8,
    offensiveContribution: 5,
    preferredArea: {
      minX: -25, // Stay within defensive third
      maxX: 30,  // Can support attacks to midfield
      minZ: -30, // Left side coverage (within field bounds Z: -33 to 26)
      maxZ: -8   // Stay on left side of field
    },
    pursuitTendency: 0.6,       // Increased for more aggressive ball recovery
    positionRecoverySpeed: 0.7,  // Keep current
    supportDistance: 10,         // Keep current
    interceptDistance: 15        // Increased for corner coverage
  },
  'right-back': {
    name: 'Right Back',
    description: 'Defends right flank, supports attacks down right side',
    primaryDuties: [
      'Defend against opposition left winger',
      'Support midfield in build-up play',
      'Provide width in attack occasionally'
    ],
    defensiveContribution: 8,
    offensiveContribution: 5,
    preferredArea: {
      minX: -25, // Stay within defensive third
      maxX: 30,  // Can support attacks to midfield
      minZ: 2,   // Stay on right side of field
      maxZ: 23   // Right side coverage (within field bounds Z: -33 to 26)
    },
    pursuitTendency: 0.6,       // Increased for more aggressive ball recovery
    positionRecoverySpeed: 0.7,  // Keep current
    supportDistance: 10,         // Keep current
    interceptDistance: 15        // Increased for corner coverage
  },
  'central-midfielder-1': {
    name: 'Left Central Midfielder',
    description: 'Controls central areas, links defense to attack on left side',
    primaryDuties: [
      'Link defense to attack',
      'Control central area of pitch',
      'Support both defensive and offensive phases'
    ],
    defensiveContribution: 6,
    offensiveContribution: 7,
    preferredArea: {
      minX: -20, // Can drop back to help defense
      maxX: 35,  // Can push forward for attacks
      minZ: -20, // Left-center coverage
      maxZ: 5    // Overlap slightly with right midfielder
    },
    pursuitTendency: 0.75,      // Increased to be more active in transitions
    positionRecoverySpeed: 0.6,  // Keep current
    supportDistance: 15,         // Increased support distance
    interceptDistance: 18        // Increased for wider coverage
  },
  'central-midfielder-2': {
    name: 'Right Central Midfielder',
    description: 'Controls central areas, links defense to attack on right side',
    primaryDuties: [
      'Link defense to attack',
      'Control central area of pitch',
      'Support both defensive and offensive phases'
    ],
    defensiveContribution: 6,
    offensiveContribution: 7,
    preferredArea: {
      minX: -20, // Can drop back to help defense
      maxX: 35,  // Can push forward for attacks
      minZ: -11, // Overlap slightly with left midfielder
      maxZ: 20   // Right-center coverage
    },
    pursuitTendency: 0.75,      // Increased to be more active in transitions
    positionRecoverySpeed: 0.6,  // Keep current
    supportDistance: 15,         // Increased support distance
    interceptDistance: 18        // Increased for wider coverage
  },
  'striker': {
    name: 'Striker',
    description: 'Main goal threat, leads pressing, creates space for others',
    primaryDuties: [
      'Score goals',
      'Hold up play',
      'Press opposition defenders',
      'Create space for midfielders'
    ],
    defensiveContribution: 3,
    offensiveContribution: 10,
    preferredArea: {
      minX: -10, // Can drop back to midfield
      maxX: 45,  // Can push to attacking third
      minZ: -18, // Wide attacking coverage
      maxZ: 12   // Wide attacking coverage
    },
    pursuitTendency: 0.85,      // Very aggressive pursuit for pressing
    positionRecoverySpeed: 0.5,  // Keep current
    supportDistance: 15,         // Keep current
    interceptDistance: 15        // Increased for wider coverage
  }
};

// Constants for AI behavior (can be refined later)
const TEAMMATE_REPULSION_DISTANCE = 9.0;  // Increased from 7.5 for better spacing
const TEAMMATE_REPULSION_STRENGTH = 0.8; // Increased from 0.65 for stronger spacing
const BALL_ANTICIPATION_FACTOR = 1.5;     // Keep current

// Enhanced position discipline - these control how strongly players stick to their positions
const POSITION_DISCIPLINE_FACTOR = {
  'goalkeeper': 0.95,     // Goalkeepers stay very close to their position
  'left-back': 0.8,       // Defenders maintain formation
  'right-back': 0.8,      // Defenders maintain formation
  'central-midfielder-1': 0.6,  // Midfielders have more flexibility
  'central-midfielder-2': 0.6,  // Midfielders have more flexibility
  'striker': 0.5          // Strikers have most freedom to roam
};

// FIXED: Increased pursuit distances to allow better ball retrieval near boundaries (except goalkeeper)
const GOALKEEPER_PURSUIT_DISTANCE = 8.0;   // Kept same to keep goalkeepers near goal
const DEFENDER_PURSUIT_DISTANCE = 20.0;    // Increased from 12.0 to reach sideline balls
const MIDFIELDER_PURSUIT_DISTANCE = 25.0;  // Increased from 16.0 for better field coverage
const STRIKER_PURSUIT_DISTANCE = 30.0;     // Increased from 20.0 for aggressive ball pursuit

// Reduced pursuit probabilities to maintain spacing
const ROLE_PURSUIT_PROBABILITY = {
  'goalkeeper': 0.15,  // Reduced from 0.25
  'left-back': 0.3,    // Reduced from 0.45
  'right-back': 0.3,   // Reduced from 0.45
  'central-midfielder-1': 0.4, // Reduced from 0.55
  'central-midfielder-2': 0.4, // Reduced from 0.55
  'striker': 0.5       // Reduced from 0.6
};

// Enhanced position recovery speeds to make players return to position faster
const POSITION_RECOVERY_MULTIPLIER = {
  'goalkeeper': 1.5,  // Increased for faster return
  'left-back': 1.4,   // Increased for faster return
  'right-back': 1.4,  // Increased for faster return
  'central-midfielder-1': 1.3, // Increased for faster return
  'central-midfielder-2': 1.3, // Increased for faster return
  'striker': 1.2      // Increased for faster return
};

// Constants for formation spacing during kickoffs and restarts
const KICKOFF_SPACING_MULTIPLIER = 2.0;    // Extra spacing during kickoffs
const RESTART_FORMATION_DISCIPLINE = 0.9;  // High discipline during restarts
const CENTER_AVOIDANCE_RADIUS = 12.0;      // Radius around center to avoid crowding

// Constants for arcing shots and passes
const SHOT_ARC_FACTOR = 0.18; // Balanced arc for realistic goal shots without going over crossbar
const PASS_ARC_FACTOR = 0.05; // Reduced from 0.08 to keep passes lower and more controlled
const PASS_FORCE = 3.5; // Reduced from 5.5 to 3.5 for better pass control (user feedback)
const SHOT_FORCE = 2.5; // Reduced to match typical human quick shot power

/**
 * Behavioral Tree Implementation
 * This provides a more structured and maintainable way to organize AI decision making
 */

/**
 * AI-controlled soccer player entity
 * This class extends SoccerPlayerEntity to provide AI-controlled behavior for specific roles.
 */
export default class AIPlayerEntity extends SoccerPlayerEntity {
  public targetPosition: Vector3Like = { x: 0, y: 0, z: 0 }; // Changed to public for behavior tree
  private updateInterval: Timer | null = null;
  public aiRole: SoccerAIRole; // Changed to public for behavior tree access
  private decisionInterval: number = 500; // milliseconds between AI decisions (reduced for goalkeepers in constructor)
  public isKickoffActive: boolean = true; // Changed to public for out-of-bounds reset
  // Track last position for animation state detection
  private lastAIPosition: Vector3Like | null = null;
  // Animation state tracking
  private currentAnimState: 'idle' | 'walk' | 'run' | null = null;
  // Store mass for physics calculations
  private _mass: number = 1.0; // Default mass if not set by parent
  // Support both AI systems
  private agent: SoccerAgent;
  private behaviorTree: BehaviorNode | null = null;
  // Flag to prevent handleTick rotation override after agent action
  public hasRotationBeenSetThisTick: boolean = false; 
  // Last rotation update time
  private _lastRotationUpdateTime: number | null = null;
  // Track ball possession time for all players
  private ballPossessionStartTime: number | null = null;
  private readonly GOALKEEPER_MAX_POSSESSION_TIME = 3000; // 3 seconds in milliseconds
  private readonly DEFENDER_MAX_POSSESSION_TIME = 4000; // 4 seconds for defenders
  private readonly MIDFIELDER_MAX_POSSESSION_TIME = 5000; // 5 seconds for midfielders
  private readonly STRIKER_MAX_POSSESSION_TIME = 4000; // 4 seconds for strikers

  // Restart behavior type to determine how AI behaves after ball resets
  private restartBehavior: 'pass-to-teammates' | 'normal' | null = null;

  /**
   * Create a new AI player entity
   * @param world - The Hytopia game world instance
   * @param team - The team (red or blue)
   * @param role - The AI player's specific role on the team
   */
  constructor(world: World, team: "red" | "blue", role: SoccerAIRole) {
    // Create a mock player object that implements the required Hytopia SDK interfaces
    // This allows AI players to use the same entity base class as human players
    const aiPlayer = {
      username: `AI_${team}_${role}_${Math.random().toString(36).substring(2, 6)}`,
      camera: {
        setMode: () => {},
        setOffset: () => {},
        setZoom: () => {},
        setAttachedToEntity: () => {},
        setFacingDirection: () => {},
        facingDirection: { x: 0, y: 0, z: team === 'red' ? -1 : 1 }
      },
      ui: {
        sendData: () => {},
        on: () => {},
        load: () => {},
        sendBroadcastMessage: () => {}
      },
      on: () => {
        return { remove: () => {} };
      },
      off: () => {},
      emit: () => {},
      once: () => {
        return { remove: () => {} };
      }
    } as any; 
    
    // Call parent constructor with mock player, team, and role
    // This initializes the base SoccerPlayerEntity with the SDK's Entity systems
    super(aiPlayer, team, role);
    this.aiRole = role;
    
    // **GOALKEEPER ENHANCEMENT**: Much faster decision-making for goalkeepers
    if (this.aiRole === 'goalkeeper') {
      this.decisionInterval = 150; // 3x faster than field players for quick shot reactions
    }
    
    // Create controller instance but don't attach it immediately
    // This avoids the stopModelAnimations error when the entity isn't spawned yet
    const controller = new PlayerEntityController({
      runVelocity: 5.5, 
      walkVelocity: 3.5
    });
    
    // Initialize AI systems
    this.agent = new SoccerAgent(this);
    this.behaviorTree = createBehaviorTree(this); 
    
    // Retrieve mass from parent or use default
    // Mass is used by SDK physics system for momentum calculations
    this._mass = this.mass || 1.0; 
    if (this._mass <= 0) {
      console.warn(`AI ${this.player.username} has invalid mass (${this.mass}), defaulting to 1.0`);
      this._mass = 1.0;
    }

    // Initialize targetPosition to the calculated spawn point
    // This prevents targeting (0,0,0) before the first makeDecision runs
    this.targetPosition = this.getRoleBasedPosition();
    
    // Set the initial actual position using SDK teleport
    this.setPosition(this.targetPosition);

    // Only set controller when the entity is spawned
    this.on(EntityEvent.SPAWN, () => {
      // Set controller using SDK's controller system after the entity is spawned
      // This prevents the stopModelAnimations error
      this.setController(controller);
      console.log(`AI ${this.player.username} controller set after spawn`);
    });
    
    // Setup tick handler using SDK's entity event system
    // This will run every frame to handle movement and animations
    this.on(EntityEvent.TICK, ({ entity, tickDeltaMs }) => {
      this.handleTick(tickDeltaMs);
    });
  }
  
  /**
   * Activate the AI - start the decision-making process
   */
  public activate() {
    // Clear any existing interval first
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Ensure entity is spawned before activating
    if (!this.isSpawned) {
      console.log(`Cannot activate AI ${this.player.username} - not spawned`);
      return;
    }

    // Initialize state
    this.isKickoffActive = true; // Start with kickoff active to respect positioning
    this.lastAIPosition = this.position;
    this.currentAnimState = 'idle';
    this.hasRotationBeenSetThisTick = false;

    console.log(`AI ${this.player.username} (${this.aiRole}) activated with kickoff mode active`);

    // Start the decision making interval
    this.updateInterval = setInterval(() => {
      if (this.isSpawned) {
        // If ball has moved significantly from center, disable kickoff mode
        if (this.isKickoffActive && sharedState.getBallHasMoved()) {
          console.log(`AI ${this.player.username} (${this.aiRole}) detected ball movement, ending kickoff mode`);
          this.isKickoffActive = false;
        }
        this.makeDecision();
      } else {
        this.deactivate(); // Clean up if entity is no longer spawned
      }
    }, this.decisionInterval);

    // Start with idle animation
    if (this.isSpawned) {
      this.startModelLoopedAnimations(['idle_upper', 'idle_lower']);
    }
  }
  
  /**
   * Deactivate the AI - stop the decision-making process
   */
  public deactivate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Reset all state variables
    this.isKickoffActive = false;
    this.lastAIPosition = null;
    this.currentAnimState = null;
    this.hasRotationBeenSetThisTick = false;
    
    // Clear any pending animations
    if (this.isSpawned) {
      this.stopModelAnimations(["idle", "walk", "run", "wind_up", "kick"]);
    }
  }
  
  /**
   * Main AI decision making function
   * Analyzes the game state and uses either SoccerAgent or BehaviorTree for decision making
   * based on the global AI system setting
   */
  private makeDecision() {
    // Performance profiling: Start timing AI decision
    const decisionStartTime = performance.now();
    
    const ball = sharedState.getSoccerBall();
    // Add check: ensure AI is spawned before making decisions
    if (!this.isSpawned) {
      // console.log(`AI ${this.player.username} (${this.aiRole}) decision skipped: not spawned.`);
      return;
    }
    if (!ball) {
      // console.log(`AI ${this.player.username} (${this.aiRole}) decision skipped: ball not found.`);
      return;
    }
    
    // Get ball position and check if this player has the ball
    const ballPosition = ball.position;
    const hasBall = sharedState.getAttachedPlayer() === this;
    
    // **STAMINA CONSERVATION LOGIC**
    // Check stamina levels and adjust behavior accordingly
    const staminaPercentage = this.getStaminaPercentage();
    const shouldConserveStamina = this.shouldConserveStamina(staminaPercentage);
    
    if (shouldConserveStamina) {
      // When stamina is low, prioritize conservative play
      this.handleStaminaConservation(ballPosition, hasBall, staminaPercentage);
      return;
    }
    
    // Check if a teammate has the ball - special case to prevent teammates from chasing player with ball
    const playerWithBall = sharedState.getAttachedPlayer();
    if (playerWithBall && playerWithBall !== this && 
        playerWithBall instanceof SoccerPlayerEntity && 
        playerWithBall.team === this.team) {
      
      // A teammate has the ball - provide appropriate support without chasing
      // REDUCED INTERFERENCE: Only apply this logic if we're very close to the ball carrier
      const distanceToBallCarrier = this.distanceBetween(this.position, playerWithBall.position);
      
      // Only do special teammate support if we're within 8 units of the ball carrier
      if (distanceToBallCarrier < 8) {
        // Get formation position as a base
        const formationPosition = this.getRoleBasedPosition();
        
        // Adjust position slightly to provide passing options based on role
        let supportPos = { ...formationPosition };
        const forwardDir = this.team === 'red' ? 1 : -1;
        
        if (this.aiRole === 'striker') {
          // Striker moves ahead to provide a forward pass option
          supportPos.x += forwardDir * 10;
          supportPos.z += (Math.random() > 0.5 ? 5 : -5); // Slight random width adjustment
        } else if (this.aiRole.includes('midfielder')) {
          // Midfielders provide wide passing options
          supportPos.x += forwardDir * 5;
          supportPos.z += (this.aiRole === 'central-midfielder-1' ? -8 : 8); // One left, one right
        } else if (this.aiRole.includes('back')) {
          // Defenders move up slightly but maintain defensive shape
          supportPos.x += forwardDir * 3;
        }
        // Goalkeeper stays in position
        
        // Set the adjusted position as target and apply spacing
        this.targetPosition = this.adjustPositionForSpacing(supportPos);
        return; // Skip normal decision making only when close to ball carrier
      }
      // If far from ball carrier, continue with normal decision making
    }
    
    // If kickoff is active, AI should stay in formation and not chase the ball
    if (this.isKickoffActive) {
      // For players with the special restart behavior 'pass-to-teammates', modify behavior
      // This makes midfielders at midfield pass instead of dribbling
      if (this.restartBehavior === 'pass-to-teammates' && hasBall) {
        console.log(`${this.aiRole} ${this.player.username} has the ball during restart, looking to pass to teammates`);
        
        // IMPORTANT: Always attempt to pass to a teammate rather than dribble during restarts
        // This creates more realistic restart behavior
        const passResult = this.passBall();
        
        // If passing failed, hold position and try again soon
        if (!passResult) {
          console.log(`${this.aiRole} ${this.player.username} couldn't find a pass, maintaining possession near ball`);
          // Hold position close to ball but not exactly on it
          this.targetPosition = {
            x: ballPosition.x + (this.team === 'red' ? -1 : 1), // Slightly behind ball
            y: ballPosition.y,
            z: ballPosition.z + ((Math.random() - 0.5) * 2) // Small lateral variation
          };
        }
        return; // Skip normal kickoff positioning
      }
      
      // ENHANCED FORMATION POSITIONING FOR KICKOFFS
      // Get the AI's role-based position as the foundation
      const formationPosition = this.getRoleBasedPosition();
      
      // Enhanced spacing to prevent center-field clustering
      const spreadFactor = KICKOFF_SPACING_MULTIPLIER; // Use new constant
      const teamDirectionX = this.team === "red" ? -1 : 1; // Which way the team faces
      
      // Calculate distance from field center to enforce spacing
      const distanceFromCenter = this.distanceBetween(formationPosition, 
        { x: AI_FIELD_CENTER_X, y: formationPosition.y, z: AI_FIELD_CENTER_Z });
      
      // Apply center avoidance - push players away from center if too close
      let centerAvoidanceX = 0;
      let centerAvoidanceZ = 0;
      
      if (distanceFromCenter < CENTER_AVOIDANCE_RADIUS) {
        const awayFromCenterX = formationPosition.x - AI_FIELD_CENTER_X;
        const awayFromCenterZ = formationPosition.z - AI_FIELD_CENTER_Z;
        const awayLength = Math.sqrt(awayFromCenterX * awayFromCenterX + awayFromCenterZ * awayFromCenterZ);
        
        if (awayLength > 0.1) {
          const pushFactor = (CENTER_AVOIDANCE_RADIUS - distanceFromCenter) / CENTER_AVOIDANCE_RADIUS;
          centerAvoidanceX = (awayFromCenterX / awayLength) * pushFactor * 8;
          centerAvoidanceZ = (awayFromCenterZ / awayLength) * pushFactor * 8;
        }
      }
      
      // Start with formation position and apply avoidance
      let kickoffPosition = { 
        x: formationPosition.x + centerAvoidanceX, 
        y: formationPosition.y, 
        z: formationPosition.z + centerAvoidanceZ 
      };
      
      // Apply role-specific positioning with enhanced discipline
      const disciplineFactor = POSITION_DISCIPLINE_FACTOR[this.aiRole];
      
      if (this.aiRole.includes('midfielder')) {
        // Midfielders: Strong lateral separation and disciplined positioning
        const lateralSeparation = this.aiRole === 'central-midfielder-1' ? -8 : 8;
        kickoffPosition.z += lateralSeparation * spreadFactor * disciplineFactor;
        
        // Push midfielders slightly back from center during kickoff
        kickoffPosition.x += teamDirectionX * -3 * spreadFactor;
        
      } else if (this.aiRole === 'striker') {
        // Striker: Stay forward but not too close to center circle
        kickoffPosition.x += teamDirectionX * 8 * spreadFactor;
        
        // Add slight width variation for striker
        kickoffPosition.z += ((Math.random() - 0.5) * 6);
        
      } else if (this.aiRole === 'left-back') {
        // Left back: Maintain wide defensive position
        kickoffPosition.x += teamDirectionX * -2 * spreadFactor; // Slightly deeper
        kickoffPosition.z -= 10 * spreadFactor * disciplineFactor; // Wide left
        
      } else if (this.aiRole === 'right-back') {
        // Right back: Maintain wide defensive position
        kickoffPosition.x += teamDirectionX * -2 * spreadFactor; // Slightly deeper
        kickoffPosition.z += 10 * spreadFactor * disciplineFactor; // Wide right
        
      } else if (this.aiRole === 'goalkeeper') {
        // Goalkeeper: Stay very close to goal, minimal variation
        kickoffPosition = formationPosition; // Minimal change for goalkeeper
      }
      
      // Apply formation discipline - reduces random movement during kickoffs
      const disciplineVariation = (1.0 - RESTART_FORMATION_DISCIPLINE);
      const randomOffset = {
        x: (Math.random() - 0.5) * disciplineVariation * 3, // Reduced random variation
        y: 0,
        z: (Math.random() - 0.5) * disciplineVariation * 3  // Reduced random variation
      };
      
      // Final position with constraints
      this.targetPosition = {
        x: kickoffPosition.x + randomOffset.x,
        y: kickoffPosition.y,
        z: kickoffPosition.z + randomOffset.z
      };
      
      // Ensure position stays within field boundaries and role constraints
      this.targetPosition = this.constrainToPreferredArea(this.targetPosition, this.aiRole);
      
      // Apply enhanced spacing for kickoffs
      this.targetPosition = this.adjustPositionForSpacing(this.targetPosition);
      
      // Log the calculated position during kickoff
      console.log(`AI ${this.player.username} (${this.aiRole}) enhanced kickoff position: x=${this.targetPosition.x.toFixed(1)}, z=${this.targetPosition.z.toFixed(1)}, center_dist=${this.distanceBetween(this.targetPosition, {x: AI_FIELD_CENTER_X, y: 0, z: AI_FIELD_CENTER_Z}).toFixed(1)}`);
      
      return;
    }
    
    // Normal decision making outside of kickoff
    // Check which AI system to use
    const aiSystem = sharedState.getAISystem();
    let success = false;
    
    if (aiSystem === 'agent') {
      // Use the SoccerAgent for decision making
      console.log(`AI ${this.player.username} (${this.aiRole}) using SoccerAgent`);
      success = this.agent.update();
    } else {
      // Use the Behavior Tree for decision making
      console.log(`AI ${this.player.username} (${this.aiRole}) using BehaviorTree`);
      success = this.behaviorTree ? this.behaviorTree.execute(this) : false;
    }
    
    // If either system failed to make a decision, fall back to formation position
    if (!success) {
      console.log(`AI ${this.player.username} (${this.aiRole}) decision making failed, returning to formation`);
      this.targetPosition = this.getRoleBasedPosition();
    }
    
    // Performance profiling: Record AI decision timing
    const decisionEndTime = performance.now();
    const decisionDuration = decisionEndTime - decisionStartTime;
    
    // Get performance profiler from world if available
    const profiler = (this.world as any)._performanceProfiler;
    if (profiler) {
      profiler.recordAIDecision(decisionDuration);
    }
    
    // ROTATION STABILITY: Reset agent rotation flag at the END of decision making
    // This ensures the agent's rotation choice persists until the next decision cycle
    this.hasRotationBeenSetThisTick = false;
  }
  
  /**
   * Enhanced predictive positioning system for goalkeepers
   * Calculates optimal position based on ball velocity and trajectory
   */
  private calculatePredictiveGoalkeeperPosition(ballPosition: Vector3Like, ballVelocity: Vector3Like): Vector3Like {
    const ball = sharedState.getSoccerBall();
    if (!ball) return this.position;

    // Predict where ball will be in 0.5 seconds
    const predictionTime = 0.5;
    const predictedBallPos = {
      x: ballPosition.x + (ballVelocity.x * predictionTime),
      y: ballPosition.y + (ballVelocity.y * predictionTime),
      z: ballPosition.z + (ballVelocity.z * predictionTime)
    };

    // Calculate goal center position
    const goalCenterX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    const goalCenterZ = AI_FIELD_CENTER_Z;
    
    // Position to cut off the angle between predicted ball position and goal center
    const direction = this.team === 'red' ? 1 : -1;
    const interceptX = goalCenterX + (3 * direction); // Stay 3 units in front of goal line
    
    // Calculate Z position to cut off shooting angle
    const ballToGoalZ = goalCenterZ - predictedBallPos.z;
    const optimalZ = goalCenterZ + (ballToGoalZ * 0.4); // Position 40% toward ball's Z
    
    // Clamp Z position to stay within goal area
    const maxGoalWidth = 8;
    const clampedZ = Math.max(goalCenterZ - maxGoalWidth, Math.min(goalCenterZ + maxGoalWidth, optimalZ));
    
    return { x: interceptX, y: this.position.y, z: clampedZ };
  }

  /**
   * Check if ball is heading towards goal based on velocity
   * **ENHANCED**: Improved shot detection with lower thresholds and prediction
   */
  private isBallHeadingTowardsGoal(ballPosition: Vector3Like, ballVelocity: Vector3Like): boolean {
    const goalCenterX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    const goalCenterZ = AI_FIELD_CENTER_Z;
    
    // **ENHANCED SHOT DETECTION**: Lowered thresholds for better coverage
    const isMovingTowardsGoalX = this.team === 'red' ? ballVelocity.x < -1.0 : ballVelocity.x > 1.0; // Reduced from ±2 to ±1
    
    // **PREDICTIVE POSITIONING**: Check where ball will be in 0.3 seconds
    const predictionTime = 0.3;
    const predictedZ = ballPosition.z + (ballVelocity.z * predictionTime);
    
    // **EXPANDED GOAL RANGE**: Larger detection area for better coverage
    const goalZMin = goalCenterZ - 12; // Increased from 6 to 12
    const goalZMax = goalCenterZ + 12; // Increased from 6 to 12
    const isInGoalZRange = predictedZ >= goalZMin && predictedZ <= goalZMax;
    
    return isMovingTowardsGoalX && isInGoalZRange;
  }

  /**
   * **NEW METHOD**: Calculate where goalkeeper should position to intercept ball
   * This is the core of improved goalkeeper AI
   */
  private calculateBallInterceptionPoint(ballPosition: Vector3Like, ballVelocity: Vector3Like): Vector3Like | null {
    const goalCenterX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    const goalCenterZ = AI_FIELD_CENTER_Z;
    const currentPos = this.position;
    
    // **BALL TRAJECTORY PREDICTION**: Calculate where ball will cross goal line
    const goalLineX = goalCenterX;
    const timeToGoalLine = Math.abs((goalLineX - ballPosition.x) / ballVelocity.x);
    
    // **IGNORE UNREALISTIC TRAJECTORIES**: Don't chase balls going away or too slow
    if (timeToGoalLine <= 0 || timeToGoalLine > 3.0) return null;
    
    // **PREDICTED BALL POSITION**: Where ball will be when it reaches goal line
    const predictedGoalZ = ballPosition.z + (ballVelocity.z * timeToGoalLine);
    
    // **GOALKEEPER REACH CALCULATION**: Can the goalkeeper get there in time?
    const goalkeeperSpeed = 8.0; // Goalkeeper movement speed
    const maxReachableDistance = goalkeeperSpeed * timeToGoalLine;
    
    // **INTERCEPTION POINT**: Position slightly in front of goal line
    const interceptX = goalLineX + (this.team === 'red' ? 2 : -2); // 2 units in front
    const interceptZ = Math.max(goalCenterZ - 8, Math.min(goalCenterZ + 8, predictedGoalZ)); // Clamp to goal width
    
    // **REACHABILITY CHECK**: Only attempt saves within reach
    const distanceToIntercept = Math.sqrt(
      (interceptX - currentPos.x) ** 2 + (interceptZ - currentPos.z) ** 2
    );
    
    if (distanceToIntercept <= maxReachableDistance) {
      return { x: interceptX, y: currentPos.y, z: interceptZ };
    }
    
    return null; // Ball is unreachable
  }

  /**
   * Apply rapid response movement for fast incoming shots
   * **COMPLETELY REWRITTEN**: Now uses direct ball interception with explosive movement
   */
  private applyRapidResponse(ballVelocity: Vector3Like): void {
    const ball = sharedState.getSoccerBall();
    if (!ball) return;
    
    const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
    
    // **ENHANCED SHOT DETECTION**: React to medium-speed shots too
    if (ballSpeed > 2.0) { // Reduced from 8.0 to 2.0 for much better coverage
      // **DIRECT BALL INTERCEPTION**: Calculate exact interception point
      const interceptionPoint = this.calculateBallInterceptionPoint(ball.position, ballVelocity);
      
      if (interceptionPoint) {
        // **IMMEDIATE GOALKEEPER POSITIONING**: Set target directly to interception point
        this.targetPosition = interceptionPoint;
        
        // **EXPLOSIVE GOALKEEPER MOVEMENT**: Apply immediate velocity toward interception
        const currentPos = this.position;
        const directionToIntercept = {
          x: interceptionPoint.x - currentPos.x,
          z: interceptionPoint.z - currentPos.z
        };
        
        const distanceToIntercept = Math.sqrt(directionToIntercept.x * directionToIntercept.x + directionToIntercept.z * directionToIntercept.z);
        
        if (distanceToIntercept > 0.5) {
          // **GOALKEEPER DIVE MECHANICS**: Apply explosive movement
          const urgentSpeed = 10.0; // Much faster than normal movement
          const normalizedX = directionToIntercept.x / distanceToIntercept;
          const normalizedZ = directionToIntercept.z / distanceToIntercept;
          
          // **DIRECT VELOCITY APPLICATION**: Bypass gradual physics for urgent saves
          this.setLinearVelocity({
            x: normalizedX * urgentSpeed,
            y: this.linearVelocity?.y || 0,
            z: normalizedZ * urgentSpeed
          });
          
          console.log(`🥅 GOALKEEPER DIVE: ${this.player.username} diving to intercept (speed: ${urgentSpeed.toFixed(1)})`);
          
          // **GOALKEEPER SAVE ANIMATION**: Visual feedback
          if (this.isSpawned) {
            this.startModelOneshotAnimations(['kick']); // Using kick as diving animation
            
            setTimeout(() => {
              if (this.isSpawned) {
                this.stopModelAnimations(['kick']);
              }
            }, 800);
          }
        }
      }
    }
  }

  /**
   * Decision making for Goalkeeper
   * Enhanced with predictive positioning, shot detection, and rapid response
   */
  private goalkeeperDecision(ballPosition: Vector3Like, myPosition: Vector3Like, hasBall: boolean, goalLineX: number) {
    const roleDefinition = ROLE_DEFINITIONS['goalkeeper'];
    const ball = sharedState.getSoccerBall();
    
    // Get ball velocity for enhanced decision making
    const ballVelocity = ball ? ball.linearVelocity : { x: 0, y: 0, z: 0 };
    const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
    
    // Define goal width and penalty area radius
    const goalWidth = 10;
    const penaltyAreaRadius = 18; // Increased from 15 for better coverage

    // Get distance from goal line to ball
    const distanceFromGoalToBall = Math.abs(ballPosition.x - goalLineX);
    
    // Check if the ball is in the penalty area
    const ballInPenaltyArea = distanceFromGoalToBall < penaltyAreaRadius;
    
    // Distance from goalkeeper to ball
    const distanceToBall = this.distanceBetween(ballPosition, myPosition);
    
    // **ENHANCED SHOT DETECTION**: Lower thresholds for better coverage
    const isShotOnGoal = this.isBallHeadingTowardsGoal(ballPosition, ballVelocity);
    const isFastShot = ballSpeed > 5.0; // Reduced from 8.0
    const isMediumShot = ballSpeed > 2.0; // Reduced from 5.0
    
    // **PRIORITY 1: URGENT SHOT RESPONSE**
    if (isShotOnGoal && (isFastShot || isMediumShot)) {
      console.log(`🥅 URGENT SAVE: ${this.player.username} responding to shot (speed: ${ballSpeed.toFixed(1)})`);
      this.applyRapidResponse(ballVelocity);
      return; // Skip normal positioning logic
    }
    
    // **PRIORITY 2: BALL INTERCEPTION**
    if (ballSpeed > 1.0 && distanceToBall < 15) {
      const interceptionPoint = this.calculateBallInterceptionPoint(ballPosition, ballVelocity);
      if (interceptionPoint) {
        console.log(`🎯 INTERCEPTION: ${this.player.username} moving to intercept ball`);
        this.targetPosition = interceptionPoint;
        return;
      }
    }
    
    // New: Check if the ball is in a corner
    const isInCorner = (
      (Math.abs(ballPosition.x - FIELD_MIN_X) < 8 || Math.abs(ballPosition.x - FIELD_MAX_X) < 8) &&
      (Math.abs(ballPosition.z - FIELD_MIN_Z) < 8 || Math.abs(ballPosition.z - FIELD_MAX_Z) < 8)
    );
    
    // New: Special case for goalkeeper to retrieve ball in corners if they're the closest player
    // and the corner is on their end of the field
    const cornerNearOwnGoal = 
      (this.team === 'red' && Math.abs(ballPosition.x - FIELD_MIN_X) < 8) ||
      (this.team === 'blue' && Math.abs(ballPosition.x - FIELD_MAX_X) < 8);
      
    if (isInCorner && cornerNearOwnGoal && this.isClosestTeammateToPosition(ballPosition) && distanceToBall < 25) {
      console.log(`Goalkeeper ${this.player.username} moving to retrieve ball from corner`);
      
      // Set target position to retrieve the ball
      this.targetPosition = ballPosition;
      
      // If goalkeeper already has the ball in a corner, make a safe clearance to mid-field
      if (hasBall) {
        console.log(`Goalkeeper ${this.player.username} has retrieved ball from corner, making safe clearance`);
        
        // First, try to find a good teammate to pass to
        const teammates = this.getVisibleTeammates();
        let bestTarget: SoccerPlayerEntity | null = null;
        let bestScore = -Infinity;
        
        // Calculate field center for reference
        const fieldCenterX = AI_FIELD_CENTER_X;
        const fieldCenterZ = AI_FIELD_CENTER_Z;
        
        // Find the best teammate to pass to (prioritize central positions)
        for (const teammate of teammates) {
          if (teammate === this) continue;
          
          // Calculate distance to teammate
          const distanceToTeammate = this.distanceBetween(this.position, teammate.position);
          
          // Skip teammates that are too close or too far
          if (distanceToTeammate < 8 || distanceToTeammate > 30) continue;
          
          // Skip teammates that are near the sidelines
          const distanceToSidelines = Math.min(
            Math.abs(teammate.position.z - FIELD_MIN_Z),
            Math.abs(teammate.position.z - FIELD_MAX_Z)
          );
          if (distanceToSidelines < 8) continue;
          
          // Calculate central position score (higher is better)
          const centralityScore = 15 - Math.min(15, Math.abs(teammate.position.z - fieldCenterZ) / 2);
          
          // Calculate final score
          const score = centralityScore + 
                       (20 - Math.min(20, distanceToTeammate / 2)); // Favor medium-distance passes
          
          if (score > bestScore) {
            bestScore = score;
            bestTarget = teammate;
          }
        }
        
        // If we found a good teammate target, pass to them
        if (bestTarget && bestScore > 5) {
          console.log(`Goalkeeper ${this.player.username} passing from corner to teammate ${bestTarget.player.username}`);
          this.forcePass(bestTarget, bestTarget.position, 0.7);
        } 
        // Otherwise clear to mid-field
        else {
          console.log(`Goalkeeper ${this.player.username} no good targets, clearing from corner to mid-field`);
          
          // Always aim for central mid-field area
          const clearTargetX = fieldCenterX + (this.team === 'red' ? -2 : 2); // Slightly on own side
          const clearTargetZ = fieldCenterZ; // Directly center
          
          const clearTarget = {
            x: clearTargetX,
            y: myPosition.y,
            z: clearTargetZ
          };
          
          // Ensure target is in bounds and clear with medium power
          const safeTarget = this.ensureTargetInBounds(clearTarget);
          this.forcePass(null, safeTarget, 0.7);
        }
      }
      return;
    }
    
    // Reset ball possession timer when not having the ball
    if (!hasBall) {
      this.ballPossessionStartTime = null;
    }
    
    // GK has the ball - distribute it
    if (hasBall) {
      // IMPORTANT: Always start tracking possession time when goalkeeper has the ball
      if (this.ballPossessionStartTime === null) {
        this.ballPossessionStartTime = Date.now();
        console.log(`Goalkeeper ${this.player.username} started possession timer in goalkeeperDecision`);
      }

      // Get the current possession time
      const possessionTime = Date.now() - this.ballPossessionStartTime;
      console.log(`Goalkeeper ${this.player.username} possession time in goalkeeperDecision: ${possessionTime}ms / ${this.GOALKEEPER_MAX_POSSESSION_TIME}ms`);
      
      // Get field center coordinates
      const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
      const fieldCenterZ = AI_FIELD_CENTER_Z;
      
      // IMPORTANT: Check if we've exceeded the possession time limit - this triggers regardless of other logic
      if (possessionTime >= this.GOALKEEPER_MAX_POSSESSION_TIME) {
        console.log(`Goalkeeper ${this.player.username} FORCED clearing ball after ${possessionTime}ms possession (3 second rule) in goalkeeperDecision`);
        
        // Calculate a safe clearing target that stays in bounds
        const forwardDirection = this.team === 'red' ? 1 : -1;
        const clearDistance = 10; // Reduced from 12 to keep ball in bounds
        
        const clearTarget = { 
          x: myPosition.x + (forwardDirection * clearDistance), // Forward but not too far
          y: myPosition.y, 
          z: fieldCenterZ + ((Math.random() * 6) - 3) // Smaller random Z offset toward center
        };
        
        // Use forcePass with lower power for clearance - safer to keep in bounds
        this.forcePass(null, clearTarget, 0.7); // Reduced from 1.0
        this.ballPossessionStartTime = null; // Reset timer
        return;
      }
      
      // MODIFICATION: Change logic to IMMEDIATELY pass/clear regardless of random chance
      // Rather than waiting, we want goalie to IMMEDIATELY try to distribute the ball when they have it
      console.log(`Goalkeeper ${this.player.username} IMMEDIATE distribution (${possessionTime}ms possession)`);
      
      // Get teammates to pass to
      const teammates = this.getVisibleTeammates();
      const hasTeammates = teammates.filter(t => t !== this).length > 0;
      
      if (hasTeammates) {
        // Always attempt a strategic pass first
        console.log(`Goalkeeper ${this.player.username} attempting immediate pass to teammate`);
        const passResult = this.passBall();
        
        // If pass failed (no good target), do a clearance to mid-field
        if (!passResult) {
          console.log(`Goalkeeper ${this.player.username} pass failed, clearing to mid-field`);
          
          // Calculate a safe target in mid-field, away from sidelines
          const fieldCenterX = AI_FIELD_CENTER_X;
          const fieldCenterZ = AI_FIELD_CENTER_Z;
          
          // Determine target X in mid-field (slightly on own half)
          let clearTargetX;
          if (this.team === 'red') {
            clearTargetX = fieldCenterX - (Math.random() * 5); // Slightly our side of center
          } else {
            clearTargetX = fieldCenterX + (Math.random() * 5); // Slightly our side of center
          }
          
          // Keep Z close to center to avoid sidelines
          const clearTargetZ = fieldCenterZ + ((Math.random() * 8) - 4); // Small variance but stay central
          
          const clearTarget = { 
            x: clearTargetX,
            y: myPosition.y, 
            z: clearTargetZ
          };
          
          // Ensure target is in bounds with margin
          const safeTarget = this.ensureTargetInBounds(clearTarget);
          this.forcePass(null, safeTarget, 0.7); // Lower power for safer clearance
        }
      } else {
        // No teammates, clear it safely to mid-field
        console.log(`Goalkeeper ${this.player.username} no teammates, clearing to mid-field`);
        
        // Calculate a safe target in mid-field, away from sidelines
        const fieldCenterX = AI_FIELD_CENTER_X;
        const fieldCenterZ = AI_FIELD_CENTER_Z;
        
        // Determine target X in mid-field (slightly on own half)
        let clearTargetX;
        if (this.team === 'red') {
          clearTargetX = fieldCenterX - (Math.random() * 5); // Slightly our side of center
        } else {
          clearTargetX = fieldCenterX + (Math.random() * 5); // Slightly our side of center
        }
        
        // Keep Z close to center to avoid sidelines
        const clearTargetZ = fieldCenterZ + ((Math.random() * 8) - 4); // Small variance but stay central
        
        const clearTarget = { 
          x: clearTargetX,
          y: myPosition.y, 
          z: clearTargetZ
        };
        
        // Ensure target is in bounds with margin
        const safeTarget = this.ensureTargetInBounds(clearTarget);
        this.forcePass(null, safeTarget, 0.7); // Lower power for safer clearance
      }
      
      this.ballPossessionStartTime = null; // Reset timer after passing/clearing
    } 
    // Ball in penalty area - decide whether to come out or stay on line
    else if (ballInPenaltyArea && this.distanceBetween(ballPosition, myPosition) < penaltyAreaRadius) {
      // Reset possession timer when not having the ball
      this.ballPossessionStartTime = null;
      
      // Extra check: NEVER pursue if a teammate has the ball
      const playerWithBall = sharedState.getAttachedPlayer();
      if (playerWithBall && playerWithBall !== this && 
          playerWithBall instanceof SoccerPlayerEntity && 
          playerWithBall.team === this.team) {
        // Teammate has the ball - do NOT pursue, stay on goal line
        this.targetPosition = {
          x: goalLineX + (this.team === 'red' ? 1 : -1), // Slightly off goal line
          y: myPosition.y,
          z: Math.max(
            AI_FIELD_CENTER_Z - goalWidth/2, 
            Math.min(AI_FIELD_CENTER_Z + goalWidth/2, ballPosition.z * 0.7 + AI_FIELD_CENTER_Z * 0.3)
          )
        };
        return;
      }
      
      // Check if we should stop pursuit because ball is too far
      const shouldStop = this.shouldStopPursuit(ballPosition);
      
      // If currently pursuing and ball is too far, stop pursuing
      if (shouldStop) {
        console.log(`Goalkeeper ${this.player.username} stopping pursuit - ball too far from area`);
        // Default back to goal line position
        this.targetPosition = {
          x: goalLineX + (this.team === 'red' ? 1 : -1), // Slightly off goal line
          y: myPosition.y,
          z: Math.max(
            AI_FIELD_CENTER_Z - goalWidth/2, 
            Math.min(AI_FIELD_CENTER_Z + goalWidth/2, ballPosition.z * 0.7 + AI_FIELD_CENTER_Z * 0.3)
          )
        };
      }
      // Not currently pursuing or not too far - evaluate normal pursuit
      else {
        // Goalkeeper will come out for the ball if:
        // 1. It's very close to goal (high danger)
        // 2. No defenders are closer to the ball
        // 3. A random check passes based on GK aggression
        // 4. Ball is not too far to chase
        const dangerLevel = 1 - (distanceFromGoalToBall / penaltyAreaRadius); // 0 to 1, higher = more dangerous
        const ballIsTooFar = this.isBallTooFarToChase(ballPosition);
        const shouldComeOut = (dangerLevel > 0.7 || Math.random() < (roleDefinition.pursuitTendency * dangerLevel)) && !ballIsTooFar;
        
        if (shouldComeOut) {
          console.log(`Goalkeeper ${this.player.username} coming out to claim the ball`);
          this.targetPosition = ballPosition;
        } else {
          // Stay on line but track ball Z position
          console.log(`Goalkeeper ${this.player.username} holding position on goal line`);
          this.targetPosition = {
            x: goalLineX + (this.team === 'red' ? 1 : -1), // Slightly off goal line
            y: myPosition.y,
            z: Math.max(
              AI_FIELD_CENTER_Z - goalWidth/2, 
              Math.min(AI_FIELD_CENTER_Z + goalWidth/2, ballPosition.z * 0.7 + AI_FIELD_CENTER_Z * 0.3)
            )
          };
        }
      }
    } 
    // Enhanced positioning system based on ball speed and trajectory
    else {
      // Reset possession timer when not having the ball
      this.ballPossessionStartTime = null;
      
      // Use predictive positioning for fast shots or balls heading towards goal
      if ((isMediumShot && isShotOnGoal) || (ballSpeed > 3.0 && distanceToBall < 20)) {
        // Use predictive positioning for better shot blocking
        this.targetPosition = this.calculatePredictiveGoalkeeperPosition(ballPosition, ballVelocity);
      } else {
        // Standard positioning - stay on goal line and track ball Z position
        // Use angle-based positioning for better positional play
        const ballAngle = Math.atan2(
          ballPosition.z - AI_FIELD_CENTER_Z,
          ballPosition.x - goalLineX
        );
        
        // Calculate Z position on goal line based on angle
        // Enhanced response factor for better coverage
        const angleResponse = 0.8; // Increased from 0.7 for better movement
        const targetZ = AI_FIELD_CENTER_Z + Math.sin(ballAngle) * (goalWidth/2) * angleResponse;
        
        this.targetPosition = {
          x: goalLineX + (this.team === 'red' ? 1 : -1), // Slightly off goal line
          y: myPosition.y,
          z: targetZ
        };
      }
    }
    
    // Ensure position is within the role's preferred area
    this.targetPosition = this.constrainToPreferredArea(this.targetPosition, 'goalkeeper');
    
    // Apply teammate avoidance
    this.targetPosition = this.adjustPositionForSpacing(this.targetPosition);
  }

  /**
   * Decision making for Left Back (Min Z side)
   * Defends left flank (Z-axis), stays deeper (X-axis), moves up slightly if ball is advanced.
   * Enhanced to match the fullback role from the detailed position description.
   * @param wideZBoundary - The minimum Z value for this position
   */
  private leftBackDecision(ballPosition: Vector3Like, myPosition: Vector3Like, hasBall: boolean, goalLineX: number, wideZBoundary: number) {
    const roleDefinition = ROLE_DEFINITIONS['left-back'];
    let targetPos: Vector3Like;
    const distanceToBall = this.distanceBetween(myPosition, ballPosition);

    // Left back has the ball
    if (hasBall) {
      console.log(`Left Back ${this.player.username} has the ball`);
      
      // Determine if we should pass or advance
      const opponentGoalLineX = this.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
      
      // Check if there's space to advance
      const midfielderPosition = { 
        x: goalLineX + (this.team === 'red' ? AI_MIDFIELD_OFFSET_X : -AI_MIDFIELD_OFFSET_X), 
        y: myPosition.y, 
        z: wideZBoundary * 0.75 
      };
      
      const hasAdvancingSpace = this.distanceBetween(myPosition, midfielderPosition) > 6;
      
      // Higher chance to pass (70%) than advance (30%)
      if (Math.random() > 0.3 || !hasAdvancingSpace) {
        console.log(`Left Back ${this.player.username} looking to pass`);
        this.passBall();
        // Target slightly forward
        targetPos = { 
          x: myPosition.x + (this.team === 'red' ? 5 : -5), 
          y: myPosition.y, 
          z: wideZBoundary * 0.75 
        };
      } else {
        // Advance up the left flank
        console.log(`Left Back ${this.player.username} advancing up the left flank`);
        targetPos = { 
          x: myPosition.x + (opponentGoalLineX - myPosition.x) * 0.3, // Move forward cautiously
          y: myPosition.y, 
          z: wideZBoundary * 0.75 // Stay wide on left side
        };
      }
    } 
    // Left back doesn't have the ball - defensive positioning
    else {
      // --- Analyze game situation ---
      // const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2; // Use AI_FIELD_CENTER_X
      const ballInOurHalf = (this.team === 'red' && ballPosition.x < AI_FIELD_CENTER_X) || 
                           (this.team === 'blue' && ballPosition.x > AI_FIELD_CENTER_X);
      const ballOnMyFlank = ballPosition.z < AI_FIELD_CENTER_Z; // Left side of field
      const ballInDefensiveThird = Math.abs(ballPosition.x - goalLineX) < AI_DEFENSIVE_OFFSET_X;
      
      // Get base defensive position
      const baseX = goalLineX + (this.team === 'red' ? AI_DEFENSIVE_OFFSET_X : -AI_DEFENSIVE_OFFSET_X); 
      const baseZ = wideZBoundary * 0.75; // Wide left position
      
      // --- Left Back Movement Logic ---
      
      // 1. URGENT DEFENSIVE DUTY: Ball in our defensive third on my flank - close down immediately
      if (ballInDefensiveThird && ballOnMyFlank) {
        console.log(`Left Back ${this.player.username} closing down immediate threat`);
        
        // Direct movement to close down the ball, with slight goal-side bias
        const goalSideZ = ballPosition.z + (AI_FIELD_CENTER_Z - ballPosition.z) * 0.3; // 30% shift toward center
        
        targetPos = {
          x: Math.min(ballPosition.x + 2, baseX), // Stay slightly goal-side of ball
          y: myPosition.y,
          z: goalSideZ // Position to intercept path to goal
        };
      }
      // 2. DEFENSIVE DUTY: Ball in our half - maintain defensive shape
      else if (ballInOurHalf) {
        console.log(`Left Back ${this.player.username} maintaining defensive shape`);
        
        // Increased position recovery factor for faster return to position
        const recoveryFactor = POSITION_RECOVERY_MULTIPLIER['left-back'];
        
        // Calculate Z position based on ball's position while maintaining defensive line
        // Use higher recovery factor to stay more in position
        const ballTrackingZ = AI_FIELD_CENTER_Z + (ballPosition.z - AI_FIELD_CENTER_Z) * (0.2 / recoveryFactor); // Reduced from 0.3
        const defendingZ = Math.max(wideZBoundary, Math.min(baseZ, ballTrackingZ)); // Stay in left flank
        
        // Adjust position based on where ball is on X axis (depth)
        const defensiveLineX = baseX + (ballPosition.x - baseX) * 0.2; // Track ball X with 20% follow
        
        targetPos = {
          x: Math.max(goalLineX + 5, defensiveLineX), // Don't go too deep
          y: myPosition.y,
          z: defendingZ
        };
      }
      // 3. SUPPORTING ATTACK: Ball in opponent's half - cautious forward support
      else {
        console.log(`Left Back ${this.player.username} providing attacking width`);
        
        // How far forward we go depends on ball position
        // Calculate a "safe" X position that's never too far forward
        const forwardLimit = AI_FIELD_CENTER_X + (this.team === 'red' ? AI_DEFENSIVE_OFFSET_X : -AI_DEFENSIVE_OFFSET_X); // Use AI_FIELD_CENTER_X
        const supportX = Math.min(
          this.team === 'red' ? forwardLimit : goalLineX,
          Math.max(
            this.team === 'red' ? goalLineX : forwardLimit,
            ballPosition.x + (this.team === 'red' ? -10 : 10) // Stay behind the ball
          )
        );
        
        // Provide width on the left side
        const supportZ = Math.min(AI_FIELD_CENTER_Z - 5, wideZBoundary + 3);
        
        targetPos = {
          x: supportX,
          y: myPosition.y,
          z: supportZ
        };
      }
      
          // --- PURSUIT OVERRIDE ---
    // Only chase the ball if it's on our flank and in our defensive area
    // Check for loose ball in area or if we should pursue based on team coordination
    const isLooseBall = this.isLooseBallInArea(ballPosition);
    const shouldPursue = this.shouldPursueBasedOnTeamCoordination(ballPosition);
    
    // Extra check: NEVER pursue if a teammate has the ball
    const playerWithBall = sharedState.getAttachedPlayer();
    if (playerWithBall && playerWithBall !== this && 
        playerWithBall instanceof SoccerPlayerEntity && 
        playerWithBall.team === this.team) {
      // Teammate has the ball - do NOT pursue
      return;
    }
    
    // Check if we should stop pursuit because ball is too far
    const shouldStop = this.shouldStopPursuit(ballPosition);
    
    // If currently pursuing and ball is too far, stop pursuing
    if (shouldStop) {
      console.log(`Left Back ${this.player.username} stopping pursuit - ball too far from area`);
      // Return to a defensive position (already set in targetPos)
    }
    // Otherwise, evaluate whether to begin/continue pursuit
    else if (!this.isKickoffActive && 
        sharedState.getBallHasMoved() && 
        distanceToBall < DEFENDER_PURSUIT_DISTANCE) {
        
        // Check if ball is too far to chase even before starting pursuit
        const ballTooFar = this.isBallTooFarToChase(ballPosition);
        if (ballTooFar) {
          console.log(`Left Back ${this.player.username} not pursuing - ball too far from area`);
          return; // Keep existing target position
        }
        
        // Conditions that increase pursuit probability:
        // 1. Ball is on left flank (our area of responsibility)
        // 2. Ball is in our defensive third (urgent threat)
        // 3. No midfielder is closer to the ball
        
        let pursuitBonus = 0;
        if (ballOnMyFlank) pursuitBonus += 0.2; // Reduced from 0.3
        if (ballInDefensiveThird) pursuitBonus += 0.2; // Reduced from 0.3
        if (this.isClosestTeammateToPosition(ballPosition)) pursuitBonus += 0.3;
        
        // Apply recovery factor to make return to position faster
        const positionRecoveryFactor = 1 - (roleDefinition.positionRecoverySpeed * POSITION_RECOVERY_MULTIPLIER['left-back']);
        
        const pursuitProbability = Math.min(0.8, ROLE_PURSUIT_PROBABILITY['left-back'] * positionRecoveryFactor + pursuitBonus);
        
        // Only pursue if:
        // 1. It's a loose ball in our area, OR
        // 2. It's an urgent defensive situation (defensive third + our flank), OR
        // 3. We're the closest teammate to the ball, OR
        // 4. We should pursue based on team coordination AND random check passes
        if (isLooseBall || 
            (ballInDefensiveThird && ballOnMyFlank) || 
            this.isClosestTeammateToPosition(ballPosition) || 
            (shouldPursue && Math.random() < pursuitProbability)) {
          console.log(`Left Back ${this.player.username} moving to intercept ball (${isLooseBall ? 'loose ball' : 'defensive duty'})`);
          // Add slight goal-side bias when pursuing
          targetPos = {
              x: ballPosition.x + (this.team === 'red' ? 1 : -1), // Slight goal-side position
              y: ballPosition.y,
              z: ballPosition.z + (AI_FIELD_CENTER_Z - ballPosition.z) * 0.2 // 20% shift toward center
          };
        }
    }
    }
    
    // Ensure position is within the role's preferred area
    this.targetPosition = this.constrainToPreferredArea(targetPos, 'left-back');
    
    // Apply teammate avoidance
    this.targetPosition = this.adjustPositionForSpacing(this.targetPosition);
  }

  /**
   * Decision making for Right Back (Max Z side)
   * Defends right flank (Z-axis), stays deeper (X-axis), moves up slightly if ball is advanced.
   * Enhanced to match the fullback role from the detailed position description.
   * @param wideZBoundary - The maximum Z value for this position
   */
  private rightBackDecision(ballPosition: Vector3Like, myPosition: Vector3Like, hasBall: boolean, goalLineX: number, wideZBoundary: number) {
    const roleDefinition = ROLE_DEFINITIONS['right-back'];
    let targetPos: Vector3Like;
    const distanceToBall = this.distanceBetween(myPosition, ballPosition);

    // Right back has the ball
    if (hasBall) {
      console.log(`Right Back ${this.player.username} has the ball`);
      
      // Determine if we should pass or advance
      const opponentGoalLineX = this.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
      
      // Check if there's space to advance
      const midfielderPosition = { 
        x: goalLineX + (this.team === 'red' ? AI_MIDFIELD_OFFSET_X : -AI_MIDFIELD_OFFSET_X), 
        y: myPosition.y, 
        z: wideZBoundary * 0.75 
      };
      
      const hasAdvancingSpace = this.distanceBetween(myPosition, midfielderPosition) > 6;
      
      // Higher chance to pass (70%) than advance (30%)
      if (Math.random() > 0.3 || !hasAdvancingSpace) {
        console.log(`Right Back ${this.player.username} looking to pass`);
        this.passBall();
        // Target slightly forward
        targetPos = { 
          x: myPosition.x + (this.team === 'red' ? 5 : -5), 
          y: myPosition.y, 
          z: wideZBoundary * 0.75 
        };
      } else {
        // Advance up the right flank
        console.log(`Right Back ${this.player.username} advancing up the right flank`);
        targetPos = { 
          x: myPosition.x + (opponentGoalLineX - myPosition.x) * 0.3, // Move forward cautiously
          y: myPosition.y, 
          z: wideZBoundary * 0.75 // Stay wide on right side
        };
      }
    } 
    // Right back doesn't have the ball - defensive positioning
    else {
      // --- Analyze game situation ---
      // const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2; // Use AI_FIELD_CENTER_X
      const ballInOurHalf = (this.team === 'red' && ballPosition.x < AI_FIELD_CENTER_X) || 
                           (this.team === 'blue' && ballPosition.x > AI_FIELD_CENTER_X);
      const ballOnMyFlank = ballPosition.z > AI_FIELD_CENTER_Z; // Right side of field
      const ballInDefensiveThird = Math.abs(ballPosition.x - goalLineX) < AI_DEFENSIVE_OFFSET_X;
      
      // Get base defensive position
      const baseX = goalLineX + (this.team === 'red' ? AI_DEFENSIVE_OFFSET_X : -AI_DEFENSIVE_OFFSET_X); 
      const baseZ = wideZBoundary * 0.75; // Wide right position
      
      // Determine if we need to track an attacker
      const attackingThreatNearby = false; // In a real situation, check for opponents on this flank
      
      // --- Right Back Movement Logic ---
      
      // 1. URGENT DEFENSIVE DUTY: Ball in our defensive third on my flank - close down immediately
      if (ballInDefensiveThird && ballOnMyFlank) {
        console.log(`Right Back ${this.player.username} closing down immediate threat`);
        
        // Direct movement to close down the ball, with slight goal-side bias
        const goalSideZ = ballPosition.z + (AI_FIELD_CENTER_Z - ballPosition.z) * 0.3; // 30% shift toward center
        
        targetPos = {
          x: Math.min(ballPosition.x + 2, baseX), // Stay slightly goal-side of ball
          y: myPosition.y,
          z: goalSideZ // Position to intercept path to goal
        };
      }
      // 2. DEFENSIVE DUTY: Ball in our half - maintain defensive shape
      else if (ballInOurHalf) {
        console.log(`Right Back ${this.player.username} maintaining defensive shape`);
        
        // Calculate Z position based on ball's position while maintaining defensive line
        const ballTrackingZ = AI_FIELD_CENTER_Z + (ballPosition.z - AI_FIELD_CENTER_Z) * 0.3; // 30% tracking of ball Z
        const defendingZ = Math.min(wideZBoundary, Math.max(baseZ, ballTrackingZ)); // Stay in right flank
        
        // Adjust position based on where ball is on X axis (depth)
        const defensiveLineX = baseX + (ballPosition.x - baseX) * 0.2; // Track ball X with 20% follow
        
        targetPos = {
          x: Math.max(goalLineX + 5, defensiveLineX), // Don't go too deep
          y: myPosition.y,
          z: defendingZ
        };
      }
      // 3. SUPPORTING ATTACK: Ball in opponent's half - cautious forward support
      else {
        console.log(`Right Back ${this.player.username} providing attacking width`);
        
        // How far forward we go depends on ball position
        // Calculate a "safe" X position that's never too far forward
        const forwardLimit = AI_FIELD_CENTER_X + (this.team === 'red' ? AI_DEFENSIVE_OFFSET_X : -AI_DEFENSIVE_OFFSET_X); // Use AI_FIELD_CENTER_X
        const supportX = Math.min(
          this.team === 'red' ? forwardLimit : goalLineX,
          Math.max(
            this.team === 'red' ? goalLineX : forwardLimit,
            ballPosition.x + (this.team === 'red' ? -10 : 10) // Stay behind the ball
          )
        );
        
        // Provide width on the right side
        const supportZ = Math.max(AI_FIELD_CENTER_Z + 5, wideZBoundary - 3);
        
        targetPos = {
          x: supportX,
          y: myPosition.y,
          z: supportZ
        };
      }
      
      // --- PURSUIT OVERRIDE ---
      // Only chase the ball if it's on our flank and in our defensive area
      if (!this.isKickoffActive && 
          sharedState.getBallHasMoved() && 
          distanceToBall < DEFENDER_PURSUIT_DISTANCE) {
          
          // Conditions that increase pursuit probability:
          // 1. Ball is on right flank (our area of responsibility)
          // 2. Ball is in our defensive third (urgent threat)
          // 3. No midfielder is closer to the ball
          
          let pursuitBonus = 0;
          if (ballOnMyFlank) pursuitBonus += 0.3;
          if (ballInDefensiveThird) pursuitBonus += 0.3;
          if (this.isClosestTeammateToPosition(ballPosition)) pursuitBonus += 0.2;
          
          const pursuitProbability = Math.min(1.0, roleDefinition.pursuitTendency + pursuitBonus);
          
          if (Math.random() < pursuitProbability) {
              console.log(`Right Back ${this.player.username} moving to intercept ball`);
              // Add slight goal-side bias when pursuing
              targetPos = {
                  x: ballPosition.x + (this.team === 'red' ? 1 : -1), // Slight goal-side position
                  y: ballPosition.y,
                  z: ballPosition.z + (AI_FIELD_CENTER_Z - ballPosition.z) * 0.2 // 20% shift toward center
              };
          }
      }
    }
    
    // Ensure position is within the role's preferred area
    this.targetPosition = this.constrainToPreferredArea(targetPos, 'right-back');
    
    // Apply teammate avoidance
    this.targetPosition = this.adjustPositionForSpacing(this.targetPosition);
  }

  /**
   * Decision making for Central Midfielder
   * Connects defense (low X) and attack (high X), covers central areas (Z), supports ball carrier.
   * Enhanced to match true midfielder role from the detailed position description.
   * @param sidePreference - -1 for left-sided midfielder, 1 for right-sided midfielder
   * @param midfieldZBoundary - The min/max Z boundary for this midfielder side
   * @param fieldCenterZ - The center Z coordinate of the field
   */
  private centralMidfielderDecision(
    ballPosition: Vector3Like, 
    myPosition: Vector3Like, 
    hasBall: boolean, 
    goalLineX: number, 
    opponentGoalLineX: number, 
    sidePreference: -1 | 1, 
    midfieldZBoundary: number, 
    fieldCenterZ: number
  ) {
    const roleKey = sidePreference === -1 ? 'central-midfielder-1' : 'central-midfielder-2';
    const roleDefinition = ROLE_DEFINITIONS[roleKey];
    let targetPos: Vector3Like;
    const distanceToBall = this.distanceBetween(myPosition, ballPosition);
    
    // If the midfielder has the ball
    if (hasBall) {
      console.log(`Midfielder ${this.player.username} has the ball, looking for options`);
      
      // Look at ball velocity and current player movement to decide action
      const teammates = this.getVisibleTeammates();
      const opponentGoal = { 
        x: this.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED, 
        y: 1, // Reference height for goal target
        z: AI_FIELD_CENTER_Z 
      };
      const distanceToGoal = this.distanceBetween(myPosition, opponentGoal);
      
      // Enhanced shooting decision logic for midfielders
      // If close enough to goal, consider shooting with increased probability
      const inPrimeShootingRange = distanceToGoal < 12; // Reduced from 15 to prevent out of bounds
      const inDecentShootingRange = distanceToGoal < 18; // Reduced from 25 to prevent out of bounds
      const centralPosition = Math.abs(myPosition.z - AI_FIELD_CENTER_Z) < 10; // Better angle if more central
      
      // Calculate shooting probability based on position quality
      let shootingProbability = 0.4; // Base probability
      
      if (inPrimeShootingRange) shootingProbability += 0.3; 
      if (centralPosition) shootingProbability += 0.2;
      
      // Attempt shot if in a good position
      if ((inPrimeShootingRange || (inDecentShootingRange && centralPosition)) && 
          Math.random() < shootingProbability) {
        console.log(`Midfielder ${this.player.username} attempting shot on goal from ${distanceToGoal.toFixed(1)}m`);
        
        // Add slight randomness to shot placement
        const shootTarget = {
          x: opponentGoal.x,
          y: opponentGoal.y,
          z: opponentGoal.z + ((Math.random() * 4) - 2) // Random offset for goal placement
        };
        
        this.shootBall(shootTarget, 1.2); // Increased power multiplier for effective midfielder shooting
        targetPos = { x: opponentGoal.x, y: myPosition.y, z: myPosition.z };
      } 
      // Otherwise, look to pass or dribble forward
      else {
        // Higher chance to pass as a midfielder (box-to-box distributor)
        if (Math.random() > 0.3) {
          console.log(`Midfielder ${this.player.username} looking to pass`);
          this.passBall();
        }
        
        // Dribble toward the opponent's goal while staying on preferred side
        targetPos = { 
          x: opponentGoalLineX, 
          y: myPosition.y, 
          z: myPosition.z + (sidePreference * 3) // Slight drift to preferred side
        };
      }
    } 
    // The midfielder doesn't have the ball
    else {
      // --- Defense, Support, or Attack Decision ---
      // const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2; // Use AI_FIELD_CENTER_X
      const ballInOurHalf = (this.team === 'red' && ballPosition.x < AI_FIELD_CENTER_X) || 
                            (this.team === 'blue' && ballPosition.x > AI_FIELD_CENTER_X);
      const ballInAttackingThird = Math.abs(ballPosition.x - opponentGoalLineX) < AI_MIDFIELD_OFFSET_X;
      const ballInDefensiveThird = Math.abs(ballPosition.x - goalLineX) < AI_MIDFIELD_OFFSET_X;
      
      // --- Get teammate with the ball ---
      const playerWithBall = sharedState.getAttachedPlayer();
      const teammateHasBall = playerWithBall && 
                             playerWithBall instanceof SoccerPlayerEntity && 
                             playerWithBall.team === this.team;
      
      // --- Box-to-Box Movement Logic ---
      
      // 1. DEFENSIVE DUTY: Ball in our defensive third - help defense
      if (ballInDefensiveThird) {
        console.log(`Midfielder ${this.player.username} helping on defense`);
        
        // If ball is on our preferred side, closely mark that area
        const ballOnMySide = (sidePreference === -1 && ballPosition.z < fieldCenterZ) || 
                             (sidePreference === 1 && ballPosition.z > fieldCenterZ);
                             
        if (ballOnMySide) {
          // Move to defensive position between ball and goal
          const defenseX = goalLineX + (this.team === 'red' ? AI_DEFENSIVE_OFFSET_X * 0.5 : -AI_DEFENSIVE_OFFSET_X * 0.5);
          targetPos = {
            x: defenseX,
            y: myPosition.y,
            z: ballPosition.z * 0.7 + fieldCenterZ * 0.3 // Shift toward center while tracking ball Z
          };
        } else {
          // Provide central cover, biased to preferred side
          targetPos = {
            x: goalLineX + (this.team === 'red' ? AI_DEFENSIVE_OFFSET_X * 0.7 : -AI_DEFENSIVE_OFFSET_X * 0.7),
            y: myPosition.y,
            z: fieldCenterZ + (sidePreference * 5) // Stay on preferred side
          };
        }
      }
      // 2. SUPPORT DUTY: Teammate has ball - provide support options
      else if (teammateHasBall) {
        console.log(`Midfielder ${this.player.username} supporting teammate with ball`);
        
        // Provide a passing option in a slightly advanced position
        const supportDirection = this.team === 'red' ? 1 : -1; // Support forward from teammate
        targetPos = {
          x: playerWithBall.position.x + (10 * supportDirection), // Support ahead
          y: myPosition.y,
          z: playerWithBall.position.z + (sidePreference * 8) // Stay wide on preferred side
        };
      }
      // 3. ATTACKING DUTY: Ball in attacking third - join attack
      else if (ballInAttackingThird) {
        console.log(`Midfielder ${this.player.username} joining attack`);
        
        // Make a run into the box if ball is on opposite flank
        const ballOnOppositeSide = (sidePreference === -1 && ballPosition.z > fieldCenterZ) || 
                                   (sidePreference === 1 && ballPosition.z < fieldCenterZ);
                                   
        if (ballOnOppositeSide) {
          // Late run into box from opposite side
          targetPos = {
            x: opponentGoalLineX + (this.team === 'red' ? -8 : 8), // Into penalty area
            y: myPosition.y,
            z: fieldCenterZ - (sidePreference * 4) // Cut inside toward goal
          };
        } else {
          // Provide width and crossing opportunity
          targetPos = {
            x: ballPosition.x + (this.team === 'red' ? 5 : -5), // Slightly ahead of ball
            y: myPosition.y,
            z: fieldCenterZ + (sidePreference * (midfieldZBoundary - fieldCenterZ) * 0.7) // Wide position
          };
        }
      }
      // 4. DEFAULT: Ball in midfield - maintain shape and position
      else {
        console.log(`Midfielder ${this.player.username} maintaining disciplined formation position`);
        
        // Get the AI's basic formation position for their role
        const formationPosition = this.getRoleBasedPosition(); 
        
        // Apply enhanced position discipline for midfielders to prevent center clustering
        const disciplineFactor = POSITION_DISCIPLINE_FACTOR[this.aiRole];
        
        // Reduced ball-following to maintain formation better
        // Scale down the ball-following factor based on discipline
        const ballFollowFactor = 0.15 * (1 - disciplineFactor); // Much reduced from 0.3
        
        // Shift from their formation X towards the ball's X by a smaller factor
        // This keeps them anchored to their side but still responsive
        const dynamicX = formationPosition.x + ((ballPosition.x - formationPosition.x) * ballFollowFactor);

        // For Z, maintain strong width discipline - prevent both midfielders converging to center
        let dynamicZ = formationPosition.z;
        
        // Only allow very limited Z adjustment based on ball position
        const zAdjustmentFactor = 0.1 * (1 - disciplineFactor); // Very limited Z movement
        const ballZOffset = (ballPosition.z - formationPosition.z) * zAdjustmentFactor;
        
        // Apply the offset but ensure we maintain minimum separation between midfielders
        dynamicZ = formationPosition.z + ballZOffset;
        
        // Enforce minimum lateral separation between the two central midfielders
        const currentTeammates = this.getVisibleTeammates();
        const otherMidfielder = currentTeammates.find((t: SoccerPlayerEntity) => 
          t instanceof AIPlayerEntity && 
          t.aiRole.includes('midfielder') && 
          t.aiRole !== this.aiRole
        );
        
        if (otherMidfielder) {
          const lateralDistance = Math.abs(dynamicZ - otherMidfielder.position.z);
          const minSeparation = 12; // Minimum separation between midfielders
          
          if (lateralDistance < minSeparation) {
            // Push this midfielder back toward their formation side
            const sideDirection = sidePreference; // -1 for left, 1 for right
            const separationAdjustment = (minSeparation - lateralDistance) / 2;
            dynamicZ = formationPosition.z + (sideDirection * separationAdjustment);
          }
        }
        
        targetPos = {
          x: dynamicX,
          y: myPosition.y,
          z: dynamicZ
        };
        
        // Additional check: ensure we're not too close to field center
        const centerDistance = this.distanceBetween(targetPos, 
          { x: AI_FIELD_CENTER_X, y: targetPos.y, z: AI_FIELD_CENTER_Z });
        
        if (centerDistance < 8) { // If too close to center
          // Push toward formation position
          const awayFromCenterX = formationPosition.x - AI_FIELD_CENTER_X;
          const awayFromCenterZ = formationPosition.z - AI_FIELD_CENTER_Z;
          const awayLength = Math.sqrt(awayFromCenterX * awayFromCenterX + awayFromCenterZ * awayFromCenterZ);
          
          if (awayLength > 0.1) {
            targetPos.x = AI_FIELD_CENTER_X + (awayFromCenterX / awayLength) * 10;
            targetPos.z = AI_FIELD_CENTER_Z + (awayFromCenterZ / awayLength) * 10;
          }
        }
      }
      
      // --- PURSUIT OVERRIDE ---
      // Enhanced pursuit logic with position discipline consideration
      if (!this.isKickoffActive && 
          sharedState.getBallHasMoved() && 
          distanceToBall < MIDFIELDER_PURSUIT_DISTANCE) {
          
          // Get formation position and distance from it
          const formationPosition = this.getRoleBasedPosition();
          const distanceFromFormation = this.distanceBetween(myPosition, formationPosition);
          const disciplineFactor = POSITION_DISCIPLINE_FACTOR[this.aiRole];
          
          // Reduce pursuit probability if far from formation position
          let formationPenalty = 0;
          if (distanceFromFormation > 15) {
            formationPenalty = 0.3 * disciplineFactor; // Higher discipline = more penalty
          }
          
          // Conditions that increase pursuit probability:
          // 1. Ball is on midfielder's preferred side
          // 2. Ball is in central midfield area (but not too central to avoid clustering)
          // 3. No teammate is closer to the ball
          // 4. Player is not too far from formation position
          const ballOnPreferredSide = (sidePreference === -1 && ballPosition.z < fieldCenterZ) || 
                                     (sidePreference === 1 && ballPosition.z > fieldCenterZ);
                                     
          const isClosestTeammate = this.isClosestTeammateToPosition(ballPosition);
          const centralPosition = Math.abs(ballPosition.z - fieldCenterZ) < 10;
          
          // Reduce pursuit if ball is too close to center (prevent clustering)
          const ballTooClose = this.distanceBetween(ballPosition, 
            { x: AI_FIELD_CENTER_X, y: ballPosition.y, z: AI_FIELD_CENTER_Z }) < 8;
          
          let pursuitBonus = 0;
          if (ballOnPreferredSide) pursuitBonus += 0.15; // Reduced from 0.2
          if (centralPosition && !ballTooClose) pursuitBonus += 0.1;
          if (isClosestTeammate) pursuitBonus += 0.2; // Reduced from 0.3
          
          // Apply formation penalty and discipline
          const basePursuitProbability = ROLE_PURSUIT_PROBABILITY[roleKey] * (1 - disciplineFactor * 0.3);
          const finalPursuitProbability = Math.max(0, basePursuitProbability + pursuitBonus - formationPenalty);
          
          // Additional check: don't pursue if it would create center clustering
          const wouldClusterAtCenter = ballTooClose && this.getVisibleTeammates().filter((t: SoccerPlayerEntity) => 
            t instanceof AIPlayerEntity && 
            this.distanceBetween(t.position, ballPosition) < 8
          ).length >= 2;
          
          if (!wouldClusterAtCenter && Math.random() < finalPursuitProbability) {
              console.log(`Midfielder ${this.player.username} pursuing ball (prob: ${finalPursuitProbability.toFixed(2)}, form_dist: ${distanceFromFormation.toFixed(1)})`);
              
              const ballVelocity = sharedState.getSoccerBall()?.linearVelocity;
              if (ballVelocity && (Math.abs(ballVelocity.x) > 0.5 || Math.abs(ballVelocity.z) > 0.5)) {
                // Anticipate ball movement for interception
                const anticipatedBallPos = {
                  x: ballPosition.x + (ballVelocity.x * BALL_ANTICIPATION_FACTOR),
                  y: ballPosition.y,
                  z: ballPosition.z + (ballVelocity.z * BALL_ANTICIPATION_FACTOR)
                };
                targetPos = anticipatedBallPos;
              } else {
                // Direct pursuit if ball is not moving fast
                targetPos = ballPosition;
              }
          } else if (wouldClusterAtCenter) {
              console.log(`Midfielder ${this.player.username} avoiding pursuit to prevent center clustering`);
          }
      }
    }
    
    // Clamp final Z position and apply spacing
    this.targetPosition = this.constrainToPreferredArea(targetPos, roleKey);
    this.targetPosition = this.adjustPositionForSpacing(this.targetPosition);
  }
  
  /**
   * Checks if this AI player is the closest teammate to the given position
   * Used for deciding who should pursue the ball
   * Changed to public for use in behavior tree
   */
  public isClosestTeammateToPosition(position: Vector3Like): boolean {
    const teammates = sharedState.getAITeammates(this);
    const myDistance = this.distanceBetween(this.position, position);
    
    for (const teammate of teammates) {
      if (!teammate.isSpawned) continue;
      
      const teammateDistance = this.distanceBetween(teammate.position, position);
      if (teammateDistance < myDistance) {
        return false; // Found a closer teammate
      }
    }
    
    return true; // This player is closest
  }
  
  /**
   * Gets teammates that are visible and in play (including human players)
   * Used for making passing decisions
   * Changed to public for use in behavior tree
   */
  public getVisibleTeammates(): SoccerPlayerEntity[] {
    // Get AI teammates
    const aiTeammates = sharedState.getAITeammates(this);
    const result: SoccerPlayerEntity[] = [];
    
    // Add spawned AI teammates
    for (const teammate of aiTeammates) {
      if (teammate.isSpawned && !teammate.isPlayerFrozen) {
        result.push(teammate);
      }
    }
    
    // Get all player entities from the world to include human players
    if (this.world) {
      const allPlayerEntities = this.world.entityManager.getAllPlayerEntities();
      for (const playerEntity of allPlayerEntities) {
        if (playerEntity instanceof SoccerPlayerEntity && 
            playerEntity !== this && 
            playerEntity.team === this.team && 
            playerEntity.isSpawned && 
            !playerEntity.isPlayerFrozen &&
            !(playerEntity instanceof AIPlayerEntity)) { // Only add human players (not AI)
          result.push(playerEntity);
        }
      }
    }
    
    return result;
  }

  /**
   * Simulate shooting the ball towards a specified target point.
   * Changed to public for use in behavior tree
   * @param targetPoint The world coordinates to shoot the ball towards.
   * @param powerMultiplier Optional multiplier for the shot force (default: 1.0).
   * @returns True if the shot was attempted, false otherwise.
   */
  public shootBall(targetPoint: Vector3Like, powerMultiplier: number = 1.0): boolean {
    const ball = sharedState.getSoccerBall();
    if (!ball || sharedState.getAttachedPlayer() !== this) return false;

    // Calculate direction components towards the targetPoint
    const dx = targetPoint.x - this.position.x;
    const dz = targetPoint.z - this.position.z;

    // Calculate horizontal distance for arc calculation
    const distanceHorizontal = Math.sqrt(dx * dx + dz * dz);

    // Calculate the vertical component for the arc with enhanced formula
    // This creates a more realistic arc that scales better with distance
    // Uses a combination of linear and quadratic scaling for natural trajectory
    const baseArc = distanceHorizontal * SHOT_ARC_FACTOR;
    const distanceBonus = Math.min(distanceHorizontal / 30, 1.0) * 0.8; // Extra arc for long shots
    const calculatedY = baseArc + distanceBonus;

    const direction = {
        x: dx,
        y: calculatedY, // Use calculated Y for arc
        z: dz
    };

    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    if (length === 0) return false; // Avoid division by zero

    // Normalize the direction vector
    direction.x /= length;
    direction.y /= length;
    direction.z /= length;

    sharedState.setAttachedPlayer(null);
    
    // Apply powerMultiplier to the base SHOT_FORCE with safety caps
    let effectiveMultiplier = 1.0; // TESTING: Force all AI shots to use base 4.5 force only
    
    // Calculate the effective shot force with a hard maximum cap
    const effectiveShotForce = Math.min(SHOT_FORCE * effectiveMultiplier, 10); // Increased cap from 6 to 10 for better shooting range
    
    // Limit the vertical component to prevent excessively high arcs
    const verticalComponent = direction.y * effectiveShotForce;
    const maxVerticalForce = 4.0; // Balanced vertical force to prevent shots from going over crossbar
    const finalVerticalForce = Math.min(verticalComponent, maxVerticalForce);
    
    // Apply impulse with controlled vertical component
    ball.applyImpulse({ 
      x: direction.x * effectiveShotForce, 
      y: finalVerticalForce, 
      z: direction.z * effectiveShotForce 
    });
    
    // Reset angular velocity immediately and continue resetting for a short period
    // This prevents unwanted spinning/backwards movement from ground collisions
    ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
    
    // Continue resetting angular velocity for 500ms to prevent spin from ground contact
    let resetCount = 0;
    const maxResets = 10; // Reset 10 times over 500ms
    const resetInterval = setInterval(() => {
      if (resetCount >= maxResets || !ball.isSpawned) {
        clearInterval(resetInterval);
        return;
      }
      ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
      resetCount++;
    }, 50); // Reset every 50ms
    
    this.startModelOneshotAnimations(["kick"]);
    return true;
  }
  
  /**
   * Simulate passing the ball (generally forward X)
   * Changed to public for use in behavior tree
   * Now returns true if pass was attempted, false otherwise
   */
  public passBall(): boolean {
    const ball = sharedState.getSoccerBall();
    if (!ball || sharedState.getAttachedPlayer() !== this) return false;

    const teammates = this.getVisibleTeammates();
    let bestTargetPlayer: PlayerEntity | null = null;
    let passTargetPosition: Vector3Like = { x: 0, y: 0, z: 0 }; // Initialize with default values
    let bestScore = -Infinity;

    const opponentGoalX = this.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;

    // Process for all player types - more sophisticated passing algorithm
    for (const teammate of teammates) {
      if (teammate === this) continue;
      
      // Calculate distance to teammate
      const distanceToTeammate = this.distanceBetween(this.position, teammate.position);
      if (distanceToTeammate > 30) continue; // Skip teammates that are too far away
      
      // Calculate how open the teammate is (space score)
      let spaceScore = 10;
      const opponents = this.team === 'red' ? sharedState.getBlueAITeam() : sharedState.getRedAITeam();
      for (const opponent of opponents) {
        if (!opponent.isSpawned) continue;
        const distanceToOpponent = this.distanceBetween(teammate.position, opponent.position);
        if (distanceToOpponent < 5) spaceScore -= 4;
        else if (distanceToOpponent < 10) spaceScore -= 2;
      }
      
      // SAFETY CHECK: Verify pass direction is safe before considering this teammate
      const passDirection = {
        x: teammate.position.x - this.position.x,
        y: 0,
        z: teammate.position.z - this.position.z
      };
      const passLength = Math.sqrt(passDirection.x * passDirection.x + passDirection.z * passDirection.z);
      if (passLength > 0) {
        passDirection.x /= passLength;
        passDirection.z /= passLength;
        
        // Check if this pass direction is safe
        if (!this.isPassDirectionSafe(this.position, passDirection, distanceToTeammate)) {
          console.log(`${this.aiRole} ${this.player.username} skipping unsafe pass to ${teammate.player.username}`);
          continue; // Skip this teammate if pass would be unsafe
        }
      }
      
      // Calculate forward progression bonus
      const isForward = (this.team === 'red' && teammate.position.x > this.position.x) ||
                      (this.team === 'blue' && teammate.position.x < this.position.x);
      const forwardPositionBonus = isForward ? 5 : 0;
      
      // Calculate proximity to goal bonus (for all players, not just striker)
      const teammateDistanceToGoal = Math.abs(teammate.position.x - opponentGoalX);
      const goalProximityBonus = 20 - Math.min(20, teammateDistanceToGoal / 2);
      
      // Role-based scoring adjustments
      let roleBonus = 0;
      
      // HUMAN PLAYER PRIORITY: Give human players massive bonus to ensure they always receive passes
      if (!(teammate instanceof AIPlayerEntity)) {
        roleBonus = 50; // Huge bonus for human players - this ensures they're always prioritized
        console.log(`${this.aiRole} ${this.player.username} prioritizing human player ${teammate.player.username} for pass`);
      } else {
        // AI player role bonuses (much smaller than human bonus)
        switch (teammate.aiRole) {
          case 'striker':
            roleBonus = 10; // Prefer passing to strikers 
            break;
          case 'central-midfielder-1':
          case 'central-midfielder-2':
            roleBonus = 5; // Midfielders are good pass targets
            break;
          case 'left-back':
          case 'right-back':
            roleBonus = isForward ? 3 : 0; // Only prefer backs when they're forward
            break;
          case 'goalkeeper':
            roleBonus = -15; // Avoid passing back to goalkeeper unless no other options
            break;
        }
      }
      
      // Final score calculation
      const score = (30 - Math.min(30, distanceToTeammate)) + // Closer is better, but capped
                  spaceScore * 2 + // Open space is important
                  forwardPositionBonus + // Bonus for forward positions
                  goalProximityBonus + // Bonus for proximity to goal
                  roleBonus + // Role-specific adjustments
                  (Math.random() * 2); // Tiny random factor to break ties
      
      if (score > bestScore) {
        bestScore = score;
        bestTargetPlayer = teammate;
      }
    }

    // Now determine the target position based on the best teammate
    if (bestTargetPlayer) {
      // Lead the pass based on distance - longer passes need more lead
      const passDirectionX = bestTargetPlayer.position.x - this.position.x;
      const passDirectionZ = bestTargetPlayer.position.z - this.position.z;
      const passDist = Math.sqrt(passDirectionX * passDirectionX + passDirectionZ * passDirectionZ);
      
      // Adjust lead factor based on distance
      const leadFactor = Math.min(4.0, 2.0 + (passDist / 10));
      
      if (passDist > 0) {
        const normDx = passDirectionX / passDist;
        const normDz = passDirectionZ / passDist;
        passTargetPosition = {
          x: bestTargetPlayer.position.x + normDx * leadFactor,
          y: bestTargetPlayer.position.y,
          z: bestTargetPlayer.position.z + normDz * leadFactor
        };
      } else {
        passTargetPosition = bestTargetPlayer.position;
      }
      
      // Log the passing decision
      console.log(`${this.aiRole} ${this.player.username} passing to ${bestTargetPlayer.player.username} with score ${bestScore.toFixed(1)}`);
    } else {
      // No suitable teammate found, make a general forward pass
      console.log(`${this.aiRole} ${this.player.username} - no specific teammate target, making a general forward pass`);
      
      // Make a more controlled forward pass based on field position
      const forwardDirection = this.team === 'red' ? 1 : -1;
      const currentX = this.position.x;
      const fieldCenter = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
      
      // Adjust pass distance based on field position
      let passDistance = 12;
      
      // If on own half, make a longer pass
      if ((this.team === 'red' && currentX < fieldCenter) || 
          (this.team === 'blue' && currentX > fieldCenter)) {
        passDistance = 18;
      }
      
      passTargetPosition = {
        x: this.position.x + (forwardDirection * passDistance),
        y: this.position.y,
        z: this.position.z + ((Math.random() * 10) - 5) // Small random Z offset
      };
    }

    // Use a power multiplier based on the distance to the target
    const distanceToTarget = this.distanceBetween(this.position, passTargetPosition);
    
    // More conservative power calculation to prevent out-of-bounds passes
    let powerMultiplier = Math.min(0.8, 0.4 + (distanceToTarget / 50)); // Reduced max from 1.0 to 0.8
    
    // Additional safety check: reduce power if target is near field boundaries
    const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
    const fieldCenterZ = AI_FIELD_CENTER_Z;
    const distanceFromCenterX = Math.abs(passTargetPosition.x - fieldCenterX);
    const distanceFromCenterZ = Math.abs(passTargetPosition.z - fieldCenterZ);
    const fieldWidthX = Math.abs(FIELD_MAX_X - FIELD_MIN_X);
    const fieldWidthZ = Math.abs(FIELD_MAX_Z - FIELD_MIN_Z);
    
    // If target is in outer 30% of field, reduce power significantly
    if (distanceFromCenterX > fieldWidthX * 0.35 || distanceFromCenterZ > fieldWidthZ * 0.35) {
      powerMultiplier *= 0.7; // Reduce power by 30% for edge passes
      console.log(`${this.aiRole} ${this.player.username} reducing pass power for edge target`);
    }
    
    // Execute the pass
    return this.forcePass(bestTargetPlayer, passTargetPosition, powerMultiplier);
  }
  
  /**
   * Simulate tackling for the ball
   * Changed to public for use in behavior tree
   */
  public tackleBall() {
    if (this.isTackling) return;
    const ball = sharedState.getSoccerBall();
    if (!ball) return;
    const direction = { x: ball.position.x - this.position.x, z: ball.position.z - this.position.z };
    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (length < 0.1 || length > 3) return; // Only tackle if reasonably close
    direction.x /= length; direction.z /= length;
    this.isTackling = true;
    this.applyImpulse({ x: direction.x * 12, y: 1, z: direction.z * 12 }); // Slightly stronger tackle
    setTimeout(() => { this.isTackling = false; }, 600); // Slightly longer tackle duration/cooldown
  }
  
  /**
   * Calculate the distance between two points
   * Changed to public for use in behavior tree
   */
  public distanceBetween(pos1: Vector3Like, pos2: Vector3Like): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Handle entity tick updates, including movement and animation
   * Using applyImpulse, but scaled to simulate force over time.
   * @param deltaTimeMs - Time elapsed since the last tick in milliseconds
   */
  private handleTick(deltaTimeMs: number) {
    // Performance profiling: Start timing entity tick
    const tickStartTime = performance.now();
    
    // Do nothing if frozen or not properly set up
    if (this.isPlayerFrozen || !this.isSpawned || !this.targetPosition || !this.controller) {
      return;
    }

    // BALL POSSESSION TIMER CHECK FOR ALL PLAYERS
    // Check if this player has the ball
    const attachedPlayer = sharedState.getAttachedPlayer();
    const hasBall = attachedPlayer === this;
    
    // Start the timer if player has the ball and the timer isn't started yet
    if (hasBall && this.ballPossessionStartTime === null) {
      this.ballPossessionStartTime = Date.now();
      console.log(`TIMER START: ${this.aiRole} ${this.player.username} started possession timer`);
    }
    
    // Check and reset the timer if the player no longer has the ball
    if (!hasBall && this.ballPossessionStartTime !== null) {
      this.ballPossessionStartTime = null;
      console.log(`TIMER RESET: ${this.aiRole} ${this.player.username} no longer has the ball`);
    }
    
    // If player has the ball, check the possession time
    if (hasBall && this.ballPossessionStartTime !== null) {
      const possessionTime = Date.now() - this.ballPossessionStartTime;
      const maxPossessionTime = this.getMaxPossessionTime();
      
      // Only log every 500ms to avoid spamming console
      if (possessionTime % 500 < 50) {
        console.log(`TIMER CHECK: ${this.aiRole} ${this.player.username} has had the ball for ${possessionTime}ms / ${maxPossessionTime}ms`);
      }
      
      // CRITICAL: Force passing or shooting if possession time exceeds limit
      if (possessionTime >= maxPossessionTime) {
        // Use the extracted helper method for better organization
        this.handleForcedBallRelease(possessionTime);
      }
    }

    // Safety check: ensure position is available
    if (!this.position) {
      console.warn(`AI ${this.player.username} (${this.aiRole}): position is undefined in handleTick`);
      return;
    }

    const rawPosition = this.position; // Read the position object
    // Ensure currentPosition is a new, plain object with only x, y, z from rawPosition
    const currentPosition = { 
      x: typeof rawPosition.x === 'number' ? rawPosition.x : 0, 
      y: typeof rawPosition.y === 'number' ? rawPosition.y : 0, 
      z: typeof rawPosition.z === 'number' ? rawPosition.z : 0 
    };

    if (!this.lastAIPosition) {
      this.lastAIPosition = { ...currentPosition }; // Initialize last position with clone
      return; // Skip first tick for velocity calculation
    }

    // Calculate distance moved since last tick (for animation speed detection)
    const deltaX = currentPosition.x - this.lastAIPosition.x;
    const deltaZ = currentPosition.z - this.lastAIPosition.z;
    const distanceMoved = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    // Use deltaTimeMs if > 0, otherwise default to a small value to avoid division by zero
    const timeDeltaSeconds = deltaTimeMs > 0 ? deltaTimeMs / 1000 : 0.016; 
    const speed = (distanceMoved / timeDeltaSeconds) || 0; // Speed in units per second

    // Update animation based on speed - use the extracted helper method
    this.updateAnimationState(speed);

    // Movement logic using physics - use the extracted helper method
    this.updatePhysicsMovement(currentPosition);

    // Debug Logging (Uncommented to diagnose clumping)
    if (Math.random() < 0.01) { // Reduced logging frequency from 0.05 to 0.01
      const currentVelocity = this.linearVelocity || { x: 0, y: 0, z: 0 };
      console.log(`AI ${this.player.username} (${this.aiRole}): 
        Target: ${this.targetPosition.x.toFixed(1)}, ${this.targetPosition.z.toFixed(1)}
        Current: ${currentPosition.x.toFixed(1)}, ${currentPosition.z.toFixed(1)}
        Dist: ${this.distanceBetween(currentPosition, this.targetPosition).toFixed(1)}
        CurrentVel: ${currentVelocity.x.toFixed(1)}, ${currentVelocity.z.toFixed(1)}
        Speed: ${speed.toFixed(1)} Anim: ${this.currentAnimState}`);
    }

    // Update last position for next tick's speed calculation
    this.lastAIPosition = { ...currentPosition }; // Clone position before storing
    
    // Performance profiling: Record entity tick timing
    const tickEndTime = performance.now();
    const tickDuration = tickEndTime - tickStartTime;
    
    // Get performance profiler from world if available
    const profiler = (this.world as any)._performanceProfiler;
    if (profiler) {
      profiler.recordEntityTick(tickDuration);
    }
  }
  
  /**
   * Adjusts the target position to maintain proper spacing and formation discipline.
   * Enhanced to prevent center-field clustering and maintain realistic soccer formations.
   * Changed to public for use in behavior tree
   */
  /**
   * Adjusts AI player positioning to maintain proper spacing and formation discipline
   * 
   * This function applies multiple spatial adjustments to prevent AI clustering:
   * - Teammate repulsion: Prevents players from getting too close to each other
   * - Center field avoidance: Reduces clustering around the center circle
   * - Formation discipline: Pulls players back toward their assigned positions
   * - Role-based jitter: Adds small positional variations based on player role
   * 
   * @param targetPos The desired target position before spacing adjustments
   * @returns The adjusted position with spacing and formation considerations applied
   */
  public adjustPositionForSpacing(targetPos: Vector3Like): Vector3Like {
    const teammates = sharedState.getAITeammates(this);
    let adjustment = { x: 0, y: 0, z: 0 };
    
    // Enhanced teammate repulsion with role-based considerations
    teammates.forEach(teammate => {
      if (teammate.isSpawned && teammate !== this && teammate instanceof AIPlayerEntity) { 
        // Use target position for better spacing calculations
        const distance = this.distanceBetween(targetPos, teammate.position);
        
        if (distance < TEAMMATE_REPULSION_DISTANCE) {
          // Calculate direction vector away from teammate
          let awayVector = { 
            x: targetPos.x - teammate.position.x, 
            y: 0, 
            z: targetPos.z - teammate.position.z 
          };
          
          const length = Math.sqrt(awayVector.x * awayVector.x + awayVector.z * awayVector.z);
          if (length > 0.01) { 
            // Enhanced repulsion calculation with role-based factors
            let baseScale = TEAMMATE_REPULSION_STRENGTH * Math.pow(1 - (distance / TEAMMATE_REPULSION_DISTANCE), 2);
            
            // Same-role players repel each other more strongly
            if (this.aiRole === teammate.aiRole) {
              baseScale *= 1.5; // Stronger repulsion between same-role players
            }
            
            // During kickoff, use stronger repulsion to maintain formation
            if (this.isKickoffActive) {
              baseScale *= KICKOFF_SPACING_MULTIPLIER;
            }
            
            adjustment.x += (awayVector.x / length) * baseScale;
            adjustment.z += (awayVector.z / length) * baseScale;
          }
        }
      }
    });
    
    // Center field avoidance - prevent clustering in center during all phases
    const centerDistance = this.distanceBetween(targetPos, 
      { x: AI_FIELD_CENTER_X, y: targetPos.y, z: AI_FIELD_CENTER_Z });
    
    // Apply center avoidance based on role and game state
    if (centerDistance < CENTER_AVOIDANCE_RADIUS) {
      const roleDefinition = ROLE_DEFINITIONS[this.aiRole];
      
      // Some roles (like goalkeepers and defenders) should avoid center more
      let avoidanceStrength = 0.3; // Base avoidance
      
      if (this.aiRole === 'goalkeeper') {
        avoidanceStrength = 0.8; // Goalkeepers strongly avoid center
      } else if (this.aiRole.includes('back')) {
        avoidanceStrength = 0.6; // Defenders moderately avoid center
      } else if (this.isKickoffActive) {
        avoidanceStrength = 0.7; // All players avoid center during kickoffs
      }
      
      const awayFromCenterX = targetPos.x - AI_FIELD_CENTER_X;
      const awayFromCenterZ = targetPos.z - AI_FIELD_CENTER_Z;
      const awayLength = Math.sqrt(awayFromCenterX * awayFromCenterX + awayFromCenterZ * awayFromCenterZ);
      
      if (awayLength > 0.1) {
        const pushFactor = (CENTER_AVOIDANCE_RADIUS - centerDistance) / CENTER_AVOIDANCE_RADIUS;
        adjustment.x += (awayFromCenterX / awayLength) * pushFactor * avoidanceStrength * 6;
        adjustment.z += (awayFromCenterZ / awayLength) * pushFactor * avoidanceStrength * 6;
      }
    }
    
    // Position discipline - pull players back toward their formation position
    const formationPosition = this.getRoleBasedPosition();
    const disciplineFactor = POSITION_DISCIPLINE_FACTOR[this.aiRole];
    const distanceFromFormation = this.distanceBetween(targetPos, formationPosition);
    
    // Apply discipline pull when player is far from formation position
    if (distanceFromFormation > 8) { // Only apply when significantly out of position
      const backToFormationX = formationPosition.x - targetPos.x;
      const backToFormationZ = formationPosition.z - targetPos.z;
      const formationLength = Math.sqrt(backToFormationX * backToFormationX + backToFormationZ * backToFormationZ);
      
      if (formationLength > 0.1) {
        const disciplineStrength = disciplineFactor * 0.3; // Scale discipline effect
        adjustment.x += (backToFormationX / formationLength) * disciplineStrength * 4;
        adjustment.z += (backToFormationZ / formationLength) * disciplineStrength * 4;
      }
    }
    
    // Reduced role-based jitter - less randomness for more realistic positioning
    const roleDefinition = ROLE_DEFINITIONS[this.aiRole];
    const baseJitter = this.isKickoffActive ? 0.1 : 0.2; // Less jitter during kickoffs
    const jitterScale = baseJitter + (roleDefinition.offensiveContribution / 80); // Reduced jitter scale
    
    adjustment.x += (Math.random() - 0.5) * jitterScale * 1.5;  // Reduced random variation
    adjustment.z += (Math.random() - 0.5) * jitterScale * 1.5;  // Reduced random variation
    
    return { 
      x: targetPos.x + adjustment.x, 
      y: targetPos.y, 
      z: targetPos.z + adjustment.z 
    };
  }
  
  /**
   * Checks if a position is within a role's preferred area
   * Used to determine if AI should pursue a ball outside its assigned area
   */
  public isPositionInPreferredArea(position: Vector3Like, role: SoccerAIRole): boolean {
    const roleDef = ROLE_DEFINITIONS[role];
    const roleArea = roleDef.preferredArea;
    // const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2; // Use AI_FIELD_CENTER_X from gameConfig
    
    let constrainedMinX, constrainedMaxX;
    // Determine the direction the AI attacks. Red attacks towards positive X, Blue towards negative X.
    const attackingMultiplier = (this.team === 'red') ? 1 : -1;

    // Calculate the boundaries based on ownGoalLineX and the role's defined X range.
    const ownGoalLineX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    if (role === 'goalkeeper') {
      // For goalkeeper, minX and maxX are offsets from their own goal line
      constrainedMinX = ownGoalLineX + roleArea.minX;
      constrainedMaxX = ownGoalLineX + roleArea.maxX;
    } else {
      // For other roles, minX and maxX are relative to fieldCenterX
      const x_bound1 = AI_FIELD_CENTER_X + (attackingMultiplier * roleArea.minX);
      const x_bound2 = AI_FIELD_CENTER_X + (attackingMultiplier * roleArea.maxX);
      constrainedMinX = Math.min(x_bound1, x_bound2);
      constrainedMaxX = Math.max(x_bound1, x_bound2);
    }
    
    const adjustedMinZ = AI_FIELD_CENTER_Z + roleArea.minZ;
    const adjustedMaxZ = AI_FIELD_CENTER_Z + roleArea.maxZ;
    
    return position.x >= constrainedMinX && position.x <= constrainedMaxX &&
           position.z >= adjustedMinZ && position.z <= adjustedMaxZ;
  }
  
  /**
   * Constrains target position to remain within the preferred area for the given role
   * Changed to public for use in behavior tree
   */
  public constrainToPreferredArea(position: Vector3Like, role: SoccerAIRole): Vector3Like {
    const roleDef = ROLE_DEFINITIONS[role];
    const roleArea = roleDef.preferredArea;
    // const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2; // Use AI_FIELD_CENTER_X from gameConfig
    
    let constrainedMinX, constrainedMaxX;
    // Determine the direction the AI attacks. Red attacks towards positive X, Blue towards negative X.
    const attackingMultiplier = (this.team === 'red') ? 1 : -1;

    // Calculate the boundaries based on ownGoalLineX and the role's defined X range.
    // roleArea.minX is typically 0 (center line) or a positive value representing distance from center line.
    // roleArea.maxX is a positive value representing max distance from center line in attacking direction.
    const ownGoalLineX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    if (role === 'goalkeeper') {
      // For goalkeeper, minX and maxX are offsets from their own goal line
      constrainedMinX = ownGoalLineX + roleArea.minX;
      constrainedMaxX = ownGoalLineX + roleArea.maxX;
    } else {
      // For other roles, minX and maxX are relative to fieldCenterX
      const x_bound1 = AI_FIELD_CENTER_X + (attackingMultiplier * roleArea.minX);
      const x_bound2 = AI_FIELD_CENTER_X + (attackingMultiplier * roleArea.maxX);
      constrainedMinX = Math.min(x_bound1, x_bound2);
      constrainedMaxX = Math.max(x_bound1, x_bound2);
    }
    
    const adjustedMinZ = AI_FIELD_CENTER_Z + roleArea.minZ;
    const adjustedMaxZ = AI_FIELD_CENTER_Z + roleArea.maxZ;
    
    // First, constrain to role's preferred area
    let constrainedXByRole = Math.max(constrainedMinX, Math.min(constrainedMaxX, position.x));
    let constrainedZByRole = Math.max(adjustedMinZ, Math.min(adjustedMaxZ, position.z));
    let constrainedYByRole = position.y; // Y is not typically constrained by role preferred area in 2D sense

    // Debug log for role-based clamping (optional)
    // if (constrainedXByRole !== position.x || constrainedZByRole !== position.z) {
    //   console.log(`AI ${this.player.username} (${this.aiRole}) role-constrained ${position.x.toFixed(1)},${position.z.toFixed(1)} to ${constrainedXByRole.toFixed(1)},${constrainedZByRole.toFixed(1)}`);
    // }

    // Then, apply absolute global field boundaries
    const finalConstrainedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, constrainedXByRole));
    const finalConstrainedY = Math.max(FIELD_MIN_Y, Math.min(FIELD_MAX_Y, constrainedYByRole));
    const finalConstrainedZ = Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, constrainedZByRole));
    
    // Debug log if global field boundaries further clamped the position (optional)
    // if (finalConstrainedX !== constrainedXByRole || finalConstrainedZ !== constrainedZByRole || finalConstrainedY !== constrainedYByRole) {
    //   console.log(`AI ${this.player.username} (${this.aiRole}) globally-clamped role-pos ${constrainedXByRole.toFixed(1)},${constrainedZByRole.toFixed(1)} to ${finalConstrainedX.toFixed(1)},${finalConstrainedZ.toFixed(1)}`);
    // }

    return {
      x: finalConstrainedX,
      y: finalConstrainedY,
      z: finalConstrainedZ
    };
  }

  /**
   * Override the default moveToSpawnPoint to use role-based positions
   * This ensures AI players maintain their proper positions after goals
   * Also updates the internal targetPosition.
   */
  public override moveToSpawnPoint() {
    if (!this.isSpawned) return;
    
    // Get role-specific spawn position based on team and role
    // This reuses the same position logic from the start of the game
    // to ensure consistent positioning
    const spawnPosition = this.getRoleBasedPosition();
    
    // Reset physics state before positioning
    this.setLinearVelocity({ x: 0, y: 0, z: 0 });
    this.setAngularVelocity({ x: 0, y: 0, z: 0 });
    this.setPosition(spawnPosition);
    
    // Set rotation based on team (red faces blue goal, blue faces red goal)
    if (this.team === "blue") {
      // Correct rotation: 180 degrees around Y-axis to face opponent's goal
      this.setRotation({ x: 0, y: 1, z: 0, w: 0 }); 
    } else {
      // Red team faces forward (default rotation)
      this.setRotation({ x: 0, y: 0, z: 0, w: 1 });
    }
    
    this.wakeUp(); // Ensure physics state is updated after teleport
  }
  
  /**
   * Get the position based on role and team
   * Changed to public for use in behavior tree
   */
  public getRoleBasedPosition(): Vector3Like {
    const isRed = this.team === 'red';
    const y = SAFE_SPAWN_Y; // Use safe spawn height
    let x = 0; // Depth relative to goal lines
    let z = 0; // Width relative to center Z

    // Determine own goal line and forward direction based on team
    const ownGoalLineX = isRed ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    // Corrected: Red moves towards positive X, Blue towards negative X from their respective goal lines.
    const forwardXMultiplier = isRed ? 1 : -1; 

    // Check if constants are defined
    if (ownGoalLineX === undefined || AI_FIELD_CENTER_Z === undefined ||
        AI_DEFENSIVE_OFFSET_X === undefined || AI_MIDFIELD_OFFSET_X === undefined || AI_FORWARD_OFFSET_X === undefined ||
        AI_WIDE_Z_BOUNDARY_MIN === undefined || AI_WIDE_Z_BOUNDARY_MAX === undefined ||
        AI_MIDFIELD_Z_BOUNDARY_MIN === undefined || AI_MIDFIELD_Z_BOUNDARY_MAX === undefined) {
      console.error(`!!! AI ${this.player.username} (${this.aiRole}): Missing one or more gameConfig constants in getRoleBasedPosition! Defaulting to 0,0.`);
      return { x: 0, y: SAFE_SPAWN_Y, z: 0 }; // Fallback to origin with safe Y
    }

    // Define standard formation positions relative to own goal line and center Z
    switch (this.aiRole) {
      case 'goalkeeper':
        // Goalkeeper is 1 unit IN FRONT of their own goal line.
        // If red goal is -37, forward is +1, so -37 + (1*1) = -36.
        // If blue goal is 52, forward is -1, so 52 + (1*-1) = 51.
        x = ownGoalLineX + (1 * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z; // Center of the goal width
        break;
      case 'left-back': // Min Z side
        // Defenders are OFFSET units in front of their own goal line.
        x = ownGoalLineX + (AI_DEFENSIVE_OFFSET_X * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z + (AI_WIDE_Z_BOUNDARY_MIN - AI_FIELD_CENTER_Z) * 0.6; // Positioned towards the left sideline
        break;
      case 'right-back': // Max Z side
        x = ownGoalLineX + (AI_DEFENSIVE_OFFSET_X * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z + (AI_WIDE_Z_BOUNDARY_MAX - AI_FIELD_CENTER_Z) * 0.6; // Positioned towards the right sideline
        break;
      case 'central-midfielder-1': // Min Z side preference
        x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z + (AI_MIDFIELD_Z_BOUNDARY_MIN - AI_FIELD_CENTER_Z) * 0.5; // Left side of center midfield
        break;
      case 'central-midfielder-2': // Max Z side preference
        x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z + (AI_MIDFIELD_Z_BOUNDARY_MAX - AI_FIELD_CENTER_Z) * 0.5; // Right side of center midfield
        break;
      case 'striker':
        x = ownGoalLineX + (AI_FORWARD_OFFSET_X * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z; // Central width
        break;
      default: // Fallback, place near center midfield
        console.warn(`AI ${this.player.username}: Unknown role '${this.aiRole}' in getRoleBasedPosition. Using default midfield position.`);
        x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier);
        z = AI_FIELD_CENTER_Z;
    }

    // Check for NaN results from calculations
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
       console.error(`!!! AI ${this.player.username} (${this.aiRole}): Calculated NaN position in getRoleBasedPosition! Role: ${this.aiRole}, Team: ${this.team}. Defaulting to 0,0.`);
       return { x: 0, y: SAFE_SPAWN_Y, z: 0 }; // Fallback to origin with safe Y
    }

    return { x, y, z };
  }

  /**
   * Decision making for Striker
   * Stays high up the field (X-axis), looks for scoring opportunities.
   * Enhanced to match the detailed striker role description.
   */
  private strikerDecision(ball: Entity, ballPosition: Vector3Like, myPosition: Vector3Like, hasBall: boolean, opponentGoalLineX: number) {
    const roleDefinition = ROLE_DEFINITIONS['striker'];
    let targetPos: Vector3Like;
    const distanceToBall = this.distanceBetween(myPosition, ballPosition);

    // Striker has the ball - look to score or hold up play
    if (hasBall) {
      console.log(`Striker ${this.player.username} has the ball`);
      
      // Calculate distance to goal
      const opponentGoalTarget: Vector3Like = { 
        x: this.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED, 
        y: 1, // Reference height for goal target
        z: AI_FIELD_CENTER_Z 
      };
      const distanceToGoal = this.distanceBetween(myPosition, opponentGoalTarget);
      
      // Enhanced shooting decision logic for strikers
      // Strikers should be more aggressive with shots but within reasonable range
      const inPrimeShootingRange = distanceToGoal < 15; // Reduced from 18 to prevent out of bounds
      const inDecentShootingRange = distanceToGoal < 22; // Reduced from 30 to prevent out of bounds
      const centralPosition = Math.abs(myPosition.z - AI_FIELD_CENTER_Z) < 12; // Wider shooting angle for strikers
      
      // High base probability for strikers to shoot when in position
      let shootingProbability = 0.6; // Higher base probability than midfielders
      
      if (inPrimeShootingRange) shootingProbability += 0.3;
      if (centralPosition) shootingProbability += 0.2;
      
      // Striker power adjustment based on distance - increased for effective shooting
      const powerMultiplier = distanceToGoal > 20 ? 1.2 : 1.1;
      
      // Attempt shot if in a good position (with higher probability than midfielders)
      if ((inPrimeShootingRange || (inDecentShootingRange && centralPosition)) && 
          Math.random() < shootingProbability) {
        console.log(`Striker ${this.player.username} shooting at goal from ${distanceToGoal.toFixed(1)}m!`);
        
        // Add slight randomness to shot placement
        const shootTarget = {
          x: opponentGoalTarget.x,
          y: opponentGoalTarget.y,
          z: opponentGoalTarget.z + ((Math.random() * 5) - 2.5) // Random offset for goal placement
        };
        
        this.shootBall(shootTarget, powerMultiplier);
        
        // Set target slightly away after shooting to avoid running into goal
        targetPos = {
          x: myPosition.x + (this.team === 'red' ? -2 : 2), 
          y: myPosition.y, 
          z: myPosition.z
        };
      } 
      // Too far to shoot - dribble toward goal or look to pass
      else {
        // Decide whether to pass (20% chance) or dribble (80% chance)
        // Reduced pass probability for strikers in attack
        if (Math.random() < 0.2) {
          console.log(`Striker ${this.player.username} looking to pass`);
          this.passBall();
        }
        
        // Dribble toward goal, slightly favoring the center
        const centralizing = 0.3; // How much to move toward center while dribbling
        targetPos = { 
          x: opponentGoalLineX, 
          y: myPosition.y, 
          z: myPosition.z * (1 - centralizing) + AI_FIELD_CENTER_Z * centralizing 
        };
      }
    }
    // Striker doesn't have the ball - position for attack
    else {
      // --- Positioning Phase ---
      // const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2; // Use AI_FIELD_CENTER_X
      const inAttackingHalf = (this.team === 'red' && ballPosition.x > AI_FIELD_CENTER_X) || 
                              (this.team === 'blue' && ballPosition.x < AI_FIELD_CENTER_X);
      
      // Base striker position - high and central
      const baseX = opponentGoalLineX + (this.team === 'red' ? -AI_FORWARD_OFFSET_X : AI_FORWARD_OFFSET_X);
      
      // Get the player with the ball
      const playerWithBall = sharedState.getAttachedPlayer();
      const teammateHasBall = playerWithBall && 
                              playerWithBall instanceof SoccerPlayerEntity && 
                              playerWithBall.team === this.team;
      
      // Ball trajectory anticipation
      const ballVelocity = ball.linearVelocity;
      const anticipatedBallPos = {
        x: ballPosition.x + (ballVelocity?.x ?? 0) * BALL_ANTICIPATION_FACTOR,
        y: ballPosition.y, 
        z: ballPosition.z + (ballVelocity?.z ?? 0) * BALL_ANTICIPATION_FACTOR
      };
      
      // --- Striker Movement Logic ---
      
      // 1. ATTACKING MOVEMENT: Ball in attacking half - get into scoring position
      if (inAttackingHalf) {
        console.log(`Striker ${this.player.username} getting into scoring position`);
        
        // Calculate threat assessment to goal
        const goalDistance = Math.abs(ballPosition.x - opponentGoalLineX);
        const isCrossingPosition = Math.abs(ballPosition.z - AI_FIELD_CENTER_Z) > 10; // Ball is wide
        
        if (isCrossingPosition) {
          // Position for cross - get into the box on far post
          const oppositePostZ = (ballPosition.z > AI_FIELD_CENTER_Z) 
            ? AI_FIELD_CENTER_Z - 4 // Ball on right, position on left post
            : AI_FIELD_CENTER_Z + 4; // Ball on left, position on right post
            
          targetPos = {
            x: opponentGoalLineX + (this.team === 'red' ? -6 : 6), // 6 units from goal line
            y: myPosition.y,
            z: oppositePostZ
          };
        } else {
          // Central attack - stay slightly ahead of the ball
          const forwardDistance = this.team === 'red' ? 6 : -6;
          
          targetPos = { 
            x: Math.min(opponentGoalLineX + (this.team === 'red' ? -3 : 3), ballPosition.x + forwardDistance), 
            y: myPosition.y, 
            z: AI_FIELD_CENTER_Z + (Math.random() > 0.5 ? 3 : -3) // Slightly off-center randomly
          };
        }
      }
      // 2. SUPPORT MOVEMENT: Teammate has ball - provide forward passing option
      else if (teammateHasBall) {
        console.log(`Striker ${this.player.username} providing passing option`);
        
        // Position between the ball and goal at proper depth
        const supportX = (opponentGoalLineX + playerWithBall.position.x) / 2; // Halfway to goal
        const supportZ = AI_FIELD_CENTER_Z + ((Math.random() > 0.5 ? 1 : -1) * 6); // Random left/right shift
        
        targetPos = {
          x: supportX,
          y: myPosition.y,
          z: supportZ
        };
      }
      // 3. DEFAULT: Ball in our half - hold high position and anticipate
      else {
        console.log(`Striker ${this.player.username} holding high position and anticipating`);
        
        // Get the AI's basic formation position for their role (which is already a high position)
        const formationPosition = this.getRoleBasedPosition();

        // Adjust from this formation position based on ball's general X location,
        // to stay relevant but not pulled too far out of general attacking shape.
        // Increased recovery multiplier to return to position faster
        const recoveryFactor = POSITION_RECOVERY_MULTIPLIER['striker'];
        
        // Shift from formation X towards the ball's X by a smaller factor, now adjusted by recovery
        const dynamicX = formationPosition.x + 
                        ((ballPosition.x - formationPosition.x) * 0.15 / recoveryFactor);
        
        // For Z, maintain the formation Z but allow slight shift towards ball's Z
        const dynamicZ = formationPosition.z + 
                        ((ballPosition.z - formationPosition.z) * 0.15 / recoveryFactor);

        targetPos = {
          x: dynamicX,
          y: myPosition.y,
          z: dynamicZ
        };
      }
      
      // --- PURSUIT OVERRIDE ---
      // Check for loose ball in area or if we should pursue based on team coordination
      const isLooseBall = this.isLooseBallInArea(ballPosition);
      const shouldPursue = this.shouldPursueBasedOnTeamCoordination(ballPosition);
      
      // Extra check: NEVER pursue if a teammate has the ball
      // Use the teammateHasBall variable already defined above instead of redeclaring playerWithBall
      if (teammateHasBall) {
        // Teammate has the ball - do NOT pursue
        return;
      }
      
      // Check if we should stop pursuit because ball is too far
      const shouldStop = this.shouldStopPursuit(ballPosition);
      
      // If currently pursuing and ball is too far, stop pursuing
      if (shouldStop) {
        console.log(`Striker ${this.player.username} stopping pursuit - ball too far from area`);
        // Return to formation position (do not change targetPos)
      }
      // Otherwise, evaluate whether to begin/continue pursuit
      else if (!this.isKickoffActive && 
          sharedState.getBallHasMoved() && 
          distanceToBall < STRIKER_PURSUIT_DISTANCE) {
          
          // Check if ball is too far to chase even before starting pursuit
          const ballTooFar = this.isBallTooFarToChase(ballPosition);
          if (ballTooFar) {
            console.log(`Striker ${this.player.username} not pursuing - ball too far from area`);
            return; // Keep existing target position
          }
          
          // Check if ball is within preferred area for this role
          const ballInPreferredArea = this.isPositionInPreferredArea(ballPosition, 'striker');
          
          // Get additional factors that influence pursuit decision:
          // 1. Ball in attacking third
          // 2. Ball near center (more dangerous position)
          // 3. Striker is closest teammate to ball
          const ballInAttackingThird = Math.abs(ballPosition.x - opponentGoalLineX) < AI_FORWARD_OFFSET_X;
          const ballNearCenter = Math.abs(ballPosition.z - AI_FIELD_CENTER_Z) < 8;
          const isClosestTeammate = this.isClosestTeammateToPosition(ballPosition);
          
          let pursuitBonus = 0;
          if (ballInAttackingThird) pursuitBonus += 0.15; // Reduced from 0.2
          if (ballNearCenter) pursuitBonus += 0.1;
          if (isClosestTeammate) pursuitBonus += 0.25;  // Reduced from 0.3
          
          // Factor in position recovery to reduce chasing by players who need to maintain position
          const positionRecoveryFactor = 1 - (roleDefinition.positionRecoverySpeed * POSITION_RECOVERY_MULTIPLIER['striker']);
          
          // Calculate total pursuit probability - limit max probability more strictly
          const pursuitProbability = Math.min(0.7, ROLE_PURSUIT_PROBABILITY['striker'] * positionRecoveryFactor + pursuitBonus);
          
          // Only pursue if:
          // 1. It's a loose ball in our area, OR
          // 2. We're the closest teammate to the ball, OR
          // 3. We should pursue based on team coordination AND random check passes
          if (isLooseBall || isClosestTeammate || 
              (shouldPursue && ballInPreferredArea && Math.random() < pursuitProbability)) {
              console.log(`Striker ${this.player.username} pursuing the ball (${isLooseBall ? 'loose ball' : (isClosestTeammate ? 'closest' : 'in area')})`);
              targetPos = anticipatedBallPos;
          }
      }
    }
    
    // Ensure position is within the role's preferred area
    this.targetPosition = this.constrainToPreferredArea(targetPos, 'striker');
    
    // Apply teammate avoidance
    this.targetPosition = this.adjustPositionForSpacing(this.targetPosition);
  }

  /**
   * Forces the AI to pass the ball to a specific player, aiming at a precise point.
   * Uses the Hytopia SDK applyImpulse method to simulate a pass with the proper arc.
   * 
   * @param targetPlayer The player entity to pass the ball to (can be null if passing to space).
   * @param passToPoint The world coordinates to aim the pass towards.
   * @param powerMultiplier Optional multiplier for the pass force (default: 1.0).
   * @returns True if the pass was attempted, false otherwise.
   */
  public forcePass(targetPlayer: PlayerEntity | null, passToPoint: Vector3Like, powerMultiplier: number = 1.0): boolean {
    // Validate ball and player state using SDK interfaces
    const ball = sharedState.getSoccerBall();
    const playerWithBall = sharedState.getAttachedPlayer();
    
    // Verify we have the necessary objects from the SDK
    if (!ball || playerWithBall !== this) { 
      console.warn(`AI ${this.player.username} (${this.aiRole}): forcePass failed - ball not found or not attached to this player`);
      return false; 
    }

    // Reset the ball possession timer for any player type
    this.ballPossessionStartTime = null;
    console.log(`${this.aiRole} ${this.player.username} resetting possession timer in forcePass`);

    // Ensure we have valid position data 
    if (!this.position || !passToPoint) {
      console.warn(`AI ${this.player.username} (${this.aiRole}): forcePass failed - invalid position data`);
      return false;
    }

    // ADDED SAFETY: Ensure the pass target is within field boundaries
    const safePassTarget = this.ensureTargetInBounds(passToPoint);

    // Calculate direction components towards the passToPoint
    const dx = safePassTarget.x - this.position.x;
    const dz = safePassTarget.z - this.position.z;

    const distanceHorizontal = Math.sqrt(dx * dx + dz * dz);
    // Ensure PASS_ARC_FACTOR is defined, if not, use a sensible default or log an error
    const arcFactor = typeof PASS_ARC_FACTOR === 'number' ? PASS_ARC_FACTOR : 0.08;
    const calculatedY = distanceHorizontal * arcFactor;

    const direction = {
      x: dx,
      y: calculatedY,
      z: dz
    };

    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    if (length < 0.001) {
      console.warn(`AI ${this.player.username} (${this.aiRole}): forcePass failed - zero direction length`);
      return false; // Avoid division by zero if already at target
    }

    // Normalize the direction vector for SDK physics
    direction.x /= length;
    direction.y /= length;
    direction.z /= length;

    // Release ball attachment using SDK API
    sharedState.setAttachedPlayer(null);
    
    // Apply powerMultiplier to the base PASS_FORCE
    // Ensure PASS_FORCE is defined, if not, use a sensible default
    const baseForce = typeof PASS_FORCE === 'number' ? PASS_FORCE : 10;
    
    // SAFETY: Cap the maximum multiplier for all players to avoid extreme forces
    let effectiveMultiplier = Math.min(powerMultiplier, 1.0);
    
    // Additional cap for different roles to prevent flying balls
    if (this.aiRole === 'goalkeeper') {
      effectiveMultiplier = Math.min(effectiveMultiplier, 0.8); // Goalkeeper passes are safest
    } else if (this.aiRole === 'striker') {
      effectiveMultiplier = Math.min(effectiveMultiplier, 0.9); // Strikers slightly stronger
    } else {
      effectiveMultiplier = Math.min(effectiveMultiplier, 0.85); // Other players moderate
    }
    
    // Calculate the final force, with an absolute maximum cap
    const effectivePassForce = Math.min(baseForce * effectiveMultiplier, 8);  // Reduced hard cap from 12 to 8
    
    // Add vertical dampening to prevent high arcs for longer distances
    const verticalComponent = direction.y * effectivePassForce;
    const maxVerticalForce = 2.5; // Cap vertical force component
    const finalVerticalForce = Math.min(verticalComponent, maxVerticalForce);
    
    try {
      // Apply impulse with controlled vertical component using SDK physics
      ball.applyImpulse({ 
        x: direction.x * effectivePassForce, 
        y: finalVerticalForce, 
        z: direction.z * effectivePassForce 
      });
      
      // Reset angular velocity immediately and continue resetting for a short period
      // This prevents unwanted spinning/backwards movement from ground collisions
      ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
      
      // Continue resetting angular velocity for 300ms for passes (shorter than shots)
      let resetCount = 0;
      const maxResets = 6; // Reset 6 times over 300ms
      const resetInterval = setInterval(() => {
        if (resetCount >= maxResets || !ball.isSpawned) {
          clearInterval(resetInterval);
          return;
        }
        ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
        resetCount++;
      }, 50); // Reset every 50ms
      
      // Play pass animation using SDK model animation system
      this.startModelOneshotAnimations(["kick"]);
      
      // Log the pass details
      if (targetPlayer) {
        console.log(`AI ${this.player.username} (${this.aiRole}) forcePassing to ${targetPlayer.player.username} at (${safePassTarget.x.toFixed(1)}, ${safePassTarget.z.toFixed(1)}) with force ${effectivePassForce.toFixed(1)}`);
      } else {
        console.log(`AI ${this.player.username} (${this.aiRole}) forcePassing to space at (${safePassTarget.x.toFixed(1)}, ${safePassTarget.z.toFixed(1)}) with force ${effectivePassForce.toFixed(1)}`);
      }
      return true;
    } catch (error) {
      // Handle any SDK errors that might occur during physics operations
      console.error(`AI ${this.player.username} (${this.aiRole}): Error in forcePass - ${error}`);
      return false;
    }
  }
  
  /**
   * Helper method to ensure a target point stays within the field boundaries
   * Used to prevent the ball from being passed out of bounds
   */
  private ensureTargetInBounds(targetPoint: Vector3Like): Vector3Like {
    // Get field dimensions and center
    const fieldCenterX = (AI_GOAL_LINE_X_RED + AI_GOAL_LINE_X_BLUE) / 2;
    const fieldCenterZ = AI_FIELD_CENTER_Z;
    
    // Define safe boundaries (more conservative margins to prevent out of bounds)
    const safeMinX = FIELD_MIN_X + 8; // Increased margin from 5 to 8
    const safeMaxX = FIELD_MAX_X - 8; // Increased margin from 5 to 8
    const safeMinZ = FIELD_MIN_Z + 8; // Increased margin from 5 to 8
    const safeMaxZ = FIELD_MAX_Z - 8; // Increased margin from 5 to 8
    
    // Calculate the clamped position
    const clampedX = Math.max(safeMinX, Math.min(safeMaxX, targetPoint.x));
    const clampedZ = Math.max(safeMinZ, Math.min(safeMaxZ, targetPoint.z));
    
    // If the position was clamped, adjust it to point more toward the center
    if (clampedX !== targetPoint.x || clampedZ !== targetPoint.z) {
      console.log(`Adjusted out-of-bounds pass target from (${targetPoint.x.toFixed(1)}, ${targetPoint.z.toFixed(1)}) to (${clampedX.toFixed(1)}, ${clampedZ.toFixed(1)})`);
      
      // For all players, make a safer adjustment toward field center
      const centerBias = 0.4; // Increased from 0.3 for more conservative passing
      return {
        x: clampedX * (1 - centerBias) + fieldCenterX * centerBias,
        y: targetPoint.y,
        z: clampedZ * (1 - centerBias) + fieldCenterZ * centerBias
      };
    }
    
    return {
      x: clampedX,
      y: targetPoint.y,
      z: clampedZ
    };
  }

  /**
   * Get the maximum possession time for this AI player's role
   */
  private getMaxPossessionTime(): number {
    switch (this.aiRole) {
      case 'goalkeeper': return this.GOALKEEPER_MAX_POSSESSION_TIME;
      case 'left-back':
      case 'right-back': return this.DEFENDER_MAX_POSSESSION_TIME;
      case 'central-midfielder-1':
      case 'central-midfielder-2': return this.MIDFIELDER_MAX_POSSESSION_TIME;
      case 'striker': return this.STRIKER_MAX_POSSESSION_TIME;
      default: return 5000; // Default fallback
    }
  }

  /**
   * Updates animation state based on movement speed
   * Extracted from handleTick for better organization
   * @param speed The current movement speed in units per second
   */
  private updateAnimationState(speed: number): void {
    // Determine target animation state based on speed
    let targetAnimState: 'idle' | 'walk' | 'run';
    const walkThreshold = 0.5; 
    const runThreshold = 4.0; 

    if (speed >= runThreshold) {
        targetAnimState = 'run';
    } else if (speed >= walkThreshold) {
        targetAnimState = 'walk';
    } else {
        targetAnimState = 'idle';
    }

    // Update animations only if the state changes
    if (targetAnimState !== this.currentAnimState) {
      // Stop previous state's animations
      if (this.currentAnimState === 'idle') this.stopModelAnimations(['idle_upper', 'idle_lower']);
      else if (this.currentAnimState === 'walk') this.stopModelAnimations(['walk_upper', 'walk_lower']);
      else if (this.currentAnimState === 'run') this.stopModelAnimations(['run_upper', 'run_lower']);
      
      // Start new state's animations
      if (targetAnimState === 'idle') this.startModelLoopedAnimations(['idle_upper', 'idle_lower']);
      else if (targetAnimState === 'walk') this.startModelLoopedAnimations(['walk_upper', 'walk_lower']);
      else if (targetAnimState === 'run') this.startModelLoopedAnimations(['run_upper', 'run_lower']);

      this.currentAnimState = targetAnimState;
    }
  }

  /**
   * Updates entity physics for movement
   * Extracted from handleTick for better organization
   * @param currentPosition The current position of the entity
   */
  private updatePhysicsMovement(currentPosition: Vector3Like): void {
    // Validate controller and mass exist
    if (!this.controller) {
      console.warn(`AI ${this.player.username} (${this.aiRole}): No controller in updatePhysicsMovement`);
      return;
    }

    const controller = this.controller as PlayerEntityController; 
    let baseMaxSpeed = controller?.runVelocity || 5.5;
    
    // **GOALKEEPER ENHANCEMENT**: Boost base speed for goalkeepers
    if (this.aiRole === 'goalkeeper') {
      baseMaxSpeed = 6.5; // 18% faster than field players for quick reactions
    }
    
    // Apply FIFA mode speed multipliers to match human players
    const currentModeConfig = getCurrentModeConfig();
    const speedMultiplier = currentModeConfig.sprintMultiplier || 1.0; // Default to 1.0 if not defined
    let maxSpeed = baseMaxSpeed * speedMultiplier;
    
    // Apply stamina-based speed penalty (same as human players)
    const staminaMultiplier = this.getStaminaSpeedMultiplier();
    maxSpeed *= staminaMultiplier;
    
    const mass = this._mass > 0 ? this._mass : 1.0; // Ensure valid mass
    
    // Log speed enhancement for debugging (very occasional)
    if (Math.random() < 0.001) { // Very rare logging
      console.log(`🤖 AI SPEED: ${this.player.username} (${this.aiRole}) - Base: ${baseMaxSpeed.toFixed(1)}, FIFA Enhanced: ${(baseMaxSpeed * speedMultiplier).toFixed(1)}, Final (with stamina): ${maxSpeed.toFixed(1)} (stamina: ${this.getStaminaPercentage().toFixed(0)}%)`);
    }
    
    // Calculate direction towards the target position (X and Z only)
    const direction = { 
        x: this.targetPosition.x - currentPosition.x, 
        z: this.targetPosition.z - currentPosition.z 
    };
    const distanceToTarget = Math.sqrt(direction.x * direction.x + direction.z * direction.z);

    // Calculate desired velocity based on distance and max speed
    let desiredVelocityX = 0;
    let desiredVelocityZ = 0;
    
    // Only move if distance is significant
    if (distanceToTarget > 0.3) { 
        const normalizedDirectionX = direction.x / distanceToTarget;
        const normalizedDirectionZ = direction.z / distanceToTarget;

        // Adjust speed based on distance to target
        const adaptiveSpeed = Math.min(maxSpeed, distanceToTarget > 2.0 ? maxSpeed : maxSpeed * 0.7);

        // Set desired velocities
        desiredVelocityX = normalizedDirectionX * adaptiveSpeed;
        desiredVelocityZ = normalizedDirectionZ * adaptiveSpeed;

        // Update rotation to face movement direction if needed
        this.updateRotationToMovement(normalizedDirectionX, normalizedDirectionZ);
    } 

    // Apply physics forces to move toward target
    this.applyMovementImpulse(desiredVelocityX, desiredVelocityZ, maxSpeed, mass);
  }

  /**
   * Updates entity rotation to face movement direction
   * Extracted from updatePhysicsMovement for better organization
   * @param normalizedDirectionX Normalized X direction component
   * @param normalizedDirectionZ Normalized Z direction component
   */
  private updateRotationToMovement(normalizedDirectionX: number, normalizedDirectionZ: number): void {
    // Check if this AI has the ball - if so, use more stable rotation logic
    const hasBall = sharedState.getAttachedPlayer() === this;
    
    // Only apply movement-based rotation if the agent didn't explicitly set one this tick
    const currentTime = Date.now();
    // Increase cooldown when player has the ball to reduce oscillation
    const rotationUpdateCooldown = hasBall ? 500 : 250; // Longer cooldown when having ball
    
    if (!this.hasRotationBeenSetThisTick && 
        (!this._lastRotationUpdateTime || 
        currentTime - this._lastRotationUpdateTime > rotationUpdateCooldown)) {
         
      // Calculate base yaw facing movement direction
      // Fixed: Use correct parameter order for atan2(x, z) per Hytopia SDK docs
      // Add π to flip direction since model faces opposite to coordinate system
      let targetYaw = Math.atan2(normalizedDirectionX, normalizedDirectionZ) + Math.PI;
      const halfYaw = targetYaw / 2;
      
      // Get current rotation
      const currentRotation = this.rotation;
      if (!currentRotation) {
        console.warn(`AI ${this.player.username} (${this.aiRole}): rotation is undefined in updateRotationToMovement`);
        return;
      }
      
      // Convert current rotation to yaw for comparison
      const currentYaw = Math.atan2(2 * (currentRotation.w * currentRotation.y), 1 - 2 * (currentRotation.y * currentRotation.y));
      
      // Normalize yaw differences to handle wrap-around
      let yawDifference = Math.abs(currentYaw - targetYaw);
      if (yawDifference > Math.PI) {
        yawDifference = 2 * Math.PI - yawDifference;
      }
      
      // More restrictive rotation threshold when having the ball to prevent oscillation
      const rotationThreshold = hasBall ? 0.3 : 0.1; // Wider threshold when having ball
      
      // Only rotate if difference is significant AND player is moving fast enough
      const movementSpeed = Math.sqrt(normalizedDirectionX * normalizedDirectionX + normalizedDirectionZ * normalizedDirectionZ);
      const isMovingSignificantly = movementSpeed > 0.5;
      
      if (yawDifference > rotationThreshold && isMovingSignificantly) {
        // When player has ball, use slower rotation interpolation to prevent snapping
        if (hasBall) {
          // Smoothly interpolate toward target rotation instead of snapping
          const rotationSpeed = 0.15; // Slower rotation when having ball
          const angleDiff = targetYaw - currentYaw;
          
          // Handle angle wrap-around
          let adjustedAngleDiff = angleDiff;
          if (adjustedAngleDiff > Math.PI) adjustedAngleDiff -= 2 * Math.PI;
          if (adjustedAngleDiff < -Math.PI) adjustedAngleDiff += 2 * Math.PI;
          
          // Interpolate toward target
          const newYaw = currentYaw + (adjustedAngleDiff * rotationSpeed);
          const newHalfYaw = newYaw / 2;
          
          const newRotation = { 
              x: 0, 
              y: Math.sin(newHalfYaw), 
              z: 0, 
              w: Math.cos(newHalfYaw) 
          };
          
          this.setRotation(newRotation);
        } else {
          // Normal snappy rotation when not having ball
          const newRotation = { 
              x: 0, 
              y: Math.sin(halfYaw), 
              z: 0, 
              w: Math.cos(halfYaw) 
          };
          
          this.setRotation(newRotation);
        }
        
        // Record rotation update time
        this._lastRotationUpdateTime = currentTime;
      }
    }
  }

  /**
   * Apply movement impulse using SDK physics system
   * Extracted from updatePhysicsMovement for better organization
   * @param desiredVelocityX Desired X velocity component
   * @param desiredVelocityZ Desired Z velocity component
   * @param maxSpeed Maximum allowed speed
   * @param mass Entity mass
   */
  private applyMovementImpulse(desiredVelocityX: number, desiredVelocityZ: number, maxSpeed: number, mass: number): void {
    // Validate linearVelocity exists
    const currentVelocity = this.linearVelocity || { x: 0, y: 0, z: 0 };
    
    // Reduce acceleration as velocity increases
    const velocityMagnitude = Math.sqrt(
      currentVelocity.x * currentVelocity.x + 
      currentVelocity.z * currentVelocity.z
    );
    
    // Reduce acceleration as velocity increases
    const accelerationScale = Math.max(0.3, 1.0 - (velocityMagnitude / maxSpeed) * 0.7);
    
    const deltaVelocityX = (desiredVelocityX - currentVelocity.x) * accelerationScale;
    const deltaVelocityZ = (desiredVelocityZ - currentVelocity.z) * accelerationScale;

    // Calculate impulse needed for the velocity change
    let impulseX = deltaVelocityX * mass;
    let impulseZ = deltaVelocityZ * mass;

    // Scale the impulse based on the tick duration to simulate applying force over time
    const forceApplicationFactor = 1.2; // Slightly reduced from 1.5 to make movement smoother
    impulseX *= forceApplicationFactor; 
    impulseZ *= forceApplicationFactor;

    // Apply the scaled impulse
    this.applyImpulse({ 
        x: impulseX, 
        y: 0, // Don't affect vertical movement
        z: impulseZ 
    });

    // Limit maximum velocity to prevent physics instability
    this.limitMaximumVelocity(maxSpeed);
  }

  /**
   * Limit maximum velocity to prevent physics instability
   * Extracted from applyMovementImpulse for better organization
   * @param maxVelocity Maximum allowed velocity
   */
  private limitMaximumVelocity(maxVelocity: number): void {
    if (!this.linearVelocity) return;
    
    const currentVelocitySqr = 
      this.linearVelocity.x * this.linearVelocity.x + 
      this.linearVelocity.z * this.linearVelocity.z;
    const maxVelocitySqr = maxVelocity * maxVelocity;
    
    if (currentVelocitySqr > maxVelocitySqr) {
      const scale = maxVelocity / Math.sqrt(currentVelocitySqr);
      this.setLinearVelocity({
        x: this.linearVelocity.x * scale,
        y: this.linearVelocity.y, // Preserve vertical velocity
        z: this.linearVelocity.z * scale
      });
    }
  }

  /**
   * Handles forced ball release when possession time exceeds limit
   * Extracted from handleTick for better organization
   * @param possessionTime Current possession time in milliseconds
   */
  private handleForcedBallRelease(possessionTime: number): void {
    console.log(`⚠️ AUTO ACTION: ${this.aiRole} ${this.player.username} has held the ball too long (${possessionTime}ms)!`);
    
    // Get the soccer ball
    const ball = sharedState.getSoccerBall();
    if (!ball) {
      console.warn(`AI ${this.player.username} (${this.aiRole}): Ball not found in handleForcedBallRelease`);
      return;
    }
    
    // Different strategies based on player role
    if (this.aiRole === 'goalkeeper') {
      this.handleGoalkeeperForcedRelease();
    } else {
      this.handleFieldPlayerForcedRelease();
    }
    
    // Reset the timer
    this.ballPossessionStartTime = null;
  }

  /**
   * Handles goalkeeper forced ball release
   * Extracted from handleForcedBallRelease for better organization
   */
  private handleGoalkeeperForcedRelease(): void {
    // Goalkeepers always try to pass to a teammate first, then clear to mid-field if no good options
    console.log(`Goalkeeper ${this.player.username} forced release - trying to distribute ball safely`);
    
    // First, try to find a good teammate to pass to
    const teammates = this.getVisibleTeammates();
    let bestTarget: SoccerPlayerEntity | null = null;
    let bestScore = -Infinity;
    
    // Calculate field center for reference
    const fieldCenterX = AI_FIELD_CENTER_X;
    const fieldCenterZ = AI_FIELD_CENTER_Z;
    
    // Find the best teammate to pass to
    for (const teammate of teammates) {
      if (teammate === this) continue;
      
      // Calculate distance to teammate
      const distanceToTeammate = this.distanceBetween(this.position, teammate.position);
      
      // Skip teammates that are too close or too far
      if (distanceToTeammate < 6 || distanceToTeammate > 25) continue;
      
      // Calculate angle to avoid passing across goal
      const ownGoalX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
      const passingAcrossGoal = (this.team === 'red' && teammate.position.x < this.position.x) || 
                                (this.team === 'blue' && teammate.position.x > this.position.x);
      
      // Calculate safety score (higher is better)
      let safetyScore = 10;
      
      // Reduce score for passing across goal (dangerous)
      if (passingAcrossGoal) safetyScore -= 8;
      
      // Reduce score if teammate is close to sidelines
      const distanceToSidelines = Math.min(
        Math.abs(teammate.position.z - FIELD_MIN_Z),
        Math.abs(teammate.position.z - FIELD_MAX_Z)
      );
      if (distanceToSidelines < 5) safetyScore -= 5;
      
      // Calculate final score
      const score = safetyScore + 
                   (20 - Math.min(20, distanceToTeammate / 2)) + // Favor medium-distance passes
                   (10 - Math.min(10, Math.abs(teammate.position.z - fieldCenterZ) / 2)); // Favor central positions
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = teammate;
      }
    }
    
    // If we found a good teammate target, pass to them
    if (bestTarget && bestScore > 5) {
      console.log(`Goalkeeper ${this.player.username} passing to teammate ${bestTarget.player.username} with safety score ${bestScore}`);
      
      // Lead the pass slightly
      const passDirectionX = bestTarget.position.x - this.position.x;
      const passDirectionZ = bestTarget.position.z - this.position.z;
      const passDist = Math.sqrt(passDirectionX * passDirectionX + passDirectionZ * passDirectionZ);
      
      if (passDist > 0) {
        const normDx = passDirectionX / passDist;
        const normDz = passDirectionZ / passDist;
        const leadFactor = 2.0; // Small lead factor
        
        const passTarget = {
          x: bestTarget.position.x + normDx * leadFactor,
          y: bestTarget.position.y,
          z: bestTarget.position.z + normDz * leadFactor
        };
        
        this.forcePass(bestTarget, passTarget, 0.6); // Lower power for controlled pass
      } else {
        this.forcePass(bestTarget, bestTarget.position, 0.6);
      }
    } 
    // Otherwise clear to a safe mid-field position
    else {
      console.log(`Goalkeeper ${this.player.username} no good teammate targets, clearing to mid-field`);
      
      // Always aim for central mid-field area, never near the sidelines
      const forwardDirection = this.team === 'red' ? 1 : -1;
      
      // Calculate target in central mid-field area
      // Use the real field center X position, not just halfway between goals
      let clearTargetX;
      
      // If we're red (left goal), aim for center or slightly our side of center
      if (this.team === 'red') {
        clearTargetX = fieldCenterX - (Math.random() * 5); // Slightly our side of center
      } 
      // If we're blue (right goal), aim for center or slightly our side of center
      else {
        clearTargetX = fieldCenterX + (Math.random() * 5); // Slightly our side of center
      }
      
      // Z position should be very centered to avoid sidelines
      const clearTargetZ = fieldCenterZ + ((Math.random() * 8) - 4); // Small variance but stay central
      
      // Create the clear target with guaranteed safe position
      const clearTarget = {
        x: clearTargetX,
        y: this.position.y,
        z: clearTargetZ
      };
      
      // Ensure target is in bounds with plenty of margin
      const safeTarget = this.ensureTargetInBounds(clearTarget);
      
      // Use medium power for clearance
      this.forcePass(null, safeTarget, 0.7);
    }
  }

  /**
   * Handles field player forced ball release
   * Extracted from handleForcedBallRelease for better organization
   */
  private handleFieldPlayerForcedRelease(): void {
    // For other players, check if we're in a good position to shoot
    const opponentGoalX = this.team === 'red' ? AI_GOAL_LINE_X_BLUE : AI_GOAL_LINE_X_RED;
    const opponentGoal = { 
      x: opponentGoalX, 
      y: 1, // Reference height for goal target
      z: AI_FIELD_CENTER_Z 
    };
    const distanceToGoal = this.distanceBetween(this.position, opponentGoal);
    
    // Check if we're in shooting range
    const inShootingRange = distanceToGoal < 20; // Good shooting distance
    const centralPosition = Math.abs(this.position.z - AI_FIELD_CENTER_Z) < 12; // Not too wide
    const shootingChance = this.aiRole === 'striker' ? 0.7 : // Strikers prefer shooting
                          (this.aiRole.includes('midfielder') ? 0.5 : 0.3); // Others less likely
    
    // Attempt shot if in good position
    if (inShootingRange && centralPosition && Math.random() < shootingChance) {
      console.log(`${this.aiRole} ${this.player.username} auto shooting on goal from ${distanceToGoal.toFixed(1)} distance`);
      // Add slight randomness to shot placement
      const shootTarget = {
        x: opponentGoal.x,
        y: opponentGoal.y,
        z: opponentGoal.z + ((Math.random() * 4) - 2) // Random offset for goal placement
      };
      
      this.shootBall(shootTarget, 1.2); // Increased from 1.0 to ensure shots have sufficient power to reach goal
    } else {
      // Not in shooting position, try to use the normal passing logic
      console.log(`${this.aiRole} ${this.player.username} not in shooting position, attempting pass`);
      const passResult = this.passBall();
      
      // If normal passing didn't work, do a simple forward pass
      if (!passResult) {
        console.log(`${this.aiRole} ${this.player.username} forced pass failed, doing simple forward pass`);
        
        const forwardDirection = this.team === 'red' ? 1 : -1;
        const passDistance = 10; // Safe pass distance
        
        // Aim more toward the center to avoid sidelines
        const fieldCenterZ = AI_FIELD_CENTER_Z;
        const currentZOffset = this.position.z - fieldCenterZ;
        // Calculate new Z that's 30% closer to center
        const targetZ = this.position.z - (currentZOffset * 0.3);
        
        const passTarget = {
          x: this.position.x + (forwardDirection * passDistance),
          y: this.position.y,
          z: targetZ
        };
        
        // Use lower power for safer passes
        this.forcePass(null, passTarget, 0.6);
      }
    }
  }

  /**
   * Checks if this AI player is allowed to pursue the ball based on team coordination
   * Prevents too many players from chasing the ball at once
   * @param ballPosition The position of the ball
   * @returns True if this player should be allowed to pursue
   */
  public shouldPursueBasedOnTeamCoordination(ballPosition: Vector3Like): boolean {
    // First, check if a teammate already has the ball - never pursue in that case
    const playerWithBall = sharedState.getAttachedPlayer();
    if (playerWithBall && playerWithBall !== this) {
      // Check if the player with the ball is on the same team
      if (playerWithBall instanceof SoccerPlayerEntity && playerWithBall.team === this.team) {
        // Never chase a teammate who has the ball
        return false;
      }
    }
    
    // **ENHANCED STATIONARY BALL LOGIC**
    // Be more aggressive when ball is stationary
    const isBallStationary = sharedState.isBallStationary();
    const stationaryDuration = sharedState.getBallStationaryDuration();
    
    // Adjust pursuit limits based on ball stationary status
    let maxSimultaneousPursuers = 2; // Default
    if (isBallStationary) {
      if (stationaryDuration > 10000) { // 10+ seconds
        maxSimultaneousPursuers = 4; // Very aggressive team response
      } else if (stationaryDuration > 7000) { // 7+ seconds  
        maxSimultaneousPursuers = 3; // More aggressive
      } else {
        maxSimultaneousPursuers = 3; // Still more aggressive than normal
      }
    }
    
    // Always allow pursuit if we're the closest teammate to the ball
    if (this.isClosestTeammateToPosition(ballPosition)) {
      return true;
    }
    
    // Check how many teammates are already pursuing
    const teammates = sharedState.getAITeammates(this);
    let pursuingCount = 0;
    
    // Calculate my distance to ball
    const myDistanceToBall = this.distanceBetween(this.position, ballPosition);
    let myPursuitRank = 1; // Default rank (lower is better)
    
    // Find teammates who are already pursuing and closer than me
    for (const teammate of teammates) {
      if (!teammate.isSpawned) continue;
      
      // Skip non-AIPlayerEntity teammates
      if (!(teammate instanceof AIPlayerEntity)) continue;
      
      const teammatePos = teammate.position;
      const teammateToBall = this.distanceBetween(teammatePos, ballPosition);
      
      // Is this teammate pursuing?
      const distanceToTarget = teammate.targetPosition ? 
        this.distanceBetween(teammate.targetPosition, ballPosition) : 999;
        
      // Consider a teammate to be pursuing if their target is close to the ball
      if (distanceToTarget < 3) {
        pursuingCount++;
        
        // Count how many teammates are closer to the ball than me
        if (teammateToBall < myDistanceToBall) {
          myPursuitRank++;
        }
      }
    }
    
    // Only allow pursuit if we're within the pursuit limit by rank
    const shouldPursue = myPursuitRank <= maxSimultaneousPursuers;
    
    // Log enhanced coordination for stationary balls
    if (isBallStationary && shouldPursue) {
      console.log(`${this.player.username} (${this.aiRole}) ENHANCED pursuit coordination for stationary ball: rank ${myPursuitRank}/${maxSimultaneousPursuers}, pursuers: ${pursuingCount}, duration: ${(stationaryDuration/1000).toFixed(1)}s`);
    }
    
    return shouldPursue;
  }

  /**
   * Detect loose ball situations where no player has possession
   * This allows AIs to recognize when they should pursue a loose ball
   * @param ballPosition The position of the ball
   * @returns True if the ball is loose and in this player's area
   */
  public isLooseBallInArea(ballPosition: Vector3Like): boolean {
    // Check if ball is not possessed by any player
    const attachedPlayer = sharedState.getAttachedPlayer();
    
    // Ball is not loose if it's possessed by any player
    if (attachedPlayer !== null) {
      // If a teammate has the ball, it's definitely not a loose ball
      if (attachedPlayer instanceof SoccerPlayerEntity && attachedPlayer.team === this.team) {
        return false;
      }
      
      // Even if an opponent has the ball, it's not loose
      return false;
    }
    
    // At this point we've verified the ball is truly loose (not possessed by anyone)
    
    // **ENHANCED STATIONARY BALL DETECTION**
    // Check if ball is stationary anywhere on the field (not just boundaries)
    const isBallStationary = sharedState.isBallStationary();
    const stationaryDuration = sharedState.getBallStationaryDuration();
    
    if (isBallStationary) {
      const distanceToBall = this.distanceBetween(this.position, ballPosition);
      
      // For stationary balls, be much more aggressive with pursuit
      let maxStationaryDistance = 40; // Base distance for stationary balls
      
      // Increase pursuit distance based on how long ball has been stationary
      if (stationaryDuration > 10000) { // 10+ seconds
        maxStationaryDistance = 60; // Very aggressive pursuit
      } else if (stationaryDuration > 7000) { // 7+ seconds
        maxStationaryDistance = 50; // More aggressive
      }
      
      // Allow more players to pursue stationary balls
      const teammates = this.getVisibleTeammates();
      let playersCloser = 0;
      
      for (const teammate of teammates) {
        if (teammate instanceof AIPlayerEntity && teammate.isSpawned) {
          const teammateDistance = this.distanceBetween(teammate.position, ballPosition);
          if (teammateDistance < distanceToBall) {
            playersCloser++;
          }
        }
      }
      
      // Allow up to 3 players to pursue stationary balls (vs normal 2)
      const shouldPursueStationary = playersCloser < 3 && distanceToBall < maxStationaryDistance;
      
      if (shouldPursueStationary) {
        console.log(`${this.player.username} (${this.aiRole}) pursuing STATIONARY ball (idle for ${(stationaryDuration/1000).toFixed(1)}s, distance: ${distanceToBall.toFixed(1)})`);
        return true;
      }
    }
    
    // SPECIAL CASE: Stuck balls in corners/boundaries (existing logic)
    // Check if ball is near boundaries and stationary
    const BOUNDARY_THRESHOLD = 12;
    const nearMinX = Math.abs(ballPosition.x - FIELD_MIN_X) < BOUNDARY_THRESHOLD;
    const nearMaxX = Math.abs(ballPosition.x - FIELD_MAX_X) < BOUNDARY_THRESHOLD;
    const nearMinZ = Math.abs(ballPosition.z - FIELD_MIN_Z) < BOUNDARY_THRESHOLD;
    const nearMaxZ = Math.abs(ballPosition.z - FIELD_MAX_Z) < BOUNDARY_THRESHOLD;
    
    const isNearBoundary = nearMinX || nearMaxX || nearMinZ || nearMaxZ;
    const isInCorner = (nearMinX || nearMaxX) && (nearMinZ || nearMaxZ);
    
    // Check if ball is stationary (indicating it's stuck)
    const ball = sharedState.getSoccerBall();
    const isStuck = ball && ball.linearVelocity ? 
      Math.sqrt(ball.linearVelocity.x * ball.linearVelocity.x + ball.linearVelocity.z * ball.linearVelocity.z) < 0.5 :
      false;
    
    // For stuck balls near boundaries, be much more aggressive
    if (isNearBoundary && isStuck) {
      const distanceToBall = this.distanceBetween(this.position, ballPosition);
      
      // Allow much larger pursuit distances for stuck balls
      let maxStuckBallDistance = 35; // Base distance for boundary balls
      if (isInCorner) {
        maxStuckBallDistance = 45; // Even more aggressive for corner balls
      }
      
      // Be one of the closest players to the stuck ball
      const teammates = this.getVisibleTeammates();
      let playersCloser = 0;
      
      for (const teammate of teammates) {
        if (teammate instanceof AIPlayerEntity && teammate.isSpawned) {
          const teammateDistance = this.distanceBetween(teammate.position, ballPosition);
          if (teammateDistance < distanceToBall) {
            playersCloser++;
          }
        }
      }
      
      // Allow up to 2 players to pursue stuck balls (closest 2)
      const shouldPursueStuck = playersCloser < 2 && distanceToBall < maxStuckBallDistance;
      
      if (shouldPursueStuck) {
        console.log(`${this.player.username} (${this.aiRole}) recognizing stuck ball in ${isInCorner ? 'corner' : 'boundary'} as loose ball in area (distance: ${distanceToBall.toFixed(1)})`);
        return true;
      }
    }
    
    // Check if the ball is within this player's preferred area
    const inPreferredArea = this.isPositionInPreferredArea(ballPosition, this.aiRole);
    
    // Check if ball is within reasonable pursuit distance
    let maxPursuitDistance = 0;
    switch (this.aiRole) {
      case 'goalkeeper': maxPursuitDistance = GOALKEEPER_PURSUIT_DISTANCE; break;
      case 'left-back':
      case 'right-back': maxPursuitDistance = DEFENDER_PURSUIT_DISTANCE; break;
      case 'central-midfielder-1':
      case 'central-midfielder-2': maxPursuitDistance = MIDFIELDER_PURSUIT_DISTANCE; break;
      case 'striker': maxPursuitDistance = STRIKER_PURSUIT_DISTANCE; break;
    }
    
    // **ENHANCED: Increase pursuit distance for stationary balls**
    const ballIsStationary = sharedState.isBallStationary();
    if (ballIsStationary) {
      const stationaryDuration = sharedState.getBallStationaryDuration();
      if (stationaryDuration > 7000) { // 7+ seconds
        maxPursuitDistance *= 2.5; // Very extended range
      } else {
        maxPursuitDistance *= 2.0; // Extended range
      }
      console.log(`${this.player.username} (${this.aiRole}) using EXTENDED pursuit distance ${maxPursuitDistance.toFixed(1)} for stationary ball`);
    }
    
    const withinDistance = this.distanceBetween(this.position, ballPosition) < maxPursuitDistance;
    
    // If ball is in preferred area OR we're one of the closest players, consider it relevant
    return (inPreferredArea || this.isClosestTeammateToPosition(ballPosition)) && withinDistance;
  }

  /**
   * Checks if a ball is too far from the player's area to continue pursuing
   * Used to make AI players stop chasing the ball when it moves too far away
   * @param ballPosition The position of the ball
   * @returns True if the ball is too far and pursuit should stop
   */
  public isBallTooFarToChase(ballPosition: Vector3Like): boolean {
    // Check if ball is in or near player's preferred area
    const inPreferredArea = this.isPositionInPreferredArea(ballPosition, this.aiRole);
    if (inPreferredArea) {
      return false; // Never too far if in preferred area
    }
    
    // Check distance from player to ball
    const distanceToBall = this.distanceBetween(this.position, ballPosition);
    
    // Get max pursuit distance based on role
    let maxPursuitDistance = 0;
    switch (this.aiRole) {
      case 'goalkeeper': maxPursuitDistance = GOALKEEPER_PURSUIT_DISTANCE; break;
      case 'left-back':
      case 'right-back': maxPursuitDistance = DEFENDER_PURSUIT_DISTANCE; break;
      case 'central-midfielder-1':
      case 'central-midfielder-2': maxPursuitDistance = MIDFIELDER_PURSUIT_DISTANCE; break;
      case 'striker': maxPursuitDistance = STRIKER_PURSUIT_DISTANCE; break;
    }
    
    // **ENHANCED: Increase pursuit distance for stationary balls in chase calculations**
    const ballStationaryStatus = sharedState.isBallStationary();
    if (ballStationaryStatus) {
      const stationaryDuration = sharedState.getBallStationaryDuration();
      if (stationaryDuration > 7000) { // 7+ seconds
        maxPursuitDistance *= 2.5; // Very extended range
      } else {
        maxPursuitDistance *= 2.0; // Extended range
      }
    }
    
    // Calculate distance from ball to edge of preferred area
    const roleDefinition = ROLE_DEFINITIONS[this.aiRole];
    const roleArea = roleDefinition.preferredArea;
    
    // Determine direction the AI attacks
    const attackingMultiplier = (this.team === 'red') ? 1 : -1;
    
    // Calculate boundaries for player's preferred area
    let constrainedMinX, constrainedMaxX, adjustedMinZ, adjustedMaxZ;
    const ownGoalLineX = this.team === 'red' ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    
    if (this.aiRole === 'goalkeeper') {
      constrainedMinX = ownGoalLineX + roleArea.minX;
      constrainedMaxX = ownGoalLineX + roleArea.maxX;
    } else {
      const x_bound1 = AI_FIELD_CENTER_X + (attackingMultiplier * roleArea.minX);
      const x_bound2 = AI_FIELD_CENTER_X + (attackingMultiplier * roleArea.maxX);
      constrainedMinX = Math.min(x_bound1, x_bound2);
      constrainedMaxX = Math.max(x_bound1, x_bound2);
    }
    
    adjustedMinZ = AI_FIELD_CENTER_Z + roleArea.minZ;
    adjustedMaxZ = AI_FIELD_CENTER_Z + roleArea.maxZ;
    
    // Find minimum distance to any edge of the preferred area
    const distanceToMinX = Math.max(0, constrainedMinX - ballPosition.x);
    const distanceToMaxX = Math.max(0, ballPosition.x - constrainedMaxX);
    const distanceToMinZ = Math.max(0, adjustedMinZ - ballPosition.z);
    const distanceToMaxZ = Math.max(0, ballPosition.z - adjustedMaxZ);
    
    const distanceFromArea = Math.max(distanceToMinX, distanceToMaxX, distanceToMinZ, distanceToMaxZ);
    
    // FIXED: Improved boundary detection - check for ANY boundary proximity, not just corners
    const nearXBoundary = Math.abs(ballPosition.x - FIELD_MIN_X) < 15 || Math.abs(ballPosition.x - FIELD_MAX_X) < 15;
    const nearZBoundary = Math.abs(ballPosition.z - FIELD_MIN_Z) < 15 || Math.abs(ballPosition.z - FIELD_MAX_Z) < 15;
    
    // Ball is near ANY boundary (not just corners) 
    const isNearBoundary = nearXBoundary || nearZBoundary;
    
    // Special case for corners - both X and Z boundaries
    const isInCorner = nearXBoundary && nearZBoundary;
    
    // For near-boundary situations, allow more players to pursue
    if (isNearBoundary) {
      const teammates = this.getVisibleTeammates();
      const myDistanceToBall = this.distanceBetween(this.position, ballPosition);
      let playersCloserThanMe = 0;
      
      for (const teammate of teammates) {
        if (teammate instanceof AIPlayerEntity && teammate.isSpawned) {
          const teammateDistance = this.distanceBetween(teammate.position, ballPosition);
          if (teammateDistance < myDistanceToBall) {
            playersCloserThanMe++;
          }
        }
      }
      
      // Allow up to 3 players to pursue near-boundary balls (closest 3)
      // For corners, allow up to 2 players
      const maxPursuers = isInCorner ? 2 : 3;
      if (playersCloserThanMe < maxPursuers) {
        console.log(`Player ${this.player.username} (${this.aiRole}) pursuing near-boundary ball (${playersCloserThanMe + 1} of ${maxPursuers})`);
        return false; // Never too far if ball is near boundary and we're one of the allowed pursuers
      }
    }
    
    // Calculate allowed pursuit distance with boundary bonuses
    let maxAllowedDistance = maxPursuitDistance * 1.5; // Base increase from 1.3 to 1.5
    
    // Additional bonuses for boundary situations
    if (isNearBoundary) {
      maxAllowedDistance = maxPursuitDistance * 2.0; // Generous for near-boundary situations
      console.log(`Player ${this.player.username} (${this.aiRole}) using extended boundary pursuit distance: ${maxAllowedDistance}`);
    }
    
    if (isInCorner) {
      maxAllowedDistance = maxPursuitDistance * 3.0; // Extra generous for corners
      console.log(`Player ${this.player.username} (${this.aiRole}) using extended corner pursuit distance: ${maxAllowedDistance}`);
    }
    
    return distanceFromArea > maxAllowedDistance || distanceToBall > maxAllowedDistance;
  }
  
  /**
   * Utility method to add stop pursuit logic to all role decision methods
   * @param ballPosition The current position of the ball
   * @param targetPos The current target position being considered
   * @param role The player's role
   * @returns True if the player should stop pursuing the ball, false otherwise
   */
  public shouldStopPursuit(ballPosition: Vector3Like): boolean {
    // Check if we're currently pursuing the ball (targeting near the ball)
    const targetNearBall = this.targetPosition && 
                          this.distanceBetween(this.targetPosition, ballPosition) < 3;
    const currentlyPursuing = targetNearBall;
    
    // Check if ball is too far to chase
    const ballTooFar = this.isBallTooFarToChase(ballPosition);
    
    // Return true if both conditions are met (currently pursuing but ball is now too far)
    return currentlyPursuing && ballTooFar;
  }

  /**
   * Sets the behavior for this AI player during restarts (kickoffs, out-of-bounds)
   * @param behavior - The special behavior for restarts, or null for default behavior
   */
  public setRestartBehavior(behavior: 'pass-to-teammates' | 'normal' | null) {
    this.restartBehavior = behavior;
    console.log(`AI ${this.player.username} (${this.aiRole}) restart behavior set to: ${behavior || 'default'}`);
  }

  /**
   * Helper method to check if a pass direction is safe and won't go out of bounds
   * @param fromPosition Starting position of the pass
   * @param direction Direction vector of the pass
   * @param distance Distance of the pass
   * @returns True if the pass is safe, false if it might go out of bounds
   */
  private isPassDirectionSafe(fromPosition: Vector3Like, direction: Vector3Like, distance: number): boolean {
    const targetPosition = {
      x: fromPosition.x + direction.x * distance,
      y: fromPosition.y,
      z: fromPosition.z + direction.z * distance
    };
    
    // Check if target would be within safe boundaries
    const safeMinX = FIELD_MIN_X + 10; // Conservative margin
    const safeMaxX = FIELD_MAX_X - 10;
    const safeMinZ = FIELD_MIN_Z + 10;
    const safeMaxZ = FIELD_MAX_Z - 10;
    
    return targetPosition.x >= safeMinX && targetPosition.x <= safeMaxX &&
           targetPosition.z >= safeMinZ && targetPosition.z <= safeMaxZ;
  }

  /**
   * STAMINA CONSERVATION SYSTEM
   * Determines if the AI should conserve stamina based on current levels
   * @param staminaPercentage Current stamina as a percentage (0-100)
   * @returns True if stamina should be conserved
   */
  private shouldConserveStamina(staminaPercentage: number): boolean {
    // Different stamina thresholds based on role
    let conservationThreshold = 30; // Default threshold
    
    switch (this.aiRole) {
      case 'goalkeeper':
        conservationThreshold = 20; // Goalkeepers conserve less aggressively
        break;
      case 'striker':
        conservationThreshold = 40; // Strikers need to conserve more to be effective
        break;
      case 'central-midfielder-1':
      case 'central-midfielder-2':
        conservationThreshold = 35; // Midfielders balance defense and attack
        break;
      case 'left-back':
      case 'right-back':
        conservationThreshold = 25; // Defenders can be more aggressive with stamina
        break;
    }
    
    // More aggressive conservation as the game progresses
    // In the second half, players should be more conservative with their stamina
    // For now, we'll use a consistent threshold regardless of game phase
    
    return staminaPercentage < conservationThreshold;
  }
  
  /**
   * STAMINA CONSERVATION HANDLER
   * Handles AI behavior when stamina is low, prioritizing recovery and conservative play
   * @param ballPosition Current ball position
   * @param hasBall Whether this AI has the ball
   * @param staminaPercentage Current stamina percentage
   */
  private handleStaminaConservation(ballPosition: Vector3Like, hasBall: boolean, staminaPercentage: number): void {
    // Log conservation behavior occasionally
    if (Math.random() < 0.02) { // 2% chance to log
      console.log(`💨 STAMINA CONSERVATION: ${this.player.username} (${this.aiRole}) conserving stamina (${staminaPercentage.toFixed(0)}%)`);
    }
    
    if (hasBall) {
      // If we have the ball and low stamina, prioritize quick pass over dribbling
      const passSuccess = this.passBall();
      if (passSuccess) {
        console.log(`⚡ STAMINA CONSERVATION: ${this.player.username} made quick pass to preserve stamina`);
        return;
      }
      
      // If passing failed, hold position and slow down
      this.targetPosition = {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      };
      return;
    }
    
    // When we don't have the ball, prioritize positioning over aggressive pursuit
    const roleDef = ROLE_DEFINITIONS[this.aiRole];
    const distanceToBall = this.distanceBetween(this.position, ballPosition);
    
    // Reduce effective pursuit based on stamina levels
    const staminaFactor = Math.max(0.3, staminaPercentage / 100); // Never go below 30% pursuit
    const adjustedPursuitTendency = roleDef.pursuitTendency * staminaFactor;
    
    // Only pursue if we're very close to the ball or if we're the designated role
    const shouldPursue = distanceToBall < 8 && Math.random() < adjustedPursuitTendency;
    
    if (shouldPursue && this.isClosestTeammateToPosition(ballPosition)) {
      // Pursue the ball but with reduced intensity
      this.targetPosition = {
        x: ballPosition.x,
        y: ballPosition.y,
        z: ballPosition.z
      };
    } else {
      // Move to a conservative position that allows stamina recovery
      const formationPosition = this.getRoleBasedPosition();
      
      // Move towards formation position but prioritize standing still for stamina recovery
      const distanceToFormation = this.distanceBetween(this.position, formationPosition);
      
      if (distanceToFormation < 3) {
        // If close to formation position, hold position for stamina recovery
        this.targetPosition = {
          x: this.position.x,
          y: this.position.y,
          z: this.position.z
        };
      } else {
        // Move slowly towards formation position
        const direction = {
          x: formationPosition.x - this.position.x,
          z: formationPosition.z - this.position.z
        };
        const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        
        if (distance > 0.1) {
          const moveDistance = Math.min(2, distance); // Move only 2 units at a time
          this.targetPosition = {
            x: this.position.x + (direction.x / distance) * moveDistance,
            y: this.position.y,
            z: this.position.z + (direction.z / distance) * moveDistance
          };
        }
      }
    }
  }
}
