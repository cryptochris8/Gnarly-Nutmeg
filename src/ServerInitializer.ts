/**
 * Server Initialization Module
 * 
 * Handles the setup and initialization of the Hytopia Soccer server.
 * Centralizes server startup logic and world configuration.
 */

import { startServer, Audio } from "hytopia";
import worldMap from "../assets/maps/soccer.json";
import { SoccerGame } from "../state/gameState";
import createSoccerBall from "../utils/ball";
import { BALL_SPAWN_POSITION } from "../state/gameConfig";
import { ModelRegistry } from "hytopia";
import sharedState from "../state/sharedState";
import { ArcadeEnhancementManager } from "../state/arcadeEnhancements";
import { PickupGameManager } from "../state/pickupGameManager";
import { TournamentManager } from "../tournaments/TournamentManager";
import { FIFACrowdManager } from "../audio/FIFACrowdManager";
import { PerformanceProfiler } from "../utils/performanceProfiler";
import { PerformanceOptimizer } from "../utils/performanceOptimizer";
import { MusicSystem } from "../audio/audioManagement";

import { timerManager } from "../utils/TimerManager";
import { errorHandler, ErrorCategory, ErrorSeverity } from "../utils/ErrorHandler";
import { configManager } from "../config/ConfigManager";
import type { SoccerWorld, OptimizationLevel } from "../types/GameTypes";

export class ServerInitializer {
  private world: SoccerWorld | null = null;
  private soccerGame: SoccerGame | null = null;
  private isInitialized = false;

  /**
   * Main server initialization method
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Starting Hytopia Soccer Server initialization...');

      // Phase 1: Pre-load models
      await this.preloadModels();

      // Phase 2: Start server and create world
      await this.initializeServer();

      // Phase 3: Setup game world
      await this.setupGameWorld();

      // Phase 4: Initialize game systems
      await this.initializeGameSystems();

      // Phase 5: Setup performance monitoring
      this.initializePerformanceMonitoring();

      // Phase 6: Initialize audio systems
      await this.initializeAudioSystems();

      // Phase 7: Final setup
      this.finalizeInitialization();

      this.isInitialized = true;
      console.log('✅ Server initialization completed successfully!');

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.CRITICAL,
        'Server initialization failed',
        error,
        { phase: 'initialization' }
      );
      throw error;
    }
  }

  /**
   * Pre-load all game models for better performance
   */
  private async preloadModels(): Promise<void> {
    try {
      console.log('ModelRegistry.preloadModels(): Preloading models...');
      const startTime = Date.now();
      
      // Use the existing ModelRegistry system
      await ModelRegistry.preloadModels();
      
      const loadTime = Date.now() - startTime;
      console.log(`ModelRegistry.preloadModels(): Preloaded models in ${loadTime}ms!`);

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.HIGH,
        'Model preloading failed',
        error
      );
      // Continue initialization even if model preloading fails
    }
  }

  /**
   * Initialize the Hytopia server and world
   */
  private async initializeServer(): Promise<void> {
    console.log('🎮 Starting server and loading soccer stadium...');

    this.world = await startServer({
      map: worldMap,
      port: 8080
    }) as SoccerWorld;

    if (!this.world) {
      throw new Error('Failed to create world instance');
    }

    console.log('✅ Soccer map loaded');
    
    // Enhanced stadium lighting
    this.world.setDirectionalLightIntensity(0.6);
    this.world.setDirectionalLightColor(0xffffff);
    this.world.setAmbientLightIntensity(0.4);
    
    console.log('✅ Enhanced stadium lighting configured');
  }

  /**
   * Setup the game world with ball and goals
   */
  private async setupGameWorld(): Promise<void> {
    if (!this.world) {
      throw new Error('World not initialized');
    }

    console.log('⚽ Creating soccer ball...');

    try {
      // Create and configure the soccer ball
      const ballConfig = configManager.getBallPhysicsConfig('fifa'); // Default to FIFA mode
      console.log('Creating soccer ball with config:', ballConfig);
      
      const ball = createSoccerBall(ballConfig);
      console.log('Ball spawn position:', BALL_SPAWN_POSITION);
      
      // Spawn the ball
      ball.spawn(this.world, BALL_SPAWN_POSITION);
      console.log('Ball spawned successfully at:', ball.position);

      // Store ball reference
      this.world.ball = ball;
      sharedState.setSoccerBall(ball);

      console.log('✅ Soccer ball created and spawned');

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PHYSICS,
        ErrorSeverity.CRITICAL,
        'Failed to create soccer ball',
        error,
        { position: BALL_SPAWN_POSITION }
      );
      throw error;
    }
  }

  /**
   * Initialize core game systems
   */
  private async initializeGameSystems(): Promise<void> {
    if (!this.world) {
      throw new Error('World not initialized');
    }

    console.log('🎯 Initializing game systems...');

    try {
      // Initialize soccer game state
      this.soccerGame = new SoccerGame(this.world);
      (globalThis as any).soccerGame = this.soccerGame;

      // Initialize arcade enhancement manager
      const arcadeManager = new ArcadeEnhancementManager(this.world);
      (this.world as any)._arcadeManager = arcadeManager;
      console.log('ArcadeEnhancementManager initialized - pickup-based abilities only in Arcade Mode');

      // Initialize pickup game manager
      const pickupManager = new PickupGameManager(this.world);
      (this.world as any)._pickupManager = pickupManager;
      console.log('PickupGameManager initialized - active in Arcade Mode only');

      // Initialize tournament manager
      const tournamentConfig = configManager.getTournamentConfig('quickMatch');
      const tournamentManager = new TournamentManager(tournamentConfig);
      (this.world as any)._tournamentManager = tournamentManager;
      console.log('🏆 Tournament manager initialized');

      // Initialize FIFA crowd manager
      const fifaCrowdManager = new FIFACrowdManager(this.world);
      (this.world as any)._fifaCrowdManager = fifaCrowdManager;
      console.log('FIFA Crowd Manager initialized');

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.CRITICAL,
        'Failed to initialize game systems',
        error
      );
      throw error;
    }
  }

  /**
   * Initialize performance monitoring systems
   */
  private initializePerformanceMonitoring(): void {
    if (!this.world) {
      throw new Error('World not initialized');
    }

    console.log('🔍 Initializing performance monitoring...');

    try {
      // Initialize performance profiler
      const performanceProfiler = new PerformanceProfiler();
      (this.world as any)._performanceProfiler = performanceProfiler;
      
      console.log('🔍 Performance Profiler initialized');
      console.log('🚀 Starting performance profiling...');
      
      performanceProfiler.startProfiling();

      // Initialize performance optimizer
      const optimizationLevel: OptimizationLevel = 'HIGH_PERFORMANCE';
      const performanceOptimizer = new PerformanceOptimizer(optimizationLevel);
      (this.world as any)._performanceOptimizer = performanceOptimizer;
      
      console.log(`🎯 Performance Optimizer initialized at ${optimizationLevel} level`);

      // Setup performance monitoring with timer manager
      timerManager.setInterval(() => {
        this.checkPerformanceMetrics();
      }, 30000, 'performance-monitoring'); // Check every 30 seconds

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'Failed to initialize performance monitoring',
        error
      );
      // Continue without performance monitoring if it fails
    }
  }

  /**
   * Initialize audio systems
   */
  private async initializeAudioSystems(): Promise<void> {
    if (!this.world) {
      throw new Error('World not initialized');
    }

    console.log('🎵 Loading audio system...');

    try {
      // Initialize music system
      const musicSystem = new MusicSystem();
      await musicSystem.initialize();
      (this.world as any)._musicSystem = musicSystem;

      console.log('🎵 Music system initialized - gameplay music ready');

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.AUDIO,
        ErrorSeverity.LOW,
        'Failed to initialize audio systems',
        error
      );
      // Continue without audio if it fails
    }
  }

  /**
   * Finalize initialization and setup cleanup handlers
   */
  private finalizeInitialization(): void {
    if (!this.world || !this.soccerGame) {
      throw new Error('Core systems not initialized');
    }

    console.log('🛡️ Setting up server memory management...');

    // Setup cleanup handlers
    this.setupCleanupHandlers();

    // Initialize ball boundary checking with timer manager
    timerManager.setTimeout(() => {
      console.log('Ball initialization complete, enabling boundary checks');
      if (this.world?.ball) {
        console.log('Current ball position:', 
          `x=${this.world.ball.position.x}, y=${this.world.ball.position.y}, z=${this.world.ball.position.z}`);
        
        // Enable ball movement tracking
        this.soccerGame?.enableBallTracking();
      }
    }, 2000, 'ball-initialization');

    console.log('✅ Game initialized successfully with performance optimizations!');
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      console.log('🧹 Server shutdown initiated - cleaning up resources...');
      
      try {
        // Cleanup timer manager
        timerManager.cleanup();
        
        // Cleanup game systems
        if (this.world) {
          const arcadeManager = (this.world as any)._arcadeManager;
          const pickupManager = (this.world as any)._pickupManager;
          const performanceProfiler = (this.world as any)._performanceProfiler;
          
          arcadeManager?.cleanup?.();
          pickupManager?.cleanup?.();
          performanceProfiler?.stopProfiling?.();
        }

        console.log('✅ Server cleanup completed');
      } catch (error) {
        errorHandler.logError(
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.MEDIUM,
          'Error during server cleanup',
          error
        );
      }
    };

    // Register cleanup handlers
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * Check performance metrics and log warnings if needed
   */
  private checkPerformanceMetrics(): void {
    try {
      const performanceProfiler = (this.world as any)?._performanceProfiler;
      if (performanceProfiler) {
        const metrics = performanceProfiler.getMetrics();
        const target = configManager.getPerformanceTarget('HIGH_PERFORMANCE');

        // Check for performance issues
        if (metrics.frameTime > target.targetFrameTime * 1.2) {
          errorHandler.logError(
            ErrorCategory.PERFORMANCE,
            ErrorSeverity.MEDIUM,
            `Frame time exceeded target: ${metrics.frameTime.toFixed(2)}ms vs ${target.targetFrameTime}ms target`,
            undefined,
            { metrics }
          );
        }

        if (metrics.memoryUsage.heapUsed > target.maxMemoryUsage * 0.8) {
          errorHandler.logError(
            ErrorCategory.PERFORMANCE,
            ErrorSeverity.MEDIUM,
            `Memory usage approaching limit: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
            undefined,
            { memoryUsage: metrics.memoryUsage }
          );
        }
      }

      // Check timer manager for potential leaks
      timerManager.checkForLeaks();

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'Error checking performance metrics',
        error
      );
    }
  }

  /**
   * Get the initialized world instance
   */
  getWorld(): SoccerWorld | null {
    return this.world;
  }

  /**
   * Get the initialized soccer game instance
   */
  getSoccerGame(): SoccerGame | null {
    return this.soccerGame;
  }

  /**
   * Check if server is fully initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.world !== null && this.soccerGame !== null;
  }
}

// Export singleton instance
export const serverInitializer = new ServerInitializer();