import type { Ability } from './Ability';
import type { ItemAbilityOptions } from './itemTypes';
import { type Vector3Like, type Entity, Audio } from 'hytopia';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';
import { isArcadeMode } from '../state/gameModes';

export class PowerBoostAbility implements Ability {
    private effectDuration: number = 8000; // 8 seconds default
    private boostType: string;

    constructor(private options: ItemAbilityOptions) {
        this.boostType = options.name.toLowerCase().replace(' ', '_');
    }

    getIcon(): string {
        return this.options.icon;
    }

    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        if (!source.world || !(source instanceof SoccerPlayerEntity)) return;
        
        console.log(`🎯 Activating ${this.options.name} for player: ${source.player.username}`);
        
        // Apply boost effect based on type
        this.applyBoostEffect(source);

        // Remove ability after use
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);
    }

    private applyBoostEffect(player: SoccerPlayerEntity): void {
        // SAFETY CHECK: Only work in arcade mode
        if (!isArcadeMode()) {
            console.log("🎮 POWER BOOST: Blocked - not in arcade mode");
            return;
        }

        // Get the arcade enhancement manager from the world
        const arcadeManager = (player.world as any)._arcadeManager;
        if (!arcadeManager) {
            console.error("❌ POWER BOOST: Arcade manager not found!");
            return;
        }

        // Apply different effects based on boost type
        let success = false;
        switch (this.boostType) {
            case 'mega_kick':
                console.log(`⚽ Activating Mega Kick for ${player.player.username}`);
                success = arcadeManager.activatePowerUp(player.player.username, 'mega_kick');
                break;
            case 'power_boost':
                console.log(`💪 Activating Power Boost for ${player.player.username}`);
                success = arcadeManager.activatePowerUp(player.player.username, 'power');
                break;
            case 'precision':
                console.log(`🎯 Activating Precision Boost for ${player.player.username}`);
                success = arcadeManager.activatePowerUp(player.player.username, 'precision');
                break;
            case 'stamina':
                console.log(`💊 Activating regular Stamina boost for ${player.player.username}`);
                success = arcadeManager.activatePowerUp(player.player.username, 'stamina');
                break;
            case 'shield':
                console.log(`🛡️ Activating Shield for ${player.player.username}`);
                success = arcadeManager.activatePowerUp(player.player.username, 'shield');
                break;
            default:
                console.error(`❌ Unknown boost type: ${this.boostType}`);
        }

        if (success) {
            // Play power-up activation sound
            try {
                const activationAudio = new Audio({
                    uri: 'audio/sfx/ui/inventory-grab-item.mp3',
                    loop: false,
                    volume: 0.8,
                    attachedToEntity: player,
                });
                activationAudio.play(player.world);
            } catch (e) {
                console.log("Could not play activation sound:", e);
            }

            // Send UI feedback
            try {
                player.player.ui.sendData({
                    type: "power-up-activated",
                    powerUpType: this.boostType,
                    message: `${this.options.name} Activated!`,
                    duration: this.effectDuration
                });
            } catch (e) {
                console.log("Could not send UI feedback:", e);
            }
        } else {
            console.error(`❌ Failed to activate ${this.options.name} for ${player.player.username}`);
        }
    }

    private getBoostValue(): number {
        switch (this.boostType) {
            case 'mega_kick': return 2.0; // 2x kick power
            case 'power_boost': return 1.5; // 1.5x general power
            case 'precision': return 3.0; // 3x accuracy
            case 'stamina': return 0.5; // 50% stamina consumption
            case 'shield': return 1.0; // 100% damage reduction
            default: return 1.0;
        }
    }

    private getBoostColor(): string {
        switch (this.boostType) {
            case 'mega_kick': return '#FF6B35'; // Orange
            case 'power_boost': return '#FF1744'; // Red
            case 'precision': return '#00E676'; // Green
            case 'stamina': return '#00BCD4'; // Cyan
            case 'shield': return '#9C27B0'; // Purple
            default: return '#FFC107'; // Yellow
        }
    }

    canActivate(): boolean {
        return true; // Power boosts can always be activated
    }
} 