/**
 * Performance Optimization Configuration for Hytopia Soccer
 * Provides tunable parameters and optimization helpers
 * Follows Hytopia SDK standards for performance best practices
 */

// Performance thresholds and targets
export const PERFORMANCE_TARGETS = {
  // Target frame time for 60 FPS
  TARGET_FRAME_TIME: 16.67, // milliseconds
  
  // AI decision timing targets
  AI_DECISION_TARGET: 30, // milliseconds per decision
  AI_DECISION_WARNING: 50, // milliseconds - warn if exceeded
  AI_DECISION_CRITICAL: 100, // milliseconds - critical performance issue
  
  // Physics timing targets
  PHYSICS_TARGET: 20, // milliseconds per update
  PHYSICS_WARNING: 30, // milliseconds - warn if exceeded
  PHYSICS_CRITICAL: 50, // milliseconds - critical performance issue
  
  // Entity tick timing targets
  ENTITY_TICK_TARGET: 10, // milliseconds per tick
  ENTITY_TICK_WARNING: 20, // milliseconds - warn if exceeded
  ENTITY_TICK_CRITICAL: 40, // milliseconds - critical performance issue
  
  // Ball physics timing targets
  BALL_PHYSICS_TARGET: 5, // milliseconds per update
  BALL_PHYSICS_WARNING: 10, // milliseconds - warn if exceeded
  BALL_PHYSICS_CRITICAL: 20, // milliseconds - critical performance issue
};

// Optimization levels for different performance scenarios
export const OPTIMIZATION_LEVELS = {
  HIGH_PERFORMANCE: {
    name: "High Performance",
    description: "Maximum performance, reduced visual fidelity",
    aiDecisionInterval: 750, // Slower AI decisions
    maxAIPlayers: 8, // Fewer AI players
    debugRenderingEnabled: false,
    raycastDebuggingEnabled: false,
    ballPhysicsQuality: "reduced",
    entityUpdateFrequency: "reduced"
  },
  
  BALANCED: {
    name: "Balanced",
    description: "Good balance of performance and quality",
    aiDecisionInterval: 500, // Normal AI decisions
    maxAIPlayers: 10, // Normal AI count
    debugRenderingEnabled: false,
    raycastDebuggingEnabled: false,
    ballPhysicsQuality: "normal",
    entityUpdateFrequency: "normal"
  },
  
  HIGH_QUALITY: {
    name: "High Quality",
    description: "Best visual quality, may impact performance",
    aiDecisionInterval: 250, // Faster AI decisions
    maxAIPlayers: 12, // More AI players
    debugRenderingEnabled: false,
    raycastDebuggingEnabled: false,
    ballPhysicsQuality: "enhanced",
    entityUpdateFrequency: "enhanced"
  },
  
  DEVELOPMENT: {
    name: "Development",
    description: "Debug mode with all visualizations enabled",
    aiDecisionInterval: 500, // Normal AI decisions
    maxAIPlayers: 10, // Normal AI count
    debugRenderingEnabled: true,
    raycastDebuggingEnabled: true,
    ballPhysicsQuality: "normal",
    entityUpdateFrequency: "normal"
  },

  // ===== PHASE 1 MOBILE PERFORMANCE MODE =====
  MOBILE_OPTIMIZED: {
    name: "Mobile Optimized",
    description: "Optimized for mobile devices with touch controls",
    aiDecisionInterval: 750, // Slower AI decisions to save battery
    maxAIPlayers: 8, // Fewer AI players for better mobile performance
    debugRenderingEnabled: false,
    raycastDebuggingEnabled: false,
    ballPhysicsQuality: "mobile", // New mobile physics quality
    entityUpdateFrequency: "mobile", // New mobile update frequency
    
    // Mobile-specific optimizations
    mobileOptimizations: {
      reducedParticleEffects: true, // Reduce particle effects for battery
      simplifiedLighting: true, // Simpler lighting calculations
      reducedShadowQuality: true, // Lower shadow quality
      optimizedAudio: true, // Optimized audio for mobile
      touchInputOptimized: true, // Optimized for touch input
      batteryOptimized: true, // General battery optimization
      reducedNetworkUpdates: true, // Fewer network updates
      compressedTextures: true, // Use compressed textures
      lowerPolyModels: true, // Use lower polygon count models
      reducedViewDistance: true // Reduced rendering distance
    },
    
    // Performance targets for mobile
    mobileTargets: {
      targetFPS: 30, // Target 30 FPS for mobile devices
      maxFrameTime: 33.33, // 33ms for 30 FPS
      batteryEfficient: true, // Prioritize battery life
      thermalThrottling: true, // Handle thermal throttling
      memoryOptimized: true // Optimize for limited mobile memory
    }
  }
};

// Performance monitoring configuration
export const MONITORING_CONFIG = {
  // How often to sample performance metrics
  SAMPLE_INTERVAL: 1000, // milliseconds
  
  // How many samples to keep in memory
  MAX_SAMPLES: 120, // 2 minutes at 1 second intervals
  
  // How often to log performance reports
  LOG_INTERVAL: 15000, // 15 seconds
  
  // Performance warning thresholds
  WARNING_THRESHOLDS: {
    consecutiveSlowFrames: 10, // Warn if 10 consecutive slow frames
    averageFrameTimeThreshold: 20, // Warn if average frame time exceeds 20ms
    memoryUsageThreshold: 500, // Warn if memory usage exceeds 500MB
    aiDecisionBacklog: 5 // Warn if AI decisions are backing up
  }
};

// Adaptive performance optimization settings
export interface AdaptiveSettings {
  currentLevel: keyof typeof OPTIMIZATION_LEVELS;
  autoAdjust: boolean;
  performanceHistory: number[];
  lastAdjustment: number;
  adjustmentCooldown: number; // milliseconds between adjustments
}

/**
 * Performance Optimization Manager
 * Automatically adjusts game settings based on performance metrics
 */
export class PerformanceOptimizer {
  private settings: AdaptiveSettings;
  private readonly MIN_ADJUSTMENT_INTERVAL = 30000; // 30 seconds between adjustments

  constructor(initialLevel: keyof typeof OPTIMIZATION_LEVELS = 'BALANCED') {
    this.settings = {
      currentLevel: initialLevel,
      autoAdjust: true,
      performanceHistory: [],
      lastAdjustment: 0,
      adjustmentCooldown: this.MIN_ADJUSTMENT_INTERVAL
    };
    
    console.log(`🎯 Performance Optimizer initialized at ${initialLevel} level`);
  }

  /**
   * Update performance metrics and potentially adjust settings
   */
  public updatePerformanceMetrics(frameTime: number, aiDecisionTime: number, physicsTime: number): void {
    // Add current frame time to history
    this.settings.performanceHistory.push(frameTime);
    
    // Keep only recent history
    if (this.settings.performanceHistory.length > 30) {
      this.settings.performanceHistory = this.settings.performanceHistory.slice(-30);
    }
    
    // Check if auto-adjustment is enabled and enough time has passed
    if (this.settings.autoAdjust && this.canAdjust()) {
      this.considerPerformanceAdjustment();
    }
  }

  /**
   * Get current optimization configuration
   */
  public getCurrentConfig() {
    return OPTIMIZATION_LEVELS[this.settings.currentLevel];
  }

  /**
   * Manually set optimization level
   */
  public setOptimizationLevel(level: keyof typeof OPTIMIZATION_LEVELS): void {
    this.settings.currentLevel = level;
    this.settings.lastAdjustment = Date.now();
    
    console.log(`🔧 Performance level manually set to: ${OPTIMIZATION_LEVELS[level].name}`);
    console.log(`📝 ${OPTIMIZATION_LEVELS[level].description}`);
  }

  /**
   * Enable or disable automatic performance adjustment
   */
  public setAutoAdjust(enabled: boolean): void {
    this.settings.autoAdjust = enabled;
    console.log(`⚙️ Auto performance adjustment ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get performance recommendations based on current metrics
   */
  public getRecommendations(report: any): string[] {
    const recommendations: string[] = [];
    const config = this.getCurrentConfig();

    // AI Decision Time Analysis
    if (report.averageStats.avgAIDecisionTime > PERFORMANCE_TARGETS.AI_DECISION_CRITICAL) {
      recommendations.push(`🚨 CRITICAL: AI decision time (${report.averageStats.avgAIDecisionTime.toFixed(1)}ms) is extremely high. Consider reducing AI count or increasing decision interval.`);
    } else if (report.averageStats.avgAIDecisionTime > PERFORMANCE_TARGETS.AI_DECISION_WARNING) {
      recommendations.push(`⚠️ AI decision time (${report.averageStats.avgAIDecisionTime.toFixed(1)}ms) is high. Current interval: ${config.aiDecisionInterval}ms.`);
    }

    // Physics Analysis
    if (report.averageStats.avgPhysicsTime > PERFORMANCE_TARGETS.PHYSICS_CRITICAL) {
      recommendations.push(`🚨 CRITICAL: Physics time (${report.averageStats.avgPhysicsTime.toFixed(1)}ms) is extremely high. Consider reducing entity count or physics quality.`);
    } else if (report.averageStats.avgPhysicsTime > PERFORMANCE_TARGETS.PHYSICS_WARNING) {
      recommendations.push(`⚠️ Physics time (${report.averageStats.avgPhysicsTime.toFixed(1)}ms) is high. Consider optimization.`);
    }

    // Frame Time Analysis
    if (report.averageStats.avgFrameTime > PERFORMANCE_TARGETS.TARGET_FRAME_TIME * 2) {
      recommendations.push(`🚨 CRITICAL: Frame time (${report.averageStats.avgFrameTime.toFixed(1)}ms) is far above 60 FPS target. Consider switching to HIGH_PERFORMANCE mode.`);
    } else if (report.averageStats.avgFrameTime > PERFORMANCE_TARGETS.TARGET_FRAME_TIME) {
      recommendations.push(`⚠️ Frame time (${report.averageStats.avgFrameTime.toFixed(1)}ms) exceeds 60 FPS target (${PERFORMANCE_TARGETS.TARGET_FRAME_TIME}ms).`);
    }

    // AI Count Analysis
    if (report.activeAICount > config.maxAIPlayers) {
      recommendations.push(`🤖 AI count (${report.activeAICount}) exceeds recommended maximum (${config.maxAIPlayers}) for current optimization level.`);
    }

    // Positive feedback for good performance
    if (report.averageStats.avgFrameTime < PERFORMANCE_TARGETS.TARGET_FRAME_TIME && 
        report.averageStats.avgAIDecisionTime < PERFORMANCE_TARGETS.AI_DECISION_TARGET) {
      recommendations.push(`✅ Performance is excellent! Consider switching to HIGH_QUALITY mode for better visuals.`);
    }

    return recommendations;
  }

  private canAdjust(): boolean {
    const now = Date.now();
    return (now - this.settings.lastAdjustment) >= this.settings.adjustmentCooldown;
  }

  private considerPerformanceAdjustment(): void {
    if (this.settings.performanceHistory.length < 10) {
      return; // Need more data
    }

    const avgFrameTime = this.settings.performanceHistory.reduce((a, b) => a + b, 0) / this.settings.performanceHistory.length;
    const currentLevel = this.settings.currentLevel;

    // Check if we need to reduce quality for better performance
    if (avgFrameTime > PERFORMANCE_TARGETS.TARGET_FRAME_TIME * 1.5) {
      if (currentLevel === 'HIGH_QUALITY') {
        this.setOptimizationLevel('BALANCED');
        console.log(`📉 Auto-adjusted from HIGH_QUALITY to BALANCED due to poor performance (${avgFrameTime.toFixed(1)}ms avg frame time)`);
      } else if (currentLevel === 'BALANCED') {
        this.setOptimizationLevel('HIGH_PERFORMANCE');
        console.log(`📉 Auto-adjusted from BALANCED to HIGH_PERFORMANCE due to poor performance (${avgFrameTime.toFixed(1)}ms avg frame time)`);
      }
    }
    // Check if we can increase quality due to good performance
    else if (avgFrameTime < PERFORMANCE_TARGETS.TARGET_FRAME_TIME * 0.8) {
      if (currentLevel === 'HIGH_PERFORMANCE') {
        this.setOptimizationLevel('BALANCED');
        console.log(`📈 Auto-adjusted from HIGH_PERFORMANCE to BALANCED due to good performance (${avgFrameTime.toFixed(1)}ms avg frame time)`);
      } else if (currentLevel === 'BALANCED') {
        this.setOptimizationLevel('HIGH_QUALITY');
        console.log(`📈 Auto-adjusted from BALANCED to HIGH_QUALITY due to excellent performance (${avgFrameTime.toFixed(1)}ms avg frame time)`);
      }
    }
  }

  // ===== PHASE 1 MOBILE PERFORMANCE METHODS =====
  
  /**
   * Automatically detect if mobile optimization should be enabled
   * @param deviceInfo Device information from client
   * @returns Whether mobile optimization should be used
   */
  public shouldUseMobileOptimization(deviceInfo: any): boolean {
    if (!deviceInfo) return false;
    
    // Check for mobile user agents
    const userAgent = deviceInfo.userAgent || '';
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // Check for touch capability and small screen
    const isTouchDevice = deviceInfo.touchCapable;
    const isSmallScreen = deviceInfo.screenWidth <= 768;
    
    // Check device pixel ratio (high DPI mobile devices)
    const isHighDPI = deviceInfo.devicePixelRatio > 1.5;
    
    console.log(`📱 Mobile detection: UserAgent=${isMobileUserAgent}, Touch=${isTouchDevice}, SmallScreen=${isSmallScreen}, HighDPI=${isHighDPI}`);
    
    return isMobileUserAgent || (isTouchDevice && isSmallScreen);
  }
  
  /**
   * Switch to mobile optimized performance mode
   */
  public enableMobileOptimization(): void {
    this.setOptimizationLevel('MOBILE_OPTIMIZED');
    console.log('📱 Mobile performance mode enabled');
    console.log('📱 Battery optimization, reduced effects, and touch-optimized performance active');
  }
  
  /**
   * Get mobile-specific performance recommendations
   */
  public getMobileRecommendations(report: any): string[] {
    const recommendations: string[] = [];
    const config = this.getCurrentConfig();
    
    if (config.name !== 'Mobile Optimized') {
      recommendations.push('📱 Consider enabling Mobile Optimized mode for better battery life and performance');
      return recommendations;
    }
    
    // Mobile-specific performance analysis
    const mobileTargets = (config as any).mobileTargets;
    if (mobileTargets) {
      // Frame time analysis for mobile (30 FPS target)
      if (report.averageStats.avgFrameTime > mobileTargets.maxFrameTime * 1.5) {
        recommendations.push(`📱 CRITICAL: Frame time (${report.averageStats.avgFrameTime.toFixed(1)}ms) exceeds mobile target. Consider reducing AI count or effects.`);
      } else if (report.averageStats.avgFrameTime > mobileTargets.maxFrameTime) {
        recommendations.push(`📱 Warning: Frame time (${report.averageStats.avgFrameTime.toFixed(1)}ms) above optimal mobile performance.`);
      }
      
      // Battery optimization recommendations
      if (report.averageStats.avgAIDecisionTime > 40) {
        recommendations.push('🔋 AI decision time high - consider increasing decision interval for better battery life');
      }
      
      if (report.activeAICount > 6) {
        recommendations.push('🔋 High AI count detected - reducing to 6 or fewer AI players recommended for mobile devices');
      }
    }
    
    // Positive feedback for good mobile performance
    if (report.averageStats.avgFrameTime <= (mobileTargets?.maxFrameTime || 33.33)) {
      recommendations.push('✅ Excellent mobile performance! Battery-optimized gameplay active.');
    }
    
    return recommendations;
  }
  
  /**
   * Check if current configuration is mobile-optimized
   */
  public isMobileOptimized(): boolean {
    return this.settings.currentLevel === 'MOBILE_OPTIMIZED';
  }
  
  /**
   * Get mobile performance metrics and status
   */
  public getMobilePerformanceStatus(): any {
    const config = this.getCurrentConfig();
    const isMobile = this.isMobileOptimized();
    
    return {
      isMobileMode: isMobile,
      optimizationLevel: config.name,
      mobileFeatures: isMobile ? {
        batteryOptimized: (config as any).mobileOptimizations?.batteryOptimized || false,
        touchOptimized: (config as any).mobileOptimizations?.touchInputOptimized || false,
        reducedEffects: (config as any).mobileOptimizations?.reducedParticleEffects || false,
        targetFPS: (config as any).mobileTargets?.targetFPS || 30
      } : null,
      recommendations: this.isMobileOptimized() ? 
        ['Mobile optimization active - optimized for battery life and touch controls'] :
        ['Consider enabling mobile optimization for better mobile device performance']
    };
  }
}

// Utility functions for performance optimization
export const PerformanceUtils = {
  /**
   * Check if current performance meets targets
   */
  isPerformanceGood(frameTime: number, aiTime: number, physicsTime: number): boolean {
    return frameTime <= PERFORMANCE_TARGETS.TARGET_FRAME_TIME &&
           aiTime <= PERFORMANCE_TARGETS.AI_DECISION_TARGET &&
           physicsTime <= PERFORMANCE_TARGETS.PHYSICS_TARGET;
  },

  /**
   * Get performance grade based on metrics
   */
  getPerformanceGrade(frameTime: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (frameTime <= PERFORMANCE_TARGETS.TARGET_FRAME_TIME) return 'A';
    if (frameTime <= PERFORMANCE_TARGETS.TARGET_FRAME_TIME * 1.2) return 'B';
    if (frameTime <= PERFORMANCE_TARGETS.TARGET_FRAME_TIME * 1.5) return 'C';
    if (frameTime <= PERFORMANCE_TARGETS.TARGET_FRAME_TIME * 2.0) return 'D';
    return 'F';
  },

  /**
   * Calculate recommended AI decision interval based on current performance
   */
  getRecommendedAIInterval(currentFrameTime: number, currentInterval: number): number {
    const performanceRatio = currentFrameTime / PERFORMANCE_TARGETS.TARGET_FRAME_TIME;
    
    if (performanceRatio > 1.5) {
      return Math.min(currentInterval * 1.5, 1000); // Slow down AI decisions
    } else if (performanceRatio < 0.8) {
      return Math.max(currentInterval * 0.8, 250); // Speed up AI decisions
    }
    
    return currentInterval; // No change needed
  }
};

export default PerformanceOptimizer; 