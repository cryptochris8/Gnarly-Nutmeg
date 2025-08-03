import { Entity, type World, type Vector3Like, Audio, RigidBodyType, type BlockType, ColliderShape, CollisionGroup } from 'hytopia';
import { ItemThrowAbility } from './ItemThrowAbility';
import type { ItemAbilityOptions } from './itemTypes';
import { ALL_POWERUP_OPTIONS } from './itemTypes';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';
import { ABILITY_PICKUP_POSITIONS, ABILITY_RESPAWN_TIME } from '../state/gameConfig';
import { SpeedBoostAbility } from './SpeedBoostAbility';
import { PowerBoostAbility } from './PowerBoostAbility';
import { StaminaAbility } from './StaminaAbility';
import { FreezeBlastAbility } from './FreezeBlastAbility';
import { FireballAbility } from './FireballAbility';
import { TimeSlowAbility } from './TimeSlowAbility';
import { BallMagnetAbility } from './BallMagnetAbility';
import { CrystalBarrierAbility } from './CrystalBarrierAbility';
import { EnhancedPowerAbility } from './EnhancedPowerAbility';
import type { Ability } from './Ability';

// Timer type for Node.js compatibility
type Timer = ReturnType<typeof setTimeout>;

export class AbilityConsumable {
    private entity: Entity;
    private world: World;
    private respawnTimer: Timer | null = null;
    private originalPosition: Vector3Like; // Store original position for consistent respawning

    constructor(
        world: World,
        private position: Vector3Like,
        private abilityOptions: ItemAbilityOptions
    ) {
        this.world = world;
        this.originalPosition = { ...position }; // Store original position
        this.entity = this.createConsumableEntity();
        this.spawn();
    }

    private createConsumableEntity(): Entity {
        const entity = new Entity({
            name: `${this.abilityOptions.name}Pickup`,
            modelUri: this.abilityOptions.modelUri,
            modelScale: this.abilityOptions.modelScale * 3, // Increased scale for better visibility 
            modelLoopedAnimations: [this.abilityOptions.idleAnimation],
            rigidBodyOptions: {
                type: RigidBodyType.KINEMATIC_POSITION,
                colliders: [
                    {
                        shape: ColliderShape.CYLINDER,
                        radius: 1.2, // Increased for better collision detection with larger models
                        halfHeight: 0.8, // Increased height for easier pickup
                        isSensor: true, // Allow pass-through collision for Mario/Sonic-style pickup
                        tag: 'ability-pickup',
                        collisionGroups: {
                            belongsTo: [CollisionGroup.ENTITY],
                            // ENHANCED: Multiple collision groups for maximum compatibility
                            collidesWith: [
                                CollisionGroup.PLAYER,      // For properly configured players
                                CollisionGroup.ENTITY,      // Fallback for default entity collision
                                CollisionGroup.ENTITY_SENSOR // Additional sensor collision
                            ]
                        },
                        onCollision: (other: BlockType | Entity, started: boolean) => {
                            // ENHANCED: Comprehensive collision debugging
                            console.log(`🔍 PICKUP COLLISION: ${this.abilityOptions.name}`);
                            console.log(`  ├─ Event: ${started ? 'STARTED' : 'ENDED'}`);
                            console.log(`  ├─ Other Type: ${other.constructor.name}`);
                            console.log(`  ├─ Other ID: ${other instanceof Entity ? other.id : 'N/A'}`);
                            
                            if (other instanceof Entity && 'player' in other) {
                                console.log(`  ├─ Player Username: ${(other as any).player?.username || 'Unknown'}`);
                            }
                            
                            if (other instanceof Entity && 'rigidBodyOptions' in other) {
                                const collisionGroups = (other as any)._collisionGroups;
                                console.log(`  ├─ Other Collision Groups: ${JSON.stringify(collisionGroups)}`);
                            }
                            
                            console.log(`  └─ Pickup Position: ${JSON.stringify(this.entity.position)}`);
                            
                            if (!started) return;
                            
                            // Enhanced player detection with multiple checks
                            let targetPlayer: SoccerPlayerEntity | null = null;
                            
                            // Primary check: Direct SoccerPlayerEntity instance
                            if (other instanceof SoccerPlayerEntity) {
                                targetPlayer = other;
                                console.log(`✅ Direct SoccerPlayerEntity detected: ${targetPlayer.player.username}`);
                            }
                            // Secondary check: Entity with player property (for compatibility)
                            else if (other instanceof Entity && 'player' in other && 'abilityHolder' in other) {
                                targetPlayer = other as SoccerPlayerEntity;
                                console.log(`✅ Player Entity detected via properties: ${(other as any).player?.username}`);
                            }
                            // Fallback: Log non-player collision for debugging
                            else {
                                console.log(`❌ Non-player collision: ${other.constructor.name}`);
                                return;
                            }
                            
                            if (!targetPlayer) {
                                console.log(`❌ No valid player target found`);
                                return;
                            }
                            
                            console.log(`🎯 Valid player collision detected: ${targetPlayer.player.username}`);
                            
                            // Debug pickup collision
                            console.log(`🔍 PICKUP COLLISION: Player ${targetPlayer.player.username} touched ${this.abilityOptions.name} pickup`);
                            console.log(`   Current ability: ${targetPlayer.abilityHolder.hasAbility() ? targetPlayer.abilityHolder.getAbility()?.getIcon() : 'none'}`);
                            
                            // Check if player already has an ability
                            if (!targetPlayer.abilityHolder.hasAbility()) {
                                console.log(`✅ PICKUP SUCCESS: Giving ${this.abilityOptions.name} to ${targetPlayer.player.username}`);
                                this.giveAbilityToPlayer(targetPlayer);
                                this.despawn();
                                this.startRespawnTimer();
                            } else {
                                console.log(`❌ Player ${targetPlayer.player.username} already has an ability: ${targetPlayer.abilityHolder.getAbility()?.getIcon()}`);
                                // Optional: Show feedback to player
                                try {
                                    targetPlayer.player.ui.sendData({
                                        type: "action-feedback",
                                        feedbackType: "info",
                                        title: "Ability Slot Full",
                                        message: `Press F to use current ability first`
                                    });
                                } catch (e) {
                                    console.log("Could not send UI feedback:", e);
                                }
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
        
        console.log(`🔧 DEBUG: Creating ability for ${this.abilityOptions.name}`);
        
        // Determine ability type based on name
        try {
            switch (this.abilityOptions.name) {
                // Original abilities
                case "Speed Boost":
                    console.log(`🔧 Creating SpeedBoostAbility`);
                    ability = new SpeedBoostAbility(this.abilityOptions);
                    break;
                case "Stamina Potion":
                    console.log(`🔧 Creating StaminaAbility`);
                    ability = new StaminaAbility(this.abilityOptions);
                    break;
                case "Mega Kick":
                case "Power Boost":
                case "Precision":
                case "Stamina":
                case "Shield":
                    console.log(`🔧 Creating PowerBoostAbility for ${this.abilityOptions.name}`);
                    ability = new PowerBoostAbility(this.abilityOptions);
                    break;
                
                // Enhanced abilities
                case "Time Slow":
                    console.log(`🔧 Creating TimeSlowAbility`);
                    ability = new TimeSlowAbility(this.abilityOptions);
                    break;
                case "Ball Magnet":
                    console.log(`🔧 Creating BallMagnetAbility`);
                    ability = new BallMagnetAbility(this.abilityOptions);
                    break;
                case "Crystal Barrier":
                    console.log(`🔧 Creating CrystalBarrierAbility`);
                    ability = new CrystalBarrierAbility(this.abilityOptions);
                    break;
                case "Elemental Mastery":
                case "Tidal Wave":
                case "Reality Warp":
                case "Honey Trap":
                    console.log(`🔧 Creating EnhancedPowerAbility for ${this.abilityOptions.name}`);
                    ability = new EnhancedPowerAbility(this.abilityOptions);
                    break;
                
                // Specific projectile abilities
                case "Freeze Blast":
                    console.log(`🔧 Creating FreezeBlastAbility`);
                    ability = new FreezeBlastAbility(this.abilityOptions);
                    break;
                case "Fireball":
                    console.log(`🔧 Creating FireballAbility`);
                    ability = new FireballAbility(this.abilityOptions);
                    break;
                
                // Projectile abilities (default)
                case "Shuriken":
                default:
                    console.log(`🔧 Creating ItemThrowAbility for ${this.abilityOptions.name} (default)`);
                    ability = new ItemThrowAbility(this.abilityOptions);
                    break;
            }
            
            console.log(`✅ Successfully created ability: ${ability.constructor.name} with icon: ${ability.getIcon()}`);
        } catch (error) {
            console.error(`❌ ERROR creating ability for ${this.abilityOptions.name}:`, error);
            // Fallback to basic ability
            ability = new ItemThrowAbility(this.abilityOptions);
            console.log(`🔄 Fallback: Created ItemThrowAbility instead`);
        }
        
        player.abilityHolder.setAbility(ability);
        player.abilityHolder.showAbilityUI(player.player);
        
        // Create pickup particle effect
        this.createPickupParticles(player.position);
        
        // Audio feedback for pickup
        try {
            const pickupAudio = new Audio({
                uri: 'audio/sfx/ui/inventory-grab-item.mp3',
                volume: 0.5,
                position: player.position
            });
            pickupAudio.play(this.world);
        } catch (e) {
            console.log("Could not play pickup sound:", e);
        }
        
        console.log(`🎮 ${player.player.username} collected ${this.abilityOptions.name} ability!`);
    }

    private createPickupParticles(position: Vector3Like) {
        try {
            // Create pickup effect using firework as visual feedback
            const effectEntity = new Entity({
                name: 'pickup-effect',
                modelUri: 'misc/firework.gltf',
                modelScale: 0.5,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            // Spawn briefly at pickup location
            effectEntity.spawn(this.world, position);
            
            // Auto-despawn after brief display
            setTimeout(() => {
                if (effectEntity.isSpawned) {
                    effectEntity.despawn();
                }
            }, 800); // Quick flash effect

        } catch (e) {
            console.log("Could not create pickup effect:", e);
        }
    }

    private startRespawnTimer() {
        if (this.respawnTimer) {
            clearTimeout(this.respawnTimer);
        }

        this.respawnTimer = setTimeout(() => {
            console.log(`🔄 Respawning pickup with random ability`);
            this.spawn(true); // Enable randomization on respawn
        }, ABILITY_RESPAWN_TIME);
    }

    /**
     * Randomly select a new ability type from all available options
     * Attempts to avoid selecting the same ability that was just collected for variety
     */
    private selectRandomAbility(): ItemAbilityOptions {
        let attempts = 0;
        let selectedOption: ItemAbilityOptions;
        
        // Try to select a different ability type for variety (up to 3 attempts)
        do {
            const randomIndex = Math.floor(Math.random() * ALL_POWERUP_OPTIONS.length);
            selectedOption = ALL_POWERUP_OPTIONS[randomIndex];
            attempts++;
        } while (selectedOption.name === this.abilityOptions.name && attempts < 3);
        
        console.log(`🎲 Random selection: ${selectedOption.name} (attempts: ${attempts})`);
        return selectedOption;
    }

    public spawn(randomizeAbility: boolean = false) {
        if (!this.entity.isSpawned) {
            // ENHANCED: Randomize ability type on respawn for variety
            // Initial spawn uses constructor-specified ability, respawns are randomized
            if (randomizeAbility) {
                const oldAbility = this.abilityOptions.name;
                this.abilityOptions = this.selectRandomAbility();
                console.log(`🎲 Randomized ability: ${oldAbility} → ${this.abilityOptions.name}`);
            }

            // FIXED: Create fresh entity each time to ensure collision properties are restored
            this.entity = this.createConsumableEntity();
            this.entity.spawn(this.world, this.originalPosition);
            console.log(`📦 Spawned ${this.abilityOptions.name} pickup at original position:`, this.originalPosition);
            console.log(`🎯 Pickup collision groups: belongsTo=[ENTITY], collidesWith=[PLAYER,ENTITY,ENTITY_SENSOR]`);
            console.log(`📏 Pickup collision cylinder: radius=1.2, height=0.8, isSensor=true`);
            console.log(`🎨 Pickup model scale: ${this.abilityOptions.modelScale * 3}`);
            console.log(`✅ Fresh entity created - collision settings guaranteed to be correct`);
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
        // Clean up entity reference
        console.log(`🧹 Destroying ${this.abilityOptions.name} pickup entity`);
    }
} 