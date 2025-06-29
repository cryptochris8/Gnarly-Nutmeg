import { Entity, Vector3, RigidBodyType, ColliderShape, CollisionGroup, BlockType, type Vector3Like, type QuaternionLike, PlayerEntity, Quaternion, EntityEvent } from 'hytopia';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';
import type { Ability } from './Ability';
import type { ItemAbilityOptions } from './itemTypes';

export class ItemThrowAbility implements Ability {
    private activeProjectiles: Map<string, Entity> = new Map();

    constructor(private options: ItemAbilityOptions) {}

    createProjectile(source: Entity): Entity {
        // Create the projectile entity
        const projectile = new Entity({
            name: this.options.name,
            modelUri: this.options.modelUri,
            modelScale: this.options.modelScale,
            rigidBodyOptions: {
                type: RigidBodyType.DYNAMIC,
                gravityScale: 0,
                enabledRotations: {
                    x: true,
                    y: true,
                    z: true
                },
            },
            parent: source,
            parentNodeName: "hand_right_anchor" 
        });

        // Store the projectile with the source player's ID
        const playerId = source instanceof PlayerEntity ? source.player.username : 'unknown';
        this.activeProjectiles.set(playerId, projectile);

        return projectile;
    }

    use(origin: Vector3Like, direction: Vector3Like, source: Entity) {
        if (!source.world || !(source instanceof SoccerPlayerEntity)) return;

        // Create projectile and attach it to player's right hand
        const projectile = this.createProjectile(source);
        
        // Spawn it with a specific position and rotation relative to the hand
        projectile.spawn(
            source.world,
            { x: 0, y: -0.3, z: 0.2 }, // Slight offset from hand
            // Quaternion.fromEuler(-90, 0, 0) // Rotate to face forward
        );
        
        // Start throw animation
        source.startModelOneshotAnimations(["chuck"]);
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);

        // After animation, detach and launch the projectile
        setTimeout(() => {
            if (!source.world) return; // Check world still exists
            
            // Despawn the held projectile first
            projectile.despawn();

            // Calculate spawn position in front of and above player
            const directionVector = new Vector3(direction.x, direction.y, direction.z).normalize();
            const spawnPosition = {
                x: source.position.x + directionVector.x * 1, // 1 unit in front
                y: source.position.y + .8, // Above head height
                z: source.position.z + directionVector.z * 1
            };
            
            // Create a new projectile for the actual throw
            const throwProjectile = new Entity({
                name: this.options.name,
                modelUri: this.options.modelUri,
                modelScale: this.options.modelScale,
                modelAnimationsPlaybackRate: 2.8,
                modelLoopedAnimations: ["spin"],
                rigidBodyOptions: {
                    type: RigidBodyType.DYNAMIC,
                    gravityScale: 0,
                },
            });
            
            // Spawn and launch the new projectile from the calculated position
            throwProjectile.spawn(source.world, spawnPosition);
            this.launchProjectile(throwProjectile, direction, source);
           
        }, 500);
    }

    public getIcon(): string {
        return this.options.icon;
    }

    private launchProjectile(projectile: Entity, direction: Vector3Like, source: Entity) {
        if (!projectile.isSpawned) return;

        // Create velocity vector from direction and speed
        const directionVector = new Vector3(direction.x, direction.y, direction.z).normalize();
        const velocityVector = directionVector.scale(this.options.speed);

        // Apply velocity
        projectile.setLinearVelocity(velocityVector);

        // Add collision detection
        projectile.createAndAddChildCollider({
            shape: ColliderShape.BALL,
            radius: this.options.projectileRadius,
            isSensor: true,
            collisionGroups: {
                belongsTo: [CollisionGroup.ENTITY],
                collidesWith: [CollisionGroup.PLAYER, CollisionGroup.ENTITY],
            },
            onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
                if (!started || otherEntity === source || !(otherEntity instanceof SoccerPlayerEntity)) return;

                if(otherEntity.isDodging) {
                    return;
                }

                // Despawn the projectile after hit
                otherEntity.stunPlayer();
                projectile.despawn();
                const playerId = source instanceof PlayerEntity ? source.player.username : 'unknown';
                this.activeProjectiles.delete(playerId);
            }
        });

        // Track projectile lifetime
        let age = 0;
        projectile.on(EntityEvent.TICK, ({ entity, tickDeltaMs }) => {
            // Update age and handle rotation
            age += tickDeltaMs / 1000;
            
            // Update rotation to face movement direction
            const currentVelocity = entity.linearVelocity;
            if (currentVelocity.x !== 0 || currentVelocity.y !== 0 || currentVelocity.z !== 0) {
                projectile.setRotation(this.faceDirection(currentVelocity));
            }
            
            // Despawn if exceeded lifetime
            if (age >= this.options.lifeTime) {
                projectile.despawn();
                const playerId = source instanceof PlayerEntity ? source.player.username : 'unknown';
                this.activeProjectiles.delete(playerId);
            }
        });
    }

    private faceDirection(wantedDirection: Vector3Like): QuaternionLike {
        const direction = Vector3.fromVector3Like(wantedDirection).normalize();
    
        // Calculate yaw (rotation around Y-axis)
        const yaw = Math.atan2(direction.x, direction.z);
    
        // Calculate pitch (rotation around X-axis)
        const pitch = Math.asin(direction.y);
    
        // Create quaternions for each axis rotation
        const halfYaw = yaw * 0.5;
        const halfPitch = -pitch * 0.5;
    
        // Pre-calculate trigonometric values
        const cosY = Math.cos(halfYaw);
        const sinY = Math.sin(halfYaw);
        const cosP = Math.cos(halfPitch);
        const sinP = Math.sin(halfPitch);
    
        // Correct quaternion multiplication order: pitch first, then yaw (qPitch * qYaw)
        return {
            x: sinP * cosY,
            y: sinY * cosP,
            z: -sinY * sinP,
            w: cosY * cosP
        };
    }
}