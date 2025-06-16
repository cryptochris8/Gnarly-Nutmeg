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
        if (!source.world || !(source instanceof SoccerPlayerEntity)) return;
        source.speedBoost(this.options.speed);
        source.abilityHolder.removeAbility();
        source.abilityHolder.hideAbilityUI(source.player);
    }
}