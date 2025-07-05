import {
  BaseEntityController,
  Entity,
  PlayerEntity,
  type PlayerCameraOrientation,
  ColliderShape,
  CoefficientCombineRule,
  CollisionGroup,
  type BlockType
} from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import sharedState from "../state/sharedState";

// Add constants for AI goalkeeper header mechanics
const AI_GOALKEEPER_HEADER_RANGE = 3.5; // Range for AI goalkeeper headers
const AI_GOALKEEPER_HEADER_FORCE = 15; // Force applied during AI headers
const AI_HIGH_BALL_THRESHOLD = 2.0; // Height threshold for considering ball "high"
const AI_GOALKEEPER_JUMP_BOOST = 2.0; // Extra jump velocity for AI goalkeepers
const AI_JUMP_VELOCITY = 10; // Base jump velocity for AI players

/** Options for creating an AIController instance. */
export interface AIControllerOptions {
  /** The normalized horizontal velocity applied to the entity when it runs. */
  runVelocity?: number;

  /** The normalized horizontal velocity applied to the entity when it walks. */
  walkVelocity?: number;
}

/**
 * Controller for AI soccer players
 * Simulates player input without actual input events
 */
export default class AIController extends BaseEntityController {
  /** The normalized horizontal velocity applied to the entity when it runs. */
  public runVelocity: number = 8;

  /** The normalized horizontal velocity applied to the entity when it walks. */
  public walkVelocity: number = 4;

  /** @internal */
  private _groundContactCount: number = 0;

  /** @internal */
  private _platform: Entity | undefined;

  /** @internal */
  private _lastHeaderTime: number = 0;

  /**
   * @param options - Options for the controller.
   */
  public constructor(options: AIControllerOptions = {}) {
    super();
    this.runVelocity = options.runVelocity ?? this.runVelocity;
    this.walkVelocity = options.walkVelocity ?? this.walkVelocity;
  }

  /** Whether the entity is grounded. */
  public get isGrounded(): boolean {
    return this._groundContactCount > 0;
  }

  /** Whether the entity is on a platform. */
  public get isOnPlatform(): boolean {
    return this._platform !== undefined;
  }

  /**
   * Performs an AI goalkeeper header to deflect or catch high shots
   * @param entity - The AI goalkeeper entity
   * @param ball - The soccer ball entity
   * @param direction - The direction toward the ball
   */
  private performAIGoalkeeperHeader(entity: SoccerPlayerEntity, ball: any, direction: { x: number; z: number }) {
    const currentTime = Date.now();
    
    // Prevent header spam - minimum 500ms between headers
    if (currentTime - this._lastHeaderTime < 500) {
      return;
    }
    
    this._lastHeaderTime = currentTime;
    
    // Calculate header force based on ball velocity and position
    const ballVelocity = ball.linearVelocity;
    const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
    
    // Determine header strategy based on ball speed and direction
    let headerForce = AI_GOALKEEPER_HEADER_FORCE;
    let deflectionDirection = this.calculateAIDeflectionDirection(entity, ball);
    
    // For fast incoming shots, deflect to safety
    if (ballSpeed > 8) {
      headerForce *= 1.5; // Stronger deflection for fast shots
      console.log(`AI Goalkeeper ${entity.player?.username || 'AI'} making strong deflection!`);
    } else {
      // For slower shots, try to catch or control
      headerForce *= 0.8;
      console.log(`AI Goalkeeper ${entity.player?.username || 'AI'} attempting to control the ball!`);
    }
    
    // Apply header force to ball
    ball.applyImpulse({
      x: deflectionDirection.x * headerForce,
      y: Math.abs(headerForce * 0.3), // Slight upward component
      z: deflectionDirection.z * headerForce
    });
    
    // Play header animation
    entity.startModelOneshotAnimations(["kick"]); // Use kick animation for header
    
    // Add save statistic for goalkeeper
    entity.addSave();
    
    console.log(`AI Goalkeeper header performed with force ${headerForce.toFixed(1)}`);
  }

  /**
   * Calculates the optimal deflection direction for AI goalkeeper headers
   * @param entity - The AI goalkeeper entity
   * @param ball - The soccer ball entity
   * @returns Direction vector for ball deflection
   */
  private calculateAIDeflectionDirection(entity: SoccerPlayerEntity, ball: any): { x: number; z: number } {
    const soccerEntity = entity as any; // Cast to access team property
    const goalCenterX = soccerEntity.team === 'red' ? -37 : 52; // Goal line X coordinates
    const goalCenterZ = 0; // Center of goal
    
    const entityPos = entity.position;
    const ballPos = ball.position;
    
    // Calculate direction away from goal
    const awayFromGoalX = entityPos.x - goalCenterX;
    const awayFromGoalZ = entityPos.z - goalCenterZ;
    
    // Normalize the away-from-goal direction
    const awayLength = Math.sqrt(awayFromGoalX * awayFromGoalX + awayFromGoalZ * awayFromGoalZ);
    const normalizedAwayX = awayLength > 0 ? awayFromGoalX / awayLength : 0;
    const normalizedAwayZ = awayLength > 0 ? awayFromGoalZ / awayLength : 0;
    
    // Add some randomness for realistic deflections
    const randomAngle = (Math.random() - 0.5) * Math.PI / 3; // ±30 degrees
    const cos = Math.cos(randomAngle);
    const sin = Math.sin(randomAngle);
    
    return {
      x: normalizedAwayX * cos - normalizedAwayZ * sin,
      z: normalizedAwayX * sin + normalizedAwayZ * cos
    };
  }

  /**
   * Checks if AI goalkeeper should attempt a header jump for high balls
   * @param entity - The AI goalkeeper entity
   * @returns Whether a header jump should be attempted
   */
  private shouldAttemptAIGoalkeeperHeader(entity: SoccerPlayerEntity): boolean {
    // Only goalkeepers can perform headers
    if (entity.role !== 'goalkeeper') {
      return false;
    }
    
    const ball = sharedState.getSoccerBall();
    if (!ball) {
      return false;
    }
    
    const ballPosition = ball.position;
    const playerPosition = entity.position;
    
    // Calculate distance to ball
    const distanceToBall = Math.sqrt(
      Math.pow(ballPosition.x - playerPosition.x, 2) + 
      Math.pow(ballPosition.z - playerPosition.z, 2)
    );
    
    // Check if ball is high enough and within header range
    const ballHeight = ballPosition.y - playerPosition.y;
    const isHighBall = ballHeight > AI_HIGH_BALL_THRESHOLD && ballHeight < 4.0;
    const isInHeaderRange = distanceToBall <= AI_GOALKEEPER_HEADER_RANGE;
    
    // Check if ball is moving toward the goalkeeper
    const ballVelocity = ball.linearVelocity;
    const ballToGoalkeeper = {
      x: playerPosition.x - ballPosition.x,
      z: playerPosition.z - ballPosition.z
    };
    const dotProduct = ballVelocity.x * ballToGoalkeeper.x + ballVelocity.z * ballToGoalkeeper.z;
    const isBallMovingTowardKeeper = dotProduct > 0;
    
    return isHighBall && isInHeaderRange && isBallMovingTowardKeeper && this.isGrounded;
  }

  /**
   * Performs AI goalkeeper header jump
   * @param entity - The AI goalkeeper entity
   */
  private performAIGoalkeeperJump(entity: SoccerPlayerEntity) {
    const ball = sharedState.getSoccerBall();
    if (!ball) return;
    
    const ballPosition = ball.position;
    const playerPosition = entity.position;
    
    // Calculate distance and direction to ball
    const distanceToBall = Math.sqrt(
      Math.pow(ballPosition.x - playerPosition.x, 2) + 
      Math.pow(ballPosition.z - playerPosition.z, 2)
    );
    
    const directionToBall = {
      x: (ballPosition.x - playerPosition.x) / distanceToBall,
      z: (ballPosition.z - playerPosition.z) / distanceToBall
    };
    
    // Enhanced jump velocity for AI goalkeepers
    const headerJumpVelocity = AI_JUMP_VELOCITY + AI_GOALKEEPER_JUMP_BOOST;
    const mass = entity.mass;
    
    // Apply directional impulse toward ball
    const jumpImpulseY = headerJumpVelocity * mass;
    const horizontalHeaderForce = 3.0 * mass; // Horizontal movement toward ball
    
    entity.applyImpulse({ 
      x: directionToBall.x * horizontalHeaderForce, 
      y: jumpImpulseY, 
      z: directionToBall.z * horizontalHeaderForce 
    });
    
    // Play jump animation
    entity.startModelOneshotAnimations(["kick"]); // Use kick animation for header jump
    
    console.log(`AI Goalkeeper ${entity.player?.username || 'AI'} jumping for header!`);
    
    // Check for immediate header contact if very close
    if (distanceToBall <= 1.5) {
      setTimeout(() => {
        this.performAIGoalkeeperHeader(entity, ball, directionToBall);
      }, 200); // 200ms delay for realistic header timing
    }
  }

  /**
   * Called when the controlled entity is spawned.
   * Creates the colliders for the entity for wall and ground detection.
   * @param entity - The entity that is spawned.
   */
  public spawn(entity: Entity) {
    if (!entity.isSpawned) {
      throw new Error(
        "AIController.spawn(): Entity is not spawned!"
      );
    }

    // Ground sensor
    entity.createAndAddChildCollider({
      shape: ColliderShape.CYLINDER,
      radius: 0.23,
      halfHeight: 0.125,
      collisionGroups: {
        belongsTo: [CollisionGroup.ENTITY_SENSOR],
        collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY],
      },
      isSensor: true,
      relativePosition: { x: 0, y: -0.75, z: 0 },
      tag: "groundSensor",
      onCollision: (_other: BlockType | Entity, started: boolean) => {
        // Ground contact
        this._groundContactCount += started ? 1 : -1;

        if (!this._groundContactCount) {
          entity.startModelOneshotAnimations(["jump_loop"]);
        } else {
          entity.stopModelAnimations(["jump_loop"]);
        }

        // Platform contact
        if (!(_other instanceof Entity) || !_other.isKinematic) return;

        if (started) {
          this._platform = _other;
        } else if (_other === this._platform && !started) {
          this._platform = undefined;
        }
      },
    });

    // Wall collider
    entity.createAndAddChildCollider({
      shape: ColliderShape.CAPSULE,
      halfHeight: 0.31,
      radius: 0.38,
      collisionGroups: {
        belongsTo: [CollisionGroup.ENTITY_SENSOR],
        collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY],
      },
      friction: 0,
      frictionCombineRule: CoefficientCombineRule.Min,
      tag: "wallCollider",
    });
  }

  /**
   * Ticks the AI movement for the entity controller.
   * This is called automatically by the entity system.
   * 
   * @param entity - The entity to tick.
   * @param deltaTimeMs - The delta time in milliseconds since the last tick.
   */
  public tick(entity: Entity, deltaTimeMs: number) {
    if (!(entity instanceof SoccerPlayerEntity)) return;
    
    // Check for AI goalkeeper header opportunities
    if (this.shouldAttemptAIGoalkeeperHeader(entity)) {
      this.performAIGoalkeeperJump(entity);
    }
    
    // Call the parent tick method
    super.tick(entity, deltaTimeMs);
  }
} 