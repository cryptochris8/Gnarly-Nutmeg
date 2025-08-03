/**
 * Centralized Timer Management System
 * 
 * Provides safe timer management with automatic cleanup to prevent memory leaks.
 * Integrates with Hytopia SDK patterns and provides better resource management.
 * 
 * Features:
 * - Automatic timer tracking and cleanup  
 * - Performance monitoring integration
 * - Proper error handling
 * - Game state awareness
 */

export interface TimerHandle {
  id: string;
  type: 'timeout' | 'interval';
  startTime: number;
  delay: number;
  callback: () => void;
  timer: NodeJS.Timeout;
}

export class TimerManager {
  private static instance: TimerManager;
  private timers = new Map<string, TimerHandle>();
  private timerId = 0;
  private isShuttingDown = false;

  private constructor() {
    // Singleton pattern for global timer management
  }

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  /**
   * Safe setTimeout with automatic tracking and cleanup
   */
  setTimeout(callback: () => void, delay: number, context?: string): string {
    if (this.isShuttingDown) {
      console.warn('⏰ TIMER WARNING: Attempted to create timer during shutdown');
      return '';
    }

    const id = `timeout_${++this.timerId}`;
    const startTime = Date.now();

    const wrappedCallback = () => {
      try {
        // Remove from tracking before executing
        this.timers.delete(id);
        callback();
      } catch (error) {
        console.error(`❌ TIMER ERROR in ${context || 'unknown'}:`, error);
        // Still remove from tracking even if callback fails
        this.timers.delete(id);
      }
    };

    const timer = setTimeout(wrappedCallback, delay);

    const handle: TimerHandle = {
      id,
      type: 'timeout',
      startTime,
      delay,
      callback,
      timer
    };

    this.timers.set(id, handle);
    
    if (context) {
      console.log(`⏰ TIMER CREATED: ${context} (${id}) - ${delay}ms`);
    }

    return id;
  }

  /**
   * Safe setInterval with automatic tracking and cleanup
   */
  setInterval(callback: () => void, delay: number, context?: string): string {
    if (this.isShuttingDown) {
      console.warn('⏰ TIMER WARNING: Attempted to create interval during shutdown');
      return '';
    }

    const id = `interval_${++this.timerId}`;
    const startTime = Date.now();

    const wrappedCallback = () => {
      try {
        callback();
      } catch (error) {
        console.error(`❌ INTERVAL ERROR in ${context || 'unknown'}:`, error);
        // Continue running interval even if one execution fails
      }
    };

    const timer = setInterval(wrappedCallback, delay);

    const handle: TimerHandle = {
      id,
      type: 'interval',
      startTime,
      delay,
      callback,
      timer
    };

    this.timers.set(id, handle);
    
    if (context) {
      console.log(`⏰ INTERVAL CREATED: ${context} (${id}) - ${delay}ms`);
    }

    return id;
  }

  /**
   * Clear a specific timer by ID
   */
  clearTimer(id: string): void {
    const handle = this.timers.get(id);
    if (handle) {
      if (handle.type === 'timeout') {
        clearTimeout(handle.timer);
      } else {
        clearInterval(handle.timer);
      }
      this.timers.delete(id);
      console.log(`⏰ TIMER CLEARED: ${id}`);
    }
  }

  /**
   * Clear all timers of a specific type
   */
  clearTimersByType(type: 'timeout' | 'interval'): void {
    let cleared = 0;
    for (const [id, handle] of this.timers.entries()) {
      if (handle.type === type) {
        if (type === 'timeout') {
          clearTimeout(handle.timer);
        } else {
          clearInterval(handle.timer);
        }
        this.timers.delete(id);
        cleared++;
      }
    }
    console.log(`⏰ CLEARED ${cleared} ${type}s`);
  }

  /**
   * Get timer statistics for performance monitoring
   */
  getTimerStats(): {
    totalTimers: number;
    timeouts: number;
    intervals: number;
    oldestTimer: number;
    averageAge: number;
  } {
    const now = Date.now();
    let timeouts = 0;
    let intervals = 0;
    let totalAge = 0;
    let oldestAge = 0;

    for (const handle of this.timers.values()) {
      const age = now - handle.startTime;
      totalAge += age;
      
      if (age > oldestAge) {
        oldestAge = age;
      }

      if (handle.type === 'timeout') {
        timeouts++;
      } else {
        intervals++;
      }
    }

    return {
      totalTimers: this.timers.size,
      timeouts,
      intervals,
      oldestTimer: oldestAge,
      averageAge: this.timers.size > 0 ? totalAge / this.timers.size : 0
    };
  }

  /**
   * Get list of all active timers for debugging
   */
  getActiveTimers(): Array<{
    id: string;
    type: string;
    age: number;
    delay: number;
  }> {
    const now = Date.now();
    return Array.from(this.timers.values()).map(handle => ({
      id: handle.id,
      type: handle.type,
      age: now - handle.startTime,
      delay: handle.delay
    }));
  }

  /**
   * Cleanup all timers - call during shutdown
   */
  cleanup(): void {
    console.log(`⏰ TIMER CLEANUP: Clearing ${this.timers.size} active timers`);
    this.isShuttingDown = true;

    for (const handle of this.timers.values()) {
      if (handle.type === 'timeout') {
        clearTimeout(handle.timer);
      } else {
        clearInterval(handle.timer);
      }
    }

    this.timers.clear();
    console.log('✅ TIMER CLEANUP: All timers cleared');
  }

  /**
   * Emergency cleanup - forces immediate cleanup of all timers
   */
  emergencyCleanup(): void {
    console.warn('🚨 EMERGENCY TIMER CLEANUP INITIATED');
    this.cleanup();
  }

  /**
   * Check for potential memory leaks (long-running timeouts)
   */
  checkForLeaks(): void {
    const now = Date.now();
    const LEAK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    let potentialLeaks = 0;

    for (const [id, handle] of this.timers.entries()) {
      const age = now - handle.startTime;
      
      // Warn about timeouts that have been waiting too long  
      if (handle.type === 'timeout' && age > LEAK_THRESHOLD) {
        console.warn(`⚠️ POTENTIAL LEAK: Timeout ${id} has been active for ${Math.round(age/1000)}s`);
        potentialLeaks++;
      }
    }

    if (potentialLeaks > 0) {
      console.warn(`⚠️ Found ${potentialLeaks} potential timer leaks`);
    }
  }
}

// Export singleton instance for easy access
export const timerManager = TimerManager.getInstance();

// Global cleanup handler
process.on('exit', () => {
  timerManager.cleanup();
});

process.on('SIGTERM', () => {
  timerManager.emergencyCleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  timerManager.emergencyCleanup(); 
  process.exit(0);
});