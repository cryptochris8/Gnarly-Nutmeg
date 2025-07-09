// Game Mode System - Strict Separation Between FIFA and Arcade Modes
// FIFA Mode: Realistic soccer simulation (uses existing settings - NEVER modified)
// Arcade Mode: Enhanced gameplay with abilities and power-ups (completely separate)

import { HALF_DURATION, TOTAL_HALVES, HALFTIME_DURATION } from './gameConfig';

export enum GameMode {
  FIFA = "fifa",
  ARCADE = "arcade",
  TOURNAMENT = "tournament"
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

// Arcade Mode Configuration - Enhanced Fun Soccer with Physical Pickups
export const ARCADE_MODE_CONFIG = {
  name: 'Arcade Mode',
  description: 'Fast-paced enhanced soccer with collectible ability pickups scattered on the field',
  
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
  sprintMultiplier: 1.5,
  
  // Arcade features
  crowdAudio: true,
  announcerCommentary: false, // Focus on gameplay over commentary
  realisticPhysics: false,
  
  // Arcade enhancements - now includes physical pickup system
  powerUps: false, // No random power-ups - physical pickups only
  specialAbilities: true, // Collected abilities from pickups
  enhancedPhysics: true,
  abilityPickups: true, // Physical Mario/Sonic-style pickups on field
  
  // Special arcade timing features
  fastPacedGameplay: true,
  quickRestarts: true
};

// Pickup Mode removed - physical pickups now integrated into Arcade Mode

// Tournament Mode Configuration - Competitive Bracket-Based Soccer
export const TOURNAMENT_MODE_CONFIG = {
  name: 'Tournament Mode',
  description: 'Competitive bracket-based soccer with professional rules and player coordination',
  
  // Tournament timing system - Professional match timing
  halfDuration: HALF_DURATION, // 5 minutes per half
  totalHalves: TOTAL_HALVES, // 2 halves
  halftimeDuration: HALFTIME_DURATION, // 2 minutes halftime break
  
  // Professional physics for competitive play
  ballPhysics: {
    damping: 0.95,
    friction: 0.8,
    bounciness: 0.6
  },
  
  playerSpeed: 1.0,
  sprintMultiplier: 1.5,
  
  // Tournament features
  crowdAudio: true,
  announcerCommentary: true,
  realisticPhysics: true,
  
  // Tournament-specific settings
  powerUps: false, // No power-ups in competitive play
  specialAbilities: false, // No special abilities in competitive play
  enhancedPhysics: false, // Realistic physics for fair competition
  
  // Tournament timing features
  fastPacedGameplay: false,
  quickRestarts: false,
  competitiveMode: true,
  
  // Tournament coordination features
  playerReadyCheck: true, // Players must ready up before matches
  matchScheduling: true, // Matches are scheduled in advance
  bracketProgression: true, // Automatic bracket advancement
  statisticsTracking: true, // Detailed match statistics
  
  // Tournament rules
  forfeitOnNoShow: true, // Players forfeit if not ready
  readyCheckTimeout: 300000, // 5 minutes to ready up
  matchSchedulingDelay: 120000, // 2 minutes between matches
  
  // Tournament data persistence
  persistTournamentData: true,
  persistPlayerStats: true,
  persistMatchHistory: true
};

// Current game mode (defaults to FIFA for safety)
let currentGameMode: GameMode = GameMode.FIFA;

// Safe getter for current mode
export const getCurrentGameMode = (): GameMode => currentGameMode;

// Safe getter for current config
export const getCurrentModeConfig = () => {
  switch (currentGameMode) {
    case GameMode.FIFA:
      return FIFA_MODE_CONFIG;
    case GameMode.ARCADE:
      return ARCADE_MODE_CONFIG;
    case GameMode.TOURNAMENT:
      return TOURNAMENT_MODE_CONFIG;
    default:
      return FIFA_MODE_CONFIG; // Default fallback
  }
};

// Safe mode switching function
export const setGameMode = (mode: GameMode): void => {
  console.log(`Switching from ${currentGameMode} to ${mode} mode`);
  currentGameMode = mode;
};

// Helper functions for mode checking (used throughout codebase)
export const isFIFAMode = (): boolean => currentGameMode === GameMode.FIFA;
export const isArcadeMode = (): boolean => currentGameMode === GameMode.ARCADE;
export const isTournamentMode = (): boolean => currentGameMode === GameMode.TOURNAMENT;

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