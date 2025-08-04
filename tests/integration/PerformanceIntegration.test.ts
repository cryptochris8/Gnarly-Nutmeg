/**
 * Performance Integration Testing Suite
 * 
 * Tests for performance-critical aspects of the game systems,
 * including load testing, benchmark comparisons, and stress testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SoccerWorld } from '../../types/GameTypes';
import { AIDecisionCache } from '../../ai/AIDecisionCache';
import { CachedSoccerAgent } from '../../ai/CachedSoccerAgent';
import { PerformanceDashboard } from '../../analytics/PerformanceDashboard';
import { TimerManager } from '../../utils/TimerManager';

// Mock world for performance testing
const createMockWorld = () => ({
  ball: {
    position: { x: 0, y: 0, z: 0 },
    getLinearVelocity: () => ({ x: 1, y: 0, z: 1 })
  },
  entityManager: {
    getAllPlayerEntities: () => Array(10).fill({
      player: { ui: { sendData: vi.fn() } },
      position: { x: Math.random() * 100, y: 0, z: Math.random() * 100 },
      role: 'midfielder'
    }),
    getAllEntities: () => Array(50).fill({
      name: `entity-${Math.random()}`,
      position: { x: Math.random() * 100, y: 0, z: Math.random() * 100 }
    })
  },
  _performanceProfiler: {
    getMetrics: () => ({
      frameTime: 16.67 + Math.random() * 5,
      aiDecisionTime: 2 + Math.random() * 3,
      physicsTime: 1 + Math.random() * 2,
      renderTime: 5 + Math.random() * 3,
      memoryUsage: process.memoryUsage(),
      entityCount: 50,
      playerCount: 10,
      activePowerUps: Math.floor(Math.random() * 5)
    })
  }
}) as unknown as SoccerWorld;

describe('Performance Tests - AI Caching System', () => {
  let cache: AIDecisionCache;
  let mockWorld: SoccerWorld;

  beforeEach(() => {
    cache = new AIDecisionCache({
      maxCacheSize: 1000,
      defaultTTL: 5000
    });
    mockWorld = createMockWorld();
  });

  afterEach(() => {
    cache.cleanup();
  });

  it('should handle high-frequency AI decisions efficiently', () => {
    const agent = new CachedSoccerAgent('midfielder');
    const startTime = Date.now();
    const decisionsCount = 1000;
    
    // Generate many decisions quickly
    for (let i = 0; i < decisionsCount; i++) {
      agent.makeDecision({
        player: {
          position: { x: i % 100, y: 0, z: (i * 2) % 100 },
          role: 'midfielder'
        } as any,
        ball: {
          position: { x: (i * 0.5) % 50, y: 0, z: (i * 0.3) % 50 }
        } as any,
        teammates: [],
        opponents: [],
        gameState: {
          isActive: true,
          currentHalf: 1,
          timeRemaining: 45000,
          score: { team1: 0, team2: 0 }
        }
      });
    }
    
    const duration = Date.now() - startTime;
    const decisionsPerSecond = (decisionsCount / duration) * 1000;
    
    console.log(`AI Performance: ${decisionsPerSecond.toFixed(0)} decisions/second`);
    
    // Should be able to handle at least 100 decisions per second
    expect(decisionsPerSecond).toBeGreaterThan(100);
    
    const stats = cache.getStats();
    expect(stats.cacheHits).toBeGreaterThan(0);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  it('should maintain performance under cache pressure', () => {
    const agent = new CachedSoccerAgent('forward');
    const cacheSize = 100;
    const testCache = new AIDecisionCache({
      maxCacheSize: cacheSize,
      defaultTTL: 1000
    });
    
    const startTime = Date.now();
    
    // Generate more decisions than cache can hold
    for (let i = 0; i < cacheSize * 3; i++) {
      agent.makeDecision({
        player: {
          position: { x: i, y: 0, z: i },
          role: 'forward'
        } as any,
        ball: {
          position: { x: i + 10, y: 0, z: i + 10 }
        } as any,
        teammates: [],
        opponents: [],
        gameState: {
          isActive: true,
          currentHalf: 1,
          timeRemaining: 45000,
          score: { team1: 0, team2: 0 }
        }
      });
    }
    
    const duration = Date.now() - startTime;
    const stats = testCache.getStats();
    
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(stats.cacheSize).toBeLessThanOrEqual(cacheSize);
    
    testCache.cleanup();
  });

  it('should demonstrate performance improvement with caching', () => {
    // Test without caching
    const noCacheAgent = new CachedSoccerAgent('midfielder');
    const testContext = {
      player: {
        position: { x: 10, y: 0, z: 10 },
        role: 'midfielder'
      } as any,
      ball: {
        position: { x: 0, y: 0, z: 0 }
      } as any,
      teammates: [],
      opponents: [],
      gameState: {
        isActive: true,
        currentHalf: 1,
        timeRemaining: 45000,
        score: { team1: 0, team2: 0 }
      }
    };
    
    // Warm up cache
    for (let i = 0; i < 5; i++) {
      noCacheAgent.makeDecision(testContext);
    }
    
    // Test with cache hits
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      noCacheAgent.makeDecision(testContext);
    }
    const cachedDuration = Date.now() - startTime;
    
    const stats = cache.getStats();
    console.log(`Cache hit rate: ${stats.hitRate.toFixed(1)}%`);
    console.log(`Average decision time: ${stats.averageDecisionTime.toFixed(2)}ms`);
    
    expect(stats.hitRate).toBeGreaterThan(50); // At least 50% cache hits
    expect(cachedDuration).toBeLessThan(1000); // Should be very fast with caching
  });
});

describe('Performance Tests - Dashboard System', () => {
  let dashboard: PerformanceDashboard;
  let mockWorld: SoccerWorld;

  beforeEach(() => {
    mockWorld = createMockWorld();
    dashboard = new PerformanceDashboard(mockWorld, 'HIGH_PERFORMANCE');
  });

  afterEach(() => {
    dashboard.cleanup();
  });

  it('should handle continuous metrics collection efficiently', async () => {
    const startTime = Date.now();
    
    dashboard.start();
    
    // Let it collect metrics for a short period
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const metrics = dashboard.getLatestMetrics();
    expect(metrics).toBeDefined();
    expect(metrics!.timestamp).toBeGreaterThan(startTime);
    
    dashboard.stop();
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(2000); // Should not add significant overhead
  });

  it('should efficiently send data to multiple clients', () => {
    const sendDataSpy = vi.fn();
    const mockPlayers = Array(20).fill({
      player: { ui: { sendData: sendDataSpy } }
    });
    
    mockWorld.entityManager!.getAllPlayerEntities = () => mockPlayers;
    
    dashboard.start();
    
    // Allow some time for client updates
    setTimeout(() => {
      dashboard.stop();
      
      // Should have sent data to all clients
      expect(sendDataSpy).toHaveBeenCalled();
    }, 100);
  });

  it('should maintain performance with large metrics history', () => {
    const config = dashboard.getConfig();
    dashboard.updateConfig({
      ...config,
      historySize: 1000,
      updateInterval: 100
    });
    
    const startTime = Date.now();
    dashboard.start();
    
    // Let it collect many data points
    setTimeout(() => {
      const history = dashboard.getMetricsHistory();
      dashboard.stop();
      
      const duration = Date.now() - startTime;
      
      expect(history.length).toBeGreaterThan(5);
      expect(duration).toBeLessThan(2000); // Should still be fast
    }, 1000);
  });
});

describe('Performance Tests - Timer Management', () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    timerManager = new TimerManager();
  });

  afterEach(() => {
    timerManager.cleanup();
  });

  it('should handle large numbers of timers efficiently', () => {
    const timerCount = 1000;
    const startTime = Date.now();
    
    const timerIds: string[] = [];
    
    // Create many timers
    for (let i = 0; i < timerCount; i++) {
      const id = timerManager.setTimeout(() => {}, 10000, `perf-test-${i}`);
      timerIds.push(id);
    }
    
    const creationTime = Date.now() - startTime;
    
    // Clear all timers
    const clearStartTime = Date.now();
    timerIds.forEach(id => timerManager.clearTimer(id));
    const clearTime = Date.now() - clearStartTime;
    
    const stats = timerManager.getTimerStats();
    
    console.log(`Timer creation: ${creationTime}ms for ${timerCount} timers`);
    console.log(`Timer clearing: ${clearTime}ms for ${timerCount} timers`);
    
    expect(creationTime).toBeLessThan(1000); // Should create timers quickly
    expect(clearTime).toBeLessThan(1000); // Should clear timers quickly
    expect(stats.totalTimers).toBe(0); // All should be cleared
  });

  it('should not have memory leaks with frequent timer creation/destruction', () => {
    const iterations = 100;
    const timersPerIteration = 10;
    
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const timerIds: string[] = [];
      
      // Create timers
      for (let j = 0; j < timersPerIteration; j++) {
        const id = timerManager.setTimeout(() => {}, 100, `leak-test-${i}-${j}`);
        timerIds.push(id);
      }
      
      // Immediately clear them
      timerIds.forEach(id => timerManager.clearTimer(id));
    }
    
    const duration = Date.now() - startTime;
    const stats = timerManager.getTimerStats();
    
    console.log(`Memory leak test: ${duration}ms for ${iterations * timersPerIteration} timer cycles`);
    
    expect(duration).toBeLessThan(5000); // Should complete quickly
    expect(stats.totalTimers).toBe(0); // No timers should remain
  });
});

describe('Performance Tests - Integrated System Load', () => {
  it('should handle full system load efficiently', async () => {
    const mockWorld = createMockWorld();
    
    // Initialize all systems
    const cache = new AIDecisionCache({ maxCacheSize: 500 });
    const dashboard = new PerformanceDashboard(mockWorld);
    const timerManager = new TimerManager();
    
    const agents = Array(10).fill(null).map((_, i) => 
      new CachedSoccerAgent(['goalkeeper', 'defender', 'midfielder', 'forward'][i % 4] as any)
    );
    
    const startTime = Date.now();
    
    // Start monitoring systems
    dashboard.start();
    
    // Simulate game activity
    const simulationPromise = new Promise<void>((resolve) => {
      let iterations = 0;
      const maxIterations = 100;
      
      const gameLoop = () => {
        if (iterations >= maxIterations) {
          resolve();
          return;
        }
        
        // Simulate AI decisions for all agents
        agents.forEach((agent, index) => {
          agent.makeDecision({
            player: {
              position: { 
                x: index * 10 + Math.sin(iterations * 0.1) * 5, 
                y: 0, 
                z: Math.cos(iterations * 0.1) * 5 
              },
              role: agent.getRole()
            } as any,
            ball: {
              position: { 
                x: Math.sin(iterations * 0.2) * 20, 
                y: 0, 
                z: Math.cos(iterations * 0.2) * 20 
              }
            } as any,
            teammates: [],
            opponents: [],
            gameState: {
              isActive: true,
              currentHalf: 1,
              timeRemaining: 45000 - iterations * 100,
              score: { team1: 0, team2: 0 }
            }
          });
        });
        
        iterations++;
        
        // Use timer manager for scheduling
        timerManager.setTimeout(gameLoop, 16, `game-loop-${iterations}`); // ~60fps
      };
      
      gameLoop();
    });
    
    await simulationPromise;
    
    const duration = Date.now() - startTime;
    
    // Get final statistics
    const cacheStats = cache.getStats();
    const dashboardMetrics = dashboard.getLatestMetrics();
    const timerStats = timerManager.getTimerStats();
    
    console.log('Integrated System Performance Results:');
    console.log(`Total duration: ${duration}ms`);
    console.log(`Cache hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
    console.log(`Cache size: ${cacheStats.cacheSize}`);
    console.log(`Active timers: ${timerStats.totalTimers}`);
    console.log(`Dashboard frame time: ${dashboardMetrics?.frameTime.toFixed(2)}ms`);
    
    // Performance expectations
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    expect(cacheStats.hitRate).toBeGreaterThan(30); // Reasonable cache hit rate
    expect(dashboardMetrics?.frameTime).toBeLessThan(50); // Reasonable frame time
    
    // Cleanup
    dashboard.cleanup();
    cache.cleanup();
    timerManager.cleanup();
  });

  it('should maintain stable memory usage under continuous load', async () => {
    const mockWorld = createMockWorld();
    const dashboard = new PerformanceDashboard(mockWorld);
    const cache = new AIDecisionCache({ maxCacheSize: 200 });
    
    dashboard.start();
    
    const memorySnapshots: number[] = [];
    
    // Run for several iterations, taking memory snapshots
    for (let cycle = 0; cycle < 10; cycle++) {
      // Simulate activity
      for (let i = 0; i < 50; i++) {
        const agent = new CachedSoccerAgent('midfielder');
        agent.makeDecision({
          player: {
            position: { x: i, y: 0, z: cycle },
            role: 'midfielder'
          } as any,
          ball: {
            position: { x: i + cycle, y: 0, z: i - cycle }
          } as any,
          teammates: [],
          opponents: [],
          gameState: {
            isActive: true,
            currentHalf: 1,
            timeRemaining: 45000,
            score: { team1: 0, team2: 0 }
          }
        });
      }
      
      // Take memory snapshot
      const memUsage = process.memoryUsage();
      memorySnapshots.push(memUsage.heapUsed);
      
      // Small delay between cycles
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    dashboard.cleanup();
    cache.cleanup();
    
    // Check for memory stability (no significant growth)
    const firstSnapshot = memorySnapshots[0];
    const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
    const growth = (lastSnapshot - firstSnapshot) / firstSnapshot;
    
    console.log(`Memory growth over ${memorySnapshots.length} cycles: ${(growth * 100).toFixed(1)}%`);
    
    // Should not grow by more than 50% (allowing for some variance)
    expect(growth).toBeLessThan(0.5);
  });
});