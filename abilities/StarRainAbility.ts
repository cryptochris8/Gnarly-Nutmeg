import type { Ability } from "./Ability";
import type { ItemAbilityOptions } from "./itemTypes";
import { type Vector3Like, Entity, Audio, RigidBodyType, ColliderShape, CollisionGroup } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";

/**
 * Celestial Star Rain Power-Up Ability (Arcade Mode Only)
 * 
 * Creates a spectacular star rain that falls from the sky, and allows instant
 * stellar dash teleportation to any location within 15 units.
 * Only works in Arcade mode - blocked in FIFA mode.
 */
export class StarRainAbility implements Ability {
    private options: ItemAbilityOptions;

    constructor(options: ItemAbilityOptions) {
        this.options = options;
    }

    /**
     * Gets the UI icon for the star rain power-up
     */
    getIcon(): string {
        return this.options.icon;
    }

    /**
     * Activates the star rain power-up effect
     */
    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        // SAFETY CHECK: Only work in arcade mode
        if (!isArcadeMode()) {
            console.log("🌟 STAR RAIN: Power-up blocked - not in arcade mode");
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
            console.error("❌ STAR RAIN: Invalid source entity for star rain ability");
            return;
        }

        console.log(`🌟 STAR RAIN: ${source.player.username} activating celestial star power in arcade mode`);

        // Play activation sound effect
        this.playStarActivationEffect(source);

        // Create stellar dash teleportation first
        this.executeStellarDash(source, direction);

        // Then create star rain effect
        this.createStarRain(source);

        // Remove the ability from player's inventory
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);

        console.log(`✅ STAR RAIN: Successfully activated celestial star power for ${source.player.username}`);
    }

    /**
     * Plays the stellar activation audio effect
     */
    private playStarActivationEffect(player: SoccerPlayerEntity): void {
        try {
            if (!player.world) {
                console.error("❌ STAR RAIN: Player world not available for audio");
                return;
            }

            // Play celestial activation sound
            const starActivationAudio = new Audio({
                uri: "audio/sfx/ui/inventory-grab-item.mp3", // Placeholder - use celestial sound if available
                loop: false,
                volume: 1.2,
                attachedToEntity: player,
            });
            starActivationAudio.play(player.world);

            // Additional mystical sound effect
            setTimeout(() => {
                if (!player.world) return;
                const mysticalAudio = new Audio({
                    uri: "audio/sfx/fire/fire-ignite.mp3", // Placeholder - use stellar sound
                    loop: false,
                    volume: 0.8,
                    position: player.position,
                    referenceDistance: 20
                });
                mysticalAudio.play(player.world);
            }, 400);

            console.log(`🔊 STAR RAIN: Played stellar activation effects for ${player.player.username}`);
        } catch (error) {
            console.error("❌ STAR RAIN AUDIO ERROR:", error);
        }
    }

    /**
     * Executes stellar dash teleportation
     */
    private executeStellarDash(player: SoccerPlayerEntity, direction: Vector3Like): void {
        try {
            const teleportRange = this.options.speed; // 15 units max range

            // Calculate teleport destination based on direction
            const teleportDestination = {
                x: player.position.x + direction.x * teleportRange,
                y: player.position.y + 1.0, // Slightly elevated for safety
                z: player.position.z + direction.z * teleportRange
            };

            // Clamp destination to field boundaries (basic safety check)
            teleportDestination.x = Math.max(-45, Math.min(65, teleportDestination.x));
            teleportDestination.z = Math.max(-30, Math.min(30, teleportDestination.z));
            teleportDestination.y = Math.max(1, Math.min(10, teleportDestination.y));

            // Create teleport effect at origin
            this.createTeleportEffect(player.position, player.world, 'departure');

            // Teleport the player
            player.setPosition(teleportDestination);

            // Create teleport effect at destination
            setTimeout(() => {
                this.createTeleportEffect(teleportDestination, player.world, 'arrival');
            }, 100);

            // Send notification to player
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "stellar-dash",
                    message: `Stellar Dash! Teleported ${Math.round(teleportRange)} units`,
                    duration: 3000,
                    icon: this.options.icon
                });
            }

            console.log(`🌟 STELLAR DASH: ${player.player.username} teleported to [${teleportDestination.x.toFixed(1)}, ${teleportDestination.y.toFixed(1)}, ${teleportDestination.z.toFixed(1)}]`);

        } catch (error) {
            console.error("❌ STELLAR DASH ERROR:", error);
        }
    }

    /**
     * Creates spectacular star rain from the sky
     */
    private createStarRain(player: SoccerPlayerEntity): void {
        try {
            if (!player.world) {
                console.error("❌ STAR RAIN: Player world not available for star rain");
                return;
            }

            const starCount = 5; // Number of stars to rain down
            const rainRadius = 12; // Area radius for star rain
            const rainHeight = 15; // Height from which stars fall
            const rainDuration = this.options.lifeTime * 1000; // 3 seconds

            // Create main golden apple effect at player position
            this.createMainStarEffect(player);

            // Create multiple star projectiles
            for (let i = 0; i < starCount; i++) {
                setTimeout(() => {
                    this.createStarProjectile(player.position, rainRadius, rainHeight, player.world);
                }, i * 200); // Stagger star creation for dramatic effect
            }

            // Send notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "star-rain",
                    message: `Star Rain! ${starCount} celestial projectiles incoming!`,
                    duration: rainDuration,
                    icon: this.options.icon
                });
            }

            console.log(`🌟 STAR RAIN: Created ${starCount} star projectiles around ${player.player.username}`);

        } catch (error) {
            console.error("❌ STAR RAIN CREATION ERROR:", error);
        }
    }

    /**
     * Creates the main star effect (golden apple) above the player
     */
    private createMainStarEffect(player: SoccerPlayerEntity): void {
        try {
            // Create main golden apple effect entity
            const starEffect = new Entity({
                name: 'main-star-effect',
                modelUri: this.options.modelUri, // "models/items/golden-apple.gltf"
                modelScale: this.options.modelScale * 2.5, // Larger for dramatic effect
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                    colliders: [], // No colliders for visual effect
                }
            });

            // Spawn the effect high above the player
            const effectPosition = {
                x: player.position.x,
                y: player.position.y + 8.0, // High above for star effect
                z: player.position.z
            };

            starEffect.spawn(player.world, effectPosition);

            // Animate the main star effect
            this.animateMainStarEffect(starEffect);

            console.log(`✨ STAR RAIN: Created main star effect for ${player.player.username}`);
        } catch (error) {
            console.error("❌ MAIN STAR EFFECT ERROR:", error);
        }
    }

    /**
     * Creates individual star projectiles that fall from the sky
     */
    private createStarProjectile(centerPos: Vector3Like, radius: number, height: number, world: any): void {
        try {
            // Random position within radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            
            const starPosition = {
                x: centerPos.x + Math.cos(angle) * distance,
                y: centerPos.y + height,
                z: centerPos.z + Math.sin(angle) * distance
            };

            // Create star projectile
            const starProjectile = new Entity({
                name: 'star-projectile',
                modelUri: 'models/projectiles/energy-orb-projectile.gltf', // Star-like projectile
                modelScale: 0.8,
                rigidBodyOptions: {
                    type: RigidBodyType.DYNAMIC,
                    gravityScale: 1.5, // Falls faster than normal
                    ccdEnabled: true, // High-speed collision detection
                    linearDamping: 0.1,
                    angularDamping: 0.2,
                }
            });

            starProjectile.spawn(world, starPosition);

            // Add collision detection for impact effects
            starProjectile.createAndAddChildCollider({
                shape: ColliderShape.BALL,
                radius: this.options.projectileRadius, // 2.0 explosion radius
                isSensor: true,
                collisionGroups: {
                    belongsTo: [CollisionGroup.ENTITY],
                    collidesWith: [CollisionGroup.PLAYER, CollisionGroup.ENTITY, CollisionGroup.BLOCK],
                },
                onCollision: (otherEntity: any, started: boolean) => {
                    if (!started) return;
                    
                    // Create star explosion
                    this.createStarExplosion(starProjectile.position, world);
                    
                    // Apply effects to nearby players
                    if (otherEntity instanceof SoccerPlayerEntity) {
                        this.applyStarImpact(otherEntity, starProjectile.position);
                    }
                    
                    // Remove the star projectile
                    if (starProjectile.isSpawned) {
                        starProjectile.despawn();
                    }
                }
            });

            // Auto-despawn after 6 seconds if no collision
            setTimeout(() => {
                if (starProjectile.isSpawned) {
                    this.createStarExplosion(starProjectile.position, world);
                    starProjectile.despawn();
                }
            }, 6000);

            // Add some initial rotation for visual appeal
            starProjectile.setAngularVelocity({
                x: (Math.random() - 0.5) * 10,
                y: (Math.random() - 0.5) * 10,
                z: (Math.random() - 0.5) * 10
            });

        } catch (error) {
            console.error("❌ STAR PROJECTILE ERROR:", error);
        }
    }

    /**
     * Creates star explosion effects on impact
     */
    private createStarExplosion(position: Vector3Like, world: any): void {
        try {
            // Main explosion effect
            const explosionEffect = new Entity({
                name: 'star-explosion',
                modelUri: 'misc/firework.gltf', // Correct path for firework model
                modelScale: 4.0, // Large explosion
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            explosionEffect.spawn(world, position);

            // Play explosion sound
            const explosionAudio = new Audio({
                uri: "audio/sfx/damage/explode.mp3",
                loop: false,
                volume: 0.8,
                position: position,
                referenceDistance: 15
            });
            explosionAudio.play(world);

            // Create smaller star fragments
            this.createStarFragments(position, world);

            // Remove explosion effect after animation
            setTimeout(() => {
                if (explosionEffect.isSpawned) {
                    explosionEffect.despawn();
                }
            }, 2000);

        } catch (error) {
            console.error("❌ STAR EXPLOSION ERROR:", error);
        }
    }

    /**
     * Creates star fragments around explosion
     */
    private createStarFragments(centerPos: Vector3Like, world: any): void {
        const fragmentCount = 6;
        
        for (let i = 0; i < fragmentCount; i++) {
            const angle = (i / fragmentCount) * Math.PI * 2;
            const distance = 1 + Math.random() * 2;
            
            const fragment = new Entity({
                name: `star-fragment-${i}`,
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 0.6,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            const fragmentPos = {
                x: centerPos.x + Math.cos(angle) * distance,
                y: centerPos.y + 0.5,
                z: centerPos.z + Math.sin(angle) * distance
            };

            fragment.spawn(world, fragmentPos);

            // Animate fragment dispersal
            this.animateStarFragment(fragment, angle);
        }
    }

    /**
     * Animates star fragment dispersal
     */
    private animateStarFragment(fragment: Entity, angle: number): void {
        let animationTime = 0;
        const maxAnimationTime = 1500;
        const startPos = { ...fragment.position };

        const animateFrame = () => {
            if (!fragment.isSpawned || animationTime >= maxAnimationTime) {
                if (fragment.isSpawned) {
                    fragment.despawn();
                }
                return;
            }

            try {
                const progress = animationTime / maxAnimationTime;
                const distance = progress * 3; // Spread out over time
                const height = Math.sin(progress * Math.PI) * 2; // Arc motion

                fragment.setPosition({
                    x: startPos.x + Math.cos(angle) * distance,
                    y: startPos.y + height,
                    z: startPos.z + Math.sin(angle) * distance
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ STAR FRAGMENT ANIMATION ERROR:", error);
                if (fragment.isSpawned) {
                    fragment.despawn();
                }
            }
        };

        animateFrame();
    }

    /**
     * Applies star impact effects to players
     */
    private applyStarImpact(player: SoccerPlayerEntity, impactPos: Vector3Like): void {
        try {
            const damage = this.options.damage; // Star damage (20)
            const knockback = this.options.knockback; // Knockback force (1.2)

            // Calculate knockback direction
            const direction = {
                x: player.position.x - impactPos.x,
                y: 0,
                z: player.position.z - impactPos.z
            };

            const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
            if (distance > 0) {
                direction.x /= distance;
                direction.z /= distance;
            }

            // Apply knockback
            player.applyImpulse({
                x: direction.x * knockback * player.mass,
                y: 3.0 * player.mass, // Upward launch
                z: direction.z * knockback * player.mass
            });

            // Create impact particle effect on player
            this.createPlayerImpactEffect(player);

            console.log(`🌟 STAR IMPACT: ${player.player.username} hit by star projectile!`);

        } catch (error) {
            console.error("❌ STAR IMPACT ERROR:", error);
        }
    }

    /**
     * Creates teleport effect at specified location
     */
    private createTeleportEffect(position: Vector3Like, world: any, type: 'departure' | 'arrival'): void {
        try {
            const teleportEffect = new Entity({
                name: `teleport-${type}`,
                modelUri: 'misc/firework.gltf',
                modelScale: type === 'departure' ? 3.0 : 2.5,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            teleportEffect.spawn(world, position);

            // Play teleport sound
            const teleportAudio = new Audio({
                uri: "audio/sfx/ui/inventory-grab-item.mp3",
                loop: false,
                volume: 0.7,
                position: position,
                referenceDistance: 12
            });
            teleportAudio.play(world);

            // Remove effect after brief display
            setTimeout(() => {
                if (teleportEffect.isSpawned) {
                    teleportEffect.despawn();
                }
            }, 1000);

        } catch (error) {
            console.error("❌ TELEPORT EFFECT ERROR:", error);
        }
    }

    /**
     * Animates the main star effect
     */
    private animateMainStarEffect(starEffect: Entity): void {
        let animationTime = 0;
        const maxAnimationTime = 3000; // 3 seconds
        
        const animateFrame = () => {
            if (!starEffect.isSpawned || animationTime >= maxAnimationTime) {
                if (starEffect.isSpawned) {
                    starEffect.despawn();
                }
                return;
            }

            try {
                // Rotate for celestial effect
                const rotationSpeed = 0.02;
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                starEffect.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                // Pulse size for magical effect
                const pulse = Math.sin(animationTime * 0.005) * 0.3;
                // Note: Model scaling may not be available at runtime in Hytopia

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ MAIN STAR ANIMATION ERROR:", error);
                if (starEffect.isSpawned) {
                    starEffect.despawn();
                }
            }
        };

        animateFrame();
    }

    /**
     * Creates impact particle effect on player
     */
    private createPlayerImpactEffect(player: SoccerPlayerEntity): void {
        try {
            const impactEffect = new Entity({
                name: 'star-impact-player',
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 1.5,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            impactEffect.spawn(player.world, {
                x: player.position.x,
                y: player.position.y + 1.5,
                z: player.position.z
            });

            // Brief flash effect
            setTimeout(() => {
                if (impactEffect.isSpawned) {
                    impactEffect.despawn();
                }
            }, 500);

        } catch (error) {
            console.error("❌ PLAYER IMPACT EFFECT ERROR:", error);
        }
    }
}