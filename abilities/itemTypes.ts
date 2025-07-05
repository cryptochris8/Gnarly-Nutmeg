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

/**
 * Stamina Power-Up Configuration (Arcade Mode Only)
 * 
 * Uses the potion-water model for perfect thematic fit
 * Provides stamina restoration and enhanced regeneration
 */
export const staminaBoostOptions: ItemAbilityOptions = {
    name: "Stamina Potion",
    speed: 1.5,              // 50% stamina enhancement multiplier (using speed field)
    damage: 0,               // No damage - this is a consumable
    modelUri: "models/items/potion-water.gltf", // Perfect model for stamina potion
    modelScale: 0.5,         // Medium size for visibility
    projectileRadius: 0,     // Not a projectile
    knockback: 0,            // No knockback
    lifeTime: 2.0,           // 2 second visual effect duration
    icon: "stamina-potion",  // UI icon identifier
    idleAnimation: "idle",   // Default idle animation (if available)
};