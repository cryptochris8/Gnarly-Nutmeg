import type { Ability } from "./Ability";
import type { ItemAbilityOptions } from "./itemTypes";
import { type Vector3Like, Entity, Audio } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";
import sharedState from "../state/sharedState";

/**
 * Ball Magnet Power-Up Ability (Arcade Mode Only)
 * 
 * Ball automatically follows you for 10 seconds like a magnet.
 * Creates magnetic field effects with compass particles and attraction forces.
 * Only works in Arcade mode - blocked in FIFA mode.
 */
export class BallMagnetAbility implements Ability {
    private options: ItemAbilityOptions;

    constructor(options: ItemAbilityOptions) {
        this.options = options;
    }

    /**
     * Gets the UI icon for the ball magnet power-up
     */
    getIcon(): string {
        return this.options.icon;
    }

    /**
     * Activates the ball magnet power-up effect
     */
    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        // SAFETY CHECK: Only work in arcade mode
        if (!isArcadeMode()) {
            console.log("🧭 BALL MAGNET: Power-up blocked - not in arcade mode");
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
            console.error("❌ BALL MAGNET: Invalid source entity for ball magnet ability");
            return;
        }

        console.log(`🧭 BALL MAGNET: ${source.player.username} activating ball magnetism in arcade mode`);

        // Play activation sound effect
        this.playMagnetActivationEffect(source);

        // Apply ball magnet effects
        this.applyBallMagnetEffects(source);

        // Create visual effects
        this.createMagneticFieldEffect(source);

        // Remove the ability from player's inventory
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);

        console.log(`✅ BALL MAGNET: Successfully activated ball magnetism for ${source.player.username}`);
    }

    /**
     * Plays the magnetic activation audio effect
     */
    private playMagnetActivationEffect(player: SoccerPlayerEntity): void {
        try {
            if (!player.world) {
                console.error("❌ BALL MAGNET: Player world not available for audio");
                return;
            }

            // Play magnetic activation sound
            const magnetActivationAudio = new Audio({
                uri: "audio/sfx/ui/inventory-grab-item.mp3", // Placeholder - use magnetic sound if available
                loop: false,
                volume: 1.0,
                attachedToEntity: player,
            });
            magnetActivationAudio.play(player.world);

            // Additional electromagnetic sound effect
            setTimeout(() => {
                if (!player.world) return;
                const electromagneticAudio = new Audio({
                    uri: "audio/sfx/dig/dig-grass.mp3", // Placeholder - use electromagnetic sound
                    loop: false,
                    volume: 0.7,
                    position: player.position,
                    referenceDistance: 15
                });
                electromagneticAudio.play(player.world);
            }, 300);

            console.log(`🔊 BALL MAGNET: Played magnetic activation effects for ${player.player.username}`);
        } catch (error) {
            console.error("❌ BALL MAGNET AUDIO ERROR:", error);
        }
    }

    /**
     * Applies ball magnet effects
     */
    private applyBallMagnetEffects(caster: SoccerPlayerEntity): void {
        try {
            const duration = this.options.damage; // Duration in milliseconds (10000ms = 10 seconds)
            const magnetForce = this.options.speed; // Magnetic pull force (10)
            const magnetRadius = this.options.projectileRadius; // Magnetic field radius (5.0)

            // Get the soccer ball
            const soccerBall = sharedState.getSoccerBall();
            if (!soccerBall?.isSpawned) {
                console.error("❌ BALL MAGNET: Soccer ball not available");
                return;
            }

            // Store magnet effect data
            const customProps = (caster as any).customProperties || new Map();
            (caster as any).customProperties = customProps;
            
            customProps.set('hasBallMagnetEffect', true);
            customProps.set('magnetForce', magnetForce);
            customProps.set('magnetRadius', magnetRadius);
            customProps.set('magnetEndTime', Date.now() + duration);
            
            // Start magnetic pulling interval
            const magnetInterval = setInterval(() => {
                if (!caster.isSpawned || !soccerBall.isSpawned) {
                    clearInterval(magnetInterval);
                    return;
                }

                // Check if effect is still active
                const endTime = customProps.get('magnetEndTime');
                if (Date.now() > endTime) {
                    clearInterval(magnetInterval);
                    this.removeMagnetEffect(caster);
                    return;
                }

                // Calculate distance to ball
                const distance = Math.sqrt(
                    Math.pow(soccerBall.position.x - caster.position.x, 2) +
                    Math.pow(soccerBall.position.y - caster.position.y, 2) +
                    Math.pow(soccerBall.position.z - caster.position.z, 2)
                );

                // Apply magnetic force if within radius
                if (distance <= magnetRadius && distance > 1.0) { // Don't pull if too close
                    this.applyMagneticForce(soccerBall, caster, distance, magnetForce);
                }
                
            }, 50); // Update every 50ms for smooth magnetism

            // Store interval reference for cleanup
            (caster as any)._magnetInterval = magnetInterval;

            // Send notification to player
            if (caster.player.ui && typeof caster.player.ui.sendData === 'function') {
                caster.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "ball-magnet",
                    message: `Ball Magnet Active! Ball follows you for ${duration/1000}s`,
                    duration: duration,
                    icon: this.options.icon
                });
            }

            // Auto-cleanup after duration
            setTimeout(() => {
                this.removeMagnetEffect(caster);
            }, duration);

            console.log(`🧭 BALL MAGNET: Applied ball magnetism for ${duration/1000} seconds`);

        } catch (error) {
            console.error("❌ BALL MAGNET EFFECTS ERROR:", error);
        }
    }

    /**
     * Applies magnetic force to pull the ball toward the player
     */
    private applyMagneticForce(ball: any, player: SoccerPlayerEntity, distance: number, baseForce: number): void {
        try {
            // Calculate direction from ball to player
            const direction = {
                x: (player.position.x - ball.position.x) / distance,
                y: (player.position.y - ball.position.y) / distance,
                z: (player.position.z - ball.position.z) / distance
            };

            // Calculate magnetic force (stronger when closer, but not too strong)
            const forceMultiplier = Math.max(0.3, Math.min(1.5, baseForce / distance));
            const magneticForce = {
                x: direction.x * forceMultiplier,
                y: direction.y * forceMultiplier * 0.5, // Less vertical pull
                z: direction.z * forceMultiplier
            };

            // Apply the magnetic force
            ball.applyImpulse(magneticForce);

            // Reduce ball's existing velocity slightly for more control
            const currentVelocity = ball.linearVelocity;
            ball.setLinearVelocity({
                x: currentVelocity.x * 0.9,
                y: currentVelocity.y * 0.95,
                z: currentVelocity.z * 0.9
            });

        } catch (error) {
            console.error("❌ MAGNETIC FORCE ERROR:", error);
        }
    }

    /**
     * Removes magnetic effect and cleans up
     */
    private removeMagnetEffect(player: SoccerPlayerEntity): void {
        try {
            const customProps = (player as any).customProperties;
            if (customProps) {
                customProps.set('hasBallMagnetEffect', false);
                customProps.delete('magnetForce');
                customProps.delete('magnetRadius');
                customProps.delete('magnetEndTime');
            }

            // Clear the interval
            const magnetInterval = (player as any)._magnetInterval;
            if (magnetInterval) {
                clearInterval(magnetInterval);
                delete (player as any)._magnetInterval;
            }

            // Remove visual effect
            this.removeMagneticFieldEffect(player);

            // Send expiration notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-expired",
                    powerUpType: "ball-magnet",
                    message: "Ball magnetism deactivated"
                });
            }

            console.log(`🧭 BALL MAGNET: Effect expired for ${player.player.username}`);
        } catch (error) {
            console.error("❌ MAGNET CLEANUP ERROR:", error);
        }
    }

    /**
     * Creates magnetic field visual effects around the player
     */
    private createMagneticFieldEffect(player: SoccerPlayerEntity): void {
        try {
            if (!player.world) {
                console.error("❌ BALL MAGNET: Player world not available for visual effects");
                return;
            }

            // Create main compass effect entity
            const compassEffect = new Entity({
                name: 'magnetic-field-compass',
                modelUri: this.options.modelUri, // "models/items/compass.gltf"
                modelScale: this.options.modelScale * 1.5, // Larger for effect
                rigidBodyOptions: {
                    type: 'KINEMATIC_POSITION' as any,
                    colliders: [], // No colliders for visual effect
                }
            });

            // Spawn the effect above the player
            const effectPosition = {
                x: player.position.x,
                y: player.position.y + 2.5, // 2.5 blocks above player
                z: player.position.z
            };

            compassEffect.spawn(player.world, effectPosition);

            // Create magnetic field lines around the player
            this.createMagneticFieldLines(player.position, player.world);

            // Animate the compass effect
            this.animateMagneticField(compassEffect, player);

            // Store effect reference for cleanup
            (player as any)._magneticFieldEffect = compassEffect;

            console.log(`✨ BALL MAGNET: Created magnetic field effects for ${player.player.username}`);
        } catch (error) {
            console.error("❌ BALL MAGNET VISUAL EFFECT ERROR:", error);
        }
    }

    /**
     * Creates magnetic field line effects around the player
     */
    private createMagneticFieldLines(centerPos: Vector3Like, world: any): void {
        const lineCount = 8;
        const radius = this.options.projectileRadius; // Use magnetic field radius

        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2;
            
            const fieldLine = new Entity({
                name: `magnetic-field-line-${i}`,
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 0.8,
                rigidBodyOptions: {
                    type: 'KINEMATIC_POSITION' as any,
                    colliders: [],
                }
            });

            const linePos = {
                x: centerPos.x + Math.cos(angle) * radius,
                y: centerPos.y + 0.5,
                z: centerPos.z + Math.sin(angle) * radius
            };

            fieldLine.spawn(world, linePos);
            
            // Animate field line
            this.animateFieldLine(fieldLine, angle, centerPos);
        }
    }

    /**
     * Animates a magnetic field line
     */
    private animateFieldLine(fieldLine: Entity, angle: number, centerPos: Vector3Like): void {
        let animationTime = 0;
        const maxAnimationTime = 10000; // 10 seconds to match magnet duration
        const radius = this.options.projectileRadius;

        const animateFrame = () => {
            if (!fieldLine.isSpawned || animationTime >= maxAnimationTime) {
                if (fieldLine.isSpawned) {
                    fieldLine.despawn();
                }
                return;
            }

            try {
                // Rotate the field lines around the player
                const rotationSpeed = 0.002;
                const currentAngle = angle + (animationTime * rotationSpeed);
                
                // Pulsing radius for magnetic effect
                const pulseOffset = Math.sin(animationTime * 0.005) * 0.5;
                const currentRadius = radius + pulseOffset;
                
                const newPos = {
                    x: centerPos.x + Math.cos(currentAngle) * currentRadius,
                    y: centerPos.y + 0.5 + Math.sin(animationTime * 0.003) * 0.3,
                    z: centerPos.z + Math.sin(currentAngle) * currentRadius
                };

                fieldLine.setPosition(newPos);

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ FIELD LINE ANIMATION ERROR:", error);
                if (fieldLine.isSpawned) {
                    fieldLine.despawn();
                }
            }
        };

        animateFrame();
    }

    /**
     * Animates the main magnetic field compass effect
     */
    private animateMagneticField(compassEffect: Entity, player: SoccerPlayerEntity): void {
        let animationTime = 0;
        const maxAnimationTime = 10000; // 10 seconds to match effect duration
        
        const animateFrame = () => {
            if (!compassEffect.isSpawned || animationTime >= maxAnimationTime || !player.isSpawned) {
                if (compassEffect.isSpawned) {
                    compassEffect.despawn();
                }
                return;
            }

            try {
                // Follow the player
                const newPos = {
                    x: player.position.x,
                    y: player.position.y + 2.5 + Math.sin(animationTime * 0.003) * 0.2,
                    z: player.position.z
                };
                compassEffect.setPosition(newPos);

                // Spin the compass for magnetic effect
                const rotationSpeed = 0.02;
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                compassEffect.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ MAGNETIC FIELD ANIMATION ERROR:", error);
                if (compassEffect.isSpawned) {
                    compassEffect.despawn();
                }
            }
        };

        animateFrame();
    }

    /**
     * Removes magnetic field visual effects
     */
    private removeMagneticFieldEffect(player: SoccerPlayerEntity): void {
        try {
            const magneticEffect = (player as any)._magneticFieldEffect;
            if (magneticEffect && magneticEffect.isSpawned) {
                magneticEffect.despawn();
            }
            delete (player as any)._magneticFieldEffect;
        } catch (error) {
            console.error("❌ REMOVE MAGNETIC EFFECT ERROR:", error);
        }
    }
}