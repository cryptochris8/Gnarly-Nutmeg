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
    modelScale: 0.15, // Increased for better visibility
    projectileRadius: 1,
    knockback: 0.6,
    lifeTime: 1.5,
    icon: "speed-boost",
    idleAnimation: "Take 001",
};

export const freezeBlastOptions: ItemAbilityOptions = {
    name: "Freeze Blast",
    speed: 8,
    damage: 10,
    modelUri: "models/projectiles/energy-orb-projectile.gltf",
    modelScale: 0.3,
    projectileRadius: 1.2,
    knockback: 0.3,
    lifeTime: 2.0,
    icon: "freeze-blast",
    idleAnimation: "floating",
};

export const fireballOptions: ItemAbilityOptions = {
    name: "Fireball",
    speed: 10,
    damage: 20,
    modelUri: "models/projectiles/fireball.gltf",
    modelScale: 0.5,
    projectileRadius: 1.5,
    knockback: 0.8,
    lifeTime: 1.8,
    icon: "fireball",
    idleAnimation: "floating",
};

export const megaKickOptions: ItemAbilityOptions = {
    name: "Mega Kick",
    speed: 0,
    damage: 25,
    modelUri: "models/soccer/scene.gltf",
    modelScale: 0.2,
    projectileRadius: 0.8,
    knockback: 1.0,
    lifeTime: 0,
    icon: "mega-kick",
    idleAnimation: "floating",
};

export const powerBoostOptions: ItemAbilityOptions = {
    name: "Power Boost",
    speed: 0,
    damage: 30,
    modelUri: "models/misc/firework.gltf",
    modelScale: 0.3,
    projectileRadius: 0,
    knockback: 0,
    lifeTime: 0,
    icon: "power-boost",
    idleAnimation: "floating",
};

export const precisionOptions: ItemAbilityOptions = {
    name: "Precision",
    speed: 0,
    damage: 0,
    modelUri: "models/misc/range-indicator-dot-green.gltf",
    modelScale: 0.4,
    projectileRadius: 0,
    knockback: 0,
    lifeTime: 0,
    icon: "precision",
    idleAnimation: "floating",
};

export const staminaOptions: ItemAbilityOptions = {
    name: "Stamina",
    speed: 0,
    damage: 0,
    modelUri: "models/speed/speed.gltf",
    modelScale: 0.12, // Increased from 0.08 for better visibility
    projectileRadius: 0,
    knockback: 0,
    lifeTime: 0,
    icon: "stamina",
    idleAnimation: "Take 001",
};

export const shieldOptions: ItemAbilityOptions = {
    name: "Shield",
    speed: 0,
    damage: 0,
    modelUri: "models/misc/selection-indicator.gltf",
    modelScale: 0.6,
    projectileRadius: 0,
    knockback: 0,
    lifeTime: 0,
    icon: "shield",
    idleAnimation: "floating",
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

// Array of all available power-up options for easy access
export const ALL_POWERUP_OPTIONS: ItemAbilityOptions[] = [
    speedBoostOptions,
    shurikenThrowOptions,
    freezeBlastOptions,
    fireballOptions,
    megaKickOptions,
    powerBoostOptions,
    precisionOptions,
    staminaOptions,
    shieldOptions,
    staminaBoostOptions
];
