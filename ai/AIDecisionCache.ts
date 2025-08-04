/**
 * Advanced AI Decision Caching System
 * 
 * Provides intelligent caching of AI decisions to reduce computational overhead
 * and improve game performance while maintaining realistic AI behavior.
 * 
 * Features:
 * - Context-aware caching with game state fingerprinting
 * - Cache invalidation based on significant state changes
 * - Performance metrics and cache effectiveness tracking
 * - Memory-efficient storage with automatic cleanup
 * - Configurable cache sizes and TTL
 */

import type { 
  AIDecision, 
  AIContext, 
  SoccerPlayerEntity as ISoccerPlayerEntity,
  Vector3Like,
  SoccerRole,
  AIAction 
} from '../types/GameTypes';
import { timerManager } from '../utils/TimerManager';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';

export interface CacheKey {
  playerRole: SoccerRole;
  ballPosition: string;      // Quantized ball position
  playerPosition: string;    // Quantized player position
  gamePhase: string;         // Attack/defense/neutral
  proximityHash: string;     // Nearby players hash
}

export interface CachedDecision {
  decision: AIDecision;
  timestamp: number;
  hitCount: number;
  gameStateHash: string;
  ttl: number;  // Time to live in milliseconds
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageDecisionTime: number;
  cacheSize: number;
  memoryUsage: number;
  invalidations: number;
  oldestEntry: number;
}

export interface CacheConfig {
  maxCacheSize: number;
  defaultTTL: number;        // Default time to live
  positionQuantization: number;  // Grid size for position quantization
  minTimeBetweenSimilarDecisions: number; // Prevent rapid cache invalidation
  enableMetrics: boolean;
  cleanupInterval: number;   // How often to clean expired entries
}

export class AIDecisionCache {
  private cache = new Map<string, CachedDecision>();
  private stats: CacheStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    averageDecisionTime: 0,
    cacheSize: 0,
    memoryUsage: 0,
    invalidations: 0,
    oldestEntry: 0
  };
  
  private config: CacheConfig = {
    maxCacheSize: 1000,
    defaultTTL: 5000,         // 5 seconds default
    positionQuantization: 2.0, // 2-unit grid
    minTimeBetweenSimilarDecisions: 500, // 500ms minimum
    enableMetrics: true,
    cleanupInterval: 10000    // 10 seconds
  };

  private decisionTimes: number[] = [];
  private lastCleanup = Date.now();
  private cleanupTimerId?: string;

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    console.log('🧠 AI Decision Cache initialized');
    console.log(`📊 Cache config: Max size: ${this.config.maxCacheSize}, TTL: ${this.config.defaultTTL}ms, Quantization: ${this.config.positionQuantization}`);
  }

  /**
   * Attempt to get a cached decision for the given context
   */
  getCachedDecision(context: AIContext): AIDecision | null {
    try {
      const startTime = Date.now();
      this.stats.totalRequests++;

      const cacheKey = this.generateCacheKey(context);
      const keyString = this.serializeCacheKey(cacheKey);
      
      const cached = this.cache.get(keyString);
      
      if (cached && this.isValidCachedDecision(cached, context)) {
        // Cache hit!
        cached.hitCount++;
        this.stats.cacheHits++;
        
        const decisionTime = Date.now() - startTime;
        this.recordDecisionTime(decisionTime);
        
        console.log(`🎯 AI CACHE HIT: ${context.player.role} - ${cached.decision.action} (hit count: ${cached.hitCount})`);
        
        return cached.decision;
      }

      // Cache miss
      this.stats.cacheMisses++;
      this.updateStats();
      
      return null;
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.AI,
        ErrorSeverity.LOW,
        'Error getting cached AI decision',
        error,
        { playerRole: context.player.role }
      );
      return null;
    }
  }

  /**
   * Cache a new AI decision
   */
  cacheDecision(context: AIContext, decision: AIDecision): void {
    try {
      // Don't cache certain actions that should always be fresh
      if (this.shouldNotCache(decision)) {
        return;
      }

      const cacheKey = this.generateCacheKey(context);
      const keyString = this.serializeCacheKey(cacheKey);
      
      const gameStateHash = this.generateGameStateHash(context);
      const ttl = this.calculateTTL(decision, context);
      
      const cachedDecision: CachedDecision = {
        decision: { ...decision }, // Clone the decision
        timestamp: Date.now(),
        hitCount: 0,
        gameStateHash,
        ttl
      };

      // Check if we need to evict old entries
      if (this.cache.size >= this.config.maxCacheSize) {
        this.evictOldEntries();
      }

      this.cache.set(keyString, cachedDecision);
      
      console.log(`🧠 AI CACHED: ${context.player.role} - ${decision.action} (TTL: ${ttl}ms)`);
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.AI,
        ErrorSeverity.LOW,
        'Error caching AI decision',
        error,
        { playerRole: context.player.role, action: decision.action }
      );
    }
  }

  /**
   * Invalidate cache entries when significant game state changes occur
   */
  invalidateCache(reason: string, selective?: (key: CacheKey) => boolean): void {
    try {
      let invalidatedCount = 0;
      
      if (selective) {
        // Selective invalidation
        for (const [keyString, cached] of this.cache.entries()) {
          try {
            const key = this.deserializeCacheKey(keyString);
            if (selective(key)) {
              this.cache.delete(keyString);
              invalidatedCount++;
            }
          } catch (error) {
            // If we can't deserialize the key, remove it
            this.cache.delete(keyString);
            invalidatedCount++;
          }
        }
      } else {
        // Full cache invalidation
        invalidatedCount = this.cache.size;
        this.cache.clear();
      }
      
      this.stats.invalidations += invalidatedCount;
      
      if (invalidatedCount > 0) {
        console.log(`🧹 AI CACHE INVALIDATED: ${invalidatedCount} entries (reason: ${reason})`);
      }
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.AI,
        ErrorSeverity.MEDIUM,
        'Error invalidating AI cache',
        error,
        { reason }
      );
    }
  }

  /**
   * Generate a cache key from AI context
   */
  private generateCacheKey(context: AIContext): CacheKey {
    const ballPos = this.quantizePosition(context.ball.position);
    const playerPos = this.quantizePosition(context.player.position);
    
    // Determine game phase based on ball position and player positions
    const gamePhase = this.determineGamePhase(context);
    
    // Create hash of nearby players (positions and roles)
    const proximityHash = this.generateProximityHash(context);
    
    return {
      playerRole: context.player.role,
      ballPosition: `${ballPos.x},${ballPos.z}`,
      playerPosition: `${playerPos.x},${playerPos.z}`,
      gamePhase,
      proximityHash
    };
  }

  /**
   * Quantize position to grid for similar position matching
   */
  private quantizePosition(position: Vector3Like): { x: number, z: number } {
    const grid = this.config.positionQuantization;
    return {
      x: Math.round(position.x / grid) * grid,
      z: Math.round(position.z / grid) * grid
    };
  }

  /**
   * Determine current game phase for context-aware caching
   */
  private determineGamePhase(context: AIContext): string {
    const ballX = context.ball.position.x;
    const playerX = context.player.position.x;
    
    // Simple phase determination based on field position
    if (ballX < -15) return 'defensive';
    if (ballX > 25) return 'attacking';
    
    // Check if player is closer to ball than teammates
    const distanceToBall = Math.sqrt(
      Math.pow(playerX - ballX, 2) + 
      Math.pow(context.player.position.z - context.ball.position.z, 2)
    );
    
    const teammateDistances = context.teammates.map(teammate => 
      Math.sqrt(
        Math.pow(teammate.position.x - ballX, 2) + 
        Math.pow(teammate.position.z - context.ball.position.z, 2)
      )
    );
    
    const isClosest = teammateDistances.every(dist => distanceToBall <= dist);
    
    if (isClosest) return 'ball_control';
    
    return 'supporting';
  }

  /**
   * Generate hash of nearby players for context matching
   */
  private generateProximityHash(context: AIContext): string {
    const PROXIMITY_RANGE = 10; // 10 units
    const playerPos = context.player.position;
    
    const nearbyEntities: string[] = [];
    
    // Check teammates
    context.teammates.forEach(teammate => {
      const distance = Math.sqrt(
        Math.pow(teammate.position.x - playerPos.x, 2) +
        Math.pow(teammate.position.z - playerPos.z, 2)
      );
      
      if (distance <= PROXIMITY_RANGE) {
        const quantized = this.quantizePosition(teammate.position);
        nearbyEntities.push(`T:${teammate.role}:${quantized.x},${quantized.z}`);
      }
    });
    
    // Check opponents
    context.opponents.forEach(opponent => {
      const distance = Math.sqrt(
        Math.pow(opponent.position.x - playerPos.x, 2) +
        Math.pow(opponent.position.z - playerPos.z, 2)
      );
      
      if (distance <= PROXIMITY_RANGE) {
        const quantized = this.quantizePosition(opponent.position);
        nearbyEntities.push(`O:${opponent.role}:${quantized.x},${quantized.z}`);
      }
    });
    
    // Sort for consistent hashing
    nearbyEntities.sort();
    
    return nearbyEntities.join('|');
  }

  /**
   * Generate game state hash for cache validation
   */
  private generateGameStateHash(context: AIContext): string {
    const elements = [
      context.gameState.isActive ? '1' : '0',
      context.gameState.currentHalf.toString(),
      Math.floor(context.gameState.timeRemaining / 10000).toString(), // 10-second chunks
      context.gameState.score.team1.toString(),
      context.gameState.score.team2.toString()
    ];
    
    return elements.join(':');
  }

  /**
   * Calculate appropriate TTL based on decision type and context
   */
  private calculateTTL(decision: AIDecision, context: AIContext): number {
    // Dynamic TTL based on decision type and game situation
    switch (decision.action) {
      case 'move_to_position':
        return this.config.defaultTTL * 2; // Positional decisions can be cached longer
      
      case 'defend_goal':
        return this.config.defaultTTL * 1.5; // Defensive decisions are more stable
      
      case 'pass_ball':
      case 'shoot_ball':
        return this.config.defaultTTL * 0.5; // Ball actions need to be fresh
      
      case 'intercept':
        return this.config.defaultTTL * 0.3; // Very dynamic, short cache
      
      case 'idle':
        return this.config.defaultTTL * 3; // Idle can be cached longest
      
      default:
        return this.config.defaultTTL;
    }
  }

  /**
   * Check if certain decisions should not be cached
   */
  private shouldNotCache(decision: AIDecision): boolean {
    // Don't cache random or highly situational decisions
    if (decision.reasoning?.includes('random') || decision.reasoning?.includes('emergency')) {
      return true;
    }
    
    // Don't cache very high priority decisions (they need fresh evaluation)
    if (decision.priority > 0.9) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if cached decision is still valid
   */
  private isValidCachedDecision(cached: CachedDecision, context: AIContext): boolean {
    const now = Date.now();
    
    // Check TTL expiration
    if (now - cached.timestamp > cached.ttl) {
      return false;
    }
    
    // Check if game state hash still matches
    const currentHash = this.generateGameStateHash(context);
    if (currentHash !== cached.gameStateHash) {
      return false;
    }
    
    // Check minimum time between similar decisions
    if (now - cached.timestamp < this.config.minTimeBetweenSimilarDecisions) {
      return true; // Force use of cache to prevent decision oscillation
    }
    
    return true;
  }

  /**
   * Serialize cache key to string
   */
  private serializeCacheKey(key: CacheKey): string {
    return `${key.playerRole}|${key.ballPosition}|${key.playerPosition}|${key.gamePhase}|${key.proximityHash}`;
  }

  /**
   * Deserialize string back to cache key
   */
  private deserializeCacheKey(keyString: string): CacheKey {
    const parts = keyString.split('|');
    if (parts.length !== 5) {
      throw new Error('Invalid cache key format');
    }
    
    return {
      playerRole: parts[0] as SoccerRole,
      ballPosition: parts[1],
      playerPosition: parts[2], 
      gamePhase: parts[3],
      proximityHash: parts[4]
    };
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldEntries(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    console.log(`🧹 AI CACHE EVICTED: ${toRemove} oldest entries`);
  }

  /**
   * Record decision time for performance metrics
   */
  private recordDecisionTime(time: number): void {
    if (!this.config.enableMetrics) return;
    
    this.decisionTimes.push(time);
    
    // Keep only recent decision times
    if (this.decisionTimes.length > 100) {
      this.decisionTimes = this.decisionTimes.slice(-100);
    }
    
    this.updateStats();
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    if (!this.config.enableMetrics) return;
    
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100 
      : 0;
    
    this.stats.averageDecisionTime = this.decisionTimes.length > 0
      ? this.decisionTimes.reduce((sum, time) => sum + time, 0) / this.decisionTimes.length
      : 0;
    
    this.stats.cacheSize = this.cache.size;
    
    // Estimate memory usage (rough approximation)
    this.stats.memoryUsage = this.cache.size * 512; // ~512 bytes per entry estimate
    
    // Find oldest entry
    let oldestTimestamp = Date.now();
    for (const cached of this.cache.values()) {
      if (cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
      }
    }
    this.stats.oldestEntry = Date.now() - oldestTimestamp;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimerId = timerManager.setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval, 'ai-cache-cleanup');
  }

  /**
   * Perform cleanup of expired entries
   */
  private performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 AI CACHE CLEANUP: Removed ${cleanedCount} expired entries`);
    }
    
    this.updateStats();
  }

  /**
   * Get current cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🧠 AI Cache configuration updated:', newConfig);
  }

  /**
   * Reset cache and statistics
   */
  reset(): void {
    this.cache.clear();
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageDecisionTime: 0,
      cacheSize: 0,
      memoryUsage: 0,
      invalidations: 0,
      oldestEntry: 0
    };
    this.decisionTimes = [];
    
    console.log('🧠 AI Cache reset');
  }

  /**
   * Cleanup cache resources
   */
  cleanup(): void {
    if (this.cleanupTimerId) {
      timerManager.clearTimer(this.cleanupTimerId);
    }
    this.cache.clear();
    console.log('🧠 AI Cache cleaned up');
  }
}

// Export singleton instance
export const aiDecisionCache = new AIDecisionCache();