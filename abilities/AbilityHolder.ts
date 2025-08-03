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
                const abilityName = this.getAbilityDisplayName();
                player.ui.sendData({
                    type: "ability-icon",
                    icon: this.ability?.getIcon(),
                    name: abilityName,
                    message: `Press F to use ${abilityName}`
                });
                console.log(`📱 UI: Sent enhanced powerup indicator data for ${abilityName}`);
            }
        } catch (e) {
            console.log("Could not show ability UI", e);
        }
    }

    public hideAbilityUI(player: Player, animated: boolean = true) {
        if (this.isAIPlayer) return;
        
        try {
            if (player.ui && typeof player.ui.sendData === 'function') {
                if (animated) {
                    // Send activation animation first, then hide
                    player.ui.sendData({
                        type: "powerup-activated",
                        abilityName: this.getAbilityDisplayName()
                    });
                    console.log(`🎬 UI: Sent powerup activation animation for ${this.getAbilityDisplayName()}`);
                } else {
                    // Just hide without animation
                    player.ui.sendData({
                        type: "hide-ability-icon",
                    });
                    console.log(`🚫 UI: Sent hide powerup indicator`);
                }
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
            // Send activation animation to UI
            if (player.ui && typeof player.ui.sendData === 'function') {
                player.ui.sendData({
                    type: "powerup-activated",
                    abilityName: this.getAbilityDisplayName()
                });
            }
            // We're not actually using the ability here as the interface requires
            // specific parameters that we don't have from a Player object alone
            // Just returning true to indicate we have an ability that could be used
            return true;
        } catch (e) {
            console.log("Error checking ability", e);
            return false;
        }
    }

    private getAbilityDisplayName(): string {
        if (!this.ability) return "Unknown Ability";
        
        const icon = this.ability.getIcon();
        const nameMap: { [key: string]: string } = {
            'shuriken-icon': 'Shuriken',
            'speed-boost': 'Speed Boost',
            'freeze-blast': 'Freeze Blast',
            'fireball': 'Fireball',
            'mega-kick': 'Mega Kick',
            'power-boost': 'Power Boost',
            'precision': 'Precision',
            'stamina': 'Stamina',
            'shield': 'Shield',
            'time-slow': 'Time Slow',
            'ball-magnet': 'Ball Magnet',
            'crystal-barrier': 'Crystal Barrier',
            'elemental-mastery': 'Elemental Mastery',
            'tidal-wave': 'Tidal Wave',
            'reality-warp': 'Reality Warp',
            'honey-trap': 'Honey Trap'
        };
        
        return nameMap[icon] || icon.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}