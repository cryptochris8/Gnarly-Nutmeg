/**
 * Enhanced Mobile Optimization System
 * 
 * Provides comprehensive mobile device detection and optimization
 * for Hytopia Soccer on mobile platforms, including touch controls,
 * performance adjustments, and battery-conscious settings.
 * 
 * Features:
 * - Advanced mobile device detection
 * - Touch-optimized UI layouts
 * - Performance scaling based on device capabilities
 * - Battery-conscious update intervals
 * - Network-aware optimizations
 */

import type { 
  SoccerWorld, 
  SoccerPlayerEntity as ISoccerPlayerEntity,
  OptimizationLevel,
  Vector3Like 
} from '../types/GameTypes';
import { timerManager } from '../utils/TimerManager';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';
import { configManager } from '../config/ConfigManager';

export interface MobileDeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouch: boolean;
  screenSize: { width: number; height: number };
  pixelRatio: number;
  connectionType: string;
  batteryLevel?: number;
  isLowPowerMode?: boolean;
  deviceMemory?: number;
  hardwareConcurrency: number;
  platform: string;
  userAgent: string;
  performanceClass: 'low' | 'medium' | 'high';
}

export interface MobileOptimizations {
  // Performance settings
  reducedPhysicsQuality: boolean;
  lowerFrameRate: boolean;
  reducedParticleEffects: boolean;
  simplifiedShaders: boolean;
  
  // UI adjustments
  touchControls: boolean;
  enlargedButtons: boolean;
  simplifiedUI: boolean;
  
  // Network optimizations
  reducedUpdateRate: boolean;
  compressedData: boolean;
  
  // Battery optimizations
  reducedBackgroundActivity: boolean;
  dimmedEffects: boolean;
  pauseOnBackground: boolean;
}

export interface MobileConfig {
  enableAutoDetection: boolean;
  performanceThresholds: {
    lowEnd: { memory: number; cores: number };
    midRange: { memory: number; cores: number };
  };
  touchSettings: {
    buttonMinSize: number;
    swipeThreshold: number;
    tapTimeout: number;
  };
  batterySettings: {
    lowBatteryThreshold: number;
    criticalBatteryThreshold: number;
  };
  networkSettings: {
    slowConnectionThreshold: number; // Mbps
  };
}

export class MobileOptimizer {
  private world: SoccerWorld;
  private deviceInfo: MobileDeviceInfo;
  private optimizations: MobileOptimizations;
  private isOptimizationActive = false;
  
  private config: MobileConfig = {
    enableAutoDetection: true,
    performanceThresholds: {
      lowEnd: { memory: 2, cores: 2 },
      midRange: { memory: 4, cores: 4 }
    },
    touchSettings: {
      buttonMinSize: 44, // 44px minimum touch target
      swipeThreshold: 20,
      tapTimeout: 300
    },
    batterySettings: {
      lowBatteryThreshold: 0.20, // 20%
      criticalBatteryThreshold: 0.10 // 10%
    },
    networkSettings: {
      slowConnectionThreshold: 1.0 // 1 Mbps
    }
  };

  // Timers for monitoring
  private batteryMonitorTimerId?: string;
  private performanceMonitorTimerId?: string;
  private networkMonitorTimerId?: string;

  // Performance tracking
  private frameRates: number[] = [];
  private lastOptimizationTime = 0;

  constructor(world: SoccerWorld) {
    this.world = world;
    
    // Initialize with default values
    this.deviceInfo = this.detectMobileDevice();
    this.optimizations = this.createDefaultOptimizations();
    
    console.log('📱 Mobile Optimizer initialized');
    console.log(`📱 Device: ${this.deviceInfo.isMobile ? 'Mobile' : 'Desktop'}, Performance: ${this.deviceInfo.performanceClass}`);
  }

  /**
   * Start mobile optimization monitoring
   */
  start(): void {
    if (!this.config.enableAutoDetection) {
      console.log('📱 Mobile auto-detection disabled');
      return;
    }

    console.log('📱 Starting mobile optimization monitoring...');
    
    // Initial device detection and optimization
    this.deviceInfo = this.detectMobileDevice();
    this.applyOptimizations();
    
    // Start monitoring systems
    this.startBatteryMonitoring();
    this.startPerformanceMonitoring();
    this.startNetworkMonitoring();
    
    this.isOptimizationActive = true;
    console.log('✅ Mobile optimization active');
  }

  /**
   * Stop mobile optimization monitoring
   */
  stop(): void {
    console.log('📱 Stopping mobile optimization...');
    
    this.isOptimizationActive = false;
    
    // Clear all timers
    if (this.batteryMonitorTimerId) {
      timerManager.clearTimer(this.batteryMonitorTimerId);
    }
    if (this.performanceMonitorTimerId) {
      timerManager.clearTimer(this.performanceMonitorTimerId);
    }
    if (this.networkMonitorTimerId) {
      timerManager.clearTimer(this.networkMonitorTimerId);
    }
    
    console.log('✅ Mobile optimization stopped');
  }

  /**
   * Detect mobile device capabilities and characteristics
   */
  private detectMobileDevice(): MobileDeviceInfo {
    try {
      // Basic mobile detection
      const userAgent = navigator.userAgent || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTablet = /iPad|Android.*Tablet|PlayBook|Kindle|Silk/i.test(userAgent);
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Screen information
      const screenSize = {
        width: window.screen?.width || window.innerWidth || 0,
        height: window.screen?.height || window.innerHeight || 0
      };
      
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Hardware information
      const hardwareConcurrency = navigator.hardwareConcurrency || 2;
      const deviceMemory = (navigator as any).deviceMemory || 4; // GB, defaults to 4GB
      
      // Network information
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const connectionType = connection?.effectiveType || 'unknown';
      
      // Battery information (if available)
      let batteryLevel: number | undefined;
      let isLowPowerMode: boolean | undefined;
      
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          batteryLevel = battery.level;
          isLowPowerMode = battery.level < this.config.batterySettings.lowBatteryThreshold;
        }).catch(() => {
          // Battery API not available
        });
      }
      
      // Determine performance class
      const performanceClass = this.determinePerformanceClass(deviceMemory, hardwareConcurrency, screenSize);
      
      return {
        isMobile,
        isTablet,
        isTouch,
        screenSize,
        pixelRatio,
        connectionType,
        batteryLevel,
        isLowPowerMode,
        deviceMemory,
        hardwareConcurrency,
        platform: navigator.platform || 'unknown',
        userAgent,
        performanceClass
      };
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.MOBILE,
        ErrorSeverity.MEDIUM,
        'Error detecting mobile device',
        error
      );
      
      // Return safe defaults
      return {
        isMobile: false,
        isTablet: false,
        isTouch: false,
        screenSize: { width: 1920, height: 1080 },
        pixelRatio: 1,
        connectionType: 'unknown',
        hardwareConcurrency: 4,
        platform: 'unknown',
        userAgent: '',
        performanceClass: 'medium'
      };
    }
  }

  /**
   * Determine device performance class based on hardware specs
   */
  private determinePerformanceClass(memory: number, cores: number, screenSize: { width: number; height: number }): 'low' | 'medium' | 'high' {
    const { lowEnd, midRange } = this.config.performanceThresholds;
    const totalPixels = screenSize.width * screenSize.height;
    
    // Low-end criteria
    if (memory <= lowEnd.memory || cores <= lowEnd.cores || totalPixels < 1000000) {
      return 'low';
    }
    
    // High-end criteria  
    if (memory >= 8 && cores >= 6 && totalPixels >= 2000000) {
      return 'high';
    }
    
    // Default to medium
    return 'medium';
  }

  /**
   * Create default optimization settings
   */
  private createDefaultOptimizations(): MobileOptimizations {
    return {
      reducedPhysicsQuality: false,
      lowerFrameRate: false,
      reducedParticleEffects: false,
      simplifiedShaders: false,
      touchControls: false,
      enlargedButtons: false,
      simplifiedUI: false,
      reducedUpdateRate: false,
      compressedData: false,
      reducedBackgroundActivity: false,
      dimmedEffects: false,
      pauseOnBackground: false
    };
  }

  /**
   * Apply optimizations based on device capabilities
   */
  private applyOptimizations(): void {
    try {
      const newOptimizations = { ...this.optimizations };
      
      // Mobile-specific optimizations
      if (this.deviceInfo.isMobile) {
        newOptimizations.touchControls = true;
        newOptimizations.enlargedButtons = true;
        
        // Performance-based optimizations
        switch (this.deviceInfo.performanceClass) {
          case 'low':
            newOptimizations.reducedPhysicsQuality = true;
            newOptimizations.lowerFrameRate = true;
            newOptimizations.reducedParticleEffects = true;
            newOptimizations.simplifiedShaders = true;
            newOptimizations.simplifiedUI = true;
            newOptimizations.reducedUpdateRate = true;
            newOptimizations.compressedData = true;
            break;
            
          case 'medium':
            newOptimizations.reducedParticleEffects = true;
            newOptimizations.reducedUpdateRate = true;
            break;
            
          case 'high':
            // High-end mobile devices can handle most features
            break;
        }
      }
      
      // Battery-based optimizations
      if (this.deviceInfo.isLowPowerMode || (this.deviceInfo.batteryLevel && this.deviceInfo.batteryLevel < this.config.batterySettings.lowBatteryThreshold)) {
        newOptimizations.reducedBackgroundActivity = true;
        newOptimizations.dimmedEffects = true;
        newOptimizations.lowerFrameRate = true;
        
        if (this.deviceInfo.batteryLevel && this.deviceInfo.batteryLevel < this.config.batterySettings.criticalBatteryThreshold) {
          newOptimizations.pauseOnBackground = true;
          newOptimizations.reducedPhysicsQuality = true;
        }
      }
      
      // Network-based optimizations
      if (this.deviceInfo.connectionType === '2g' || this.deviceInfo.connectionType === 'slow-2g') {
        newOptimizations.reducedUpdateRate = true;
        newOptimizations.compressedData = true;
      }
      
      // Apply the optimizations
      const hasChanges = JSON.stringify(newOptimizations) !== JSON.stringify(this.optimizations);
      
      if (hasChanges) {
        this.optimizations = newOptimizations;
        this.implementOptimizations();
        
        console.log('📱 Mobile optimizations updated:', {
          performanceClass: this.deviceInfo.performanceClass,
          batteryLevel: this.deviceInfo.batteryLevel,
          connectionType: this.deviceInfo.connectionType
        });
      }
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.MOBILE,
        ErrorSeverity.MEDIUM,
        'Error applying mobile optimizations',
        error
      );
    }
  }

  /**
   * Implement the actual optimizations in the game
   */
  private implementOptimizations(): void {
    try {
      // Send optimization data to all connected players
      const players = this.world.entityManager?.getAllPlayerEntities() || [];
      
      const optimizationData = {
        type: 'mobile-optimization',
        timestamp: Date.now(),
        deviceInfo: {
          isMobile: this.deviceInfo.isMobile,
          isTouch: this.deviceInfo.isTouch,
          performanceClass: this.deviceInfo.performanceClass,
          screenSize: this.deviceInfo.screenSize,
          pixelRatio: this.deviceInfo.pixelRatio
        },
        optimizations: this.optimizations,
        uiSettings: this.generateUISettings()
      };
      
      players.forEach(player => {
        try {
          if (player.player?.ui && typeof player.player.ui.sendData === 'function') {
            player.player.ui.sendData(optimizationData);
          }
        } catch (error) {
          // Ignore individual player send errors
        }
      });
      
      // Apply server-side optimizations
      this.applyServerOptimizations();
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.MOBILE,
        ErrorSeverity.MEDIUM,
        'Error implementing mobile optimizations',
        error
      );
    }
  }

  /**
   * Generate UI settings for mobile devices
   */
  private generateUISettings(): any {
    const { touchSettings } = this.config;
    
    return {
      touchControls: {
        enabled: this.optimizations.touchControls,
        buttonMinSize: this.optimizations.enlargedButtons ? touchSettings.buttonMinSize * 1.2 : touchSettings.buttonMinSize,
        swipeThreshold: touchSettings.swipeThreshold,
        tapTimeout: touchSettings.tapTimeout
      },
      layout: {
        simplified: this.optimizations.simplifiedUI,
        largeButtons: this.optimizations.enlargedButtons,
        reducedAnimations: this.optimizations.dimmedEffects
      },
      display: {
        reducedEffects: this.optimizations.reducedParticleEffects,
        simplifiedShaders: this.optimizations.simplifiedShaders,
        targetFrameRate: this.optimizations.lowerFrameRate ? 30 : 60
      }
    };
  }

  /**
   * Apply server-side optimizations
   */
  private applyServerOptimizations(): void {
    try {
      // Adjust update intervals based on performance needs
      if (this.optimizations.reducedUpdateRate) {
        // Reduce server update frequency for mobile clients
        this.adjustUpdateIntervals(true);
      } else {
        this.adjustUpdateIntervals(false);
      }
      
      // Adjust physics quality if needed
      if (this.optimizations.reducedPhysicsQuality) {
        this.adjustPhysicsQuality('low');
      } else {
        this.adjustPhysicsQuality('normal');
      }
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.MOBILE,
        ErrorSeverity.LOW,
        'Error applying server-side mobile optimizations',
        error
      );
    }
  }

  /**
   * Adjust server update intervals for mobile optimization
   */
  private adjustUpdateIntervals(reduce: boolean): void {
    // This would integrate with the server's update loop
    // For now, we'll just log the intended change
    const interval = reduce ? 50 : 33; // 20fps vs 30fps
    console.log(`📱 Server update interval adjusted to ${interval}ms for mobile optimization`);
  }

  /**
   * Adjust physics quality for mobile devices
   */
  private adjustPhysicsQuality(quality: 'low' | 'normal' | 'high'): void {
    // This would integrate with the physics engine
    console.log(`📱 Physics quality adjusted to ${quality} for mobile optimization`);
  }

  /**
   * Start battery level monitoring
   */
  private startBatteryMonitoring(): void {
    if (!('getBattery' in navigator)) {
      return; // Battery API not available
    }

    this.batteryMonitorTimerId = timerManager.setInterval(() => {
      (navigator as any).getBattery().then((battery: any) => {
        const previousBatteryLevel = this.deviceInfo.batteryLevel;
        this.deviceInfo.batteryLevel = battery.level;
        this.deviceInfo.isLowPowerMode = battery.level < this.config.batterySettings.lowBatteryThreshold;
        
        // Reapply optimizations if battery level changed significantly
        if (!previousBatteryLevel || Math.abs(battery.level - previousBatteryLevel) > 0.05) {
          this.applyOptimizations();
        }
      }).catch(() => {
        // Battery monitoring failed, ignore
      });
    }, 30000, 'mobile-battery-monitor'); // Check every 30 seconds
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.performanceMonitorTimerId = timerManager.setInterval(() => {
      this.monitorPerformance();
    }, 5000, 'mobile-performance-monitor'); // Check every 5 seconds
  }

  /**
   * Monitor performance and adjust optimizations
   */
  private monitorPerformance(): void {
    try {
      // Estimate current frame rate
      const now = Date.now();
      const frameTime = now - this.lastOptimizationTime;
      const estimatedFPS = frameTime > 0 ? 1000 / frameTime : 60;
      
      this.frameRates.push(estimatedFPS);
      if (this.frameRates.length > 20) {
        this.frameRates = this.frameRates.slice(-20);
      }
      
      const averageFPS = this.frameRates.reduce((sum, fps) => sum + fps, 0) / this.frameRates.length;
      
      // Adjust optimizations based on performance
      if (averageFPS < 20 && !this.optimizations.lowerFrameRate) {
        console.log('📱 Low performance detected, applying additional optimizations');
        this.optimizations.lowerFrameRate = true;
        this.optimizations.reducedParticleEffects = true;
        this.implementOptimizations();
      } else if (averageFPS > 45 && this.optimizations.lowerFrameRate) {
        console.log('📱 Good performance detected, reducing optimizations');
        this.optimizations.lowerFrameRate = false;
        if (this.deviceInfo.performanceClass !== 'low') {
          this.optimizations.reducedParticleEffects = false;
        }
        this.implementOptimizations();
      }
      
      this.lastOptimizationTime = now;
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.MOBILE,
        ErrorSeverity.LOW,
        'Error monitoring mobile performance',
        error
      );
    }
  }

  /**
   * Start network monitoring
   */
  private startNetworkMonitoring(): void {
    if (!('connection' in navigator)) {
      return; // Network API not available
    }

    this.networkMonitorTimerId = timerManager.setInterval(() => {
      const connection = (navigator as any).connection;
      if (connection) {
        const previousConnectionType = this.deviceInfo.connectionType;
        this.deviceInfo.connectionType = connection.effectiveType;
        
        if (previousConnectionType !== this.deviceInfo.connectionType) {
          console.log(`📱 Network connection changed to ${this.deviceInfo.connectionType}`);
          this.applyOptimizations();
        }
      }
    }, 10000, 'mobile-network-monitor'); // Check every 10 seconds
  }

  /**
   * Get current device information
   */
  getDeviceInfo(): MobileDeviceInfo {
    return { ...this.deviceInfo };
  }

  /**
   * Get current optimizations
   */
  getOptimizations(): MobileOptimizations {
    return { ...this.optimizations };
  }

  /**
   * Update mobile configuration
   */
  updateConfig(newConfig: Partial<MobileConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reapply optimizations with new config
    if (this.isOptimizationActive) {
      this.applyOptimizations();
    }
    
    console.log('📱 Mobile configuration updated:', newConfig);
  }

  /**
   * Force redetection of mobile device
   */
  redetectDevice(): void {
    console.log('📱 Redetecting mobile device...');
    this.deviceInfo = this.detectMobileDevice();
    this.applyOptimizations();
  }

  /**
   * Manually override optimization settings
   */
  setOptimizations(optimizations: Partial<MobileOptimizations>): void {
    this.optimizations = { ...this.optimizations, ...optimizations };
    this.implementOptimizations();
    console.log('📱 Mobile optimizations manually updated:', optimizations);
  }

  /**
   * Get mobile optimization statistics
   */
  getStats(): any {
    return {
      deviceInfo: this.deviceInfo,
      optimizations: this.optimizations,
      isActive: this.isOptimizationActive,
      averageFrameRate: this.frameRates.length > 0 
        ? Math.round(this.frameRates.reduce((sum, fps) => sum + fps, 0) / this.frameRates.length)
        : 0,
      config: this.config
    };
  }

  /**
   * Cleanup mobile optimizer resources
   */
  cleanup(): void {
    this.stop();
    this.frameRates = [];
    console.log('📱 Mobile Optimizer cleaned up');
  }
}

// Export utility function to create mobile optimizer
export function createMobileOptimizer(world: SoccerWorld): MobileOptimizer {
  return new MobileOptimizer(world);
}