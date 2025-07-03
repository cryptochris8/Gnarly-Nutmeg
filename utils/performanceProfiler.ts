import { World } from "hytopia";

/**
 * Performance Profiler for Hytopia Soccer Game
 * Tracks AI decision making, physics calculations, and entity updates
 * Follows Hytopia SDK standards for debugging and performance monitoring
 */

// Performance metrics interface
interface PerformanceMetrics {
  aiDecisionTime: number;
  aiDecisionCount: number;
  physicsUpdateTime: number;
  physicsUpdateCount: number;
  entityTickTime: number;
  entityTickCount: number;
  ballPhysicsTime: number;
  ballPhysicsCount: number;
  totalFrameTime: number;
  frameCount: number;
  memoryUsage?: number;
}

// Performance sampling configuration
interface ProfilerConfig {
  enabled: boolean;
  sampleInterval: number; // milliseconds between samples
  maxSamples: number; // maximum number of samples to keep
  logInterval: number; // milliseconds between console logs
  trackMemory: boolean; // whether to track memory usage
}

// Individual performance sample
interface PerformanceSample {
  timestamp: number;
  metrics: PerformanceMetrics;
  activeAICount: number;
  activeEntityCount: number;
}

export class PerformanceProfiler {
  private config: ProfilerConfig;
  private samples: PerformanceSample[] = [];
  private currentMetrics: PerformanceMetrics;
  private world: World;
  private sampleTimer: Timer | null = null;
  private logTimer: Timer | null = null;
  private frameStartTime: number = 0;
  private isEnabled: boolean = false;

  constructor(world: World, config: Partial<ProfilerConfig> = {}) {
    this.world = world;
    this.config = {
      enabled: false,
      sampleInterval: 1000, // Sample every second
      maxSamples: 60, // Keep 60 samples (1 minute of data)
      logInterval: 10000, // Log every 10 seconds
      trackMemory: true,
      ...config
    };

    this.currentMetrics = this.createEmptyMetrics();
    
    console.log("🔍 Performance Profiler initialized for Hytopia Soccer");
  }

  /**
   * Start performance profiling
   * Begins collecting performance data according to configuration
   */
  public start(): void {
    if (this.isEnabled) {
      console.warn("Performance profiler is already running");
      return;
    }

    this.isEnabled = true;
    this.samples = [];
    this.currentMetrics = this.createEmptyMetrics();
    
    console.log("🚀 Starting performance profiling...");
    console.log(`📊 Sample interval: ${this.config.sampleInterval}ms`);
    console.log(`📈 Max samples: ${this.config.maxSamples}`);
    console.log(`📝 Log interval: ${this.config.logInterval}ms`);

    // Start sampling timer
    this.sampleTimer = setInterval(() => {
      this.takeSample();
    }, this.config.sampleInterval);

    // Start logging timer
    this.logTimer = setInterval(() => {
      this.logPerformanceReport();
    }, this.config.logInterval);
  }

  /**
   * Stop performance profiling
   * Stops collecting data and clears timers
   */
  public stop(): void {
    if (!this.isEnabled) {
      console.warn("Performance profiler is not running");
      return;
    }

    this.isEnabled = false;

    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }

    if (this.logTimer) {
      clearInterval(this.logTimer);
      this.logTimer = null;
    }

    console.log("⏹️ Performance profiling stopped");
    this.logFinalReport();
  }

  /**
   * Record AI decision timing
   * Call this when AI decision making starts and ends
   */
  public recordAIDecision(duration: number): void {
    if (!this.isEnabled) return;
    
    this.currentMetrics.aiDecisionTime += duration;
    this.currentMetrics.aiDecisionCount++;
  }

  /**
   * Record physics update timing
   * Call this when physics calculations start and end
   */
  public recordPhysicsUpdate(duration: number): void {
    if (!this.isEnabled) return;
    
    this.currentMetrics.physicsUpdateTime += duration;
    this.currentMetrics.physicsUpdateCount++;
  }

  /**
   * Record entity tick timing
   * Call this when entity tick processing starts and ends
   */
  public recordEntityTick(duration: number): void {
    if (!this.isEnabled) return;
    
    this.currentMetrics.entityTickTime += duration;
    this.currentMetrics.entityTickCount++;
  }

  /**
   * Record ball physics timing
   * Call this when ball physics calculations start and end
   */
  public recordBallPhysics(duration: number): void {
    if (!this.isEnabled) return;
    
    this.currentMetrics.ballPhysicsTime += duration;
    this.currentMetrics.ballPhysicsCount++;
  }

  /**
   * Record frame timing
   * Call this at the start and end of each frame
   */
  public startFrame(): void {
    if (!this.isEnabled) return;
    this.frameStartTime = performance.now();
  }

  public endFrame(): void {
    if (!this.isEnabled) return;
    
    const frameTime = performance.now() - this.frameStartTime;
    this.currentMetrics.totalFrameTime += frameTime;
    this.currentMetrics.frameCount++;
  }

  /**
   * Get current performance statistics
   * Returns averaged performance data from recent samples
   */
  public getPerformanceStats(): PerformanceStats {
    if (this.samples.length === 0) {
      return this.createEmptyStats();
    }

    const recentSamples = this.samples.slice(-10); // Last 10 samples
    const totalSamples = recentSamples.length;

    const avgMetrics = recentSamples.reduce((acc, sample) => {
      acc.avgAIDecisionTime += sample.metrics.aiDecisionTime / totalSamples;
      acc.avgPhysicsTime += sample.metrics.physicsUpdateTime / totalSamples;
      acc.avgEntityTickTime += sample.metrics.entityTickTime / totalSamples;
      acc.avgBallPhysicsTime += sample.metrics.ballPhysicsTime / totalSamples;
      acc.avgFrameTime += sample.metrics.totalFrameTime / totalSamples;
      acc.avgAICount += sample.activeAICount / totalSamples;
      acc.avgEntityCount += sample.activeEntityCount / totalSamples;
      return acc;
    }, this.createEmptyStats());

    return avgMetrics;
  }

  /**
   * Get detailed performance report
   * Returns comprehensive performance analysis
   */
  public getDetailedReport(): PerformanceReport {
    const stats = this.getPerformanceStats();
    const latestSample = this.samples[this.samples.length - 1];
    
    return {
      timestamp: Date.now(),
      averageStats: stats,
      currentMetrics: latestSample?.metrics || this.createEmptyMetrics(),
      activeAICount: latestSample?.activeAICount || 0,
      activeEntityCount: latestSample?.activeEntityCount || 0,
      sampleCount: this.samples.length,
      recommendations: this.generateRecommendations(stats)
    };
  }

  /**
   * Enable or disable debug rendering for performance visualization
   * Uses Hytopia SDK's built-in debug rendering capabilities
   */
  public toggleDebugRendering(enabled: boolean): void {
    try {
      this.world.simulation.enableDebugRendering(enabled);
      console.log(`🔍 Debug rendering ${enabled ? 'enabled' : 'disabled'}`);
      
      if (enabled) {
        console.warn("⚠️ Debug rendering is performance intensive - use only for debugging");
      }
    } catch (error) {
      console.error("Failed to toggle debug rendering:", error);
    }
  }

  /**
   * Enable debug raycasting for AI pathfinding visualization
   * Uses Hytopia SDK's raycast debugging
   */
  public toggleRaycastDebugging(enabled: boolean): void {
    try {
      this.world.simulation.enableDebugRaycasting(enabled);
      console.log(`🎯 Raycast debugging ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error("Failed to toggle raycast debugging:", error);
    }
  }

  private takeSample(): void {
    if (!this.isEnabled) return;

    // Get current entity counts using Hytopia SDK
    const allEntities = this.world.entityManager.getAllEntities();
    const playerEntities = this.world.entityManager.getAllPlayerEntities();
    
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      metrics: { ...this.currentMetrics },
      activeAICount: playerEntities.filter(entity => 
        entity.constructor.name === 'AIPlayerEntity'
      ).length,
      activeEntityCount: allEntities.length
    };

    // Add memory usage if tracking is enabled
    if (this.config.trackMemory && typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      sample.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // Convert to MB
    }

    this.samples.push(sample);

    // Limit sample count
    if (this.samples.length > this.config.maxSamples) {
      this.samples = this.samples.slice(-this.config.maxSamples);
    }

    // Reset current metrics for next sample period
    this.currentMetrics = this.createEmptyMetrics();
  }

  private logPerformanceReport(): void {
    const report = this.getDetailedReport();
    
    console.log("\n📊 === PERFORMANCE REPORT ===");
    console.log(`🤖 Active AI Players: ${report.activeAICount}`);
    console.log(`🎮 Total Entities: ${report.activeEntityCount}`);
    console.log(`⏱️ Avg AI Decision Time: ${report.averageStats.avgAIDecisionTime.toFixed(2)}ms`);
    console.log(`🔄 Avg Physics Time: ${report.averageStats.avgPhysicsTime.toFixed(2)}ms`);
    console.log(`🎯 Avg Entity Tick Time: ${report.averageStats.avgEntityTickTime.toFixed(2)}ms`);
    console.log(`⚽ Avg Ball Physics Time: ${report.averageStats.avgBallPhysicsTime.toFixed(2)}ms`);
    console.log(`🖼️ Avg Frame Time: ${report.averageStats.avgFrameTime.toFixed(2)}ms`);
    
    if (report.currentMetrics.memoryUsage) {
      console.log(`💾 Memory Usage: ${report.currentMetrics.memoryUsage.toFixed(2)}MB`);
    }

    if (report.recommendations.length > 0) {
      console.log("\n💡 RECOMMENDATIONS:");
      report.recommendations.forEach(rec => console.log(`   ${rec}`));
    }
    
    console.log("=========================\n");
  }

  private logFinalReport(): void {
    const report = this.getDetailedReport();
    
    console.log("\n🏁 === FINAL PERFORMANCE REPORT ===");
    console.log(`📈 Total Samples Collected: ${report.sampleCount}`);
    console.log(`⏱️ Average AI Decision Time: ${report.averageStats.avgAIDecisionTime.toFixed(2)}ms`);
    console.log(`🔄 Average Physics Time: ${report.averageStats.avgPhysicsTime.toFixed(2)}ms`);
    console.log(`🎯 Average Entity Tick Time: ${report.averageStats.avgEntityTickTime.toFixed(2)}ms`);
    console.log(`⚽ Average Ball Physics Time: ${report.averageStats.avgBallPhysicsTime.toFixed(2)}ms`);
    console.log(`🖼️ Average Frame Time: ${report.averageStats.avgFrameTime.toFixed(2)}ms`);
    
    console.log("\n💡 FINAL RECOMMENDATIONS:");
    report.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    console.log("==================================\n");
  }

  private generateRecommendations(stats: PerformanceStats): string[] {
    const recommendations: string[] = [];

    // AI Decision Time Analysis
    if (stats.avgAIDecisionTime > 50) {
      recommendations.push("🤖 AI decision time is high (>50ms). Consider reducing decision frequency or optimizing AI logic.");
    }

    // Physics Analysis
    if (stats.avgPhysicsTime > 30) {
      recommendations.push("🔄 Physics update time is high (>30ms). Consider optimizing collision detection or reducing entity count.");
    }

    // Entity Tick Analysis
    if (stats.avgEntityTickTime > 20) {
      recommendations.push("🎯 Entity tick time is high (>20ms). Consider optimizing entity update logic.");
    }

    // Frame Time Analysis
    if (stats.avgFrameTime > 16.67) {
      recommendations.push("🖼️ Frame time exceeds 60 FPS target (>16.67ms). Overall optimization needed.");
    }

    // AI Count Analysis
    if (stats.avgAICount > 10) {
      recommendations.push("🤖 High AI count detected. Consider reducing AI complexity or decision frequency.");
    }

    return recommendations;
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      aiDecisionTime: 0,
      aiDecisionCount: 0,
      physicsUpdateTime: 0,
      physicsUpdateCount: 0,
      entityTickTime: 0,
      entityTickCount: 0,
      ballPhysicsTime: 0,
      ballPhysicsCount: 0,
      totalFrameTime: 0,
      frameCount: 0
    };
  }

  private createEmptyStats(): PerformanceStats {
    return {
      avgAIDecisionTime: 0,
      avgPhysicsTime: 0,
      avgEntityTickTime: 0,
      avgBallPhysicsTime: 0,
      avgFrameTime: 0,
      avgAICount: 0,
      avgEntityCount: 0
    };
  }
}

// Type definitions for performance data
interface PerformanceStats {
  avgAIDecisionTime: number;
  avgPhysicsTime: number;
  avgEntityTickTime: number;
  avgBallPhysicsTime: number;
  avgFrameTime: number;
  avgAICount: number;
  avgEntityCount: number;
}

interface PerformanceReport {
  timestamp: number;
  averageStats: PerformanceStats;
  currentMetrics: PerformanceMetrics;
  activeAICount: number;
  activeEntityCount: number;
  sampleCount: number;
  recommendations: string[];
}

// Timer type for Node.js compatibility
type Timer = ReturnType<typeof setTimeout>;

export default PerformanceProfiler; 