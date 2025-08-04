/**
 * Cached Soccer AI Agent
 * 
 * Extends the existing SoccerAgent with intelligent caching capabilities.
 * Maintains compatibility with existing AI architecture while providing
 * significant performance improvements through decision caching.
 */

import type { SoccerAIRole } from '../entities/AIPlayerEntity';
import type { 
  AIDecision, 
  AIContext, 
  SoccerPlayerEntity as ISoccerPlayerEntity,
  Vector3Like 
} from '../types/GameTypes';
import { aiDecisionCache, AIDecisionCache } from './AIDecisionCache';
import { timerManager } from '../utils/TimerManager';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';

export class CachedSoccerAgent {
  private role: SoccerAIRole;
  private decisionHistory: AIDecision[] = [];
  private lastDecisionTime = 0;
  private performanceMetrics = {
    totalDecisions: 0,
    cachedDecisions: 0,
    averageDecisionTime: 0,
    cacheEfficiency: 0
  };

  // Original AI decision making (fallback)
  private originalDecisionMaker?: (context: AIContext) => AIDecision;

  constructor(role: SoccerAIRole, originalDecisionMaker?: (context: AIContext) => AIDecision) {
    this.role = role;
    this.originalDecisionMaker = originalDecisionMaker;
    
    console.log(`🧠 CachedSoccerAgent initialized for role: ${role}`);
  }

  /**
   * Main decision making method with caching integration
   */
  makeDecision(context: AIContext): AIDecision {
    const startTime = Date.now();
    
    try {
      // Prevent too frequent decisions (performance optimization)
      if (startTime - this.lastDecisionTime < 50) { // Minimum 50ms between decisions
        return this.getLastDecision() || this.createIdleDecision(context);
      }

      // Try to get cached decision first
      const cachedDecision = aiDecisionCache.getCachedDecision(context);
      
      if (cachedDecision) {
        // Cache hit! Use cached decision
        this.recordCachedDecision(cachedDecision, startTime);
        return cachedDecision;
      }

      // Cache miss - generate new decision
      const newDecision = this.generateFreshDecision(context);
      
      // Cache the new decision for future use
      aiDecisionCache.cacheDecision(context, newDecision);
      
      // Record metrics and history
      this.recordFreshDecision(newDecision, startTime);
      
      return newDecision;
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.AI,
        ErrorSeverity.MEDIUM,
        `Error in cached AI decision making for ${this.role}`,
        error,
        { role: this.role }
      );
      
      // Fallback to basic decision
      return this.createIdleDecision(context);
    }
  }

  /**
   * Generate a fresh AI decision using existing AI logic
   */
  private generateFreshDecision(context: AIContext): AIDecision {
    try {
      // Use original decision maker if available
      if (this.originalDecisionMaker) {
        return this.originalDecisionMaker(context);
      }

      // Fallback to role-based decision making
      return this.makeRoleBasedDecision(context);
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.AI,
        ErrorSeverity.MEDIUM,
        'Error generating fresh AI decision',
        error,
        { role: this.role }
      );
      
      return this.createIdleDecision(context);
    }
  }

  /**
   * Role-based decision making (fallback implementation)
   */
  private makeRoleBasedDecision(context: AIContext): AIDecision {
    const ball = context.ball;
    const player = context.player;
    
    // Calculate distance to ball
    const distanceToBall = Math.sqrt(
      Math.pow(player.position.x - ball.position.x, 2) +
      Math.pow(player.position.z - ball.position.z, 2)
    );

    // Role-specific logic
    switch (this.role) {
      case 'goalkeeper':
        return this.makeGoalkeeperDecision(context, distanceToBall);
      
      case 'defender':
        return this.makeDefenderDecision(context, distanceToBall);
      
      case 'midfielder':
        return this.makeMidfielderDecision(context, distanceToBall);
      
      case 'forward':
        return this.makeForwardDecision(context, distanceToBall);
      
      default:
        return this.createIdleDecision(context);
    }
  }

  /**
   * Goalkeeper-specific decision making
   */
  private makeGoalkeeperDecision(context: AIContext, distanceToBall: number): AIDecision {
    const ball = context.ball;
    const player = context.player;
    
    // Stay in goal area unless ball is very close
    if (distanceToBall < 8 && ball.position.x < player.position.x - 5) {
      return {
        action: 'move_to_ball',
        target: ball.position,
        priority: 0.9,
        reasoning: 'Ball approaching goal - intercept',
        timestamp: Date.now()
      };
    }
    
    // Defend goal position
    const goalPosition = { x: -40, y: player.position.y, z: 0 };
    return {
      action: 'defend_goal',
      target: goalPosition,
      priority: 0.8,
      reasoning: 'Defending goal position',
      timestamp: Date.now()
    };
  }

  /**
   * Defender-specific decision making
   */
  private makeDefenderDecision(context: AIContext, distanceToBall: number): AIDecision {
    const ball = context.ball;
    const player = context.player;
    
    // If ball is close and in defensive area, go for it
    if (distanceToBall < 5 && ball.position.x < 0) {
      return {
        action: 'move_to_ball',
        target: ball.position,
        priority: 0.8,
        reasoning: 'Ball in defensive zone - clear',
        timestamp: Date.now()
      };
    }
    
    // Position defensively
    const defensivePosition = { 
      x: Math.min(player.position.x, -10), 
      y: player.position.y, 
      z: ball.position.z * 0.3 
    };
    
    return {
      action: 'move_to_position',
      target: defensivePosition,
      priority: 0.6,
      reasoning: 'Defensive positioning',
      timestamp: Date.now()
    };
  }

  /**
   * Midfielder-specific decision making
   */
  private makeMidfielderDecision(context: AIContext, distanceToBall: number): AIDecision {
    const ball = context.ball;
    const player = context.player;
    
    // If closest to ball, go for it
    const isClosestToBall = this.isClosestToBall(context, distanceToBall);
    
    if (isClosestToBall && distanceToBall < 8) {
      return {
        action: 'move_to_ball',
        target: ball.position,
        priority: 0.7,
        reasoning: 'Closest midfielder to ball',
        timestamp: Date.now()
      };
    }
    
    // Support play by positioning in midfield
    const supportPosition = {
      x: (ball.position.x + player.position.x) * 0.5,
      y: player.position.y,
      z: ball.position.z + (Math.random() - 0.5) * 10
    };
    
    return {
      action: 'support_attack',
      target: supportPosition,
      priority: 0.5,
      reasoning: 'Supporting midfield play',
      timestamp: Date.now()
    };
  }

  /**
   * Forward-specific decision making
   */
  private makeForwardDecision(context: AIContext, distanceToBall: number): AIDecision {
    const ball = context.ball;
    const player = context.player;
    
    // If ball is in attacking third, go for it
    if (ball.position.x > 20 && distanceToBall < 10) {
      return {
        action: 'move_to_ball',
        target: ball.position,
        priority: 0.8,
        reasoning: 'Ball in attacking zone',
        timestamp: Date.now()
      };
    }
    
    // Position for attack
    const attackPosition = {
      x: Math.max(ball.position.x + 5, 15),
      y: player.position.y,
      z: ball.position.z + (Math.random() - 0.5) * 8
    };
    
    return {
      action: 'move_to_position',
      target: attackPosition,
      priority: 0.6,
      reasoning: 'Attacking positioning',
      timestamp: Date.now()
    };
  }

  /**
   * Check if this player is closest to the ball
   */
  private isClosestToBall(context: AIContext, currentDistance: number): boolean {
    const teammateDistances = context.teammates.map(teammate => 
      Math.sqrt(
        Math.pow(teammate.position.x - context.ball.position.x, 2) +
        Math.pow(teammate.position.z - context.ball.position.z, 2)
      )
    );
    
    return teammateDistances.every(distance => currentDistance <= distance);
  }

  /**
   * Create idle decision as fallback
   */
  private createIdleDecision(context: AIContext): AIDecision {
    return {
      action: 'idle',
      priority: 0.1,
      reasoning: 'No specific action needed',
      timestamp: Date.now()
    };
  }

  /**
   * Record metrics for cached decision
   */
  private recordCachedDecision(decision: AIDecision, startTime: number): void {
    const decisionTime = Date.now() - startTime;
    
    this.performanceMetrics.totalDecisions++;
    this.performanceMetrics.cachedDecisions++;
    this.performanceMetrics.cacheEfficiency = 
      (this.performanceMetrics.cachedDecisions / this.performanceMetrics.totalDecisions) * 100;
    
    this.updateAverageDecisionTime(decisionTime);
    this.addToHistory(decision);
    this.lastDecisionTime = Date.now();
  }

  /**
   * Record metrics for fresh decision
   */
  private recordFreshDecision(decision: AIDecision, startTime: number): void {
    const decisionTime = Date.now() - startTime;
    
    this.performanceMetrics.totalDecisions++;
    this.performanceMetrics.cacheEfficiency = 
      (this.performanceMetrics.cachedDecisions / this.performanceMetrics.totalDecisions) * 100;
    
    this.updateAverageDecisionTime(decisionTime);
    this.addToHistory(decision);
    this.lastDecisionTime = Date.now();
  }

  /**
   * Update average decision time metric
   */
  private updateAverageDecisionTime(newDecisionTime: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.performanceMetrics.averageDecisionTime = 
      (alpha * newDecisionTime) + ((1 - alpha) * this.performanceMetrics.averageDecisionTime);
  }

  /**
   * Add decision to history
   */
  private addToHistory(decision: AIDecision): void {
    this.decisionHistory.push(decision);
    
    // Keep only recent decisions
    if (this.decisionHistory.length > 50) {
      this.decisionHistory = this.decisionHistory.slice(-50);
    }
  }

  /**
   * Get last decision made
   */
  private getLastDecision(): AIDecision | null {
    return this.decisionHistory.length > 0 
      ? this.decisionHistory[this.decisionHistory.length - 1] 
      : null;
  }

  /**
   * Get agent performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      role: this.role,
      decisionHistorySize: this.decisionHistory.length,
      lastDecisionTime: this.lastDecisionTime
    };
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.decisionHistory = [];
    this.lastDecisionTime = 0;
    this.performanceMetrics = {
      totalDecisions: 0,
      cachedDecisions: 0,
      averageDecisionTime: 0,
      cacheEfficiency: 0
    };
    
    console.log(`🧠 CachedSoccerAgent reset for role: ${this.role}`);
  }

  /**
   * Invalidate relevant cache entries when significant events occur
   */
  onGameEvent(eventType: string, eventData?: any): void {
    switch (eventType) {
      case 'goal_scored':
        // Goal changes the entire game dynamic
        aiDecisionCache.invalidateCache('goal_scored');
        break;
      
      case 'ball_possession_changed':
        // Invalidate ball-related decisions
        aiDecisionCache.invalidateCache('ball_possession_changed', (key) => {
          return key.gamePhase.includes('ball_control');
        });
        break;
      
      case 'player_position_major_change':
        // Invalidate proximity-based decisions
        aiDecisionCache.invalidateCache('player_repositioned', (key) => {
          return key.proximityHash.length > 0;
        });
        break;
      
      case 'half_time':
        // Clear all cache for fresh half
        aiDecisionCache.invalidateCache('half_time');
        break;
    }
  }

  /**
   * Get decision history for analysis
   */
  getDecisionHistory(): AIDecision[] {
    return [...this.decisionHistory];
  }

  /**
   * Get role of this agent
   */
  getRole(): SoccerAIRole {
    return this.role;
  }
}