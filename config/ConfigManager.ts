/**
 * Centralized Configuration Management System
 * 
 * Consolidates all game configurations into a single, type-safe system.
 * Provides validation, environment-specific overrides, and runtime configuration updates.
 */

import type { 
  GameModeConfig, 
  BallPhysicsConfig, 
  AudioConfig, 
  PerformanceTarget,
  OptimizationLevel,
  TournamentConfig,
  ValidationResult,
  ConfigurationError
} from '../types/GameTypes';

// ========== CORE GAME CONFIGURATIONS ==========

export const GAME_TIMING = {
  HALF_DURATION: 45 * 60 * 1000,    // 45 minutes in milliseconds
  TOTAL_HALVES: 2,
  HALFTIME_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
  INJURY_TIME_MAX: 5 * 60 * 1000,    // 5 minutes max injury time
  TOURNAMENT_MATCH_DURATION: 10 * 60 * 1000 // 10 minutes for tournament matches
} as const;

export const FIELD_DIMENSIONS = {
  LENGTH: 105,           // FIFA standard field length in meters
  WIDTH: 68,             // FIFA standard field width in meters
  GOAL_WIDTH: 7.32,      // FIFA standard goal width
  GOAL_HEIGHT: 2.44,     // FIFA standard goal height
  PENALTY_AREA_LENGTH: 16.5,
  PENALTY_AREA_WIDTH: 40.32,
  CENTER_CIRCLE_RADIUS: 9.15
} as const;

export const PLAYER_LIMITS = {
  MAX_PLAYERS_PER_TEAM: 11,
  MIN_PLAYERS_PER_TEAM: 1,
  MAX_TOTAL_PLAYERS: 22,
  MAX_SPECTATORS: 50,
  MAX_AI_PLAYERS: 20
} as const;

// ========== BALL PHYSICS CONFIGURATIONS ==========

export const BALL_PHYSICS_CONFIGS: Record<string, BallPhysicsConfig> = {
  fifa: {
    scale: 0.2,
    radius: 0.2,
    friction: 0.4,
    linearDamping: 0.7,
    angularDamping: 3,
    horizontalForce: 0.4,
    verticalForce: 0.6,
    upwardBias: 0.2
  },
  arcade: {
    scale: 0.2,
    radius: 0.2,
    friction: 0.3,
    linearDamping: 0.5,
    angularDamping: 2.5,
    horizontalForce: 0.6,
    verticalForce: 0.8,
    upwardBias: 0.3
  },
  tournament: {
    scale: 0.2,
    radius: 0.2,
    friction: 0.45,
    linearDamping: 0.75,
    angularDamping: 3.2,
    horizontalForce: 0.35,
    verticalForce: 0.55,
    upwardBias: 0.15
  }
};

// ========== GAME MODE CONFIGURATIONS ==========

export const GAME_MODE_CONFIGS: Record<string, GameModeConfig> = {
  fifa: {
    realisticPhysics: true,
    enhancedAbilities: false,
    aiEnabled: true,
    powerUpsEnabled: false,
    tournamentMode: false,
    ballPhysics: BALL_PHYSICS_CONFIGS.fifa,
    audioConfig: {
      masterVolume: 1.0,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      crowdVolume: 0.9,
      commentaryEnabled: true,
      crowdReactionsEnabled: true
    }
  },
  arcade: {
    realisticPhysics: false,
    enhancedAbilities: true,
    aiEnabled: true,
    powerUpsEnabled: true,
    tournamentMode: false,
    ballPhysics: BALL_PHYSICS_CONFIGS.arcade,
    audioConfig: {
      masterVolume: 1.0,
      musicVolume: 0.8,
      sfxVolume: 1.0,
      crowdVolume: 0.7,
      commentaryEnabled: false,
      crowdReactionsEnabled: true
    }
  },
  tournament: {
    realisticPhysics: true,
    enhancedAbilities: false,
    aiEnabled: false,
    powerUpsEnabled: false,
    tournamentMode: true,
    ballPhysics: BALL_PHYSICS_CONFIGS.tournament,
    audioConfig: {
      masterVolume: 1.0,
      musicVolume: 0.6,
      sfxVolume: 0.9,
      crowdVolume: 1.0,
      commentaryEnabled: true,
      crowdReactionsEnabled: true
    }
  }
};

// ========== PERFORMANCE CONFIGURATIONS ==========

export const PERFORMANCE_TARGETS: Record<OptimizationLevel, PerformanceTarget> = {
  HIGH_PERFORMANCE: {
    targetFrameTime: 16.67,    // 60 FPS
    maxAIDecisionTime: 20,     // 20ms per AI decision
    maxPhysicsTime: 10,        // 10ms per physics step
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    maxEntityCount: 200
  },
  BALANCED: {
    targetFrameTime: 20,       // 50 FPS
    maxAIDecisionTime: 30,     // 30ms per AI decision
    maxPhysicsTime: 15,        // 15ms per physics step
    maxMemoryUsage: 768 * 1024 * 1024, // 768MB
    maxEntityCount: 300
  },
  HIGH_QUALITY: {
    targetFrameTime: 33.33,    // 30 FPS
    maxAIDecisionTime: 50,     // 50ms per AI decision
    maxPhysicsTime: 25,        // 25ms per physics step
    maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
    maxEntityCount: 500
  },
  MOBILE: {
    targetFrameTime: 33.33,    // 30 FPS for mobile
    maxAIDecisionTime: 40,     // 40ms per AI decision
    maxPhysicsTime: 20,        // 20ms per physics step
    maxMemoryUsage: 256 * 1024 * 1024, // 256MB for mobile
    maxEntityCount: 150
  }
};

// ========== AI CONFIGURATION ==========

export const AI_CONFIG = {
  DECISION_INTERVALS: {
    HIGH_PERFORMANCE: 100,     // 100ms between decisions
    BALANCED: 150,             // 150ms between decisions
    HIGH_QUALITY: 200,         // 200ms between decisions
    MOBILE: 250                // 250ms between decisions (battery saving)
  },
  BEHAVIOR_WEIGHTS: {
    ATTACK: 0.7,
    DEFENSE: 0.8,
    SUPPORT: 0.6,
    POSITIONING: 0.9
  },
  DIFFICULTY_MULTIPLIERS: {
    EASY: 0.6,
    MEDIUM: 0.8,
    HARD: 1.0,
    EXPERT: 1.2
  }
} as const;

// ========== TOURNAMENT CONFIGURATIONS ==========

export const TOURNAMENT_CONFIGS: Record<string, TournamentConfig> = {
  quickMatch: {
    name: 'Quick Match',
    maxPlayers: 8,
    matchDuration: GAME_TIMING.TOURNAMENT_MATCH_DURATION,
    eliminationRounds: false,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0
  },
  championship: {
    name: 'Championship Tournament',
    maxPlayers: 16,
    matchDuration: GAME_TIMING.HALF_DURATION * 2,
    eliminationRounds: true,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0
  },
  worldCup: {
    name: 'World Cup Style',
    maxPlayers: 32,
    matchDuration: GAME_TIMING.HALF_DURATION * 2,
    eliminationRounds: true,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0
  }
};

// ========== CONFIGURATION MANAGER CLASS ==========

export class ConfigManager {
  private static instance: ConfigManager;
  private currentConfig: Record<string, unknown> = {};
  private environmentOverrides: Record<string, unknown> = {};

  private constructor() {
    this.loadEnvironmentOverrides();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load environment-specific configuration overrides
   */
  private loadEnvironmentOverrides(): void {
    // Check for environment variables and apply overrides
    const env = process.env.NODE_ENV || 'development';
    
    if (env === 'development') {
      this.environmentOverrides = {
        debugMode: true,
        logLevel: 'debug',
        performanceTargets: PERFORMANCE_TARGETS.HIGH_QUALITY
      };
    } else if (env === 'production') {
      this.environmentOverrides = {
        debugMode: false,
        logLevel: 'error',
        performanceTargets: PERFORMANCE_TARGETS.HIGH_PERFORMANCE
      };
    }

    console.log(`⚙️ CONFIG: Loaded environment overrides for ${env}`);
  }

  /**
   * Get configuration for a specific game mode
   */
  getGameModeConfig(mode: string): GameModeConfig {
    const config = GAME_MODE_CONFIGS[mode];
    if (!config) {
      throw new Error(`Invalid game mode: ${mode}`);
    }

    // Apply environment overrides
    return this.applyOverrides(config) as GameModeConfig;
  }

  /**
   * Get ball physics configuration
   */
  getBallPhysicsConfig(mode: string): BallPhysicsConfig {
    const config = BALL_PHYSICS_CONFIGS[mode];
    if (!config) {
      throw new Error(`Invalid ball physics mode: ${mode}`);
    }

    return this.applyOverrides(config) as BallPhysicsConfig;
  }

  /**
   * Get performance target configuration
   */
  getPerformanceTarget(level: OptimizationLevel): PerformanceTarget {
    const config = PERFORMANCE_TARGETS[level];
    if (!config) {
      throw new Error(`Invalid optimization level: ${level}`);
    }

    return this.applyOverrides(config) as PerformanceTarget;
  }

  /**
   * Get tournament configuration
   */
  getTournamentConfig(type: string): TournamentConfig {
    const config = TOURNAMENT_CONFIGS[type];
    if (!config) {
      throw new Error(`Invalid tournament type: ${type}`);
    }

    return this.applyOverrides(config) as TournamentConfig;
  }

  /**
   * Apply environment overrides to configuration
   */
  private applyOverrides<T>(config: T): T {
    return { ...config, ...this.environmentOverrides };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(path: string, value: unknown): void {
    this.currentConfig[path] = value;
    console.log(`⚙️ CONFIG UPDATE: ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * Get current configuration value
   */
  getConfig(path: string, defaultValue?: unknown): unknown {
    return this.currentConfig[path] ?? defaultValue;
  }

  /**
   * Validate configuration integrity
   */
  validateConfiguration(): ValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    // Validate game mode configurations
    for (const [mode, config] of Object.entries(GAME_MODE_CONFIGS)) {
      if (!config.ballPhysics) {
        errors.push({
          path: `gameMode.${mode}.ballPhysics`,
          expected: 'BallPhysicsConfig',
          actual: config.ballPhysics,
          message: 'Ball physics configuration is required'
        });
      }

      if (!config.audioConfig) {
        errors.push({
          path: `gameMode.${mode}.audioConfig`,
          expected: 'AudioConfig',
          actual: config.audioConfig,
          message: 'Audio configuration is required'
        });
      }
    }

    // Validate performance targets
    for (const [level, target] of Object.entries(PERFORMANCE_TARGETS)) {
      if (target.targetFrameTime <= 0) {
        errors.push({
          path: `performance.${level}.targetFrameTime`,
          expected: 'positive number',
          actual: target.targetFrameTime,
          message: 'Target frame time must be positive'
        });
      }

      if (target.maxMemoryUsage <= 0) {
        errors.push({
          path: `performance.${level}.maxMemoryUsage`,
          expected: 'positive number',
          actual: target.maxMemoryUsage,
          message: 'Max memory usage must be positive'
        });
      }
    }

    // Add warnings for potential issues
    if (PERFORMANCE_TARGETS.MOBILE.maxMemoryUsage > 512 * 1024 * 1024) {
      warnings.push('Mobile memory target may be too high for some devices');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Export current configuration for debugging
   */
  exportConfiguration(): string {
    const config = {
      gameModes: GAME_MODE_CONFIGS,
      ballPhysics: BALL_PHYSICS_CONFIGS,
      performance: PERFORMANCE_TARGETS,
      tournaments: TOURNAMENT_CONFIGS,
      ai: AI_CONFIG,
      timing: GAME_TIMING,
      field: FIELD_DIMENSIONS,
      playerLimits: PLAYER_LIMITS,
      environmentOverrides: this.environmentOverrides,
      currentConfig: this.currentConfig
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.currentConfig = {};
    this.loadEnvironmentOverrides();
    console.log('⚙️ CONFIG: Reset to defaults');
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();

// Export convenience functions
export const getGameModeConfig = (mode: string) => configManager.getGameModeConfig(mode);
export const getBallPhysicsConfig = (mode: string) => configManager.getBallPhysicsConfig(mode);
export const getPerformanceTarget = (level: OptimizationLevel) => configManager.getPerformanceTarget(level);
export const getTournamentConfig = (type: string) => configManager.getTournamentConfig(type);