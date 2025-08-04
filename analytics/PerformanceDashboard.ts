/**
 * Enhanced Performance Analytics Dashboard
 * 
 * Provides comprehensive real-time performance monitoring and analytics
 * with visual dashboard capabilities for development and production monitoring.
 * 
 * Integrates with existing PerformanceProfiler and adds advanced analytics,
 * trend analysis, and real-time dashboard data for client display.
 */

import type { 
  PerformanceMetrics, 
  PerformanceTarget, 
  OptimizationLevel,
  SoccerWorld 
} from '../types/GameTypes';
import { timerManager } from '../utils/TimerManager';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';
import { aiDecisionCache } from '../ai/AIDecisionCache';

export interface DashboardMetrics extends PerformanceMetrics {
  // Enhanced metrics
  timestamp: number;
  uptimeSeconds: number;
  
  // AI Performance
  aiCacheHitRate: number;
  aiDecisionsCached: number;
  aiAverageDecisionTime: number;
  
  // System Health
  errorRate: number;
  warningCount: number;
  criticalErrorCount: number;
  
  // Resource Usage
  heapUsedMB: number;
  heapTotalMB: number;
  heapUsagePercent: number;
  
  // Game Metrics  
  activePowerUps: number;
  ballVelocity: number;
  averagePlayerDistance: number;
  
  // Timer System
  activeTimers: number;
  timerLeakWarnings: number;
}

export interface PerformanceTrend {
  metric: string;
  values: number[];
  timestamps: number[];
  trend: 'improving' | 'degrading' | 'stable';
  trendStrength: number; // 0-1, how strong the trend is
}

export interface DashboardAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  value?: number;
  threshold?: number;
}

export interface DashboardConfig {
  updateInterval: number;        // How often to collect metrics (ms)
  historySize: number;          // How many data points to keep
  trendsEnabled: boolean;       // Calculate trends
  alertsEnabled: boolean;       // Generate alerts
  clientUpdatesEnabled: boolean; // Send data to clients
  clientUpdateInterval: number; // How often to send to clients
}

export class PerformanceDashboard {
  private world: SoccerWorld;
  private config: DashboardConfig = {
    updateInterval: 2000,        // 2 seconds
    historySize: 300,           // 10 minutes of data at 2s intervals  
    trendsEnabled: true,
    alertsEnabled: true,
    clientUpdatesEnabled: true,
    clientUpdateInterval: 5000   // 5 seconds to clients
  };

  private metricsHistory: DashboardMetrics[] = [];
  private trends = new Map<string, PerformanceTrend>();
  private alerts = new Map<string, DashboardAlert>();
  private isRunning = false;
  private alertIdCounter = 0;

  // Timer IDs for cleanup
  private metricsTimerId?: string;
  private clientUpdateTimerId?: string;
  private trendAnalysisTimerId?: string;

  // Performance targets for alerting
  private performanceTarget: PerformanceTarget;

  constructor(world: SoccerWorld, optimizationLevel: OptimizationLevel = 'HIGH_PERFORMANCE') {
    this.world = world;
    
    // Get performance targets based on optimization level
    this.performanceTarget = this.getPerformanceTarget(optimizationLevel);
    
    console.log('📊 Performance Dashboard initialized');
    console.log(`🎯 Target: ${optimizationLevel} - Frame time: ${this.performanceTarget.targetFrameTime}ms`);
  }

  /**
   * Start the dashboard monitoring
   */
  start(): void {
    if (this.isRunning) {
      console.warn('📊 Performance Dashboard already running');
      return;
    }

    console.log('📊 Starting Performance Dashboard monitoring...');
    
    this.isRunning = true;
    
    // Start metrics collection
    this.metricsTimerId = timerManager.setInterval(() => {
      this.collectMetrics();
    }, this.config.updateInterval, 'dashboard-metrics');

    // Start client updates
    if (this.config.clientUpdatesEnabled) {
      this.clientUpdateTimerId = timerManager.setInterval(() => {
        this.sendClientUpdates();
      }, this.config.clientUpdateInterval, 'dashboard-client-updates');
    }

    // Start trend analysis
    if (this.config.trendsEnabled) {
      this.trendAnalysisTimerId = timerManager.setInterval(() => {
        this.analyzeTrends();
      }, 30000, 'dashboard-trend-analysis'); // Every 30 seconds
    }

    console.log('✅ Performance Dashboard started');
  }

  /**
   * Stop the dashboard monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('📊 Stopping Performance Dashboard...');
    
    this.isRunning = false;
    
    // Clear timers
    if (this.metricsTimerId) {
      timerManager.clearTimer(this.metricsTimerId);
    }
    if (this.clientUpdateTimerId) {
      timerManager.clearTimer(this.clientUpdateTimerId);
    }
    if (this.trendAnalysisTimerId) {
      timerManager.clearTimer(this.trendAnalysisTimerId);
    }

    console.log('✅ Performance Dashboard stopped');
  }

  /**
   * Collect comprehensive performance metrics
   */
  private collectMetrics(): void {
    try {
      const now = Date.now();
      const performanceProfiler = (this.world as any)._performanceProfiler;
      
      // Get base metrics from existing profiler
      const baseMetrics = performanceProfiler?.getMetrics() || this.getDefaultMetrics();
      
      // Get AI cache statistics
      const aiStats = aiDecisionCache.getStats();
      
      // Get timer statistics
      const timerStats = timerManager.getTimerStats();
      
      // Get error statistics
      const errorStats = errorHandler.getErrorStats();
      
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      
      // Get game-specific metrics
      const gameMetrics = this.collectGameMetrics();
      
      const dashboardMetrics: DashboardMetrics = {
        ...baseMetrics,
        timestamp: now,
        uptimeSeconds: Math.round(process.uptime()),
        
        // AI Performance
        aiCacheHitRate: aiStats.cacheHits > 0 ? aiStats.hitRate : 0,
        aiDecisionsCached: aiStats.cacheHits,
        aiAverageDecisionTime: aiStats.averageDecisionTime || 0,
        
        // System Health
        errorRate: errorStats.errorRate,
        warningCount: errorStats.errorsBySeverity.MEDIUM || 0,
        criticalErrorCount: errorStats.errorsBySeverity.CRITICAL || 0,
        
        // Resource Usage
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        
        // Game Metrics
        activePowerUps: gameMetrics.activePowerUps,
        ballVelocity: gameMetrics.ballVelocity,
        averagePlayerDistance: gameMetrics.averagePlayerDistance,
        
        // Timer System
        activeTimers: timerStats.totalTimers,
        timerLeakWarnings: timerStats.oldestTimer > 300000 ? 1 : 0 // 5 minutes
      };

      // Add to history
      this.metricsHistory.push(dashboardMetrics);
      
      // Trim history to configured size
      if (this.metricsHistory.length > this.config.historySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.config.historySize);
      }

      // Check for alerts
      if (this.config.alertsEnabled) {
        this.checkForAlerts(dashboardMetrics);
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'Error collecting dashboard metrics',
        error
      );
    }
  }

  /**
   * Collect game-specific metrics
   */
  private collectGameMetrics(): {
    activePowerUps: number;
    ballVelocity: number;
    averagePlayerDistance: number;
  } {
    try {
      const ball = this.world.ball;
      const players = this.world.entityManager?.getAllPlayerEntities() || [];
      
      // Count active power-ups (estimate)
      const activePowerUps = this.countActivePowerUps();
      
      // Calculate ball velocity
      const ballVelocity = ball ? this.calculateBallVelocity(ball) : 0;
      
      // Calculate average player distance from ball
      const averagePlayerDistance = ball && players.length > 0 
        ? this.calculateAveragePlayerDistance(ball, players)
        : 0;
        
      return {
        activePowerUps,
        ballVelocity,
        averagePlayerDistance
      };
      
    } catch (error) {
      return {
        activePowerUps: 0,
        ballVelocity: 0,
        averagePlayerDistance: 0
      };
    }
  }

  /**
   * Count active power-ups in the game
   */
  private countActivePowerUps(): number {
    try {
      // This would need integration with the actual power-up system
      // For now, return an estimate based on entities
      const entities = this.world.entityManager?.getAllEntities() || [];
      return entities.filter(entity => 
        entity.name.includes('power-up') || 
        entity.name.includes('ability') ||
        entity.name.includes('effect')
      ).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate current ball velocity
   */
  private calculateBallVelocity(ball: any): number {
    try {
      if (ball.getLinearVelocity) {
        const velocity = ball.getLinearVelocity();
        return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate average distance of players from ball
   */
  private calculateAveragePlayerDistance(ball: any, players: any[]): number {
    try {
      if (players.length === 0) return 0;
      
      const distances = players.map(player => {
        const dx = player.position.x - ball.position.x;
        const dz = player.position.z - ball.position.z;
        return Math.sqrt(dx * dx + dz * dz);
      });
      
      return distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(metrics: DashboardMetrics): void {
    // Frame time alert
    if (metrics.frameTime > this.performanceTarget.targetFrameTime * 1.5) {
      this.createAlert(
        'critical',
        'performance',
        `Frame time critically high: ${metrics.frameTime.toFixed(1)}ms (target: ${this.performanceTarget.targetFrameTime}ms)`,
        metrics.frameTime,
        this.performanceTarget.targetFrameTime
      );
    } else if (metrics.frameTime > this.performanceTarget.targetFrameTime * 1.2) {
      this.createAlert(
        'warning',
        'performance',
        `Frame time above target: ${metrics.frameTime.toFixed(1)}ms`,
        metrics.frameTime,
        this.performanceTarget.targetFrameTime
      );
    }

    // Memory usage alert
    if (metrics.heapUsagePercent > 90) {
      this.createAlert(
        'critical',
        'memory',
        `Memory usage critically high: ${metrics.heapUsagePercent}%`,
        metrics.heapUsagePercent,
        90
      );
    } else if (metrics.heapUsagePercent > 75) {
      this.createAlert(
        'warning',
        'memory',
        `Memory usage high: ${metrics.heapUsagePercent}%`,
        metrics.heapUsagePercent,
        75
      );
    }

    // Error rate alert
    if (metrics.errorRate > 10) {
      this.createAlert(
        'warning',
        'errors',
        `High error rate: ${metrics.errorRate.toFixed(1)} errors/minute`,
        metrics.errorRate,
        10
      );
    }

    // Critical errors alert
    if (metrics.criticalErrorCount > 0) {
      this.createAlert(
        'critical',
        'errors',
        `Critical errors detected: ${metrics.criticalErrorCount}`,
        metrics.criticalErrorCount,
        0
      );
    }

    // Timer leak alert
    if (metrics.timerLeakWarnings > 0) {
      this.createAlert(
        'warning',
        'memory',
        'Potential timer memory leaks detected',
        metrics.timerLeakWarnings,
        0
      );
    }

    // AI performance alert
    if (metrics.aiAverageDecisionTime > this.performanceTarget.maxAIDecisionTime) {
      this.createAlert(
        'warning',
        'ai',
        `AI decision time high: ${metrics.aiAverageDecisionTime.toFixed(1)}ms`,
        metrics.aiAverageDecisionTime,
        this.performanceTarget.maxAIDecisionTime
      );
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    severity: 'info' | 'warning' | 'critical',
    category: string,
    message: string,
    value?: number,
    threshold?: number
  ): void {
    const alertId = `${category}_${this.alertIdCounter++}_${Date.now()}`;
    
    const alert: DashboardAlert = {
      id: alertId,
      severity,
      category,
      message,
      timestamp: Date.now(),
      acknowledged: false,
      value,
      threshold
    };

    this.alerts.set(alertId, alert);
    
    // Log alert
    const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} DASHBOARD ALERT [${severity.toUpperCase()}]: ${message}`);

    // Clean up old alerts (keep only last 50)
    if (this.alerts.size > 50) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      this.alerts.clear();
      sortedAlerts.slice(0, 50).forEach(([id, alert]) => {
        this.alerts.set(id, alert);
      });
    }
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(): void {
    if (this.metricsHistory.length < 10) {
      return; // Need at least 10 data points
    }

    try {
      const recentMetrics = this.metricsHistory.slice(-30); // Last 30 data points
      
      // Analyze key metrics
      this.analyzeTrendForMetric('frameTime', recentMetrics.map(m => m.frameTime));
      this.analyzeTrendForMetric('memoryUsage', recentMetrics.map(m => m.heapUsagePercent));
      this.analyzeTrendForMetric('errorRate', recentMetrics.map(m => m.errorRate));
      this.analyzeTrendForMetric('aiCacheHitRate', recentMetrics.map(m => m.aiCacheHitRate));
      this.analyzeTrendForMetric('playerCount', recentMetrics.map(m => m.playerCount));
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'Error analyzing performance trends',
        error
      );
    }
  }

  /**
   * Analyze trend for a specific metric
   */
  private analyzeTrendForMetric(metricName: string, values: number[]): void {
    if (values.length < 5) return;

    // Calculate linear regression to determine trend
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((sum, x) => sum + x, 0);
    const sumY = values.reduce((sum, y) => sum + y, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const correlation = this.calculateCorrelation(indices, values);
    
    // Determine trend direction and strength
    let trend: 'improving' | 'degrading' | 'stable';
    let trendStrength = Math.abs(correlation);
    
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else {
      // For metrics like frameTime and errorRate, negative slope is improving
      // For metrics like aiCacheHitRate, positive slope is improving
      const isImproving = ['frameTime', 'memoryUsage', 'errorRate'].includes(metricName) 
        ? slope < 0 
        : slope > 0;
      
      trend = isImproving ? 'improving' : 'degrading';
    }

    // Store trend
    this.trends.set(metricName, {
      metric: metricName,
      values: [...values],
      timestamps: this.metricsHistory.slice(-values.length).map(m => m.timestamp),
      trend,
      trendStrength
    });

    // Create alert for strong negative trends
    if (trend === 'degrading' && trendStrength > 0.7) {
      this.createAlert(
        'warning',
        'trend',
        `${metricName} showing degrading trend (strength: ${(trendStrength * 100).toFixed(0)}%)`
      );
    }
  }

  /**
   * Calculate correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Send real-time updates to connected clients
   */
  private sendClientUpdates(): void {
    try {
      const players = this.world.entityManager?.getAllPlayerEntities() || [];
      
      if (players.length === 0) {
        return; // No players to send to
      }

      const latestMetrics = this.getLatestMetrics();
      const recentTrends = this.getRecentTrends();
      const activeAlerts = this.getActiveAlerts();

      const dashboardData = {
        type: 'performance-dashboard',
        timestamp: Date.now(),
        metrics: latestMetrics,
        trends: recentTrends,
        alerts: activeAlerts,
        config: {
          optimizationLevel: this.getOptimizationLevel(),
          targets: this.performanceTarget
        }
      };

      // Send to all connected players (for development/admin purposes)
      players.forEach(player => {
        try {
          if (player.player?.ui && typeof player.player.ui.sendData === 'function') {
            player.player.ui.sendData(dashboardData);
          }
        } catch (error) {
          // Ignore individual player send errors
        }
      });

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.UI,
        ErrorSeverity.LOW,
        'Error sending dashboard updates to clients',
        error
      );
    }
  }

  /**
   * Get latest metrics for client
   */
  getLatestMetrics(): DashboardMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  /**
   * Get recent trends for client
   */
  getRecentTrends(): PerformanceTrend[] {
    return Array.from(this.trends.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): DashboardAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get full metrics history
   */
  getMetricsHistory(): DashboardMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear all acknowledged alerts
   */
  clearAcknowledgedAlerts(): number {
    let cleared = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.acknowledged) {
        this.alerts.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Update dashboard configuration
   */
  updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart with new config if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    
    console.log('📊 Dashboard configuration updated:', newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /**
   * Get default metrics when profiler is not available
   */
  private getDefaultMetrics(): PerformanceMetrics {
    return {
      frameTime: 16.67,
      aiDecisionTime: 0,
      physicsTime: 0,
      renderTime: 0,
      memoryUsage: process.memoryUsage(),
      entityCount: 0,
      playerCount: 0,
      activePowerUps: 0
    };
  }

  /**
   * Get performance target based on optimization level
   */
  private getPerformanceTarget(level: OptimizationLevel): PerformanceTarget {
    const targets = {
      HIGH_PERFORMANCE: {
        targetFrameTime: 16.67,
        maxAIDecisionTime: 20,
        maxPhysicsTime: 10,
        maxMemoryUsage: 512 * 1024 * 1024,
        maxEntityCount: 200
      },
      BALANCED: {
        targetFrameTime: 20,
        maxAIDecisionTime: 30,
        maxPhysicsTime: 15,
        maxMemoryUsage: 768 * 1024 * 1024,
        maxEntityCount: 300
      },
      HIGH_QUALITY: {
        targetFrameTime: 33.33,
        maxAIDecisionTime: 50,
        maxPhysicsTime: 25,
        maxMemoryUsage: 1024 * 1024 * 1024,
        maxEntityCount: 500
      },
      MOBILE: {
        targetFrameTime: 33.33,
        maxAIDecisionTime: 40,
        maxPhysicsTime: 20,
        maxMemoryUsage: 256 * 1024 * 1024,
        maxEntityCount: 150
      }
    };
    
    return targets[level];
  }

  /**
   * Get current optimization level (would need integration with config system)
   */
  private getOptimizationLevel(): OptimizationLevel {
    return 'HIGH_PERFORMANCE'; // Default
  }

  /**
   * Export dashboard data for analysis
   */
  exportData(): string {
    const exportData = {
      config: this.config,
      metricsHistory: this.metricsHistory,
      trends: Array.from(this.trends.entries()),
      alerts: Array.from(this.alerts.entries()),
      exported: new Date().toISOString()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Cleanup dashboard resources
   */
  cleanup(): void {
    this.stop();
    this.metricsHistory = [];
    this.trends.clear();
    this.alerts.clear();
    console.log('📊 Performance Dashboard cleaned up');
  }
}

// Export utility function to create dashboard
export function createPerformanceDashboard(
  world: SoccerWorld, 
  optimizationLevel: OptimizationLevel = 'HIGH_PERFORMANCE'
): PerformanceDashboard {
  return new PerformanceDashboard(world, optimizationLevel);
}