/**
 * Command Handlers Module
 * 
 * Handles console commands and administrative functions.
 * Provides a clean interface for server management and debugging.
 */

import { timerManager } from '../utils/TimerManager';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';
import { configManager } from '../config/ConfigManager';
import type { SoccerWorld, GameMode, OptimizationLevel } from '../types/GameTypes';

export class CommandHandlers {
  private world: SoccerWorld;
  private soccerGame: any; // Will be properly typed later

  constructor(world: SoccerWorld, soccerGame: any) {
    this.world = world;
    this.soccerGame = soccerGame;
    this.registerCommands();
  }

  /**
   * Register all console commands
   */
  private registerCommands(): void {
    console.log('🎮 Console commands available:');
    console.log('  /fifa - Switch to FIFA mode (realistic)');
    console.log('  /arcade - Switch to Arcade mode (enhanced)');
    console.log('  /tournament - Switch to Tournament mode');
    console.log('  /status - Show server status');
    console.log('  /stats - Show performance statistics');
    console.log('  /errors - Show error report');
    console.log('  /cleanup - Clean up resources');
    console.log('  /config - Show configuration');
    console.log('  /help - Show this help message');
  }

  /**
   * Handle console input
   */
  handleCommand(input: string): void {
    const command = input.trim().toLowerCase();

    try {
      switch (command) {
        case '/fifa':
          this.switchToFIFAMode();
          break;
        case '/arcade':
          this.switchToArcadeMode();
          break;
        case '/tournament':
          this.switchToTournamentMode();
          break;
        case '/status':
          this.showServerStatus();
          break;
        case '/stats':
          this.showPerformanceStats();
          break;
        case '/errors':
          this.showErrorReport();
          break;
        case '/cleanup':
          this.performCleanup();
          break;
        case '/config':
          this.showConfiguration();
          break;
        case '/help':
          this.showHelp();
          break;
        default:
          if (command.startsWith('/')) {
            console.log(`❌ Unknown command: ${command}`);
            console.log('Type /help for available commands');
          } else {
            console.log(`💬 Chat: ${input}`);
          }
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.MEDIUM,
        `Error executing command: ${command}`,
        error,
        { command, input }
      );
    }
  }

  /**
   * Switch to FIFA mode
   */
  private switchToFIFAMode(): void {
    try {
      if (this.soccerGame.switchToFIFAMode) {
        this.soccerGame.switchToFIFAMode();
        console.log('⚽ FIFA Mode activated - Realistic physics and professional gameplay');
      } else {
        console.log('⚠️ FIFA mode switching not available in current implementation');
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM,
        'Failed to switch to FIFA mode',
        error
      );
    }
  }

  /**
   * Switch to Arcade mode
   */
  private switchToArcadeMode(): void {
    try {
      if (this.soccerGame.switchToArcadeMode) {
        this.soccerGame.switchToArcadeMode();
        console.log('🎮 Arcade Mode activated - Enhanced abilities and power-ups enabled');
      } else {
        console.log('⚠️ Arcade mode switching not available in current implementation');
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM,
        'Failed to switch to arcade mode',
        error
      );
    }
  }

  /**
   * Switch to Tournament mode
   */
  private switchToTournamentMode(): void {
    try {
      if (this.soccerGame.switchToTournamentMode) {
        this.soccerGame.switchToTournamentMode();
        console.log('🏆 Tournament Mode activated - Competitive gameplay');
      } else {
        console.log('⚠️ Tournament mode switching not available in current implementation');
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM,
        'Failed to switch to tournament mode',
        error
      );
    }
  }

  /**
   * Show server status
   */
  private showServerStatus(): void {
    try {
      console.log('\n📊 SERVER STATUS:');
      console.log('==================');
      
      // Basic server info
      console.log(`Server uptime: ${Math.round(process.uptime())} seconds`);
      console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      
      // Player count
      const playerCount = this.world.entityManager?.getAllPlayerEntities?.()?.length || 0;
      console.log(`Active players: ${playerCount}`);
      
      // Game state
      if (this.soccerGame.getCurrentMode) {
        console.log(`Current mode: ${this.soccerGame.getCurrentMode()}`);
      }
      
      // Timer stats
      const timerStats = timerManager.getTimerStats();
      console.log(`Active timers: ${timerStats.totalTimers} (${timerStats.timeouts} timeouts, ${timerStats.intervals} intervals)`);
      
      // Error stats
      const errorStats = errorHandler.getErrorStats();
      console.log(`Total errors: ${errorStats.totalErrors} (Rate: ${errorStats.errorRate.toFixed(2)}/min)`);
      
      console.log('==================\n');
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.LOW,
        'Error showing server status',
        error
      );
    }
  }

  /**
   * Show performance statistics
   */
  private showPerformanceStats(): void {
    try {
      const performanceProfiler = (this.world as any)._performanceProfiler;
      
      if (performanceProfiler) {
        const metrics = performanceProfiler.getMetrics();
        
        console.log('\n⚡ PERFORMANCE STATS:');
        console.log('=====================');
        console.log(`Frame time: ${metrics.frameTime?.toFixed(2) || 'N/A'}ms`);
        console.log(`AI decision time: ${metrics.aiDecisionTime?.toFixed(2) || 'N/A'}ms`);
        console.log(`Physics time: ${metrics.physicsTime?.toFixed(2) || 'N/A'}ms`);
        console.log(`Entity count: ${metrics.entityCount || 'N/A'}`);
        console.log(`Player count: ${metrics.playerCount || 'N/A'}`);
        console.log('=====================\n');
      } else {
        console.log('⚠️ Performance profiler not available');
      }
      
      // Show timer statistics
      const timerStats = timerManager.getTimerStats();
      console.log('\n⏰ TIMER STATS:');
      console.log('===============');
      console.log(`Total active timers: ${timerStats.totalTimers}`);
      console.log(`Timeouts: ${timerStats.timeouts}`);
      console.log(`Intervals: ${timerStats.intervals}`);
      console.log(`Oldest timer age: ${Math.round(timerStats.oldestTimer / 1000)}s`);
      console.log(`Average timer age: ${Math.round(timerStats.averageAge / 1000)}s`);
      console.log('===============\n');
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'Error showing performance stats',
        error
      );
    }
  }

  /**
   * Show error report
   */
  private showErrorReport(): void {
    try {
      const errorStats = errorHandler.getErrorStats();
      
      console.log('\n❌ ERROR REPORT:');
      console.log('================');
      console.log(`Total errors: ${errorStats.totalErrors}`);
      console.log(`Error rate: ${errorStats.errorRate.toFixed(2)} errors/minute`);
      
      console.log('\nBy Category:');
      Object.entries(errorStats.errorsByCategory).forEach(([category, count]) => {
        if (count > 0) {
          console.log(`  ${category}: ${count}`);
        }
      });
      
      console.log('\nBy Severity:');
      Object.entries(errorStats.errorsBySeverity).forEach(([severity, count]) => {
        if (count > 0) {
          console.log(`  ${severity}: ${count}`);
        }
      });
      
      if (errorStats.recentErrors.length > 0) {
        console.log('\nRecent Errors:');
        errorStats.recentErrors.slice(-5).forEach((error, index) => {
          console.log(`  ${index + 1}. [${error.category}] ${error.message}`);
        });
      }
      
      console.log('================\n');
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.LOW,
        'Error showing error report',
        error
      );
    }
  }

  /**
   * Perform cleanup operations
   */
  private performCleanup(): void {
    try {
      console.log('🧹 Starting manual cleanup...');
      
      // Check for timer leaks
      timerManager.checkForLeaks();
      
      // Clear old errors
      errorHandler.clearOldErrors(30); // Clear errors older than 30 minutes
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️ Forced garbage collection');
      }
      
      // Get cleanup stats
      const timerStats = timerManager.getTimerStats();
      const errorStats = errorHandler.getErrorStats();
      
      console.log('✅ Cleanup completed:');
      console.log(`  Active timers: ${timerStats.totalTimers}`);
      console.log(`  Total errors: ${errorStats.totalErrors}`);
      console.log(`  Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.MEDIUM,
        'Error during manual cleanup',
        error
      );
    }
  }

  /**
   * Show configuration
   */
  private showConfiguration(): void {
    try {
      const currentMode = this.soccerGame.getCurrentMode?.() || 'unknown';
      const modeConfig = configManager.getGameModeConfig(currentMode);
      
      console.log('\n⚙️ CURRENT CONFIGURATION:');
      console.log('=========================');
      console.log(`Game Mode: ${currentMode}`);
      console.log(`Realistic Physics: ${modeConfig.realisticPhysics}`);
      console.log(`Enhanced Abilities: ${modeConfig.enhancedAbilities}`);
      console.log(`Power-ups Enabled: ${modeConfig.powerUpsEnabled}`);
      console.log(`AI Enabled: ${modeConfig.aiEnabled}`);
      console.log(`Tournament Mode: ${modeConfig.tournamentMode}`);
      
      console.log('\nBall Physics:');
      console.log(`  Friction: ${modeConfig.ballPhysics.friction}`);
      console.log(`  Linear Damping: ${modeConfig.ballPhysics.linearDamping}`);
      console.log(`  Horizontal Force: ${modeConfig.ballPhysics.horizontalForce}`);
      
      console.log('\nAudio Config:');
      console.log(`  Master Volume: ${modeConfig.audioConfig.masterVolume}`);
      console.log(`  Commentary: ${modeConfig.audioConfig.commentaryEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`  Crowd Reactions: ${modeConfig.audioConfig.crowdReactionsEnabled ? 'Enabled' : 'Disabled'}`);
      
      console.log('=========================\n');
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.LOW,
        'Error showing configuration',
        error
      );
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log('\n🎮 HYTOPIA SOCCER - CONSOLE COMMANDS:');
    console.log('====================================');
    console.log('Game Mode Commands:');
    console.log('  /fifa       - Switch to FIFA mode (realistic physics)');
    console.log('  /arcade     - Switch to Arcade mode (enhanced abilities)');
    console.log('  /tournament - Switch to Tournament mode (competitive)');
    console.log('');
    console.log('Information Commands:');
    console.log('  /status     - Show server status and player count');
    console.log('  /stats      - Show performance and timer statistics');
    console.log('  /errors     - Show error report and recent issues');
    console.log('  /config     - Show current game configuration');
    console.log('');
    console.log('Maintenance Commands:');
    console.log('  /cleanup    - Perform manual cleanup and memory management');
    console.log('  /help       - Show this help message');
    console.log('====================================\n');
  }
}

/**
 * Create console input handler
 */
export function setupConsoleInput(world: SoccerWorld, soccerGame: any): void {
  const commandHandlers = new CommandHandlers(world, soccerGame);

  // Setup stdin listener for console commands
  if (process.stdin.isTTY) {
    console.log('📝 Console input enabled. Type /help for commands.');
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (input: string) => {
      const trimmedInput = input.trim();
      if (trimmedInput) {
        commandHandlers.handleCommand(trimmedInput);
      }
    });
  }
}