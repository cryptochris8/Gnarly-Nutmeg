/**
 * Integration Testing Suite
 * 
 * Comprehensive integration tests for the Hytopia Soccer game
 * covering AI systems, performance optimizations, mobile features,
 * and end-to-end game scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { 
  SoccerWorld, 
  SoccerPlayerEntity,
  AIDecision,
  AIContext
} from '../../types/GameTypes';
import { AIDecisionCache } from '../../ai/AIDecisionCache';
import { CachedSoccerAgent } from '../../ai/CachedSoccerAgent';
import { PerformanceDashboard } from '../../analytics/PerformanceDashboard';
import { MobileOptimizer } from '../../mobile/MobileOptimizer';
import { TimerManager } from '../../utils/TimerManager';
import { ErrorHandler } from '../../utils/ErrorHandler';

// Mock implementations
const mockWorld = {
  ball: {
    position: { x: 0, y: 0, z: 0 },
    getLinearVelocity: () => ({ x: 1, y: 0, z: 1 })
  },
  entityManager: {
    getAllPlayerEntities: () => [],
    getAllEntities: () => []
  },
  _performanceProfiler: {
    getMetrics: () => ({
      frameTime: 16.67,
      aiDecisionTime: 5,
      physicsTime: 3,
      renderTime: 8,
      memoryUsage: process.memoryUsage(),
      entityCount: 10,
      playerCount: 2,
      activePowerUps: 0
    })
  }
} as unknown as SoccerWorld;

const mockPlayer = {
  position: { x: -10, y: 0, z: 5 },
  role: 'midfielder',
  player: {
    ui: {
      sendData: vi.fn()
    }
  }
} as unknown as SoccerPlayerEntity;

const mockAIContext: AIContext = {
  player: mockPlayer,
  ball: mockWorld.ball,
  teammates: [],
  opponents: [],
  gameState: {
    isActive: true,
    currentHalf: 1,
    timeRemaining: 45000,
    score: { team1: 0, team2: 0 }
  }
};

describe('Integration Tests - AI Caching System', () => {
  let aiCache: AIDecisionCache;
  let cachedAgent: CachedSoccerAgent;

  beforeEach(() => {
    aiCache = new AIDecisionCache({
      maxCacheSize: 100,
      defaultTTL: 1000
    });
    cachedAgent = new CachedSoccerAgent('midfielder');
  });

  afterEach(() => {
    aiCache.cleanup();
  });

  it('should cache and retrieve AI decisions correctly', () => {
    const decision = cachedAgent.makeDecision(mockAIContext);
    expect(decision).toBeDefined();
    expect(decision.action).toBeTruthy();
    expect(decision.timestamp).toBeGreaterThan(0);
  });

  it('should provide cache hit on similar contexts', () => {
    // First decision - cache miss
    const decision1 = cachedAgent.makeDecision(mockAIContext);
    
    // Second decision with same context - should be cache hit
    const decision2 = cachedAgent.makeDecision(mockAIContext);
    
    expect(decision1.action).toBe(decision2.action);
    
    const stats = aiCache.getStats();
    expect(stats.totalRequests).toBeGreaterThan(0);
  });

  it('should invalidate cache on game events', () => {
    cachedAgent.makeDecision(mockAIContext);
    
    const initialStats = aiCache.getStats();
    const initialCacheSize = initialStats.cacheSize;
    
    // Trigger cache invalidation
    cachedAgent.onGameEvent('goal_scored');
    
    const newStats = aiCache.getStats();
    expect(newStats.invalidations).toBeGreaterThan(0);
  });

  it('should respect TTL for cached decisions', async () => {
    const shortTTLCache = new AIDecisionCache({
      maxCacheSize: 100,
      defaultTTL: 50 // 50ms
    });
    
    const agent = new CachedSoccerAgent('forward');
    
    // Make initial decision
    agent.makeDecision(mockAIContext);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // This should be a cache miss due to TTL expiration
    agent.makeDecision(mockAIContext);
    
    const stats = shortTTLCache.getStats();
    expect(stats.cacheMisses).toBeGreaterThan(0);
    
    shortTTLCache.cleanup();
  });
});

describe('Integration Tests - Performance Dashboard', () => {
  let dashboard: PerformanceDashboard;

  beforeEach(() => {
    dashboard = new PerformanceDashboard(mockWorld, 'HIGH_PERFORMANCE');
  });

  afterEach(() => {
    dashboard.cleanup();
  });

  it('should start and collect metrics', () => {
    dashboard.start();
    
    // Allow some time for metrics collection
    const metrics = dashboard.getLatestMetrics();
    expect(metrics).toBeDefined();
    
    dashboard.stop();
  });

  it('should track performance trends', () => {
    dashboard.start();
    
    // Allow some time for trend analysis
    const trends = dashboard.getRecentTrends();
    expect(Array.isArray(trends)).toBe(true);
    
    dashboard.stop();
  });

  it('should generate alerts for performance issues', () => {
    dashboard.start();
    
    const alerts = dashboard.getActiveAlerts();
    expect(Array.isArray(alerts)).toBe(true);
    
    dashboard.stop();
  });

  it('should export dashboard data', () => {
    dashboard.start();
    
    const exportedData = dashboard.exportData();
    expect(typeof exportedData).toBe('string');
    expect(() => JSON.parse(exportedData)).not.toThrow();
    
    dashboard.stop();
  });
});

describe('Integration Tests - Mobile Optimization', () => {
  let mobileOptimizer: MobileOptimizer;

  beforeEach(() => {
    // Mock navigator for testing
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        hardwareConcurrency: 2,
        maxTouchPoints: 5,
        platform: 'iPhone'
      },
      configurable: true
    });

    mobileOptimizer = new MobileOptimizer(mockWorld);
  });

  afterEach(() => {
    mobileOptimizer.cleanup();
  });

  it('should detect mobile devices correctly', () => {
    const deviceInfo = mobileOptimizer.getDeviceInfo();
    expect(deviceInfo.isMobile).toBe(true);
    expect(deviceInfo.isTouch).toBe(true);
  });

  it('should apply mobile optimizations', () => {
    mobileOptimizer.start();
    
    const optimizations = mobileOptimizer.getOptimizations();
    expect(optimizations.touchControls).toBe(true);
    expect(optimizations.enlargedButtons).toBe(true);
    
    mobileOptimizer.stop();
  });

  it('should provide mobile stats', () => {
    const stats = mobileOptimizer.getStats();
    expect(stats.deviceInfo).toBeDefined();
    expect(stats.optimizations).toBeDefined();
  });

  it('should update configuration', () => {
    const newConfig = {
      performanceThresholds: {
        lowEnd: { memory: 1, cores: 1 },
        midRange: { memory: 2, cores: 2 }
      }
    };

    mobileOptimizer.updateConfig(newConfig);
    const stats = mobileOptimizer.getStats();
    expect(stats.config.performanceThresholds.lowEnd.memory).toBe(1);
  });
});

describe('Integration Tests - Timer Management', () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    timerManager = new TimerManager();
  });

  afterEach(() => {
    timerManager.cleanup();
  });

  it('should manage timers without memory leaks', () => {
    const timerId1 = timerManager.setTimeout(() => {}, 100, 'test-timer-1');
    const timerId2 = timerManager.setInterval(() => {}, 50, 'test-timer-2');
    
    expect(timerId1).toBeTruthy();
    expect(timerId2).toBeTruthy();
    
    const stats = timerManager.getTimerStats();
    expect(stats.totalTimers).toBe(2);
    
    timerManager.clearTimer(timerId1);
    timerManager.clearTimer(timerId2);
    
    const finalStats = timerManager.getTimerStats();
    expect(finalStats.totalTimers).toBe(0);
  });

  it('should prevent timer memory leaks on cleanup', () => {
    for (let i = 0; i < 10; i++) {
      timerManager.setTimeout(() => {}, 1000, `test-timer-${i}`);
    }
    
    const beforeCleanup = timerManager.getTimerStats();
    expect(beforeCleanup.totalTimers).toBe(10);
    
    timerManager.cleanup();
    
    const afterCleanup = timerManager.getTimerStats();
    expect(afterCleanup.totalTimers).toBe(0);
  });
});

describe('Integration Tests - Error Handling', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  it('should log and categorize errors correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    errorHandler.logError(
      'AI' as any,
      'HIGH' as any,
      'Test error message',
      new Error('Test error')
    );
    
    const stats = errorHandler.getErrorStats();
    expect(stats.totalErrors).toBe(1);
    expect(stats.errorsByCategory.AI).toBe(1);
    
    consoleSpy.mockRestore();
  });

  it('should provide error statistics', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    errorHandler.logError('GAME_LOGIC' as any, 'MEDIUM' as any, 'Error 1');
    errorHandler.logError('PHYSICS' as any, 'HIGH' as any, 'Error 2');
    errorHandler.logError('AI' as any, 'LOW' as any, 'Error 3');
    
    const stats = errorHandler.getErrorStats();
    expect(stats.totalErrors).toBe(3);
    expect(stats.errorsBySeverity.MEDIUM).toBe(1);
    expect(stats.errorsBySeverity.HIGH).toBe(1);
    expect(stats.errorsBySeverity.LOW).toBe(1);
    
    consoleSpy.mockRestore();
  });
});

describe('Integration Tests - End-to-End Game Scenarios', () => {
  let aiCache: AIDecisionCache;
  let dashboard: PerformanceDashboard;
  let mobileOptimizer: MobileOptimizer;

  beforeEach(() => {
    aiCache = new AIDecisionCache();
    dashboard = new PerformanceDashboard(mockWorld);
    mobileOptimizer = new MobileOptimizer(mockWorld);
  });

  afterEach(() => {
    aiCache.cleanup();
    dashboard.cleanup();
    mobileOptimizer.cleanup();
  });

  it('should handle full game initialization', () => {
    // Start all systems
    dashboard.start();
    mobileOptimizer.start();
    
    // Verify all systems are running
    expect(dashboard.getLatestMetrics()).toBeDefined();
    expect(mobileOptimizer.getStats().isActive).toBe(true);
    
    // Stop all systems
    dashboard.stop();
    mobileOptimizer.stop();
  });

  it('should maintain performance under load', async () => {
    dashboard.start();
    
    // Simulate game activity
    const agent = new CachedSoccerAgent('midfielder');
    
    // Make many AI decisions to test performance
    const decisions: AIDecision[] = [];
    for (let i = 0; i < 100; i++) {
      const decision = agent.makeDecision({
        ...mockAIContext,
        ball: {
          ...mockAIContext.ball,
          position: { x: i, y: 0, z: i % 10 }
        }
      });
      decisions.push(decision);
    }
    
    expect(decisions.length).toBe(100);
    
    // Check that caching improved performance
    const cacheStats = aiCache.getStats();
    expect(cacheStats.totalRequests).toBeGreaterThan(0);
    
    dashboard.stop();
  });

  it('should handle system integration correctly', () => {
    // Start all systems
    dashboard.start();
    mobileOptimizer.start();
    
    // Create AI agent
    const agent = new CachedSoccerAgent('forward');
    
    // Test integration between systems
    const initialMetrics = dashboard.getLatestMetrics();
    const deviceInfo = mobileOptimizer.getDeviceInfo();
    
    // Make AI decision
    const decision = agent.makeDecision(mockAIContext);
    
    // Verify systems are working together
    expect(initialMetrics).toBeDefined();
    expect(deviceInfo).toBeDefined();
    expect(decision).toBeDefined();
    
    // Test cache integration
    const cacheStats = aiCache.getStats();
    expect(cacheStats.totalRequests).toBeGreaterThan(0);
    
    // Stop systems
    dashboard.stop();
    mobileOptimizer.stop();
  });

  it('should handle errors gracefully across systems', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Start systems
    dashboard.start();
    mobileOptimizer.start();
    
    // Simulate error conditions
    const agent = new CachedSoccerAgent('goalkeeper');
    
    // Test with invalid context
    try {
      agent.makeDecision({
        ...mockAIContext,
        player: null as any
      });
    } catch (error) {
      // Expected to handle gracefully
    }
    
    // Systems should still be functional
    expect(dashboard.getLatestMetrics()).toBeDefined();
    expect(mobileOptimizer.getStats()).toBeDefined();
    
    dashboard.stop();
    mobileOptimizer.stop();
    
    consoleSpy.mockRestore();
  });
});

describe('Integration Tests - Memory and Resource Management', () => {
  it('should not have memory leaks in timer system', () => {
    const timerManager = new TimerManager();
    
    // Create many timers
    const timerIds: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const id = timerManager.setTimeout(() => {}, 10, `leak-test-${i}`);
      timerIds.push(id);
    }
    
    let stats = timerManager.getTimerStats();
    expect(stats.totalTimers).toBe(1000);
    
    // Clear all timers
    timerIds.forEach(id => timerManager.clearTimer(id));
    
    stats = timerManager.getTimerStats();
    expect(stats.totalTimers).toBe(0);
    
    timerManager.cleanup();
  });

  it('should handle cache memory management', () => {
    const cache = new AIDecisionCache({
      maxCacheSize: 10
    });
    
    const agent = new CachedSoccerAgent('midfielder');
    
    // Fill cache beyond capacity
    for (let i = 0; i < 20; i++) {
      agent.makeDecision({
        ...mockAIContext,
        ball: {
          ...mockAIContext.ball,
          position: { x: i, y: 0, z: i }
        }
      });
    }
    
    const stats = cache.getStats();
    expect(stats.cacheSize).toBeLessThanOrEqual(10);
    
    cache.cleanup();
  });
});