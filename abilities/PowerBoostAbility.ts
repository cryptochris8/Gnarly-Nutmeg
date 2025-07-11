import type { Ability } from './Ability';
import type { ItemAbilityOptions } from './itemTypes';
import { type Vector3Like, type Entity } from 'hytopia';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';

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
        // Apply different effects based on boost type
        switch (this.boostType) {
            case 'mega_kick':
                // TODO: Implement mega kick boost
                console.log(`🏈 ${player.player.username} gained mega kick power!`);
                break;
            case 'power_boost':
                // TODO: Implement power boost
                console.log(`💪 ${player.player.username} gained power boost!`);
                break;
            case 'precision':
                // TODO: Implement precision boost
                console.log(`🎯 ${player.player.username} gained precision boost!`);
                break;
            case 'stamina':
                // TODO: Implement stamina boost
                console.log(`🧪 ${player.player.username} gained stamina boost!`);
                break;
            case 'shield':
                // TODO: Implement shield boost
                console.log(`🛡️ ${player.player.username} gained shield protection!`);
                break;
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