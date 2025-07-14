import type { Ability } from "./Ability";
import type { ItemAbilityOptions } from "./itemTypes";
import { type Vector3Like, Entity, Audio } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";

/**
 * Time Slow Power-Up Ability (Arcade Mode Only)
 * 
 * Slows down all other players for 8 seconds while you move normally.
 * Creates spectacular time distortion effects and clock particles.
 * Only works in Arcade mode - blocked in FIFA mode.
 */
export class TimeSlowAbility implements Ability {
    private options: ItemAbilityOptions;

    constructor(options: ItemAbilityOptions) {
        this.options = options;
    }

    /**
     * Gets the UI icon for the time slow power-up
     */
    getIcon(): string {
        return this.options.icon;
    }

    /**
     * Activates the time slow power-up effect
     */
    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        console.log(`🕐 TIME SLOW: use() method called!`);
        console.log(`🕐 TIME SLOW: origin=${JSON.stringify(origin)}, direction=${JSON.stringify(direction)}, source=${source.constructor.name}`);
        
        // SAFETY CHECK: Only work in arcade mode
        if (!isArcadeMode()) {
            console.log("🕐 TIME SLOW: Power-up blocked - not in arcade mode");
            // Send feedback to player
            if (source instanceof SoccerPlayerEntity && source.player.ui && typeof source.player.ui.sendData === 'function') {
                source.player.ui.sendData({
                    type: "action-feedback",
                    feedbackType: "error",
                    title: "Mode Required",
                    message: "Enhanced power-ups only work in Arcade Mode! Use '/arcade' to switch modes."
                });
            }
            // Remove the ability since it can't be used
            if (source instanceof SoccerPlayerEntity) {
                source.abilityHolder.removeAbility();
                source.abilityHolder.hideAbilityUI(source.player);
            }
            return;
        }

        // Validate the source entity
        if (!source.world || !(source instanceof SoccerPlayerEntity)) {
            console.error("❌ TIME SLOW: Invalid source entity for time slow ability");
            console.error(`❌ TIME SLOW: source.world=${!!source.world}, instanceof SoccerPlayerEntity=${source instanceof SoccerPlayerEntity}`);
            return;
        }

        console.log(`🕐 TIME SLOW: ${source.player.username} activating time manipulation in arcade mode`);

        // Play activation sound effect
        this.playTimeActivationEffect(source);

        // Apply time slow effects to all other players
        this.applyTimeSlowEffects(source);

        // Create visual effects
        this.createTimeDistortionEffect(source);

        // Remove the ability from player's inventory
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);

        console.log(`✅ TIME SLOW: Successfully applied time manipulation to all opponents`);
    }

    /**
     * Plays the time manipulation activation audio effect
     */
    private playTimeActivationEffect(player: SoccerPlayerEntity): void {
        try {
            if (!player.world) {
                console.error("❌ TIME SLOW: Player world not available for audio");
                return;
            }

            // Play mystical time activation sound
            const timeActivationAudio = new Audio({
                uri: "audio/sfx/ui/inventory-grab-item.mp3", // Placeholder - use mystical sound if available
                loop: false,
                volume: 1.0,
                attachedToEntity: player,
            });
            timeActivationAudio.play(player.world);

            // Additional ethereal sound effect
            setTimeout(() => {
                if (!player.world) return;
                const etherealAudio = new Audio({
                    uri: "audio/sfx/liquid/large-splash.mp3", // Placeholder - use time distortion sound
                    loop: false,
                    volume: 0.6,
                    position: player.position,
                    referenceDistance: 20
                });
                etherealAudio.play(player.world);
            }, 500);

            console.log(`🔊 TIME SLOW: Played time activation effects for ${player.player.username}`);
        } catch (error) {
            console.error("❌ TIME SLOW AUDIO ERROR:", error);
        }
    }

    /**
     * Applies time slow effects to all other players
     */
    private applyTimeSlowEffects(caster: SoccerPlayerEntity): void {
        try {
            const duration = this.options.damage; // Duration in milliseconds (8000ms = 8 seconds)
            const timeScale = this.options.speed; // Time scale factor (0.3 = 30% speed)

            // Get all player entities from the world
            const allPlayers = caster.world.entityManager.getAllPlayerEntities()
                .filter(entity => entity instanceof SoccerPlayerEntity) as SoccerPlayerEntity[];

            const affectedPlayers: SoccerPlayerEntity[] = [];

            allPlayers.forEach(player => {
                // Skip the caster
                if (player.player.username === caster.player.username) {
                    return;
                }

                // Apply time slow effect
                this.applyTimeSlowToPlayer(player, duration, timeScale);
                affectedPlayers.push(player);
                
                console.log(`🕐 TIME SLOW: Applied time distortion to ${player.player.username}`);
            });

            // Send notification to caster
            if (caster.player.ui && typeof caster.player.ui.sendData === 'function') {
                caster.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "time-slow",
                    message: `Time Slow Active! ${affectedPlayers.length} players slowed for ${duration/1000}s`,
                    duration: duration,
                    icon: this.options.icon
                });
            }

            console.log(`🕐 TIME SLOW: Applied time distortion to ${affectedPlayers.length} players`);

        } catch (error) {
            console.error("❌ TIME SLOW EFFECTS ERROR:", error);
        }
    }

    /**
     * Applies time slow effect to a specific player
     */
    private applyTimeSlowToPlayer(player: SoccerPlayerEntity, durationMs: number, timeScale: number): void {
        try {
            // Store original movement capabilities
            const customProps = (player as any).customProperties || new Map();
            (player as any).customProperties = customProps;
            
            // Mark as having time slow effect
            customProps.set('hasTimeSlowEffect', true);
            customProps.set('timeSlowScale', timeScale);
            customProps.set('timeSlowEndTime', Date.now() + durationMs);
            customProps.set('originalMovementScale', 1.0);
            
            // Create time distortion visual effect on player
            this.createPlayerTimeEffect(player);
            
            console.log(`⏰ TIME SLOW: Applied ${Math.round((1 - timeScale) * 100)}% speed reduction for ${durationMs/1000} seconds`);
            
            // Remove effects after duration
            setTimeout(() => {
                try {
                    if (customProps) {
                        customProps.set('hasTimeSlowEffect', false);
                        customProps.delete('timeSlowScale');
                        customProps.delete('timeSlowEndTime');
                        customProps.delete('originalMovementScale');
                        
                        // Remove visual effect
                        this.removePlayerTimeEffect(player);
                        
                        // Send recovery notification
                        if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                            player.player.ui.sendData({
                                type: "power-up-expired",
                                powerUpType: "time-slow",
                                message: "Time flow restored to normal"
                            });
                        }
                        
                        console.log(`⏰ TIME SLOW: Effect expired for ${player.player.username}`);
                    }
                } catch (error) {
                    console.error("❌ TIME SLOW CLEANUP ERROR:", error);
                }
            }, durationMs);
            
        } catch (error) {
            console.error("❌ TIME SLOW PLAYER ERROR:", error);
        }
    }

    /**
     * Creates time distortion visual effects around the caster
     */
    private createTimeDistortionEffect(player: SoccerPlayerEntity): void {
        try {
            if (!player.world) {
                console.error("❌ TIME SLOW: Player world not available for visual effects");
                return;
            }

            // Create main clock effect entity
            const clockEffect = new Entity({
                name: 'time-distortion-clock',
                modelUri: this.options.modelUri, // "models/items/clock.gltf"
                modelScale: this.options.modelScale * 2.0, // Larger for effect
                rigidBodyOptions: {
                    type: 'KINEMATIC_POSITION' as any,
                    colliders: [], // No colliders for visual effect
                }
            });

            // Spawn the effect above the player
            const effectPosition = {
                x: player.position.x,
                y: player.position.y + 3.0, // 3 blocks above player
                z: player.position.z
            };

            clockEffect.spawn(player.world, effectPosition);

            // Create time ripple effects around the field
            this.createTimeRipples(player.position, player.world);

            // Animate the clock effect
            this.animateTimeDistortion(clockEffect);

            console.log(`✨ TIME SLOW: Created time distortion effects for ${player.player.username}`);
        } catch (error) {
            console.error("❌ TIME SLOW VISUAL EFFECT ERROR:", error);
        }
    }

    /**
     * Creates time ripple effects across the field
     */
    private createTimeRipples(centerPos: Vector3Like, world: any): void {
        const rippleCount = 6;
        const maxRadius = 15;

        for (let i = 0; i < rippleCount; i++) {
            const angle = (i / rippleCount) * Math.PI * 2;
            const radius = 5 + (i * 2);
            
            const ripple = new Entity({
                name: `time-ripple-${i}`,
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 3.0 + i,
                rigidBodyOptions: {
                    type: 'KINEMATIC_POSITION' as any,
                    colliders: [],
                }
            });

            const ripplePos = {
                x: centerPos.x + Math.cos(angle) * radius,
                y: centerPos.y + 0.2,
                z: centerPos.z + Math.sin(angle) * radius
            };

            ripple.spawn(world, ripplePos);
            
            // Animate ripple expansion
            this.animateRipple(ripple, i * 300);
        }
    }

    /**
     * Animates a time ripple effect
     */
    private animateRipple(ripple: Entity, delay: number): void {
        setTimeout(() => {
            let animationTime = 0;
            const maxAnimationTime = 2000;
            const startScale = ripple.modelScale;

            const animateFrame = () => {
                if (!ripple.isSpawned || animationTime >= maxAnimationTime) {
                    if (ripple.isSpawned) {
                        ripple.despawn();
                    }
                    return;
                }

                try {
                    const progress = animationTime / maxAnimationTime;
                    const scale = startScale * (1 + progress * 2); // Expand over time
                    
                    // Update scale (if Hytopia supports dynamic scaling)
                    // ripple.setModelScale(scale); // This may not be available
                    
                    // Fade out effect by moving underground
                    const fadeOffset = progress * -2;
                    const currentPos = ripple.position;
                    ripple.setPosition({
                        x: currentPos.x,
                        y: currentPos.y + fadeOffset * 0.1,
                        z: currentPos.z
                    });

                    animationTime += 100;
                    setTimeout(animateFrame, 100);
                } catch (error) {
                    console.error("❌ TIME RIPPLE ANIMATION ERROR:", error);
                    if (ripple.isSpawned) {
                        ripple.despawn();
                    }
                }
            };

            animateFrame();
        }, delay);
    }

    /**
     * Animates the main time distortion clock effect
     */
    private animateTimeDistortion(clockEffect: Entity): void {
        let animationTime = 0;
        const maxAnimationTime = 8000; // 8 seconds to match effect duration
        
        const animateFrame = () => {
            if (!clockEffect.isSpawned || animationTime >= maxAnimationTime) {
                if (clockEffect.isSpawned) {
                    clockEffect.despawn();
                }
                return;
            }

            try {
                // Rotate the clock for time distortion effect
                const rotationSpeed = 0.01;
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                clockEffect.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                // Float up and down
                const floatOffset = Math.sin(animationTime * 0.002) * 0.5;
                const currentPos = clockEffect.position;
                clockEffect.setPosition({
                    x: currentPos.x,
                    y: currentPos.y + floatOffset * 0.1,
                    z: currentPos.z
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ TIME DISTORTION ANIMATION ERROR:", error);
                if (clockEffect.isSpawned) {
                    clockEffect.despawn();
                }
            }
        };

        animateFrame();
    }

    /**
     * Creates time slow visual effect on affected player
     */
    private createPlayerTimeEffect(player: SoccerPlayerEntity): void {
        try {
            // Create a slowing visual indicator above the player
            const slowEffect = new Entity({
                name: 'player-time-slow',
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 1.2,
                rigidBodyOptions: {
                    type: 'KINEMATIC_POSITION' as any,
                    colliders: [],
                }
            });

            slowEffect.spawn(player.world, {
                x: player.position.x,
                y: player.position.y + 2.2,
                z: player.position.z
            });

            // Store effect reference for cleanup
            (player as any)._timeSlowEffect = slowEffect;
        } catch (error) {
            console.error("❌ PLAYER TIME EFFECT ERROR:", error);
        }
    }

    /**
     * Removes time slow visual effect from player
     */
    private removePlayerTimeEffect(player: SoccerPlayerEntity): void {
        try {
            const slowEffect = (player as any)._timeSlowEffect;
            if (slowEffect && slowEffect.isSpawned) {
                slowEffect.despawn();
            }
            delete (player as any)._timeSlowEffect;
        } catch (error) {
            console.error("❌ REMOVE TIME EFFECT ERROR:", error);
        }
    }
}