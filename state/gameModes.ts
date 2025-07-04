// Game Mode System - Strict Separation Between FIFA and Arcade Modes
// FIFA Mode: Realistic soccer simulation (uses existing settings - NEVER modified)
// Arcade Mode: Enhanced gameplay with abilities and power-ups (completely separate)

import { HALF_DURATION, TOTAL_HALVES, HALFTIME_DURATION } from './gameConfig';

export enum GameMode {
  FIFA = "fifa",
  ARCADE = "arcade"
}

// FIFA Mode Configuration - Realistic Soccer
export const FIFA_MODE_CONFIG = {
  name: 'FIFA Mode',
  description: 'Realistic soccer with professional rules and timing',
  
  // Timing system - 2 halves of 5 minutes each
  halfDuration: HALF_DURATION, // 5 minutes per half
  totalHalves: TOTAL_HALVES, // 2 halves
  halftimeDuration: HALFTIME_DURATION, // 2 minutes halftime break
  
  // Realistic physics and gameplay
  ballPhysics: {
    damping: 0.95,
    friction: 0.8,
    bounciness: 0.6
  },
  
  playerSpeed: 1.0,
  sprintMultiplier: 1.5,
  
  // Professional soccer features
  crowdAudio: true,
  announcerCommentary: true,
  realisticPhysics: true,
  
  // No arcade enhancements
  powerUps: false,
  specialAbilities: false,
  enhancedPhysics: false
};

// Arcade Mode Configuration - Enhanced Fun Soccer
export const ARCADE_MODE_CONFIG = {
  name: 'Arcade Mode',
  description: 'Fast-paced soccer with power-ups and special abilities',
  
  // Timing system - Same 2 halves but faster pace
  halfDuration: HALF_DURATION, // 5 minutes per half (consistent with FIFA)
  totalHalves: TOTAL_HALVES, // 2 halves
  halftimeDuration: HALFTIME_DURATION, // 2 minutes halftime break
  
  // Enhanced physics for arcade feel
  ballPhysics: {
    damping: 0.9,
    friction: 0.6,
    bounciness: 0.8
  },
  
  playerSpeed: 1.2,
  sprintMultiplier: 2.0,
  
  // Arcade features
  crowdAudio: true,
  announcerCommentary: false, // Focus on gameplay over commentary
  realisticPhysics: false,
  
  // Arcade enhancements
  powerUps: true,
  specialAbilities: true,
  enhancedPhysics: true,
  
  // Special arcade timing features
  fastPacedGameplay: true,
  quickRestarts: true
};

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