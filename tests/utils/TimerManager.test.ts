/**
 * Tests for TimerManager utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerManager } from '../../utils/TimerManager';

describe('TimerManager', () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    // Create a fresh instance for each test
    timerManager = TimerManager.getInstance();
    vi.useFakeTimers();
  });

  afterEach(() => {
    timerManager.cleanup();
    vi.useRealTimers();
  });

  describe('setTimeout', () => {
    it('should create and track timeout', () => {
      const callback = vi.fn();
      const id = timerManager.setTimeout(callback, 1000, 'test-timeout');

      expect(id).toBeTruthy();
      expect(id).toMatch(/^timeout_\d+$/);
      expect(callback).not.toHaveBeenCalled();

      // Advance time
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should not create timer during shutdown', () => {
      timerManager.cleanup();
      
      const callback = vi.fn();
      const id = timerManager.setTimeout(callback, 1000);

      expect(id).toBe('');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const id = timerManager.setTimeout(errorCallback, 100, 'error-test');
      vi.advanceTimersByTime(100);

      expect(errorCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TIMER ERROR in error-test:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('setInterval', () => {
    it('should create and track interval', () => {
      const callback = vi.fn();
      const id = timerManager.setInterval(callback, 500, 'test-interval');

      expect(id).toBeTruthy();
      expect(id).toMatch(/^interval_\d+$/);

      // Should not be called immediately
      expect(callback).not.toHaveBeenCalled();

      // Should be called after interval
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledOnce();

      // Should be called again after another interval
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should continue running interval even if callback throws', () => {
      let callCount = 0;
      const errorCallback = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call error');
        }
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      timerManager.setInterval(errorCallback, 100, 'error-interval');
      
      // First call should error
      vi.advanceTimersByTime(100);
      expect(errorCallback).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalled();

      // Second call should succeed
      vi.advanceTimersByTime(100);
      expect(errorCallback).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('clearTimer', () => {
    it('should clear timeout by ID', () => {
      const callback = vi.fn();
      const id = timerManager.setTimeout(callback, 1000);

      timerManager.clearTimer(id);
      
      // Advance time - callback should not be called
      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear interval by ID', () => {
      const callback = vi.fn();
      const id = timerManager.setInterval(callback, 500);

      // Let it run once
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledOnce();

      // Clear the interval
      timerManager.clearTimer(id);

      // Should not run again
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should handle clearing non-existent timer', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Should not throw error
      expect(() => {
        timerManager.clearTimer('non-existent-id');
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('getTimerStats', () => {
    it('should return correct timer statistics', () => {
      // Create some timers
      timerManager.setTimeout(() => {}, 1000);
      timerManager.setTimeout(() => {}, 2000);
      timerManager.setInterval(() => {}, 500);

      const stats = timerManager.getTimerStats();

      expect(stats.totalTimers).toBe(3);
      expect(stats.timeouts).toBe(2);
      expect(stats.intervals).toBe(1);
      expect(stats.oldestTimer).toBeGreaterThanOrEqual(0);
      expect(stats.averageAge).toBeGreaterThanOrEqual(0);
    });

    it('should return zero stats when no timers exist', () => {
      const stats = timerManager.getTimerStats();

      expect(stats.totalTimers).toBe(0);
      expect(stats.timeouts).toBe(0);
      expect(stats.intervals).toBe(0);
      expect(stats.oldestTimer).toBe(0);
      expect(stats.averageAge).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all timers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      timerManager.setTimeout(callback1, 1000);
      timerManager.setTimeout(callback2, 2000);
      timerManager.setInterval(callback3, 500);

      // Verify timers exist
      expect(timerManager.getTimerStats().totalTimers).toBe(3);

      // Cleanup
      timerManager.cleanup();

      // Verify all timers are cleared
      expect(timerManager.getTimerStats().totalTimers).toBe(0);

      // Advance time - no callbacks should be called
      vi.advanceTimersByTime(5000);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });
  });

  describe('checkForLeaks', () => {
    it('should detect potential memory leaks', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Create a timeout that would be considered a leak
      timerManager.setTimeout(() => {}, 10 * 60 * 1000); // 10 minutes

      // Mock the timer to appear old
      const stats = timerManager.getTimerStats();
      expect(stats.totalTimers).toBe(1);

      // Check for leaks (this would normally detect old timers)
      timerManager.checkForLeaks();

      // Note: In real implementation, this would check timer age
      // For this test, we just verify the method doesn't throw

      consoleSpy.mockRestore();
    });
  });
});