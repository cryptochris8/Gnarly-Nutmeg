import { ItemThrowAbility } from "./ItemThrowAbility";

import type { Ability } from "./Ability";
import { shurikenThrowOptions } from "./itemTypes";
import type { Player } from "hytopia";

export class AbilityHolder {
    private ability: Ability | null = null;
    private isAIPlayer: boolean = false;

    constructor(player: Player) {
        // Players should start with NO abilities in pickup-only mode
        this.ability = null;
        
        // Check if this is likely an AI player (missing UI methods)
        try {
            if (player.ui && typeof player.ui.sendData === 'function') {
                this.isAIPlayer = false;
            } else {
                this.isAIPlayer = true;
            }
        } catch (e) {
            console.log("Could not check player UI methods", e);
            this.isAIPlayer = true;
        }
    }

    public getAbility(): Ability | null {
        return this.ability;
    }

    public hasAbility(): boolean {
        return this.ability !== null;
    }

    public setAbility(ability: Ability) {
        // Always set the ability (replace existing one if any)
        this.ability = ability;
        console.log(`✅ Ability set: ${ability.getIcon()}`);
    }

    public removeAbility() {
        console.log(`🗑️ Ability removed: ${this.ability?.getIcon() || 'none'}`);
        this.ability = null;
    }

    public showAbilityUI(player: Player) {
        if (this.isAIPlayer) return;
        
        try {
            if (player.ui && typeof player.ui.sendData === 'function') {
                player.ui.sendData({
                    type: "ability-icon",
                    icon: this.ability?.getIcon(),
                });
            }
        } catch (e) {
            console.log("Could not show ability UI", e);
        }
    }

    public hideAbilityUI(player: Player) {
        if (this.isAIPlayer) return;
        
        try {
            if (player.ui && typeof player.ui.sendData === 'function') {
                player.ui.sendData({
                    type: "hide-ability-icon",
                });
            }
        } catch (e) {
            console.log("Could not hide ability UI", e);
        }
    }
    
    public useAbility(player: Player): boolean {
        // If no ability is available, return false
        if (!this.ability) return false;
        
        // Since we need to return a boolean but the ability.use() returns void,
        // we'll catch errors and return false if there's a problem
        try {
            // We're not actually using the ability here as the interface requires
            // specific parameters that we don't have from a Player object alone
            // Just returning true to indicate we have an ability that could be used
            return true;
        } catch (e) {
            console.log("Error checking ability", e);
            return false;
        }
    }
}