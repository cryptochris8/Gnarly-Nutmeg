import { Entity, type World, type Vector3Like, Audio, RigidBodyType, type BlockType, ColliderShape, CollisionGroup } from 'hytopia';
import { ItemThrowAbility } from './ItemThrowAbility';
import type { ItemAbilityOptions } from './itemTypes';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';
import { ABILITY_PICKUP_POSITIONS, ABILITY_RESPAWN_TIME } from '../state/gameConfig';
import { SpeedBoostAbility } from './SpeedBoostAbility';
import type { Ability } from './Ability';

// Timer type for Node.js compatibility
type Timer = ReturnType<typeof setTimeout>;

export class AbilityConsumable {
    private entity: Entity;
    private world: World;
    private respawnTimer: Timer | null = null;

    constructor(
        world: World,
        private position: Vector3Like,
        private abilityOptions: ItemAbilityOptions
    ) {
        this.world = world;
        this.entity = this.createConsumableEntity();
        this.spawn();
    }

    private createConsumableEntity(): Entity {
        const entity = new Entity({
            name: `${this.abilityOptions.name}Pickup`,
            modelUri: this.abilityOptions.modelUri,
            modelScale: this.abilityOptions.modelScale * 1, 
            modelLoopedAnimations: [this.abilityOptions.idleAnimation],
            rigidBodyOptions: {
                type: RigidBodyType.KINEMATIC_POSITION,
                colliders: [
                    {
                        shape: ColliderShape.CYLINDER,
                        radius: 0.8,
                        halfHeight: 0.4,
                        isSensor: false, // This creates solid collision so players stop
                        tag: 'ability-pickup',
                        collisionGroups: {
                            belongsTo: [CollisionGroup.ENTITY],
                            collidesWith: [CollisionGroup.ENTITY] // Players use ENTITY group by default
                        },
                        onCollision: (other: BlockType | Entity, started: boolean) => {
                            if (!started || !(other instanceof SoccerPlayerEntity)) return;
                            console.log(`🎯 Ability pickup collision detected with player: ${other.player.username}`);
                            
                            // Check if player already has an ability
                            if (!other.abilityHolder.hasAbility()) {
                                console.log(`✅ Giving ability to player: ${other.player.username}`);
                                this.giveAbilityToPlayer(other);
                                this.despawn();
                                this.startRespawnTimer();
                            } else {
                                console.log(`❌ Player ${other.player.username} already has an ability`);
                            }
                        }
                    }
                ]
            }
        });
        
        return entity;
    }

    private giveAbilityToPlayer(player: SoccerPlayerEntity) {
        let ability: Ability;
        if (this.abilityOptions.name === "Speed Boost") {
            ability = new SpeedBoostAbility(this.abilityOptions);
        } else {
            ability = new ItemThrowAbility(this.abilityOptions);
        }
        player.abilityHolder.setAbility(ability);
        player.abilityHolder.showAbilityUI(player.player);
        
        // Audio feedback for pickup
        try {
            const pickupAudio = new Audio({
                uri: 'ui/inventory-grab-item.mp3',
                volume: 0.5,
                position: player.position
            });
            pickupAudio.play(this.world);
        } catch (e) {
            console.log("Could not play pickup sound:", e);
        }
        
        console.log(`🎮 ${player.player.username} collected ${this.abilityOptions.name} ability!`);
    }

    private startRespawnTimer() {
        if (this.respawnTimer) {
            clearTimeout(this.respawnTimer);
        }

        this.respawnTimer = setTimeout(() => {
            console.log(`🔄 Respawning ${this.abilityOptions.name} pickup`);
            this.spawn();
        }, ABILITY_RESPAWN_TIME);
    }

    public spawn() {
        if (!this.entity.isSpawned) {
            const randomPosition = ABILITY_PICKUP_POSITIONS[Math.floor(Math.random() * ABILITY_PICKUP_POSITIONS.length)];
            this.entity.spawn(this.world, randomPosition);
            console.log(`📦 Spawned ${this.abilityOptions.name} pickup at position:`, randomPosition);
        }
    }

    public despawn() {
        if (this.entity.isSpawned) {
            this.entity.despawn();
            console.log(`🗑️ Despawned ${this.abilityOptions.name} pickup`);
        }
    }

    public destroy() {
        this.despawn();
        if (this.respawnTimer) {
            clearTimeout(this.respawnTimer);
        }
    }
} 