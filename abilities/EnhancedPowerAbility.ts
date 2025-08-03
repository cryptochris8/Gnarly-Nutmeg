import type { Ability } from "./Ability";
import type { ItemAbilityOptions } from "./itemTypes";
import { type Vector3Like, Entity, Audio, RigidBodyType, ColliderShape, CollisionGroup } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";
import sharedState from "../state/sharedState";

/**
 * Enhanced Power Ability - Handles multiple enhanced power-ups
 * Supports: Elemental Mastery, Tidal Wave, Reality Warp, Honey Trap
 */
export class EnhancedPowerAbility implements Ability {
    private options: ItemAbilityOptions;

    constructor(options: ItemAbilityOptions) {
        this.options = options;
    }

    getIcon(): string {
        return this.options.icon;
    }

    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        if (!isArcadeMode()) {
            console.log(`🎯 ${this.options.name}: Power-up blocked - not in arcade mode`);
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

        if (!source.world || !(source instanceof SoccerPlayerEntity)) {
            console.error(`❌ ${this.options.name}: Invalid source entity`);
            return;
        }

        console.log(`🎯 ${this.options.name}: ${source.player.username} activating enhanced power`);

        // Route to appropriate ability based on name
        switch (this.options.name) {
            case "Elemental Mastery":
                this.executeElementalMastery(source, origin, direction);
                break;
            case "Tidal Wave":
                this.executeTidalWave(source, origin, direction);
                break;
            case "Reality Warp":
                this.executeRealityWarp(source, origin, direction);
                break;
            case "Honey Trap":
                this.executeHoneyTrap(source, origin, direction);
                break;
            default:
                console.error(`❌ Unknown enhanced power: ${this.options.name}`);
                return;
        }

        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);
    }

    // ===== ELEMENTAL MASTERY =====
    private executeElementalMastery(player: SoccerPlayerEntity, origin: Vector3Like, direction: Vector3Like): void {
        try {
            this.playActivationSound(player, "audio/sfx/fire/fire-ignite.mp3");
            
            // Create magic circle effect
            this.createMagicCircle(player);
            
            // Apply field physics changes
            this.applyElementalEffects(player);
            
            console.log(`🔮 ELEMENTAL MASTERY: Applied field transformation for ${player.player.username}`);
        } catch (error) {
            console.error("❌ ELEMENTAL MASTERY ERROR:", error);
        }
    }

    private createMagicCircle(player: SoccerPlayerEntity): void {
        try {
            const magicCircle = new Entity({
                name: 'elemental-magic-circle',
                modelUri: this.options.modelUri, // "models/environment/Dungeon/magic-circle-purple.gltf"
                modelScale: this.options.modelScale * 3, // Large circle
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            magicCircle.spawn(player.world, {
                x: player.position.x,
                y: player.position.y + 0.1, // Slightly above ground
                z: player.position.z
            });

            // Animate the magic circle
            this.animateMagicCircle(magicCircle);
        } catch (error) {
            console.error("❌ MAGIC CIRCLE ERROR:", error);
        }
    }

    private animateMagicCircle(circle: Entity): void {
        let animationTime = 0;
        const maxAnimationTime = 12000; // 12 seconds

        const animateFrame = () => {
            if (!circle.isSpawned || animationTime >= maxAnimationTime) {
                if (circle.isSpawned) {
                    circle.despawn();
                }
                return;
            }

            try {
                // Rotate the magic circle
                const rotationSpeed = 0.02;
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                circle.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ MAGIC CIRCLE ANIMATION ERROR:", error);
                if (circle.isSpawned) {
                    circle.despawn();
                }
            }
        };

        animateFrame();
    }

    private applyElementalEffects(player: SoccerPlayerEntity): void {
        try {
            const duration = this.options.damage; // 12000ms
            const gravityMultiplier = this.options.speed; // 0.5 (low gravity)
            
            // Store elemental effect data
            const customProps = (player as any).customProperties || new Map();
            (player as any).customProperties = customProps;
            
            customProps.set('hasElementalMastery', true);
            customProps.set('originalGravity', 1.0);
            customProps.set('elementalGravityScale', gravityMultiplier);
            customProps.set('elementalEndTime', Date.now() + duration);
            
            // Apply to all entities in area
            this.applyAreaElementalEffects(player.position, this.options.projectileRadius);
            
            // Remove effects after duration
            setTimeout(() => {
                this.removeElementalEffects(player);
            }, duration);

            // Send notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "elemental-mastery",
                    message: `Elemental Mastery! Gravity altered for ${duration/1000}s`,
                    duration: duration,
                    icon: this.options.icon
                });
            }
        } catch (error) {
            console.error("❌ ELEMENTAL EFFECTS ERROR:", error);
        }
    }

    private applyAreaElementalEffects(centerPos: Vector3Like, radius: number): void {
        try {
            // Find ball and apply elemental physics changes
            const soccerGame = (globalThis as any).soccerGame;
            if (soccerGame && soccerGame.ball) {
                const ball = soccerGame.ball;
                const distance = Math.sqrt(
                    Math.pow(ball.position.x - centerPos.x, 2) + 
                    Math.pow(ball.position.z - centerPos.z, 2)
                );
                
                if (distance <= radius) {
                    // Apply modified gravity to ball
                    const gravityScale = this.options.speed; // 0.5 for low gravity
                    ball.setGravityScale(gravityScale);
                    
                    // Set timer to restore normal gravity
                    setTimeout(() => {
                        if (ball.isSpawned) {
                            ball.setGravityScale(1.0); // Restore normal gravity
                        }
                    }, this.options.damage); // duration
                    
                    console.log(`🔮 Applied ${gravityScale}x gravity to ball for ${this.options.damage/1000}s`);
                }
            }
            
            console.log(`🔮 Applied elemental effects in ${radius} unit radius around [${centerPos.x.toFixed(1)}, ${centerPos.z.toFixed(1)}]`);
        } catch (error) {
            console.error("❌ AREA ELEMENTAL EFFECTS ERROR:", error);
        }
    }

    private removeElementalEffects(player: SoccerPlayerEntity): void {
        try {
            const customProps = (player as any).customProperties;
            if (customProps) {
                customProps.set('hasElementalMastery', false);
                customProps.delete('originalGravity');
                customProps.delete('elementalGravityScale');
                customProps.delete('elementalEndTime');
            }

            console.log(`🔮 ELEMENTAL MASTERY: Effects expired for ${player.player.username}`);
        } catch (error) {
            console.error("❌ REMOVE ELEMENTAL EFFECTS ERROR:", error);
        }
    }

    // ===== TIDAL WAVE =====
    private executeTidalWave(player: SoccerPlayerEntity, origin: Vector3Like, direction: Vector3Like): void {
        try {
            this.playActivationSound(player, "audio/sfx/liquid/large-splash.mp3");
            
            // Create tidal wave effect
            this.createTidalWave(player, direction);
            
            // Create splash zones
            this.createSplashZones(player.position);
            
            console.log(`🌊 TIDAL WAVE: Created wave effects for ${player.player.username}`);
        } catch (error) {
            console.error("❌ TIDAL WAVE ERROR:", error);
        }
    }

    private createTidalWave(player: SoccerPlayerEntity, direction: Vector3Like): void {
        try {
            const waveForce = this.options.speed; // 12
            const waveWidth = 8;
            const waveLength = 15;

            // Create wave visual effect
            const waveEffect = new Entity({
                name: 'tidal-wave-effect',
                modelUri: this.options.modelUri, // "models/items/milk.gltf"
                modelScale: this.options.modelScale * 8, // Large wave
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            const wavePosition = {
                x: player.position.x + direction.x * 3,
                y: player.position.y + 0.5,
                z: player.position.z + direction.z * 3
            };

            waveEffect.spawn(player.world, wavePosition);

            // Push ball and players in wave direction
            this.applyWaveForces(player, direction, waveForce);

            // Animate wave movement
            this.animateWave(waveEffect, direction, waveLength);

            // Send notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "tidal-wave",
                    message: `Tidal Wave! Pushing everything in its path`,
                    duration: 3000,
                    icon: this.options.icon
                });
            }
        } catch (error) {
            console.error("❌ TIDAL WAVE CREATION ERROR:", error);
        }
    }

    private applyWaveForces(caster: SoccerPlayerEntity, direction: Vector3Like, force: number): void {
        try {
            // Push the ball
            const soccerBall = sharedState.getSoccerBall();
            if (soccerBall?.isSpawned) {
                soccerBall.applyImpulse({
                    x: direction.x * force,
                    y: 2.0,
                    z: direction.z * force
                });
            }

            // Push other players
            const allPlayers = caster.world.entityManager.getAllPlayerEntities()
                .filter(entity => entity instanceof SoccerPlayerEntity) as SoccerPlayerEntity[];

            allPlayers.forEach(player => {
                if (player.player.username === caster.player.username) return;

                // Check if player is in wave path
                const distanceToPlayer = Math.sqrt(
                    Math.pow(player.position.x - caster.position.x, 2) +
                    Math.pow(player.position.z - caster.position.z, 2)
                );

                if (distanceToPlayer <= 12) { // Wave range
                    player.applyImpulse({
                        x: direction.x * force * 0.8 * player.mass,
                        y: 3.0 * player.mass,
                        z: direction.z * force * 0.8 * player.mass
                    });
                    console.log(`🌊 WAVE HIT: ${player.player.username} caught in tidal wave!`);
                }
            });
        } catch (error) {
            console.error("❌ WAVE FORCES ERROR:", error);
        }
    }

    private animateWave(waveEffect: Entity, direction: Vector3Like, length: number): void {
        let animationTime = 0;
        const maxAnimationTime = 3000; // 3 seconds
        const startPos = { ...waveEffect.position };

        const animateFrame = () => {
            if (!waveEffect.isSpawned || animationTime >= maxAnimationTime) {
                if (waveEffect.isSpawned) {
                    waveEffect.despawn();
                }
                return;
            }

            try {
                const progress = animationTime / maxAnimationTime;
                const distance = progress * length;

                waveEffect.setPosition({
                    x: startPos.x + direction.x * distance,
                    y: startPos.y,
                    z: startPos.z + direction.z * distance
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ WAVE ANIMATION ERROR:", error);
                if (waveEffect.isSpawned) {
                    waveEffect.despawn();
                }
            }
        };

        animateFrame();
    }

    private createSplashZones(centerPos: Vector3Like): void {
        const zoneCount = 4;
        const zoneDuration = this.options.damage; // 6000ms

        for (let i = 0; i < zoneCount; i++) {
            const angle = (i / zoneCount) * Math.PI * 2;
            const distance = 3 + Math.random() * 5;

            const zonePos = {
                x: centerPos.x + Math.cos(angle) * distance,
                y: centerPos.y + 0.1,
                z: centerPos.z + Math.sin(angle) * distance
            };

            this.createSingleSplashZone(zonePos, zoneDuration);
        }
    }

    private createSingleSplashZone(position: Vector3Like, duration: number): void {
        try {
            const splashZone = new Entity({
                name: 'splash-zone',
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 3.0,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            splashZone.spawn(sharedState.getSoccerBall()?.world || null, position);

            // Auto-despawn after duration
            setTimeout(() => {
                if (splashZone.isSpawned) {
                    splashZone.despawn();
                }
            }, duration);
        } catch (error) {
            console.error("❌ SPLASH ZONE ERROR:", error);
        }
    }

    // ===== REALITY WARP =====
    private executeRealityWarp(player: SoccerPlayerEntity, origin: Vector3Like, direction: Vector3Like): void {
        try {
            this.playActivationSound(player, "audio/sfx/ui/inventory-grab-item.mp3");
            
            // Create portal pair
            this.createPortalPair(player, direction);
            
            console.log(`🌀 REALITY WARP: Created portal system for ${player.player.username}`);
        } catch (error) {
            console.error("❌ REALITY WARP ERROR:", error);
        }
    }

    private createPortalPair(player: SoccerPlayerEntity, direction: Vector3Like): void {
        try {
            const portalRange = this.options.speed; // 20 units
            const portalDuration = this.options.damage; // 15000ms

            // Portal A (entrance) - near player
            const portalA = {
                x: player.position.x + direction.x * 3,
                y: player.position.y + 0.5,
                z: player.position.z + direction.z * 3
            };

            // Portal B (exit) - at max range
            const portalB = {
                x: player.position.x + direction.x * portalRange,
                y: player.position.y + 0.5,
                z: player.position.z + direction.z * portalRange
            };

            this.createPortal(portalA, player.world, 'entrance', portalDuration);
            this.createPortal(portalB, player.world, 'exit', portalDuration);

            // Send notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "reality-warp",
                    message: `Reality Warp! Portals active for ${portalDuration/1000}s`,
                    duration: portalDuration,
                    icon: this.options.icon
                });
            }
        } catch (error) {
            console.error("❌ PORTAL CREATION ERROR:", error);
        }
    }

    private createPortal(position: Vector3Like, world: any, type: 'entrance' | 'exit', duration: number): void {
        try {
            const portal = new Entity({
                name: `reality-portal-${type}`,
                modelUri: this.options.modelUri, // "models/items/map.gltf"
                modelScale: this.options.modelScale * 3,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            portal.spawn(world, position);

            // Add collision detection for teleportation
            portal.createAndAddChildCollider({
                shape: ColliderShape.BALL,
                radius: this.options.projectileRadius, // 2.0
                isSensor: true,
                collisionGroups: {
                    belongsTo: [CollisionGroup.ENTITY],
                    collidesWith: [CollisionGroup.PLAYER, CollisionGroup.ENTITY],
                },
                onCollision: (otherEntity: any, started: boolean) => {
                    if (!started || type !== 'entrance') return;
                    
                    // Only teleport players and ball
                    if (otherEntity instanceof SoccerPlayerEntity || otherEntity === sharedState.getSoccerBall()) {
                        this.teleportThroughPortal(otherEntity, position, world);
                    }
                }
            });

            // Animate portal
            this.animatePortal(portal, type);

            // Auto-despawn after duration
            setTimeout(() => {
                if (portal.isSpawned) {
                    portal.despawn();
                }
            }, duration);
        } catch (error) {
            console.error("❌ PORTAL ERROR:", error);
        }
    }

    private teleportThroughPortal(entity: Entity, entrancePos: Vector3Like, world: any): void {
        try {
            // Calculate exit position (opposite direction from entrance)
            const centerPos = { x: 7, y: 6, z: -3 }; // Field center
            const exitPos = {
                x: centerPos.x + (centerPos.x - entrancePos.x),
                y: entrancePos.y,
                z: centerPos.z + (centerPos.z - entrancePos.z)
            };

            // Clamp to field boundaries
            exitPos.x = Math.max(-45, Math.min(65, exitPos.x));
            exitPos.z = Math.max(-30, Math.min(30, exitPos.z));

            // Teleport the entity
            entity.setPosition(exitPos);

            // Play teleport sound
            const teleportAudio = new Audio({
                uri: "audio/sfx/ui/portal-teleporting-long.mp3",
                loop: false,
                volume: 0.8,
                position: exitPos,
                referenceDistance: 15
            });
            teleportAudio.play(world);

            console.log(`🌀 REALITY WARP: Teleported entity to [${exitPos.x.toFixed(1)}, ${exitPos.y.toFixed(1)}, ${exitPos.z.toFixed(1)}]`);
        } catch (error) {
            console.error("❌ PORTAL TELEPORT ERROR:", error);
        }
    }

    private animatePortal(portal: Entity, type: string): void {
        let animationTime = 0;
        const maxAnimationTime = 15000; // 15 seconds

        const animateFrame = () => {
            if (!portal.isSpawned || animationTime >= maxAnimationTime) {
                if (portal.isSpawned) {
                    portal.despawn();
                }
                return;
            }

            try {
                // Rotate portal for reality distortion effect
                const rotationSpeed = type === 'entrance' ? 0.03 : -0.03; // Opposite rotations
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                portal.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                // Float up and down
                const floatOffset = Math.sin(animationTime * 0.004) * 0.5;
                const currentPos = portal.position;
                portal.setPosition({
                    x: currentPos.x,
                    y: currentPos.y + floatOffset * 0.1,
                    z: currentPos.z
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ PORTAL ANIMATION ERROR:", error);
                if (portal.isSpawned) {
                    portal.despawn();
                }
            }
        };

        animateFrame();
    }

    // ===== HONEY TRAP =====
    private executeHoneyTrap(player: SoccerPlayerEntity, origin: Vector3Like, direction: Vector3Like): void {
        try {
            this.playActivationSound(player, "audio/sfx/dig/dig-grass.mp3");
            
            // Create honey trap zones
            this.createHoneyTraps(player.position);
            
            // Apply attraction field
            this.applyAttractionField(player);
            
            console.log(`🍯 HONEY TRAP: Created sticky zones for ${player.player.username}`);
        } catch (error) {
            console.error("❌ HONEY TRAP ERROR:", error);
        }
    }

    private createHoneyTraps(centerPos: Vector3Like): void {
        const trapCount = 5;
        const trapDuration = this.options.damage; // 10000ms

        for (let i = 0; i < trapCount; i++) {
            const angle = (i / trapCount) * Math.PI * 2;
            const distance = 2 + Math.random() * 6;

            const trapPos = {
                x: centerPos.x + Math.cos(angle) * distance,
                y: centerPos.y + 0.1,
                z: centerPos.z + Math.sin(angle) * distance
            };

            this.createSingleHoneyTrap(trapPos, trapDuration);
        }
    }

    private createSingleHoneyTrap(position: Vector3Like, duration: number): void {
        try {
            const honeyTrap = new Entity({
                name: 'honey-trap',
                modelUri: this.options.modelUri, // "models/items/carrot-golden.gltf"
                modelScale: this.options.modelScale * 2,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            honeyTrap.spawn(sharedState.getSoccerBall()?.world || null, position);

            // Add collision detection for sticky effects
            honeyTrap.createAndAddChildCollider({
                shape: ColliderShape.BALL,
                radius: this.options.projectileRadius, // 4.0
                isSensor: true,
                collisionGroups: {
                    belongsTo: [CollisionGroup.ENTITY],
                    collidesWith: [CollisionGroup.PLAYER, CollisionGroup.ENTITY],
                },
                onCollision: (otherEntity: any, started: boolean) => {
                    if (!started) return;
                    
                    // Apply sticky effect to players and ball
                    if (otherEntity instanceof SoccerPlayerEntity) {
                        this.applyStickiness(otherEntity, position);
                    } else if (otherEntity === sharedState.getSoccerBall()) {
                        this.applyStickyBallEffect(otherEntity, position);
                    }
                }
            });

            // Auto-despawn after duration
            setTimeout(() => {
                if (honeyTrap.isSpawned) {
                    honeyTrap.despawn();
                }
            }, duration);
        } catch (error) {
            console.error("❌ HONEY TRAP ERROR:", error);
        }
    }

    private applyStickiness(player: SoccerPlayerEntity, trapPos: Vector3Like): void {
        try {
            const slowFactor = this.options.speed; // 0.3 (70% speed reduction)
            const stickyDuration = 3000; // 3 seconds of stickiness

            // Apply speed reduction
            const customProps = (player as any).customProperties || new Map();
            (player as any).customProperties = customProps;
            
            customProps.set('isSticky', true);
            customProps.set('stickySpeedMultiplier', slowFactor);
            customProps.set('stickyEndTime', Date.now() + stickyDuration);

            // Visual effect
            const stickyEffect = new Entity({
                name: 'sticky-effect',
                modelUri: 'misc/selection-indicator.gltf',
                modelScale: 1.5,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            stickyEffect.spawn(player.world, {
                x: player.position.x,
                y: player.position.y + 0.1,
                z: player.position.z
            });

            // Remove effect after duration
            setTimeout(() => {
                customProps.set('isSticky', false);
                customProps.delete('stickySpeedMultiplier');
                customProps.delete('stickyEndTime');
                
                if (stickyEffect.isSpawned) {
                    stickyEffect.despawn();
                }
            }, stickyDuration);

            console.log(`🍯 HONEY TRAP: Applied stickiness to ${player.player.username} for ${stickyDuration/1000}s`);
        } catch (error) {
            console.error("❌ STICKINESS APPLICATION ERROR:", error);
        }
    }

    private applyStickyBallEffect(ball: Entity, trapPos: Vector3Like): void {
        try {
            // Slow down the ball significantly
            const currentVelocity = ball.getLinearVelocity();
            ball.setLinearVelocity({
                x: currentVelocity.x * 0.2,
                y: currentVelocity.y * 0.2,
                z: currentVelocity.z * 0.2
            });

            console.log(`🍯 HONEY TRAP: Ball caught in honey trap, velocity reduced`);
        } catch (error) {
            console.error("❌ STICKY BALL EFFECT ERROR:", error);
        }
    }

    private applyAttractionField(player: SoccerPlayerEntity): void {
        try {
            const duration = this.options.damage; // 10000ms
            const attractionRadius = this.options.projectileRadius; // 4.0

            // Store attraction effect data
            const customProps = (player as any).customProperties || new Map();
            (player as any).customProperties = customProps;
            
            customProps.set('hasAttractionField', true);
            customProps.set('attractionRadius', attractionRadius);
            customProps.set('attractionEndTime', Date.now() + duration);
            
            // Remove effects after duration
            setTimeout(() => {
                this.removeAttractionField(player);
            }, duration);

            // Send notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "honey-trap",
                    message: `Honey Trap! Sticky zones active for ${duration/1000}s`,
                    duration: duration,
                    icon: this.options.icon
                });
            }
        } catch (error) {
            console.error("❌ ATTRACTION FIELD ERROR:", error);
        }
    }

    private removeAttractionField(player: SoccerPlayerEntity): void {
        try {
            const customProps = (player as any).customProperties;
            if (customProps) {
                customProps.set('hasAttractionField', false);
                customProps.delete('attractionRadius');
                customProps.delete('attractionEndTime');
            }

            console.log(`🍯 HONEY TRAP: Attraction field expired for ${player.player.username}`);
        } catch (error) {
            console.error("❌ REMOVE ATTRACTION FIELD ERROR:", error);
        }
    }

    // ===== UTILITY METHODS =====
    private playActivationSound(player: SoccerPlayerEntity, audioUri: string): void {
        try {
            const activationAudio = new Audio({
                uri: audioUri,
                loop: false,
                volume: 1.0,
                attachedToEntity: player,
            });
            activationAudio.play(player.world);
        } catch (error) {
            console.error("❌ ACTIVATION SOUND ERROR:", error);
        }
    }
}