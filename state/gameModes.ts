// Game Mode System - Strict Separation Between FIFA and Arcade Modes
// FIFA Mode: Realistic soccer simulation (uses existing settings - NEVER modified)
// Arcade Mode: Enhanced gameplay with abilities and power-ups (completely separate)

export enum GameMode {
  FIFA = "fifa",
  ARCADE = "arcade"
}

// FIFA Mode Configuration - Uses existing settings (PROTECTED - DO NOT MODIFY)
export const FIFA_MODE_CONFIG = {
  mode: GameMode.FIFA,
  name: "FIFA Mode",
  description: "Realistic soccer simulation",
  
  // Match settings
  matchDuration: 5 * 60, // 5 minutes (current setting)
  
  // Features (FIFA mode has none of these)
  enableAbilities: false,
  enablePowerUps: false,
  enableSpecialMoves: false,
  enableParticleEffects: false,
  
  // Physics (uses existing BALL_CONFIG - never modified)
  useEnhancedPhysics: false,
  
  // Audio (uses current system)
  enhancedAudio: false,
  
  // UI (minimal, realistic)
  showPowerUpHUD: false,
  showAbilityIcons: false,
  showStylePoints: false
} as const;

// Arcade Mode Configuration - Enhanced gameplay (SEPARATE from FIFA)
export const ARCADE_MODE_CONFIG = {
  mode: GameMode.ARCADE,
  name: "Arcade Mode",
  description: "Fast-paced soccer with power-ups and abilities",
  
  // Match settings (shorter, more action-packed)
  matchDuration: 3 * 60, // 3 minutes for quick matches
  
  // Enhanced features (only in arcade mode)
  enableAbilities: true,
  enablePowerUps: true,
  enableSpecialMoves: true,
  enableParticleEffects: true,
  
  // Enhanced physics (separate from FIFA)
  useEnhancedPhysics: true,
  
  // Enhanced audio
  enhancedAudio: true,
  
  // Enhanced UI
  showPowerUpHUD: true,
  showAbilityIcons: true,
  showStylePoints: true,
  
  // Arcade-specific settings
  powerUpSpawnInterval: 30, // seconds
  abilityRespawnTime: 15, // seconds
  maxPowerUpsOnField: 4,
  stylePointMultiplier: 1.5
} as const;

// Current game mode (defaults to FIFA for safety)
let currentGameMode: GameMode = GameMode.FIFA;

// Safe getter for current mode
export const getCurrentGameMode = (): GameMode => currentGameMode;

// Safe getter for current config
export const getCurrentModeConfig = () => {
  return currentGameMode === GameMode.FIFA ? FIFA_MODE_CONFIG : ARCADE_MODE_CONFIG;
};

// Safe mode switching function
export const setGameMode = (mode: GameMode): void => {
  console.log(`Switching from ${currentGameMode} to ${mode} mode`);
  currentGameMode = mode;
};

// Helper functions for mode checking (used throughout codebase)
export const isFIFAMode = (): boolean => currentGameMode === GameMode.FIFA;
export const isArcadeMode = (): boolean => currentGameMode === GameMode.ARCADE;

// Enhanced ball physics for arcade mode only (FIFA uses existing BALL_CONFIG)
export const ARCADE_BALL_CONFIG = {
  // Enhanced ball properties for arcade mode
  SCALE: 0.2,
  RADIUS: 0.2,
  FRICTION: 0.3, // Slightly less friction for faster gameplay
  
  // Enhanced movement for arcade
  LINEAR_DAMPING: 0.6, // Less damping for more dynamic movement
  ANGULAR_DAMPING: 2.5, // Less angular damping for more spin effects
  
  // Enhanced impact forces for arcade
  HORIZONTAL_FORCE: 0.5, // More bouncing for arcade feel
  VERTICAL_FORCE: 0.7, // Higher bounces
  UPWARD_BIAS: 0.25, // More upward bias for dramatic effects
};

// Power-up configurations (only used in arcade mode)
export const POWER_UP_CONFIGS = {
  SPEED_BOOST: {
    name: "Speed Boost",
    duration: 5000, // 5 seconds
    speedMultiplier: 1.8,
    icon: "speed-boost",
    color: "#00FF00",
    particleEffect: "speed-trail"
  },
  
  SUPER_SHOT: {
    name: "Super Shot",
    duration: 10000, // 10 seconds
    powerMultiplier: 2.0,
    icon: "super-shot",
    color: "#FF4444",
    particleEffect: "power-glow"
  },
  
  SHIELD: {
    name: "Shield",
    duration: 8000, // 8 seconds
    invulnerability: true,
    icon: "shield",
    color: "#4444FF",
    particleEffect: "shield-aura"
  },
  
  TELEPORT: {
    name: "Teleport",
    cooldown: 15000, // 15 second cooldown
    range: 20, // units
    icon: "teleport",
    color: "#FF00FF",
    particleEffect: "teleport-flash"
  }
};

// Arcade-specific physics multipliers (never affects FIFA mode)
export const ARCADE_PHYSICS_MULTIPLIERS = {
  SHOT_POWER: 1.3, // 30% more powerful shots
  PASS_SPEED: 1.2, // 20% faster passes
  PLAYER_SPEED: 1.1, // 10% faster movement
  JUMP_HEIGHT: 1.4, // 40% higher jumps for headers
  BALL_SPIN: 1.5 // 50% more ball spin effects
}; 