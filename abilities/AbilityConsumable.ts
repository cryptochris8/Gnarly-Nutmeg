import { Entity, type World, type Vector3Like, Audio, RigidBodyType, type BlockType, ColliderShape, EntityEvent } from 'hytopia';
import { ItemThrowAbility } from './ItemThrowAbility';
import type { ItemAbilityOptions } from './itemTypes';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';
import { ABILITY_PICKUP_POSITIONS, ABILITY_RESPAWN_TIME } from '../state/gameConfig';
import { SpeedBoostAbility } from './SpeedBoostAbility';
import type { Ability } from './Ability';
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
            }
        });
        entity.on(EntityEvent.ENTITY_COLLISION, ({ entity, otherEntity, started }) => {
            if (!started || !(otherEntity instanceof SoccerPlayerEntity)) return;
            if (!otherEntity.abilityHolder.hasAbility()) {
                this.giveAbilityToPlayer(otherEntity);
                this.despawn();
                this.startRespawnTimer();
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
    }

    private startRespawnTimer() {
        if (this.respawnTimer) {
            clearTimeout(this.respawnTimer);
        }

        this.respawnTimer = setTimeout(() => {
            this.spawn();
        }, ABILITY_RESPAWN_TIME);
    }

    public spawn() {
        if (!this.entity.isSpawned) {
            const randomPosition = ABILITY_PICKUP_POSITIONS[Math.floor(Math.random() * ABILITY_PICKUP_POSITIONS.length)];
            this.entity.spawn(this.world, randomPosition);
        }
    }

    public despawn() {
        if (this.entity.isSpawned) {
            this.entity.despawn();
        }
    }

    public destroy() {
        this.despawn();
        if (this.respawnTimer) {
            clearTimeout(this.respawnTimer);
        }
    }
} 