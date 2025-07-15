import type { Ability } from './Ability';
import type { ItemAbilityOptions } from './itemTypes';
import { type Vector3Like, type Entity, Audio } from 'hytopia';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';
import { isArcadeMode } from '../state/gameModes';

/**
 * Freeze Blast Ability
 * Freezes nearby enemies in place for a short duration
 */
export class FreezeBlastAbility implements Ability {
    constructor(private options: ItemAbilityOptions) {}

    getIcon(): string {
        return this.options.icon;
    }

    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void {
        // SAFETY CHECK: Only work in arcade mode
        if (!isArcadeMode()) {
            console.log("🎮 FREEZE BLAST: Blocked - not in arcade mode");
            return;
        }

        if (!source.world || !(source instanceof SoccerPlayerEntity)) return;

        console.log(`🧊 FREEZE BLAST: ${source.player.username} activating freeze blast!`);

        // Get the arcade enhancement manager from the world
        const arcadeManager = (source.world as any)._arcadeManager;
        if (!arcadeManager) {
            console.error("❌ FREEZE BLAST: Arcade manager not found!");
            return;
        }

        // Activate freeze blast through the arcade manager
        const success = arcadeManager.activatePowerUp(source.player.username, 'freeze_blast');

        if (success) {
            console.log(`✅ FREEZE BLAST: Successfully activated for ${source.player.username}`);
        } else {
            console.error(`❌ FREEZE BLAST: Failed to activate for ${source.player.username}`);
        }

        // Remove ability after use
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);
    }
}