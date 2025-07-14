import type { Ability } from "./Ability";
import type { ItemAbilityOptions } from "./itemTypes";
import { type Vector3Like, Entity, Audio, RigidBodyType } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";

/**
 * Crystal Barrier Power-Up Ability (Arcade Mode Only)
 * 
 * Creates temporary crystal barriers to block opponents and allows
 * phasing through players and walls for 5 seconds.
 * Only works in Arcade mode - blocked in FIFA mode.
 */
export class CrystalBarrierAbility implements Ability {
    private options: ItemAbilityOptions;

    constructor(options: ItemAbilityOptions) {
        this.options = options;
    }

    getIcon(): string {
        return this.options.icon;
    }

    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        if (!isArcadeMode()) {
            console.log("💎 CRYSTAL BARRIER: Power-up blocked - not in arcade mode");
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
            console.error("❌ CRYSTAL BARRIER: Invalid source entity");
            return;
        }

        console.log(`💎 CRYSTAL BARRIER: ${source.player.username} activating crystal resonance`);

        this.playActivationEffect(source);
        this.createCrystalBarriers(source, direction);
        this.applyPhaseEffect(source);

        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);
    }

    private playActivationEffect(player: SoccerPlayerEntity): void {
        try {
            const activationAudio = new Audio({
                uri: "audio/sfx/ui/inventory-grab-item.mp3",
                loop: false,
                volume: 1.0,
                attachedToEntity: player,
            });
            activationAudio.play(player.world);
        } catch (error) {
            console.error("❌ CRYSTAL BARRIER AUDIO ERROR:", error);
        }
    }

    private createCrystalBarriers(player: SoccerPlayerEntity, direction: Vector3Like): void {
        try {
            const barrierCount = 3;
            const barrierSpacing = 3.0;
            const barrierDuration = this.options.damage; // 15000ms = 15 seconds

            for (let i = 0; i < barrierCount; i++) {
                const barrierPos = {
                    x: player.position.x + direction.x * (3 + i * barrierSpacing),
                    y: player.position.y + 1.0,
                    z: player.position.z + direction.z * (3 + i * barrierSpacing)
                };

                this.createSingleBarrier(barrierPos, player.world, barrierDuration, i);
            }

            // Send notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: "crystal-barrier",
                    message: `Crystal Barriers Created! ${barrierCount} barriers active for ${barrierDuration/1000}s`,
                    duration: barrierDuration,
                    icon: this.options.icon
                });
            }

            console.log(`💎 CRYSTAL BARRIER: Created ${barrierCount} crystal barriers`);
        } catch (error) {
            console.error("❌ CRYSTAL BARRIER CREATION ERROR:", error);
        }
    }

    private createSingleBarrier(position: Vector3Like, world: any, duration: number, index: number): void {
        try {
            const barrier = new Entity({
                name: `crystal-barrier-${index}`,
                modelUri: this.options.modelUri, // "models/items/sword-diamond.gltf"
                modelScale: this.options.modelScale * 4, // Large barrier
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                    colliders: [{
                        shape: 'BOX' as any,
                        halfExtents: { x: 1.5, y: 2.5, z: 0.3 }, // Barrier dimensions
                        isSensor: false // Solid barrier
                    }]
                }
            });

            barrier.spawn(world, position);

            // Create crystal light effect
            this.createCrystalLightEffect(position, world, index);

            // Auto-despawn after duration
            setTimeout(() => {
                if (barrier.isSpawned) {
                    barrier.despawn();
                }
            }, duration);

            console.log(`💎 Created crystal barrier ${index} at [${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}]`);
        } catch (error) {
            console.error("❌ SINGLE BARRIER ERROR:", error);
        }
    }

    private createCrystalLightEffect(position: Vector3Like, world: any, index: number): void {
        try {
            const lightEffect = new Entity({
                name: `crystal-light-${index}`,
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 2.0,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            lightEffect.spawn(world, {
                x: position.x,
                y: position.y + 1.5,
                z: position.z
            });

            // Animate light pulsing
            this.animateCrystalLight(lightEffect);
        } catch (error) {
            console.error("❌ CRYSTAL LIGHT ERROR:", error);
        }
    }

    private animateCrystalLight(lightEffect: Entity): void {
        let animationTime = 0;
        const maxAnimationTime = 15000; // 15 seconds

        const animateFrame = () => {
            if (!lightEffect.isSpawned || animationTime >= maxAnimationTime) {
                if (lightEffect.isSpawned) {
                    lightEffect.despawn();
                }
                return;
            }

            try {
                // Pulsing rotation for crystal effect
                const rotationSpeed = 0.01;
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                lightEffect.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ CRYSTAL LIGHT ANIMATION ERROR:", error);
                if (lightEffect.isSpawned) {
                    lightEffect.despawn();
                }
            }
        };

        animateFrame();
    }

    private applyPhaseEffect(player: SoccerPlayerEntity): void {
        try {
            const phaseDuration = this.options.speed * 1000; // 5 seconds
            
            // Store phase effect data
            const customProps = (player as any).customProperties || new Map();
            (player as any).customProperties = customProps;
            
            customProps.set('hasCrystalPhaseEffect', true);
            customProps.set('phaseEndTime', Date.now() + phaseDuration);
            
            // Create phase visual effect
            this.createPhaseEffect(player);
            
            // Remove phase effect after duration
            setTimeout(() => {
                this.removePhaseEffect(player);
            }, phaseDuration);

            console.log(`💎 CRYSTAL PHASE: Applied ${phaseDuration/1000}s phase effect to ${player.player.username}`);
        } catch (error) {
            console.error("❌ CRYSTAL PHASE ERROR:", error);
        }
    }

    private createPhaseEffect(player: SoccerPlayerEntity): void {
        try {
            const phaseEffect = new Entity({
                name: 'crystal-phase-aura',
                modelUri: 'models/misc/selection-indicator.gltf',
                modelScale: 2.5,
                rigidBodyOptions: {
                    type: RigidBodyType.KINEMATIC_POSITION,
                }
            });

            phaseEffect.spawn(player.world, {
                x: player.position.x,
                y: player.position.y + 1.0,
                z: player.position.z
            });

            // Store effect reference
            (player as any)._crystalPhaseEffect = phaseEffect;

            // Animate phase aura
            this.animatePhaseAura(phaseEffect, player);
        } catch (error) {
            console.error("❌ PHASE EFFECT ERROR:", error);
        }
    }

    private animatePhaseAura(phaseEffect: Entity, player: SoccerPlayerEntity): void {
        let animationTime = 0;
        const maxAnimationTime = 5000; // 5 seconds

        const animateFrame = () => {
            if (!phaseEffect.isSpawned || !player.isSpawned || animationTime >= maxAnimationTime) {
                if (phaseEffect.isSpawned) {
                    phaseEffect.despawn();
                }
                return;
            }

            try {
                // Follow player
                phaseEffect.setPosition({
                    x: player.position.x,
                    y: player.position.y + 1.0 + Math.sin(animationTime * 0.005) * 0.3,
                    z: player.position.z
                });

                // Rotate for ethereal effect
                const rotationSpeed = 0.03;
                const yRotation = (animationTime * rotationSpeed) % (Math.PI * 2);
                phaseEffect.setRotation({
                    x: 0,
                    y: Math.sin(yRotation / 2),
                    z: 0,
                    w: Math.cos(yRotation / 2)
                });

                animationTime += 100;
                setTimeout(animateFrame, 100);
            } catch (error) {
                console.error("❌ PHASE AURA ANIMATION ERROR:", error);
                if (phaseEffect.isSpawned) {
                    phaseEffect.despawn();
                }
            }
        };

        animateFrame();
    }

    private removePhaseEffect(player: SoccerPlayerEntity): void {
        try {
            const customProps = (player as any).customProperties;
            if (customProps) {
                customProps.set('hasCrystalPhaseEffect', false);
                customProps.delete('phaseEndTime');
            }

            // Remove visual effect
            const phaseEffect = (player as any)._crystalPhaseEffect;
            if (phaseEffect && phaseEffect.isSpawned) {
                phaseEffect.despawn();
            }
            delete (player as any)._crystalPhaseEffect;

            // Send expiration notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
                player.player.ui.sendData({
                    type: "power-up-expired",
                    powerUpType: "crystal-phase",
                    message: "Crystal phase effect expired"
                });
            }

            console.log(`💎 CRYSTAL PHASE: Effect expired for ${player.player.username}`);
        } catch (error) {
            console.error("❌ REMOVE PHASE EFFECT ERROR:", error);
        }
    }
}