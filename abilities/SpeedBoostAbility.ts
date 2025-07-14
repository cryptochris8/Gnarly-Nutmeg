import type { Ability } from "./Ability";
import type { ItemAbilityOptions } from "./itemTypes";
import { type Vector3Like, type Entity } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";

export class SpeedBoostAbility implements Ability {
    constructor(private options: ItemAbilityOptions) {}
    getIcon(): string {
        return this.options.icon;
    }

    use(origin: Vector3Like, direction: Vector3Like, source: Entity) {
        console.log(`🚀 SPEED BOOST: use() method called!`);
        console.log(`🚀 SPEED BOOST: origin=${JSON.stringify(origin)}, direction=${JSON.stringify(direction)}, source=${source.constructor.name}`);
        
        if (!source.world || !(source instanceof SoccerPlayerEntity)) {
            console.error(`❌ SPEED BOOST: Invalid source entity - world=${!!source.world}, isSoccerPlayer=${source instanceof SoccerPlayerEntity}`);
            return;
        }
        
        console.log(`🚀 SPEED BOOST: Applying speed boost to ${source.player.username} with speed=${this.options.speed}`);
        source.speedBoost(this.options.speed);
        
        console.log(`🚀 SPEED BOOST: Removing ability from player inventory`);
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);
        
        console.log(`✅ SPEED BOOST: Speed boost applied successfully to ${source.player.username}`);
    }
}