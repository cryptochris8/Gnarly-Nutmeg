export interface ItemAbilityOptions {
    name: string;
    speed: number;
    damage: number;
    modelUri: string;
    modelScale: number;
    projectileRadius: number;
    knockback: number;
    lifeTime: number;
    torque?: number;
    icon: string;
    idleAnimation: string;
}

export const shurikenThrowOptions: ItemAbilityOptions = {
    name: "Shuriken",
    speed: 12,
    damage: 15,
    modelUri: "models/projectiles/shuriken.gltf",
    modelScale: 0.4,
    projectileRadius: 1,
    knockback: 0.6,
    lifeTime: 1.5,
    icon: "shuriken-icon",
    idleAnimation: "floating",
};

export const speedBoostOptions: ItemAbilityOptions = {
    name: "Speed Boost",
    speed: 5,
    damage: 15,
    modelUri: "models/speed/speed.gltf",
    modelScale: 0.1,
    projectileRadius: 1,
    knockback: 0.6,
    lifeTime: 1.5,
    icon: "speed-boost",
    idleAnimation: "Take 001",
};