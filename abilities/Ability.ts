import { Entity, type Vector3Like } from "hytopia";

export interface Ability {
    use(origin: Vector3Like, direction: Vector3Like, source: Entity): void;

    getIcon(): string;
}
