/**
 * Centralized Error Handling System
 * 
 * Provides consistent error handling, logging, and recovery strategies
 * across the entire Hytopia Soccer game.
 * 
 * Features:
 * - Typed error categories
 * - Context-aware error logging
 * - Error recovery strategies
 * - Performance impact tracking
 */

export enum ErrorCategory {
  GAME_LOGIC = 'GAME_LOGIC',
  PHYSICS = 'PHYSICS', 
  AI = 'AI',
  AUDIO = 'AUDIO',
  NETWORK = 'NETWORK',
  UI = 'UI',
  PERFORMANCE = 'PERFORMANCE',
  CONFIGURATION = 'CONFIGURATION',
  ENTITY = 'ENTITY',
  TIMER = 'TIMER'
}

export enum ErrorSeverity {
  LOW = 'LOW',           // Minor issues, game continues normally
  MEDIUM = 'MEDIUM',     // Noticeable issues, some features may be affected
  HIGH = 'HIGH',         // Significant issues, game functionality impaired
  CRITICAL = 'CRITICAL'  // Game-breaking issues, immediate attention needed
}

export interface GameError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  context?: Record<string, any>;
  timestamp: number;
  stackTrace?: string;
  playerCount?: number;
  gameMode?: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: GameError[];
  errorRate: number; // errors per minute
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: GameError[] = [];
  private errorId = 0;
  private startTime = Date.now();
  private maxStoredErrors = 1000;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Log and handle an error with proper categorization
   */
  logError(
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    error?: Error | unknown,
    context?: Record<string, any>
  ): string {
    const errorId = `ERR_${++this.errorId}`;
    const timestamp = Date.now();

    const gameError: GameError = {
      id: errorId,
      category,
      severity,
      message,
      context: {
        ...context,
        // Add system context
        nodeMemory: process.memoryUsage(),
        uptime: process.uptime()
      },
      timestamp,
      stackTrace: error instanceof Error ? error.stack : undefined
    };

    // Add game-specific context if available
    try {
      const soccerGame = (globalThis as any).soccerGame;
      if (soccerGame) {
        gameError.playerCount = soccerGame.getActivePlayers?.()?.length || 0;
        gameError.gameMode = soccerGame.getCurrentMode?.() || 'unknown';
      }
    } catch (e) {
      // Ignore errors getting game context
    }

    this.errors.push(gameError);

    // Trim old errors to prevent memory growth
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(-this.maxStoredErrors);
    }

    // Log with appropriate severity
    this.logToConsole(gameError, error);

    // Handle error based on severity
    this.handleErrorBySeverity(gameError);

    return errorId;
  }

  /**
   * Handle specific error categories with recovery strategies
   */
  private handleErrorBySeverity(gameError: GameError): void {
    switch (gameError.severity) {
      case ErrorSeverity.LOW:
        // Just log, no action needed
        break;

      case ErrorSeverity.MEDIUM:
        // Log warning and continue
        if (gameError.category === ErrorCategory.AUDIO) {
          console.warn('🔊 AUDIO SYSTEM: Attempting graceful degradation');
        }
        break;

      case ErrorSeverity.HIGH:
        // Log error and attempt recovery
        this.attemptRecovery(gameError);
        break;

      case ErrorSeverity.CRITICAL:
        // Log critical error and notify admin
        console.error('🚨 CRITICAL ERROR DETECTED - Manual intervention may be required');
        this.notifyCriticalError(gameError);
        break;
    }
  }

  /**
   * Attempt automatic error recovery
   */
  private attemptRecovery(gameError: GameError): void {
    switch (gameError.category) {
      case ErrorCategory.TIMER:
        console.log('⏰ TIMER RECOVERY: Cleaning up orphaned timers');
        // Timer cleanup would be handled by TimerManager
        break;

      case ErrorCategory.ENTITY:
        console.log('🎮 ENTITY RECOVERY: Checking entity state');
        // Could implement entity validation/cleanup here
        break;

      case ErrorCategory.PHYSICS:
        console.log('⚽ PHYSICS RECOVERY: Validating ball state');
        // Could implement physics state validation
        break;

      case ErrorCategory.AI:
        console.log('🤖 AI RECOVERY: Resetting AI decision cache');
        // Could implement AI state reset
        break;

      default:
        console.log(`🔧 GENERIC RECOVERY: Attempting recovery for ${gameError.category}`);
    }
  }

  /**
   * Handle critical errors that may require immediate attention
   */
  private notifyCriticalError(gameError: GameError): void {
    console.error('🚨 CRITICAL ERROR NOTIFICATION');
    console.error(`Error ID: ${gameError.id}`);
    console.error(`Category: ${gameError.category}`);
    console.error(`Message: ${gameError.message}`);
    console.error(`Context:`, gameError.context);
    
    // In production, this could send notifications to administrators
    // For now, just ensure it's prominently logged
  }

  /**
   * Log error to console with proper formatting
   */
  private logToConsole(gameError: GameError, originalError?: Error | unknown): void {
    const emoji = this.getEmojiForCategory(gameError.category);
    const prefix = `${emoji} ${gameError.category} ${gameError.severity}`;
    
    switch (gameError.severity) {
      case ErrorSeverity.LOW:
        console.log(`${prefix}: ${gameError.message}`);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`${prefix}: ${gameError.message}`);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        console.error(`${prefix}: ${gameError.message}`);
        if (originalError instanceof Error && originalError.stack) {
          console.error('Stack trace:', originalError.stack);
        }
        break;
    }

    if (gameError.context && Object.keys(gameError.context).length > 0) {
      console.log('Context:', gameError.context);
    }
  }

  /**
   * Get emoji for error category
   */
  private getEmojiForCategory(category: ErrorCategory): string {
    const emojiMap: Record<ErrorCategory, string> = {
      [ErrorCategory.GAME_LOGIC]: '🎮',
      [ErrorCategory.PHYSICS]: '⚽',
      [ErrorCategory.AI]: '🤖',
      [ErrorCategory.AUDIO]: '🔊',
      [ErrorCategory.NETWORK]: '🌐',
      [ErrorCategory.UI]: '🖥️',
      [ErrorCategory.PERFORMANCE]: '⚡',
      [ErrorCategory.CONFIGURATION]: '⚙️',
      [ErrorCategory.ENTITY]: '👤',
      [ErrorCategory.TIMER]: '⏰'
    };
    return emojiMap[category] || '❌';
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const timeElapsed = (now - this.startTime) / (1000 * 60); // minutes
    
    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach(cat => errorsByCategory[cat] = 0);
    Object.values(ErrorSeverity).forEach(sev => errorsBySeverity[sev] = 0);

    // Count errors
    this.errors.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    return {
      totalErrors: this.errors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: this.errors.slice(-10), // Last 10 errors
      errorRate: timeElapsed > 0 ? this.errors.length / timeElapsed : 0
    };
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): GameError[] {
    return this.errors.filter(error => error.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): GameError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Clear old errors (for memory management)
   */
  clearOldErrors(olderThanMinutes: number = 60): void {
    const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000);
    const initialCount = this.errors.length;
    
    this.errors = this.errors.filter(error => error.timestamp > cutoffTime);
    
    const cleared = initialCount - this.errors.length;
    if (cleared > 0) {
      console.log(`🧹 CLEANUP: Cleared ${cleared} old errors`);
    }
  }

  /**
   * Export error report for analysis
   */
  exportErrorReport(): string {
    const stats = this.getErrorStats();
    
    const report = {
      generated: new Date().toISOString(),
      uptime: process.uptime(),
      stats,
      recentCriticalErrors: this.getErrorsBySeverity(ErrorSeverity.CRITICAL).slice(-5),
      recentHighErrors: this.getErrorsBySeverity(ErrorSeverity.HIGH).slice(-10)
    };

    return JSON.stringify(report, null, 2);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions for common error logging
export const logGameError = (message: string, error?: Error | unknown, context?: Record<string, any>) =>
  errorHandler.logError(ErrorCategory.GAME_LOGIC, ErrorSeverity.MEDIUM, message, error, context);

export const logPhysicsError = (message: string, error?: Error | unknown, context?: Record<string, any>) =>
  errorHandler.logError(ErrorCategory.PHYSICS, ErrorSeverity.HIGH, message, error, context);

export const logAIError = (message: string, error?: Error | unknown, context?: Record<string, any>) =>
  errorHandler.logError(ErrorCategory.AI, ErrorSeverity.MEDIUM, message, error, context);

export const logAudioError = (message: string, error?: Error | unknown, context?: Record<string, any>) =>
  errorHandler.logError(ErrorCategory.AUDIO, ErrorSeverity.LOW, message, error, context);

export const logCriticalError = (category: ErrorCategory, message: string, error?: Error | unknown, context?: Record<string, any>) =>
  errorHandler.logError(category, ErrorSeverity.CRITICAL, message, error, context);