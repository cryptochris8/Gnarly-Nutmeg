import {
  Audio,
  CoefficientCombineRule,
  ColliderShape,
  Entity,
  CollisionGroup,
  type BlockType,
  PlayerEntity,
  type PlayerInput,
  type PlayerCameraOrientation,
  BaseEntityController,
  SceneUI,
  World,
  type Vector3Like,
  BaseEntityControllerEvent,
} from "hytopia";
import sharedState from "../state/sharedState";
import {
  directionFromOrientation,
  getDirectionFromRotation,
} from "../utils/direction";
import { PASS_FORCE, BALL_SPAWN_POSITION as GLOBAL_BALL_SPAWN_POSITION, FIELD_MIN_X, FIELD_MAX_X, FIELD_MIN_Z, FIELD_MAX_Z, FIELD_MIN_Y, FIELD_MAX_Y, AI_GOAL_LINE_X_RED, AI_GOAL_LINE_X_BLUE } from "../state/gameConfig";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";

/** Options for creating a PlayerEntityController instance. @public */
export interface PlayerEntityControllerOptions {
  /** A function allowing custom logic to determine if the entity can jump. */
  canJump?: () => boolean;

  /** A function allowing custom logic to determine if the entity can walk. */
  canWalk?: () => boolean;

  /** A function allowing custom logic to determine if the entity can run. */
  canRun?: () => boolean;

  /** The upward velocity applied to the entity when it jumps. */
  jumpVelocity?: number;

  /** The normalized horizontal velocity applied to the entity when it runs. */
  runVelocity?: number;

  /** Whether the entity sticks to platforms, defaults to true. */
  sticksToPlatforms?: boolean;

  /** The normalized horizontal velocity applied to the entity when it walks. */
  walkVelocity?: number;
}

// Constants for player movement and actions
const SHOT_FORCE = 8;
const TACKLE_FORCE = 12;
const TACKLE_DURATION = 600;

// Add constants for ball reset
const BALL_VELOCITY_THRESHOLD = 0.1; // Minimum velocity to consider ball moving
const BALL_STUCK_CHECK_INTERVAL = 2000; // Check every 2 seconds
const BALL_STUCK_TIME_THRESHOLD = 3000; // Consider ball stuck after 3 seconds

// Add constants for goalkeeper header mechanics
const GOALKEEPER_HEADER_RANGE = 3.5; // Range for goalkeeper headers
const GOALKEEPER_HEADER_FORCE = 15; // Force applied during headers
const HIGH_BALL_THRESHOLD = 2.0; // Height threshold for considering ball "high"
const GOALKEEPER_JUMP_BOOST = 2.0; // Extra jump velocity for goalkeepers going for headers

export default class PlayerEntityController extends BaseEntityController {
  /**
   * A function allowing custom logic to determine if the entity can walk.
   * @param playerEntityController - The entity controller instance.
   * @returns Whether the entity of the entity controller can walk.
   */
  public canWalk: (playerEntityController: PlayerEntityController) => boolean =
    () => true;

  /**
   * A function allowing custom logic to determine if the entity can run.
   * @param playerEntityController - The entity controller instance.
   * @returns Whether the entity of the entity controller can run.
   */
  public canRun: (playerEntityController: PlayerEntityController) => boolean =
    () => true;

  /**
   * A function allowing custom logic to determine if the entity can jump.
   * @param playerEntityController - The entity controller instance.
   * @returns Whether the entity of the entity controller can jump.
   */
  public canJump: (playerEntityController: PlayerEntityController) => boolean =
    () => true;

  /** The upward velocity applied to the entity when it jumps. */
  public jumpVelocity: number = 10;

  /** The normalized horizontal velocity applied to the entity when it runs. */
  public runVelocity: number = 8;

  /** Whether the entity sticks to platforms. */
  public sticksToPlatforms: boolean = true;

  /** The normalized horizontal velocity applied to the entity when it walks. */
  public walkVelocity: number = 4;

  /** @internal */
  private _stepAudio: Audio | undefined;

  /** @internal */
  private _groundContactCount: number = 0
  
  /** @internal */
  private _lastHeaderTime: number = 0;

  /** @internal */
  private _platform: Entity | undefined;

  /** @internal */
  private _stunTimeout?: Timer;

  /** @internal */
  private static _tackleCooldownMap = new Map<string, number>();

  /** @internal */
  private static _axeThrowCooldownMap = new Map<string, number>();

  /** @internal */
  private _holdingQ: number | null = null;

  /** @internal */
  private _lastMoveDirection: { x: number; z: number } = { x: 0, z: 0 };

  /** @internal */
  private _powerBarUI?: SceneUI;

  /** @internal */
  private _chargeInterval: Timer | null = null;

  /** @internal */
  private _chargeStartTime: number | null = null;

  // Add properties to track ball state
  private static _lastBallPosition?: Vector3Like;
  private static _lastBallCheckTime = 0;
  private static _ballStuckStartTime = 0;
  private static _ballStuckCheckInterval: Timer | null = null;

  /** @internal */
  private _lastRotationUpdateTime: number | null = null;

  /** @internal */
  private _lastCameraRotationTime: number | null = null;

  /** @internal */
  private _lastBounceTime: number | null = null;

  // Power-up cooldown tracking
  private _lastPowerUpTime: number = 0;
  private static readonly POWER_UP_COOLDOWN_MS = 3000; // 3 second cooldown between power-ups

  /**
   * @param options - Options for the controller.
   */
  public constructor(options: PlayerEntityControllerOptions = {}) {
    super();

    this.jumpVelocity = options.jumpVelocity ?? this.jumpVelocity;
    this.runVelocity = options.runVelocity ?? this.runVelocity;
    this.walkVelocity = options.walkVelocity ?? this.walkVelocity;
    this.canWalk = options.canWalk ?? this.canWalk;
    this.canRun = options.canRun ?? this.canRun;
    this.canJump = options.canJump ?? this.canJump;
    this.sticksToPlatforms =
      options.sticksToPlatforms ?? this.sticksToPlatforms;
  }

  /** Whether the entity is grounded. */
  public get isGrounded(): boolean {
    return this._groundContactCount > 0;
  }

  /** Whether the entity is on a platform, a platform is any entity with a kinematic rigid body. */
  public get isOnPlatform(): boolean {
    return !!this._platform;
  }

  /** The platform the entity is on, if any. */
  public get platform(): Entity | undefined {
    return this._platform;
  }

  /**
   * Called when the controller is attached to an entity.
   * @param entity - The entity to attach the controller to.
   */
  public attach(entity: Entity) {
    this._stepAudio = new Audio({
      uri: "audio/sfx/step/grass/grass-step-02.mp3",
      loop: true,
      volume: 0.1,
      attachedToEntity: entity,
    });

    entity.lockAllRotations(); // prevent physics from applying rotation to the entity, we can still explicitly set it.
    this._powerBarUI = new SceneUI({
      templateId: "power-bar",
      attachedToEntity: entity,
      state: { isCharging: false, startTime: 0 },
      offset: { x: 0, y: 1.05, z: 0 },
    });
  }

  /**
   * Called when the controlled entity is spawned.
   * In PlayerEntityController, this function is used to create
   * the colliders for the entity for wall and ground detection.
   * @param entity - The entity that is spawned.
   */
  public spawn(entity: Entity) {
    if (!entity.isSpawned) {
      throw new Error(
        "PlayerEntityController.createColliders(): Entity is not spawned!"
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

        // Ensure entity is still valid and spawned before attempting animation
        if (!entity || !entity.isSpawned) {
          // console.warn("GroundSensor onCollision: Entity no longer spawned, skipping animation.");
          return;
        }

        if (!this._groundContactCount) {
          entity.startModelOneshotAnimations(["jump_loop"]);
        } else {
          entity.stopModelAnimations(["jump_loop"]);
        }

        // Platform contact
        if (!(_other instanceof Entity) || !_other.isKinematic) return;

        if (started && this.sticksToPlatforms) {
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

    // Start ball stuck detection when first entity spawns
    if (!PlayerEntityController._ballStuckCheckInterval) {
      PlayerEntityController._ballStuckCheckInterval = setInterval(() => {
        this.checkForStuckBall(entity.world as World);
      }, BALL_STUCK_CHECK_INTERVAL);
    }
  }

  /**
   * Ticks the player movement for the entity controller,
   * overriding the default implementation.
   *
   * @param entity - The entity to tick.
   * @param input - The current input state of the player.
   * @param cameraOrientation - The current camera orientation state of the player.
   * @param deltaTimeMs - The delta time in milliseconds since the last tick.
   */
  public tickWithPlayerInput(
    entity: PlayerEntity,
    input: PlayerInput,
    cameraOrientation: PlayerCameraOrientation,
    deltaTimeMs: number
  ) {
    try {
      // Early return if entity or world is invalid
      if (!entity?.isSpawned || !entity.world) {
        return;
      }

      // Ensure input and cameraOrientation are valid before proceeding
      if (!input) {
        // console.log("SoccerPlayerController: Input is undefined, skipping tick.");
        return;
      }
      if (!cameraOrientation) {
        // console.log("SoccerPlayerController: cameraOrientation is undefined, skipping tick.");
        return;
      }

      if (!(entity instanceof SoccerPlayerEntity)) return;

      // Get ball reference and check validity
      const soccerBall = sharedState.getSoccerBall();
      if (!soccerBall?.isSpawned || !soccerBall.world) {
        return;
      }

      // Get game state to check for halftime
      const gameState = sharedState.getGameState();
      const isHalftime = gameState?.isHalftime || false;

      // If stunned, frozen, or during halftime, ignore movement input
      const isStunned = entity.isStunned;
      const isTackling = entity.isTackling;
      const isFrozen = entity.isPlayerFrozen;

      if (isStunned || isFrozen || isHalftime) {
        input = {
          ...input,
          w: false,
          a: false,
          s: false,
          d: false,
          sp: false,
          ml: false,
          mr: false,
        };
      }

      // Check attached player state
      const attachedPlayer = sharedState.getAttachedPlayer();
      const hasBall = attachedPlayer?.player?.username === entity.player?.username;

      const { w, a, s, d, sp, ml, q, sh, mr, e } = input;
      const { yaw } = cameraOrientation;
      const currentVelocity = { ...entity.linearVelocity }; // Clone velocity
      const targetVelocities = { x: 0, y: 0, z: 0 }; // Initialize target velocities
      const isRunning = sh;
      const isDodging = entity.isDodging;

      // Temporary, animations
      if (
        this.isGrounded &&
        (w || a || s || d) &&
        !isTackling &&
        !this._holdingQ &&
        !isDodging
      ) {
        if (isRunning) {
          const runAnimations = ["run_upper", "run_lower"];
          entity.stopModelAnimations(
            Array.from(entity.modelLoopedAnimations).filter(
              (v) => !runAnimations.includes(v)
            )
          );
          entity.startModelLoopedAnimations(runAnimations);
          this._stepAudio?.setPlaybackRate(0.81);
        } else {
          const walkAnimations = ["walk_upper", "walk_lower"];
          entity.stopModelAnimations(
            Array.from(entity.modelLoopedAnimations).filter(
              (v) => !walkAnimations.includes(v)
            )
          );

          entity.startModelLoopedAnimations(walkAnimations);
          this._stepAudio?.setPlaybackRate(0.55);
        }

        this._stepAudio?.play(entity.world as World, !this._stepAudio?.isPlaying);
      } else {
        this._stepAudio?.pause();
        const idleAnimations = ["idle_upper", "idle_lower"];
        entity.stopModelAnimations(
          Array.from(entity.modelLoopedAnimations).filter(
            (v) => !idleAnimations.includes(v)
          )
        );
        entity.startModelLoopedAnimations(idleAnimations);
      }

      // Handle shooting with Right Mouse Button (mr)
      if (mr && hasBall && this._holdingQ == null) {
        this._chargeStartTime = Date.now();
        this._holdingQ = Date.now();
        entity.startModelLoopedAnimations(["wind_up"]);
        if (this._powerBarUI) {
          this._powerBarUI.load(entity.world as World);
          this._powerBarUI.setState({
            isCharging: true,
            startTime: this._chargeStartTime,
            percentage: 0,
          });

          this.clearChargeInterval();
          this._chargeInterval = setInterval(() => {
            if (!this._chargeStartTime) {
               this.clearChargeInterval();
               return;
            }
            const elapsed = Date.now() - this._chargeStartTime;
            const percentage = Math.min((elapsed / 1500) * 100, 100);

            this._powerBarUI?.setState({
               isCharging: true,
               startTime: this._chargeStartTime, 
               percentage: percentage,
            });
          }, 16);
        }
      } else if (!mr && this._holdingQ != null && hasBall) {
        const chargeDuration = Date.now() - this._holdingQ;
        // Calculate power: Base 1.5, scales up to 5 based on charge duration (max 1.5s)
        const basePower = 1.5;
        const maxChargePower = 3.5;
        const powerScale = Math.min(1500, chargeDuration) / 1500; // 0 to 1 based on charge time up to 1.5s
        let totalPower = basePower + (maxChargePower * powerScale);
        
        // Apply mega kick enhancement if active (only in arcade mode)
        if (entity instanceof SoccerPlayerEntity) {
          // Get enhancement manager from shared state or game state
          if (isArcadeMode()) {
            // Try to get arcade enhancement manager
            const arcadeManager = (entity.world as any)._arcadeManager;
                                      if (arcadeManager && arcadeManager.hasMegaKick && arcadeManager.hasMegaKick(entity.player.username)) {
               totalPower *= 2.0; // Double the total power for mega kick
               arcadeManager.consumeMegaKick(entity.player.username);
               console.log(`⚽ MEGA KICK: ${entity.player.username} used mega kick enhancement!`);
              
              // Play special mega kick sound
              new Audio({
                uri: "audio/sfx/ui/inventory-grab-item.mp3",
                loop: false,
                volume: 1.0,
                attachedToEntity: entity,
              }).play(entity.world as World);
            }
          }
        }

        console.log("Charge Duration:", chargeDuration, "Power:", totalPower);
        sharedState.setAttachedPlayer(null);
        const direction = directionFromOrientation(entity, cameraOrientation);
        
        // Apply impulse based on calculated totalPower
        soccerBall?.applyImpulse({
          x: direction.x * totalPower,       // Apply full power horizontally
          y: Math.min(1.5, totalPower * 0.3), // Apply vertical power, capped (adjusted cap from 3 to 1.5)
          z: direction.z * totalPower,       // Apply full power horizontally
        });
        // Reset angular velocity to prevent unwanted spinning/backwards movement
        soccerBall?.setAngularVelocity({ x: 0, y: 0, z: 0 });
        
        entity.stopModelAnimations(["wind_up"]);
        entity.startModelOneshotAnimations(["kick"]); // Use oneshot kick animation
        new Audio({
          uri: "audio/sfx/soccer/kick.mp3",
          loop: false,
          volume: 1,
          attachedToEntity: entity,
        }).play(entity.world as World);

        this.clearChargeInterval();
        this._powerBarUI?.unload();

        this._holdingQ = null;
        this._chargeStartTime = null;
      }

      if (input["1"] && !hasBall) {
        // Check cooldown before allowing axe throw
        if(entity.abilityHolder.hasAbility()) {
          // Use the ability
          const direction = {x: entity.player.camera.facingDirection.x, y: entity.player.camera.facingDirection.y + 0.1, z: entity.player.camera.facingDirection.z};
          entity.abilityHolder.getAbility()?.use(
            entity.position,
            direction,
            entity 
          );
        }
      }

      // Handle power-up activation with F key (only in arcade mode)
      if (input["f"]) {
        console.log(`🎮 F key pressed by ${entity.player?.username || 'unknown'}`);
        
        // Check cooldown to prevent spam
        const currentTime = Date.now();
        if (currentTime - this._lastPowerUpTime >= PlayerEntityController.POWER_UP_COOLDOWN_MS) {
          this._lastPowerUpTime = currentTime;
          this._activateRandomPowerUp(entity);
          
          // Cancel the input to prevent multiple activations
          input["f"] = false;
        } else {
          // Still on cooldown, cancel the input
          input["f"] = false;
          const remainingCooldown = Math.ceil((PlayerEntityController.POWER_UP_COOLDOWN_MS - (currentTime - this._lastPowerUpTime)) / 1000);
          console.log(`🎮 Power-up on cooldown for ${entity.player?.username || 'unknown'} - ${remainingCooldown}s remaining`);
        }
      }

      // Handle passing with E - IMPROVED TARGETING SYSTEM
      if (ml) {
        if (hasBall && !this._holdingQ) {
          sharedState.setAttachedPlayer(null);
          
          // Find the best teammate to pass to based on camera direction and positioning
          const bestTarget = this._findBestPassTarget(entity, cameraOrientation);
          
          if (bestTarget) {
            // Calculate optimal pass with leading and power adjustment
            const passResult = this._executeTargetedPass(entity, bestTarget, soccerBall);
            
            if (passResult.success) {
              console.log(`✅ HUMAN PASS: ${entity.player.username} passed to ${bestTarget.player.username} at distance ${passResult.distance.toFixed(1)}`);
            } else {
              console.warn(`❌ HUMAN PASS FAILED: Could not complete pass to ${bestTarget.player.username}`);
            }
          } else {
            // Fallback to directional pass if no good target found
            console.log(`⚠️ HUMAN PASS: No good target found, using directional pass`);
            this._executeDirectionalPass(entity, cameraOrientation, soccerBall);
          }
          
          // Play kick animation and sound
          entity.startModelOneshotAnimations(["kick"]);
          new Audio({
            uri: "audio/sfx/soccer/kick.mp3",
            loop: false,
            volume: 0.8,
            attachedToEntity: entity,
          }).play(entity.world as World);
        }
      }

      // Calculate target horizontal velocities (run/walk)
      if (
        ((isRunning && this.canRun(this)) ||
          (!isRunning && this.canWalk(this))) &&
        !isTackling &&
        !this._holdingQ
      ) {
        let velocity = isRunning ? this.runVelocity : this.walkVelocity;
        velocity += entity.getSpeedAmplifier();
        if (w) {
          targetVelocities.x -= velocity * Math.sin(yaw);
          targetVelocities.z -= velocity * Math.cos(yaw);
        }

        if (s) {
          targetVelocities.x += velocity * Math.sin(yaw);
          targetVelocities.z += velocity * Math.cos(yaw);
        }

        if (a) {
          targetVelocities.x -= velocity * Math.cos(yaw);
          targetVelocities.z += velocity * Math.sin(yaw);
        }

        if (d) {
          targetVelocities.x += velocity * Math.cos(yaw);
          targetVelocities.z -= velocity * Math.sin(yaw);
        }

        // Normalize for diagonals
        const length = Math.sqrt(
          targetVelocities.x * targetVelocities.x +
            targetVelocities.z * targetVelocities.z
        );
        if (length > velocity) {
          const factor = velocity / length;
          targetVelocities.x *= factor;
          targetVelocities.z *= factor;
        }
      }

      // --- Apply Movement Impulse ---
      const mass = entity.mass || 1.0; // Use entity's mass, default to 1.0 if not set
      const timeDeltaSeconds = deltaTimeMs / 1000; // Convert milliseconds to seconds

      // Calculate the velocity error
      const velocityErrorX = targetVelocities.x - currentVelocity.x;
      const velocityErrorZ = targetVelocities.z - currentVelocity.z;

      // Apply additional dampening when player is not receiving input
      // This helps prevent oscillations and unstable physics
      if (!(w || a || s || d)) {
        const dampingFactor = 0.98; // Increased damping for more stability
        const currentSpeed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.z * currentVelocity.z);
        
        if (currentSpeed > 0.05) { // Lower threshold for applying damping
          const additionalDampingImpulseX = -currentVelocity.x * mass * dampingFactor;
          const additionalDampingImpulseZ = -currentVelocity.z * mass * dampingFactor;
          
          entity.applyImpulse({
            x: additionalDampingImpulseX,
            y: 0,
            z: additionalDampingImpulseZ
          });
        } else {
          // If almost stationary, completely zero out horizontal velocity
          entity.setLinearVelocity({
            x: 0,
            y: entity.linearVelocity.y,
            z: 0
          });
        }
      }

      // Calculate the required impulse using a proportional control (simplified)
      const K_p = 60; // Reduced proportional gain for smoother movement
      
      // Limit the maximum velocity error to prevent extreme impulses
      const maxVelocityError = 15;
      const limitedVelocityErrorX = Math.max(-maxVelocityError, Math.min(maxVelocityError, velocityErrorX));
      const limitedVelocityErrorZ = Math.max(-maxVelocityError, Math.min(maxVelocityError, velocityErrorZ));
      
      const impulseX = mass * limitedVelocityErrorX * K_p * timeDeltaSeconds;
      const impulseZ = mass * limitedVelocityErrorZ * K_p * timeDeltaSeconds;

      // Apply the scaled impulse
      entity.applyImpulse({
          x: impulseX, 
          y: 0, // Do not apply impulse vertically for horizontal movement
          z: impulseZ 
      });

      // Debug logging for physics-related issues
      if (Math.random() < 0.01) { // Log only occasionally to avoid spam
        console.log(`Player ${entity.player?.username || 'unknown'} physics: ` +
          `pos(${entity.position.x.toFixed(2)},${entity.position.y.toFixed(2)},${entity.position.z.toFixed(2)}), ` +
          `vel(${entity.linearVelocity.x.toFixed(2)},${entity.linearVelocity.y.toFixed(2)},${entity.linearVelocity.z.toFixed(2)}), ` +
          `impulse(${impulseX.toFixed(2)},0,${impulseZ.toFixed(2)})`);
      }

      // Limit maximum velocity to prevent physics instability
      const currentVelSqr = 
        entity.linearVelocity.x * entity.linearVelocity.x + 
        entity.linearVelocity.z * entity.linearVelocity.z;
      const maxVelocity = 20; // Set a reasonable maximum velocity
      const maxVelocitySqr = maxVelocity * maxVelocity;
      
      if (currentVelSqr > maxVelocitySqr) {
        const scale = maxVelocity / Math.sqrt(currentVelSqr);
        entity.setLinearVelocity({
          x: entity.linearVelocity.x * scale,
          y: entity.linearVelocity.y, // Preserve vertical velocity
          z: entity.linearVelocity.z * scale
        });
        console.log(`Player ${entity.player?.username || 'unknown'} velocity limited to prevent instability`);
      }

      // Enhanced jump mechanics with goalkeeper header support
      if (sp && this.canJump(this) && !this._holdingQ) {
        const isGoalkeeper = (entity as any).aiRole === 'goalkeeper' || 
                            (entity as any).role === 'goalkeeper';
        
        // Check for goalkeeper header opportunity
        if (isGoalkeeper && !hasBall) {
          const ball = sharedState.getSoccerBall();
          if (ball) {
            const ballPosition = ball.position;
            const playerPosition = entity.position;
            const distanceToBall = Math.sqrt(
              Math.pow(ballPosition.x - playerPosition.x, 2) + 
              Math.pow(ballPosition.z - playerPosition.z, 2)
            );
            
            // Check if ball is high enough and within header range
            const ballHeight = ballPosition.y - playerPosition.y;
            const isHighBall = ballHeight > HIGH_BALL_THRESHOLD && ballHeight < 4.0;
            const isInHeaderRange = distanceToBall <= GOALKEEPER_HEADER_RANGE;
            
            if (isHighBall && isInHeaderRange) {
              // Goalkeeper header jump - enhanced jump with directional component
              if (this.isGrounded && currentVelocity.y > -0.001 && currentVelocity.y <= 3) {
                // Calculate direction toward ball for header jump
                const directionToBall = {
                  x: (ballPosition.x - playerPosition.x) / distanceToBall,
                  z: (ballPosition.z - playerPosition.z) / distanceToBall
                };
                
                // Enhanced jump velocity for goalkeepers
                const headerJumpVelocity = this.jumpVelocity + GOALKEEPER_JUMP_BOOST;
                targetVelocities.y = headerJumpVelocity;
                
                // Apply directional impulse toward ball
                const jumpImpulseY = headerJumpVelocity * mass;
                const horizontalHeaderForce = 3.0 * mass; // Horizontal movement toward ball
                
                entity.applyImpulse({ 
                  x: directionToBall.x * horizontalHeaderForce, 
                  y: jumpImpulseY, 
                  z: directionToBall.z * horizontalHeaderForce 
                });
                
                // Play header animation if available
                entity.startModelOneshotAnimations(["kick"]); // Use kick animation for header
                
                // Check for immediate header contact if very close
                if (distanceToBall <= 1.5 && ballHeight < 3.0) {
                  this.performGoalkeeperHeader(entity, ball, directionToBall);
                }
              }
            } else {
              // Normal jump for goalkeepers when not going for headers
              if (this.isGrounded && currentVelocity.y > -0.001 && currentVelocity.y <= 3) {
                targetVelocities.y = this.jumpVelocity;
                const jumpImpulseY = this.jumpVelocity * mass;
                entity.applyImpulse({ x: 0, y: jumpImpulseY, z: 0 });
              }
            }
          } else {
            // Normal jump when no ball present
            if (this.isGrounded && currentVelocity.y > -0.001 && currentVelocity.y <= 3) {
              targetVelocities.y = this.jumpVelocity;
              const jumpImpulseY = this.jumpVelocity * mass;
              entity.applyImpulse({ x: 0, y: jumpImpulseY, z: 0 });
            }
          }
        } else if (!hasBall) {
          // Normal jump for non-goalkeepers
          if (this.isGrounded && currentVelocity.y > -0.001 && currentVelocity.y <= 3) {
            targetVelocities.y = this.jumpVelocity;
            const jumpImpulseY = this.jumpVelocity * mass;
            entity.applyImpulse({ x: 0, y: jumpImpulseY, z: 0 });
          }
        }
      }

      // Update last move direction based on target horizontal velocities
      if (w || a || s || d) {
        const moveDirectionLength = Math.sqrt(
          targetVelocities.x * targetVelocities.x +
          targetVelocities.z * targetVelocities.z
        );
        if (moveDirectionLength > 0) {
          this._lastMoveDirection = {
            x: targetVelocities.x / moveDirectionLength,
            z: targetVelocities.z / moveDirectionLength,
          };
        }
      }

      // Apply rotation based on movement direction
      if (this._lastMoveDirection.x !== 0 || this._lastMoveDirection.z !== 0) {
          const targetYaw = Math.atan2(this._lastMoveDirection.x, this._lastMoveDirection.z);
          // Corrected 180-degree offset due to model's intrinsic orientation
          const correctedYaw = targetYaw + Math.PI;
          const halfYaw = correctedYaw / 2;
          
          // Throttle rotation updates to reduce physics strain
          const currentTime = Date.now();
          const rotationUpdateInterval = 100; // milliseconds between rotation updates
          
          if (!this._lastRotationUpdateTime || (currentTime - this._lastRotationUpdateTime) > rotationUpdateInterval) {
            entity.setRotation({
              x: 0,
              y: Math.sin(halfYaw),
              z: 0,
              w: Math.cos(halfYaw),
            });
            this._lastRotationUpdateTime = currentTime;
          }
      }

      // Handle tackle
      if (mr && !this._holdingQ && !hasBall) {
        const cooldownMap = PlayerEntityController._tackleCooldownMap;

        if (cooldownMap.has(entity.player.username)) {
          const cooldown = cooldownMap.get(entity.player.username);
          if (cooldown && cooldown > Date.now()) {
            return;
          }
          cooldownMap.delete(entity.player.username);
        }

        // Original tackle logic when doesn't have ball
        cooldownMap.set(entity.player.username, Date.now() + 2000);
        const direction = getDirectionFromRotation(entity.rotation);

        entity.setLinearVelocity({
          x: 0,
          y: 0,
          z: 0,
        });

        entity.applyImpulse({
          x: direction.x * -8,
          y: 5,
          z: direction.z * -8,
        });

        entity.isTackling = true;
        entity.startModelOneshotAnimations(["tackle"]);
        new Audio({
          uri: "audio/sfx/soccer/tackle.mp3",
          loop: false,
          volume: 0.6,
          attachedToEntity: entity,
        }).play(entity.world as World);
        setTimeout(() => {
          entity.isTackling = false;
        }, 500);
      }

      if (sp && !this._holdingQ && hasBall) {
        // Dribble/dodge move when has ball
        const cooldownMap = PlayerEntityController._tackleCooldownMap;

        if (cooldownMap.has(entity.player.username)) {
          const cooldown = cooldownMap.get(entity.player.username);
          if (cooldown && cooldown > Date.now()) {
            return;
          }
          cooldownMap.delete(entity.player.username);
        }
        cooldownMap.set(entity.player.username, Date.now() + 1000);

        // Get forward direction from camera orientation
        const forward = {
          x: -Math.sin(cameraOrientation.yaw),
          z: -Math.cos(cameraOrientation.yaw),
        };

        // Get right vector (perpendicular to forward)
        const right = {
          x: -forward.z,
          z: forward.x,
        };

        // Determine dodge direction based on last movement
        const side =
          this._lastMoveDirection.x * right.x +
            this._lastMoveDirection.z * right.z >
          0
            ? 1
            : -1;

        // Apply quick diagonal impulse (forward + side)
        entity.setLinearVelocity({
          x: 0,
          y: 0,
          z: 0,
        });

        entity.applyImpulse({
          x: forward.x * 8 + right.x * side * 10,
          y: 1,
          z: forward.z * 8 + right.z * side * 10,
        });

        // Play dodge animation
        // is player going right or left?
        const rotation = getDirectionFromRotation(entity.rotation);
        const isGoingRight = rotation.x * side > 0;
        entity.stopModelAnimations(
          Array.from(entity.modelLoopedAnimations).filter((v) => v !== "dizzy")
        );

        entity.startModelOneshotAnimations([
          isGoingRight ? "dodge_right" : "dodge_left",
        ]);
      }

      // --- Boundary Clamping Logic ---
      const currentPosition = entity.position;
      const clampedX = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, currentPosition.x));
      const clampedY = Math.max(FIELD_MIN_Y, Math.min(FIELD_MAX_Y, currentPosition.y)); // Clamp Y as well
      const clampedZ = Math.max(FIELD_MIN_Z, Math.min(FIELD_MAX_Z, currentPosition.z));

      // If the position was clamped, update the entity's position and potentially zero out velocity towards the boundary
      if (currentPosition.x !== clampedX || currentPosition.y !== clampedY || currentPosition.z !== clampedZ) {
        entity.setPosition({ x: clampedX, y: clampedY, z: clampedZ });
        // Optional: If hitting a boundary, nullify velocity in that direction to prevent sticking or continued force application
        let newVelocityX = entity.linearVelocity.x;
        let newVelocityY = entity.linearVelocity.y;
        let newVelocityZ = entity.linearVelocity.z;

        if (currentPosition.x !== clampedX) newVelocityX = 0;
        if (currentPosition.y !== clampedY) newVelocityY = 0; // Stop vertical movement if hitting Y boundary
        if (currentPosition.z !== clampedZ) newVelocityZ = 0;
        
        entity.setLinearVelocity({x: newVelocityX, y: newVelocityY, z: newVelocityZ});
        // console.log(`Player ${entity.player.username} clamped to boundaries.`);
      }
      // --- End of Boundary Clamping Logic ---

      if (entity instanceof SoccerPlayerEntity) {
        // ... existing code ...
      }
    } catch (error) {
      console.log("Tick error:", error);
    }
  }

  private clearChargeInterval() {
    if (this._chargeInterval) {
      clearInterval(this._chargeInterval);
      this._chargeInterval = null;
    }
  }

  /**
   * Handles collision events for the entity.
   * @param entity The entity that collided.
   * @param other The entity or block that was collided with.
   */
  public onCollision(entity: PlayerEntity, other: Entity): void {
    // Check if entity is still spawned to prevent errors
    if (!entity.isSpawned) {
      return;
    }

    const soccerBall = sharedState.getSoccerBall();
    try {
      // Check if both entities exist and are spawned
      if (!entity?.isSpawned || !other?.isSpawned || !entity.world || !other.world) {
       return;
     }

      if (!(entity instanceof SoccerPlayerEntity)) return;

      // Handle ball collision
      if (other.name === "SoccerBall") {
        // Only play animations if the entity is still spawned and valid
        try {
          // Re-check isSpawned immediately before animation call
          if (entity.isSpawned && entity.world) {
            entity.startModelOneshotAnimations(["kick"]);
            setTimeout(() => {
              try {
                // Re-check isSpawned immediately before animation call inside setTimeout
                if (entity.isSpawned && entity.world) {
                  entity.stopModelAnimations(["kick"]);
                }
              } catch (error) {
                // console.log("Animation stop error:", error);
              }
            }, 500);
          }
        } catch (error) {
          // console.log("Animation start error:", error);
        }
      }
    } catch (error) {
      // console.log("Collision handling error:", error);
    }
  }

  /**
   * Clean up power charge related state if needed
   */
  private _clearPowerChargeIfNeeded(player: PlayerEntity) {
    // Clear charge interval if it exists
    this.clearChargeInterval();
    
    // Clear any charge UI if it exists
    if (this._powerBarUI) {
      try {
        this._powerBarUI = undefined;
      } catch (error) {
        // Ignore errors
      }
    }
  }

  public detach(entity: Entity) {
    try {
      // Clear any pending animations or intervals
      if (entity instanceof SoccerPlayerEntity) {
        try {
          entity.stopModelAnimations(Array.from(entity.modelLoopedAnimations));
        } catch (error) {
          console.log("Animation cleanup error:", error);
        }
      }

      // Clear intervals
      this.clearChargeInterval();
      if (PlayerEntityController._ballStuckCheckInterval) {
        clearInterval(PlayerEntityController._ballStuckCheckInterval);
        PlayerEntityController._ballStuckCheckInterval = null;
      }

      super.detach(entity);
    } catch (error) {
      console.log("Detach error:", error);
    }
  }

  private checkForStuckBall(world: World) {
    try {
      const soccerBall = sharedState.getSoccerBall();
      if (!soccerBall?.isSpawned) {
        PlayerEntityController._ballStuckStartTime = 0; 
        return;
      }

      const currentTime = Date.now();

      if (PlayerEntityController._ballStuckCheckInterval === null && typeof setInterval === 'function') {
        // Initialize the interval if it hasn't been, and if setInterval is available (node environment)
        // This static interval might be better handled outside or passed in, but for now, let's try to make it work.
        // @ts-ignore: setInterval might not be available in all Hytopia environments directly on PlayerEntityController static side.
        PlayerEntityController._ballStuckCheckInterval = setInterval(() => {
            // This function will be called by the interval, 
            // but the main logic is outside. This interval setup is likely flawed for a static method.
            // The original call to checkForStuckBall should be driven by a game loop or tick.
            // For now, the check below `currentTime - PlayerEntityController._lastBallCheckTime` manages frequency.
        }, BALL_STUCK_CHECK_INTERVAL);
      }

      if (currentTime - PlayerEntityController._lastBallCheckTime < BALL_STUCK_CHECK_INTERVAL) {
          return;
      }
      PlayerEntityController._lastBallCheckTime = currentTime;
      
      const currentPosition = soccerBall.position;
      const currentVelocity = soccerBall.linearVelocity; 

      if (!currentVelocity) {
        PlayerEntityController._ballStuckStartTime = 0;
        return;
      }
      // This threshold should be validated against actual goal trigger zone X boundaries.
      const isInGoalArea = Math.abs(currentPosition.x) > 35; 
      const isAboveGoalHeight = currentPosition.y > 3; 

      const isEffectivelyStationary =
        Math.abs(currentVelocity.x) < BALL_VELOCITY_THRESHOLD &&
        Math.abs(currentVelocity.y) < BALL_VELOCITY_THRESHOLD &&
        Math.abs(currentVelocity.z) < BALL_VELOCITY_THRESHOLD;

      const isPotentiallyStuck = (isAboveGoalHeight || isInGoalArea) && isEffectivelyStationary;

      if (isPotentiallyStuck) {
        if (PlayerEntityController._ballStuckStartTime === 0) {
          PlayerEntityController._ballStuckStartTime = currentTime;
        } else if (currentTime - PlayerEntityController._ballStuckStartTime > BALL_STUCK_TIME_THRESHOLD) { 
          console.log("Ball stuck detected - resetting position to global spawn.");
          soccerBall.despawn();
          sharedState.setAttachedPlayer(null); 
          soccerBall.spawn(world, GLOBAL_BALL_SPAWN_POSITION); 
          soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
          soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
          PlayerEntityController._ballStuckStartTime = 0; 
          
          new Audio({
            uri: "audio/sfx/soccer/whistle.mp3",
            loop: false,
            volume: 0.1,
          }).play(world);
        }
      } else {
        PlayerEntityController._ballStuckStartTime = 0; 
      }

      PlayerEntityController._lastBallPosition = { ...currentPosition };

    } catch (error) {
      console.warn("Error in checkForStuckBall:", error);
      PlayerEntityController._ballStuckStartTime = 0; 
    }
  }

  /**
   * Find the best teammate to pass to based on camera direction and field positioning
   * @param entity - The player entity making the pass
   * @param cameraOrientation - The player's camera orientation
   * @returns The best teammate to pass to, or null if none found
   */
  private _findBestPassTarget(entity: PlayerEntity, cameraOrientation: PlayerCameraOrientation): PlayerEntity | null {
    // Get all player entities from the world
    if (!entity.world) return null;
    
    const allPlayerEntities = entity.world.entityManager.getAllPlayerEntities();
    const teammates = allPlayerEntities.filter((teammate: PlayerEntity) => 
      teammate !== entity && 
      teammate.isSpawned && 
      (teammate as any).team === (entity as any).team
    );

    if (teammates.length === 0) return null;

    // Calculate camera direction vector
    const cameraDirection = directionFromOrientation(entity, cameraOrientation);
    
    let bestTarget: PlayerEntity | null = null;
    let bestScore = -Infinity;

    for (const teammate of teammates) {
      // Calculate direction to teammate
      const toTeammate = {
        x: teammate.position.x - entity.position.x,
        y: 0,
        z: teammate.position.z - entity.position.z
      };
      
      const distanceToTeammate = Math.sqrt(toTeammate.x * toTeammate.x + toTeammate.z * toTeammate.z);
      
      // Skip teammates that are too far away
      if (distanceToTeammate > 35 || distanceToTeammate < 2) continue;
      
      // Normalize direction to teammate
      const normalizedToTeammate = {
        x: toTeammate.x / distanceToTeammate,
        y: 0,
        z: toTeammate.z / distanceToTeammate
      };
      
      // Calculate angle between camera direction and direction to teammate
      const dotProduct = cameraDirection.x * normalizedToTeammate.x + cameraDirection.z * normalizedToTeammate.z;
      const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))); // Clamp to prevent NaN
      
      // Only consider teammates within a reasonable angle (90 degrees = π/2 radians)
      if (angle > Math.PI / 2) continue;
      
      // Calculate score based on multiple factors
      let score = 0;
      
      // Angle bonus - prefer teammates in camera direction (max 30 points)
      score += (1 - (angle / (Math.PI / 2))) * 30;
      
      // Distance bonus - prefer closer teammates but not too close (max 25 points)
      const optimalDistance = 12; // Optimal pass distance
      const distanceScore = Math.max(0, 25 - Math.abs(distanceToTeammate - optimalDistance) * 2);
      score += distanceScore;
      
      // Forward progress bonus - prefer teammates closer to opponent goal (max 20 points)
      const opponentGoalX = (entity as any).team === 'red' ? 
        AI_GOAL_LINE_X_BLUE : 
        AI_GOAL_LINE_X_RED;
      
      const forwardProgress = (entity as any).team === 'red' ? 
        teammate.position.x - entity.position.x : 
        entity.position.x - teammate.position.x;
      
      if (forwardProgress > 0) {
        score += Math.min(20, forwardProgress * 2);
      }
      
      // Space bonus - check if teammate has space around them (max 15 points)
      const spaceScore = this._calculateTeammateSpace(teammate, allPlayerEntities);
      score += spaceScore;
      
      // Human player priority - give massive bonus to human players (max 50 points)
      if (!(teammate as any).aiRole) {
        score += 50;
        console.log(`Human pass targeting: Prioritizing human player ${teammate.player.username}`);
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = teammate;
      }
    }

    return bestTarget;
  }

  /**
   * Calculate how much space a teammate has around them
   * @param teammate - The teammate to check space for
   * @param allPlayers - All players in the game
   * @returns Space score (0-15)
   */
  private _calculateTeammateSpace(teammate: PlayerEntity, allPlayers: PlayerEntity[]): number {
    let spaceScore = 15; // Start with max space
    
    for (const otherPlayer of allPlayers) {
      if (otherPlayer === teammate || !otherPlayer.isSpawned) continue;
      
      const distance = Math.sqrt(
        Math.pow(teammate.position.x - otherPlayer.position.x, 2) + 
        Math.pow(teammate.position.z - otherPlayer.position.z, 2)
      );
      
      // Reduce space score based on nearby players
      if (distance < 3) {
        spaceScore -= 8; // Very close player
      } else if (distance < 6) {
        spaceScore -= 4; // Moderately close player
      } else if (distance < 10) {
        spaceScore -= 2; // Somewhat close player
      }
    }
    
    return Math.max(0, spaceScore);
  }

  /**
   * Execute a targeted pass to a specific teammate with proper leading and power
   * @param entity - The player making the pass
   * @param target - The teammate to pass to
   * @param ball - The soccer ball entity
   * @returns Object with success status and distance
   */
  private _executeTargetedPass(entity: PlayerEntity, target: PlayerEntity, ball: Entity | null): { success: boolean; distance: number } {
    if (!ball) return { success: false, distance: 0 };

    // Calculate distance to target
    const distanceToTarget = Math.sqrt(
      Math.pow(target.position.x - entity.position.x, 2) + 
      Math.pow(target.position.z - entity.position.z, 2)
    );

    // Calculate leading based on target's movement
    const leadFactor = Math.min(4.0, 2.0 + (distanceToTarget / 15)); // More lead for longer passes
    
    // Get target's current velocity for leading calculation
    const targetVelocity = target.linearVelocity || { x: 0, y: 0, z: 0 };
    const velocityMagnitude = Math.sqrt(targetVelocity.x * targetVelocity.x + targetVelocity.z * targetVelocity.z);
    
    // Calculate lead position
    let leadPosition = { ...target.position };
    if (velocityMagnitude > 0.5) { // Only lead if target is moving significantly
      const normalizedVelocity = {
        x: targetVelocity.x / velocityMagnitude,
        z: targetVelocity.z / velocityMagnitude
      };
      
      leadPosition = {
        x: target.position.x + normalizedVelocity.x * leadFactor,
        y: target.position.y,
        z: target.position.z + normalizedVelocity.z * leadFactor
      };
    }

    // Calculate pass direction
    const passDirection = {
      x: leadPosition.x - entity.position.x,
      y: 0,
      z: leadPosition.z - entity.position.z
    };
    
    const passDistance = Math.sqrt(passDirection.x * passDirection.x + passDirection.z * passDirection.z);
    if (passDistance === 0) return { success: false, distance: 0 };
    
    // Normalize direction
    const normalizedDirection = {
      x: passDirection.x / passDistance,
      y: 0,
      z: passDirection.z / passDistance
    };

    // Calculate optimal pass power based on distance
    // Simplified power calculation for more consistent passes
    const basePower = 5.0; // Use consistent base power
    const distanceMultiplier = Math.max(0.9, Math.min(1.8, passDistance / 15)); // More conservative scaling
    const finalPassPower = basePower * distanceMultiplier;

    // Clear ball's current velocity for clean pass
    const currentVelocity = ball.linearVelocity;
    if (currentVelocity) {
      ball.setLinearVelocity({
        x: currentVelocity.x * 0.3, // Less aggressive velocity clearing for more responsive passes
        y: currentVelocity.y * 0.3,
        z: currentVelocity.z * 0.3
      });
    } else {
      ball.setLinearVelocity({ x: 0, y: 0, z: 0 });
    }

    try {
      // Apply pass impulse with controlled vertical component
      const verticalComponent = Math.min(0.2, 0.1 + (passDistance / 100)); // Slight arc for longer passes
      
      ball.applyImpulse({
        x: normalizedDirection.x * finalPassPower,
        y: verticalComponent,
        z: normalizedDirection.z * finalPassPower
      });

      // Reset angular velocity to prevent spinning
      ball.setAngularVelocity({ x: 0, y: 0, z: 0 });

      // Continue resetting angular velocity for a short period
      let resetCount = 0;
      const maxResets = 8; // More resets for better control
      const resetInterval = setInterval(() => {
        if (resetCount >= maxResets || !ball.isSpawned) {
          clearInterval(resetInterval);
          return;
        }
        ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
        resetCount++;
      }, 40); // Reset every 40ms

      return { success: true, distance: distanceToTarget };
    } catch (error) {
      console.error(`Error in targeted pass: ${error}`);
      return { success: false, distance: distanceToTarget };
    }
  }

  /**
   * Execute a directional pass when no good target is found
   * @param entity - The player making the pass
   * @param cameraOrientation - The player's camera orientation
   * @param ball - The soccer ball entity
   */
  private _executeDirectionalPass(entity: PlayerEntity, cameraOrientation: PlayerCameraOrientation, ball: Entity | null): void {
    if (!ball) return;

    const direction = directionFromOrientation(entity, cameraOrientation);
    
    // Clear ball velocity
    const currentVelocity = ball.linearVelocity;
    if (currentVelocity) {
      ball.setLinearVelocity({
        x: currentVelocity.x * 0.3, // Less aggressive velocity clearing for more responsive passes
        y: currentVelocity.y * 0.3,
        z: currentVelocity.z * 0.3
      });
    } else {
      ball.setLinearVelocity({ x: 0, y: 0, z: 0 });
    }

    // Use moderate power for directional pass
    const directionalPassPower = 5.0; // Match the base power used in targeted passes
    
    try {
      ball.applyImpulse({
        x: direction.x * directionalPassPower,
        y: 0.15, // Slight arc
        z: direction.z * directionalPassPower
      });

      // Reset angular velocity
      ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
      
      // Continue resetting angular velocity
      let resetCount = 0;
      const maxResets = 6;
      const resetInterval = setInterval(() => {
        if (resetCount >= maxResets || !ball.isSpawned) {
          clearInterval(resetInterval);
          return;
        }
        ball.setAngularVelocity({ x: 0, y: 0, z: 0 });
        resetCount++;
      }, 50);
    } catch (error) {
      console.error(`Error in directional pass: ${error}`);
    }
  }

  /**
   * Activate a random power-up for the player (only in arcade mode)
   * @param entity - The player entity
   */
  private _activateRandomPowerUp(entity: PlayerEntity): void {
    console.log(`🎮 _activateRandomPowerUp called for ${entity.player?.username || 'unknown'}`);
    
    // Only work in arcade mode
    if (!isArcadeMode()) {
      console.log("🎮 Power-ups only available in Arcade Mode!");
      // Send feedback to player
      if (entity.player?.ui) {
        entity.player.ui.sendData({
          type: "powerup-feedback",
          success: false,
          message: "Power-ups only available in Arcade Mode!"
        });
      }
      return;
    }

    if (!(entity instanceof SoccerPlayerEntity)) {
      console.log("🎮 Entity is not a SoccerPlayerEntity");
      return;
    }

    // Try to get arcade enhancement manager directly from world
    const arcadeManager = (entity.world as any)._arcadeManager;
    
    if (arcadeManager) {
      console.log("🎮 Found arcade manager, activating powerup directly");
      
      // Get available power-ups
      const powerUps = ['speed', 'power', 'precision', 'freeze_blast', 'fireball', 'mega_kick', 'shield', 'stamina'];
      const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
      
      // Try direct activation first
      const success = arcadeManager.activatePowerUp(entity.player.username, randomPowerUp);
      
      if (success) {
        console.log(`🎮 ARCADE POWER-UP ACTIVATED: ${entity.player.username} activated ${randomPowerUp}!`);
        
        // Send success feedback to UI
        entity.player.ui.sendData({
          type: "powerup-feedback",
          success: true,
          powerUpType: randomPowerUp,
          message: `${randomPowerUp.replace('_', ' ').toUpperCase()} activated!`
        });
        
        return;
      } else {
        console.log(`🎮 Direct activation failed, falling back to UI messaging`);
      }
    } else {
      console.log("🎮 No arcade manager found, using UI messaging fallback");
    }

    // Fallback: Use UI messaging system to trigger server-side power-up activation
    // This will be handled in the main server loop where the arcade manager is available
    
    // Get available power-ups
    const powerUps = ['speed', 'power', 'precision', 'freeze_blast', 'fireball', 'mega_kick', 'shield', 'stamina'];
    const randomPowerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
    
    // Send power-up activation request to the server through UI messaging
    entity.player.ui.sendData({
      type: "activate-powerup",
      powerUpType: randomPowerUp,
      playerId: entity.player.username,
      timestamp: Date.now()
    });
    
    console.log(`🎮 ARCADE POWER-UP REQUEST: ${entity.player.username} requesting ${randomPowerUp}!`);
  }
  
  /**
   * Performs a goalkeeper header to deflect or catch high shots
   * @param entity - The goalkeeper entity
   * @param ball - The soccer ball entity
   * @param direction - The direction toward the ball
   */
  private performGoalkeeperHeader(entity: PlayerEntity, ball: any, direction: { x: number; z: number }) {
    const currentTime = Date.now();
    
    // Prevent header spam - minimum 500ms between headers
    if (currentTime - this._lastHeaderTime < 500) {
      return;
    }
    
    this._lastHeaderTime = currentTime;
    
    // Calculate header force based on ball velocity and position
    const ballVelocity = ball.linearVelocity;
    const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
    
    // Determine header action based on ball speed and goalkeeper position
    if (ballSpeed > 6.0) {
      // Fast shot - deflect away from goal
      const deflectionDirection = this.calculateDeflectionDirection(entity, ball);
      const deflectionForce = GOALKEEPER_HEADER_FORCE * 1.2; // Extra force for fast shots
      
      ball.setLinearVelocity({
        x: deflectionDirection.x * deflectionForce,
        y: Math.max(3.0, ballVelocity.y * 0.3), // Maintain some upward velocity
        z: deflectionDirection.z * deflectionForce
      });
      
      // Play deflection sound effect if available
      console.log(`Goalkeeper ${entity.player?.username || 'AI'} deflected a fast shot!`);
      
    } else {
      // Slower shot - attempt to catch or control
      const catchDirection = {
        x: -ballVelocity.x * 0.8, // Absorb most of the ball's velocity
        y: Math.max(1.0, -Math.abs(ballVelocity.y) * 0.5), // Slight upward movement
        z: -ballVelocity.z * 0.8
      };
      
      ball.setLinearVelocity(catchDirection);
      
      console.log(`Goalkeeper ${entity.player?.username || 'AI'} caught the ball with a header!`);
    }
  }
  
  /**
   * Calculates the optimal deflection direction for goalkeeper headers
   * @param entity - The goalkeeper entity
   * @param ball - The soccer ball entity
   * @returns Direction vector for ball deflection
   */
  private calculateDeflectionDirection(entity: PlayerEntity, ball: any): { x: number; z: number } {
    const soccerEntity = entity as any; // Cast to access team property
    const goalCenterX = soccerEntity.team === 'red' ? -37 : 52; // Goal line X coordinates
    const goalCenterZ = 0; // Center of goal
    
    // Calculate direction away from goal
    const ballToGoal = {
      x: goalCenterX - ball.position.x,
      z: goalCenterZ - ball.position.z
    };
    
    const distance = Math.sqrt(ballToGoal.x * ballToGoal.x + ballToGoal.z * ballToGoal.z);
    
    if (distance === 0) {
      // Ball is at goal center, deflect to the side
      return { x: 0, z: Math.random() > 0.5 ? 1 : -1 };
    }
    
    // Deflect perpendicular to the ball-to-goal direction
    const perpendicular = {
      x: -ballToGoal.z / distance,
      z: ballToGoal.x / distance
    };
    
    // Add some randomness for realistic deflections
    const randomFactor = 0.3;
    const randomAngle = (Math.random() - 0.5) * randomFactor;
    
    return {
      x: perpendicular.x * Math.cos(randomAngle) - perpendicular.z * Math.sin(randomAngle),
      z: perpendicular.x * Math.sin(randomAngle) + perpendicular.z * Math.cos(randomAngle)
    };
  }
}
