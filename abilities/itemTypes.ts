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
    modelUri: "misc/firework.gltf",
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
    modelUri: "projectiles/energy-orb-projectile.gltf", // Use energy orb as potion substitute
    modelScale: 0.5,         // Medium size for visibility
    projectileRadius: 0,     // Not a projectile
    knockback: 0,            // No knockback
    lifeTime: 2.0,           // 2 second visual effect duration
    icon: "stamina-potion",  // UI icon identifier
    idleAnimation: "floating",   // Default idle animation
};

// ====== ENHANCED POWER-UPS ======

/**
 * Time Manipulation Power-Up (Clock)
 * Slows down all other players while you move normally
 */
export const timeSlowOptions: ItemAbilityOptions = {
    name: "Time Slow",
    speed: 0.3,              // Time scale factor for other players
    damage: 8000,            // Duration in milliseconds
    modelUri: "misc/selection-indicator.gltf", // Use selection indicator as clock substitute
    modelScale: 0.6,
    projectileRadius: 0,
    knockback: 0,
    lifeTime: 8.0,           // 8 second effect duration
    icon: "time-slow",
    idleAnimation: "floating",
};

/**
 * Magnetic Field Control Power-Up (Compass)
 * Ball automatically follows you like a magnet
 */
export const ballMagnetOptions: ItemAbilityOptions = {
    name: "Ball Magnet",
    speed: 10,               // Magnetic pull force
    damage: 10000,           // Duration in milliseconds
    modelUri: "misc/range-indicator-dot-green.gltf", // Use green dot as compass substitute
    modelScale: 0.5,
    projectileRadius: 5.0,   // Magnetic field radius
    knockback: 0,
    lifeTime: 10.0,          // 10 second effect duration
    icon: "ball-magnet",
    idleAnimation: "floating",
};

/**
 * Celestial Star Power (Golden Apple)
 * Creates star rain and allows stellar dash teleportation
 */
export const starRainOptions: ItemAbilityOptions = {
    name: "Star Rain",
    speed: 15,               // Teleport range
    damage: 20,              // Star projectile damage
    modelUri: "projectiles/energy-orb-projectile.gltf", // Use energy orb as golden apple substitute
    modelScale: 0.4,
    projectileRadius: 2.0,   // Star explosion radius
    knockback: 1.2,          // Star knockback force
    lifeTime: 3.0,           // Star rain duration
    icon: "star-rain",
    idleAnimation: "floating",
};

/**
 * Crystal Resonance Power-Up (Diamond Sword)
 * Creates crystal barriers and allows phasing through objects
 */
export const crystalBarrierOptions: ItemAbilityOptions = {
    name: "Crystal Barrier",
    speed: 5,                // Phase duration in seconds
    damage: 15000,           // Barrier duration in milliseconds
    modelUri: "misc/sword.gltf", // Use existing sword as diamond sword substitute
    modelScale: 0.3,
    projectileRadius: 1.5,   // Barrier thickness
    knockback: 0,
    lifeTime: 15.0,          // Barrier lifetime
    icon: "crystal-barrier",
    idleAnimation: "floating",
};

/**
 * Elemental Mastery Power-Up (Magic Circle)
 * Changes field physics and creates elemental effects
 */
export const elementalMasteryOptions: ItemAbilityOptions = {
    name: "Elemental Mastery",
    speed: 0.5,              // Gravity multiplier
    damage: 12000,           // Duration in milliseconds
    modelUri: "misc/selection-indicator.gltf", // Use selection indicator as magic circle substitute
    modelScale: 1.0,
    projectileRadius: 8.0,   // Effect area radius
    knockback: 0.8,
    lifeTime: 12.0,          // Effect duration
    icon: "elemental-mastery",
    idleAnimation: "floating",
};

/**
 * Aquatic Powers (Milk Bottle)
 * Creates splash zones and tidal wave effects
 */
export const tidalWaveOptions: ItemAbilityOptions = {
    name: "Tidal Wave",
    speed: 12,               // Wave force
    damage: 6000,            // Splash zone duration in milliseconds
    modelUri: "projectiles/energy-orb-projectile.gltf", // Use energy orb as milk bottle substitute
    modelScale: 0.4,
    projectileRadius: 6.0,   // Splash zone radius
    knockback: 1.5,          // Wave knockback
    lifeTime: 6.0,           // Splash zone duration
    icon: "tidal-wave",
    idleAnimation: "floating",
};

/**
 * Reality Warping Power-Up (Map/Scroll)
 * Creates portals and field manipulation effects
 */
export const realityWarpOptions: ItemAbilityOptions = {
    name: "Reality Warp",
    speed: 20,               // Portal teleport range
    damage: 15000,           // Portal duration in milliseconds
    modelUri: "misc/selection-indicator.gltf", // Use selection indicator as map/scroll substitute
    modelScale: 0.5,
    projectileRadius: 2.0,   // Portal radius
    knockback: 0,
    lifeTime: 15.0,          // Portal lifetime
    icon: "reality-warp",
    idleAnimation: "floating",
};

/**
 * Sticky Situations Power-Up (Golden Carrot)
 * Creates honey traps and attraction fields
 */
export const honeyTrapOptions: ItemAbilityOptions = {
    name: "Honey Trap",
    speed: 0.3,              // Movement slow factor
    damage: 10000,           // Trap duration in milliseconds
    modelUri: "misc/range-indicator-dot-green.gltf", // Use green dot as golden carrot substitute
    modelScale: 0.4,
    projectileRadius: 4.0,   // Trap radius
    knockback: 0,
    lifeTime: 10.0,          // Trap lifetime
    icon: "honey-trap",
    idleAnimation: "floating",
};

// Array of all available power-up options for easy access
export const ALL_POWERUP_OPTIONS: ItemAbilityOptions[] = [
    // Original power-ups (keeping for compatibility)
    speedBoostOptions,
    shurikenThrowOptions,
    freezeBlastOptions,
    fireballOptions,
    megaKickOptions,
    powerBoostOptions,
    precisionOptions,
    staminaOptions,
    shieldOptions,
    staminaBoostOptions,
    
    // Enhanced power-ups
    timeSlowOptions,
    ballMagnetOptions,
    starRainOptions,
    crystalBarrierOptions,
    elementalMasteryOptions,
    tidalWaveOptions,
    realityWarpOptions,
    honeyTrapOptions
];

// Enhanced power-ups only (for premium arcade mode)
export const ENHANCED_POWERUP_OPTIONS: ItemAbilityOptions[] = [
    timeSlowOptions,
    ballMagnetOptions,
    starRainOptions,
    crystalBarrierOptions,
    elementalMasteryOptions,
    tidalWaveOptions,
    realityWarpOptions,
    honeyTrapOptions
];
