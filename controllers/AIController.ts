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
    
    // Call the parent tick method
    super.tick(entity, deltaTimeMs);
  }
} 