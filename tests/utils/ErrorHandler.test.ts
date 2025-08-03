/**
 * Tests for ErrorHandler utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from '../../utils/ErrorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear old errors after each test
    errorHandler.clearOldErrors(0);
  });

  describe('logError', () => {
    it('should log error with correct categorization', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const errorId = errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.HIGH,
        'Test error message',
        new Error('Test error'),
        { testContext: 'unit-test' }
      );

      expect(errorId).toMatch(/^ERR_\d+$/);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎮 GAME_LOGIC HIGH: Test error message')
      );

      consoleSpy.mockRestore();
    });

    it('should handle different severity levels correctly', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Low severity should use console.log
      errorHandler.logError(ErrorCategory.AUDIO, ErrorSeverity.LOW, 'Low severity error');
      expect(logSpy).toHaveBeenCalled();

      // Medium severity should use console.warn
      errorHandler.logError(ErrorCategory.UI, ErrorSeverity.MEDIUM, 'Medium severity error');
      expect(warnSpy).toHaveBeenCalled();

      // High severity should use console.error
      errorHandler.logError(ErrorCategory.PHYSICS, ErrorSeverity.HIGH, 'High severity error');
      expect(errorSpy).toHaveBeenCalled();

      // Critical severity should use console.error
      errorHandler.logError(ErrorCategory.CONFIGURATION, ErrorSeverity.CRITICAL, 'Critical error');
      expect(errorSpy).toHaveBeenCalledTimes(2); // Called for both HIGH and CRITICAL

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should add system context to errors', () => {
      const errorId = errorHandler.logError(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'Performance issue'
      );

      const stats = errorHandler.getErrorStats();
      const error = stats.recentErrors.find(e => e.id === errorId);

      expect(error).toBeDefined();
      expect(error?.context).toHaveProperty('nodeMemory');
      expect(error?.context).toHaveProperty('uptime');
    });

    it('should handle critical errors with special notification', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.CRITICAL,
        'Critical system failure'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL ERROR NOTIFICATION')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getErrorStats', () => {
    it('should return correct error statistics', () => {
      // Log some test errors
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.LOW, 'Error 1');
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.HIGH, 'Error 2'); 
      errorHandler.logError(ErrorCategory.PHYSICS, ErrorSeverity.MEDIUM, 'Error 3');

      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[ErrorCategory.GAME_LOGIC]).toBe(2);
      expect(stats.errorsByCategory[ErrorCategory.PHYSICS]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.LOW]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1);
      expect(stats.recentErrors).toHaveLength(3);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should return empty stats when no errors exist', () => {
      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.recentErrors).toHaveLength(0);
    });
  });

  describe('getErrorsByCategory', () => {
    it('should filter errors by category correctly', () => {
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.LOW, 'Game error 1');
      errorHandler.logError(ErrorCategory.PHYSICS, ErrorSeverity.MEDIUM, 'Physics error');
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.HIGH, 'Game error 2');

      const gameLogicErrors = errorHandler.getErrorsByCategory(ErrorCategory.GAME_LOGIC);
      const physicsErrors = errorHandler.getErrorsByCategory(ErrorCategory.PHYSICS);

      expect(gameLogicErrors).toHaveLength(2);
      expect(physicsErrors).toHaveLength(1);
      expect(gameLogicErrors[0].message).toBe('Game error 1');
      expect(gameLogicErrors[1].message).toBe('Game error 2');
      expect(physicsErrors[0].message).toBe('Physics error');
    });
  });

  describe('getErrorsBySeverity', () => {
    it('should filter errors by severity correctly', () => {
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.LOW, 'Low error');
      errorHandler.logError(ErrorCategory.PHYSICS, ErrorSeverity.HIGH, 'High error 1');
      errorHandler.logError(ErrorCategory.AI, ErrorSeverity.HIGH, 'High error 2');

      const lowErrors = errorHandler.getErrorsBySeverity(ErrorSeverity.LOW);
      const highErrors = errorHandler.getErrorsBySeverity(ErrorSeverity.HIGH);

      expect(lowErrors).toHaveLength(1);
      expect(highErrors).toHaveLength(2);
      expect(lowErrors[0].message).toBe('Low error');
      expect(highErrors[0].message).toBe('High error 1');
      expect(highErrors[1].message).toBe('High error 2');
    });
  });

  describe('clearOldErrors', () => {
    it('should clear errors older than specified time', () => {
      // Log an error
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.LOW, 'Old error');
      
      expect(errorHandler.getErrorStats().totalErrors).toBe(1);

      // Clear errors older than 0 minutes (all errors)
      errorHandler.clearOldErrors(0);

      expect(errorHandler.getErrorStats().totalErrors).toBe(0);
    });

    it('should not clear recent errors', () => {
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.LOW, 'Recent error');
      
      expect(errorHandler.getErrorStats().totalErrors).toBe(1);

      // Clear errors older than 1 hour (should not clear recent error)
      errorHandler.clearOldErrors(60);

      expect(errorHandler.getErrorStats().totalErrors).toBe(1);
    });
  });

  describe('exportErrorReport', () => {
    it('should export valid JSON error report', () => {
      errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.HIGH, 'Test error');
      
      const report = errorHandler.exportErrorReport();
      
      expect(() => JSON.parse(report)).not.toThrow();
      
      const parsed = JSON.parse(report);
      expect(parsed).toHaveProperty('generated');
      expect(parsed).toHaveProperty('uptime');
      expect(parsed).toHaveProperty('stats');
      expect(parsed.stats.totalErrors).toBe(1);
    });
  });

  describe('convenience functions', () => {
    it('should provide working convenience functions', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Import and test convenience functions
      const { logGameError, logPhysicsError, logAIError, logAudioError, logCriticalError } =
        require('../../utils/ErrorHandler');

      logGameError('Game logic error');
      logPhysicsError('Physics error');
      logAIError('AI error');
      logAudioError('Audio error');
      logCriticalError(ErrorCategory.CONFIGURATION, 'Critical config error');

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(5);

      consoleSpy.mockRestore();
    });
  });
});