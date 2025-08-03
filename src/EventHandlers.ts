/**
 * Event Handlers Module
 * 
 * Centralizes all player event handling logic for the Hytopia Soccer game.
 * Provides type-safe event handling with proper error recovery.
 */

import { PlayerEvent, PlayerUIEvent, EntityEvent, type Vector3Like } from "hytopia";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import { getDirectionFromRotation } from "../utils/direction";
import { timerManager } from "../utils/TimerManager";
import { errorHandler, ErrorCategory, ErrorSeverity } from "../utils/ErrorHandler";
import type { SoccerWorld, SoccerPlayerEntity as ISoccerPlayerEntity } from "../types/GameTypes";

export class EventHandlers {
  private world: SoccerWorld;

  constructor(world: SoccerWorld) {
    this.world = world;
    this.registerEventHandlers();
  }

  /**
   * Register all event handlers
   */
  private registerEventHandlers(): void {
    console.log('📡 Registering event handlers...');

    try {
      // Player connection events
      this.world.addEventListener(PlayerEvent.JOIN, this.handlePlayerJoin.bind(this));
      this.world.addEventListener(PlayerEvent.LEAVE, this.handlePlayerLeave.bind(this));

      // Player movement and interaction events
      this.world.addEventListener(PlayerEvent.MOVE, this.handlePlayerMove.bind(this));
      this.world.addEventListener(PlayerEvent.INTERACT, this.handlePlayerInteract.bind(this));
      this.world.addEventListener(PlayerEvent.ATTACK, this.handlePlayerAttack.bind(this));
      this.world.addEventListener(PlayerEvent.BUILD, this.handlePlayerBuild.bind(this));

      // UI events
      this.world.addEventListener(PlayerUIEvent.CLICK, this.handleUIClick.bind(this));

      // Entity events
      this.world.addEventListener(EntityEvent.SPAWN, this.handleEntitySpawn.bind(this));
      this.world.addEventListener(EntityEvent.DESPAWN, this.handleEntityDespawn.bind(this));

      console.log('✅ Event handlers registered successfully');

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.CRITICAL,
        'Failed to register event handlers',
        error
      );
      throw error;
    }
  }

  /**
   * Handle player join events
   */
  private handlePlayerJoin(event: PlayerEvent.JOIN): void {
    try {
      const { player } = event;
      console.log(`👤 Player joined: ${player.username} (ID: ${player.id})`);

      // Create soccer player entity
      const playerEntity = new SoccerPlayerEntity(player);
      
      // Set safe spawn position
      const spawnPosition = this.getSafeSpawnPosition();
      playerEntity.setPosition(spawnPosition);

      // Spawn the entity
      playerEntity.spawn(this.world, spawnPosition);

      // Setup player-specific timers
      this.setupPlayerTimers(playerEntity);

      // Send welcome message
      this.sendWelcomeMessage(player);

      // Update game state
      this.updateGameStateForPlayerJoin(playerEntity);

      console.log(`✅ Player ${player.username} successfully joined and spawned`);

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.HIGH,
        `Failed to handle player join for ${event.player.username}`,
        error,
        { playerId: event.player.id }
      );
    }
  }

  /**
   * Handle player leave events
   */
  private handlePlayerLeave(event: PlayerEvent.LEAVE): void {
    try {
      const { player } = event;
      console.log(`👋 Player left: ${player.username} (ID: ${player.id})`);

      // Find and cleanup player entity
      const playerEntity = this.findPlayerEntity(player.id);
      if (playerEntity) {
        this.cleanupPlayerEntity(playerEntity);
      }

      // Update game state
      this.updateGameStateForPlayerLeave(player.id);

      console.log(`✅ Player ${player.username} cleanup completed`);

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM,
        `Failed to handle player leave for ${event.player.username}`,
        error,
        { playerId: event.player.id }
      );
    }
  }

  /**
   * Handle player movement events (kicking, etc.)
   */
  private handlePlayerMove(event: PlayerEvent.MOVE): void {
    try {
      const { player } = event;
      const playerEntity = this.findPlayerEntity(player.id);
      
      if (!playerEntity) {
        return; // Player entity not found, ignore
      }

      // Handle ball kicking logic
      this.handleBallKicking(playerEntity);

      // Update player stats
      this.updatePlayerMovementStats(playerEntity);

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PHYSICS,
        ErrorSeverity.LOW,
        `Error handling player movement for ${event.player.username}`,
        error,
        { playerId: event.player.id }
      );
    }
  }

  /**
   * Handle player interaction events (F key)
   */
  private handlePlayerInteract(event: PlayerEvent.INTERACT): void {
    try {
      const { player } = event;
      const playerEntity = this.findPlayerEntity(player.id);
      
      if (!playerEntity) {
        return;
      }

      console.log(`🔧 Player ${player.username} pressed interact key`);

      // Handle ability activation
      if (playerEntity.abilityHolder?.currentAbility) {
        this.handleAbilityActivation(playerEntity);
      } else {
        // Send feedback that no ability is available
        this.sendNoAbilityMessage(player);
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM,
        `Error handling player interaction for ${event.player.username}`,
        error,
        { playerId: event.player.id }
      );
    }
  }

  /**
   * Handle player attack events
   */
  private handlePlayerAttack(event: PlayerEvent.ATTACK): void {
    try {
      const { player } = event;
      const playerEntity = this.findPlayerEntity(player.id);
      
      if (!playerEntity) {
        return;
      }

      // Handle aggressive ball kicking or special attacks
      this.handleAggressiveAction(playerEntity);

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.LOW,
        `Error handling player attack for ${event.player.username}`,
        error,
        { playerId: event.player.id }
      );
    }
  }

  /**
   * Handle player build events
   */
  private handlePlayerBuild(event: PlayerEvent.BUILD): void {
    try {
      const { player } = event;
      
      // In soccer game, build might be used for special actions
      console.log(`🔨 Player ${player.username} triggered build action`);
      
      // Could be used for special abilities or tactics
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.LOW,
        `Error handling player build for ${event.player.username}`,
        error,
        { playerId: event.player.id }
      );
    }
  }

  /**
   * Handle UI click events
   */
  private handleUIClick(event: PlayerUIEvent.CLICK): void {
    try {
      const { player, elementId } = event;
      console.log(`🖱️ Player ${player.username} clicked UI element: ${elementId}`);

      // Handle different UI interactions based on elementId
      switch (elementId) {
        case 'team-select-red':
          this.handleTeamSelection(player, 'team1');
          break;
        case 'team-select-blue':
          this.handleTeamSelection(player, 'team2');
          break;
        case 'spectator-mode':
          this.handleSpectatorMode(player);
          break;
        default:
          console.log(`Unknown UI element clicked: ${elementId}`);
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.UI,
        ErrorSeverity.LOW,
        `Error handling UI click for ${event.player.username}`,
        error,
        { playerId: event.player.id, elementId: event.elementId }
      );
    }
  }

  /**
   * Handle entity spawn events
   */
  private handleEntitySpawn(event: EntityEvent.SPAWN): void {
    try {
      const { entity } = event;
      console.log(`🎭 Entity spawned: ${entity.name} at [${entity.position.x.toFixed(1)}, ${entity.position.y.toFixed(1)}, ${entity.position.z.toFixed(1)}]`);

      // Handle special entity spawns (power-ups, effects, etc.)
      if (entity.name.includes('power-up')) {
        this.handlePowerUpSpawn(entity);
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.ENTITY,
        ErrorSeverity.LOW,
        'Error handling entity spawn',
        error,
        { entityName: event.entity.name }
      );
    }
  }

  /**
   * Handle entity despawn events
   */
  private handleEntityDespawn(event: EntityEvent.DESPAWN): void {
    try {
      const { entity } = event;
      console.log(`👻 Entity despawned: ${entity.name}`);

      // Cleanup any resources associated with the entity
      if (entity.name.includes('power-up')) {
        this.handlePowerUpDespawn(entity);
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.ENTITY,
        ErrorSeverity.LOW,
        'Error handling entity despawn',
        error,
        { entityName: event.entity.name }
      );
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Find player entity by player ID
   */
  private findPlayerEntity(playerId: string): SoccerPlayerEntity | null {
    try {
      const entities = this.world.entityManager.getAllPlayerEntities();
      return entities.find(entity => 
        entity instanceof SoccerPlayerEntity && entity.player.id === playerId
      ) as SoccerPlayerEntity || null;
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.ENTITY,
        ErrorSeverity.LOW,
        'Error finding player entity',
        error,
        { playerId }
      );
      return null;
    }
  }

  /**
   * Get a safe spawn position for new players
   */
  private getSafeSpawnPosition(): Vector3Like {
    // Return a safe spawn position on the field
    return {
      x: 7,   // Center of field
      y: 6,   // Safe height
      z: 0    // Center line
    };
  }

  /**
   * Setup player-specific timers
   */
  private setupPlayerTimers(playerEntity: SoccerPlayerEntity): void {
    // Setup stamina regeneration timer
    timerManager.setInterval(() => {
      if (playerEntity.isSpawned) {
        this.regeneratePlayerStamina(playerEntity);
      }
    }, 1000, `stamina-regen-${playerEntity.player.id}`);

    // Setup stats update timer
    timerManager.setInterval(() => {
      if (playerEntity.isSpawned) {
        this.updatePlayerStats(playerEntity);
      }
    }, 5000, `stats-update-${playerEntity.player.id}`);
  }

  /**
   * Cleanup player entity and associated resources
   */
  private cleanupPlayerEntity(playerEntity: SoccerPlayerEntity): void {
    try {
      // Clear player-specific timers
      // Timer manager will automatically clean up timers with player ID context

      // Remove any active abilities
      if (playerEntity.abilityHolder) {
        playerEntity.abilityHolder.removeAbility();
      }

      // Despawn the entity
      if (playerEntity.isSpawned) {
        playerEntity.despawn();
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.ENTITY,
        ErrorSeverity.MEDIUM,
        'Error cleaning up player entity',
        error,
        { playerId: playerEntity.player.id }
      );
    }
  }

  /**
   * Handle ball kicking logic
   */
  private handleBallKicking(playerEntity: SoccerPlayerEntity): void {
    try {
      const ball = this.world.ball;
      if (!ball || !ball.isSpawned) {
        return;
      }

      // Check distance to ball
      const distance = Math.sqrt(
        Math.pow(playerEntity.position.x - ball.position.x, 2) +
        Math.pow(playerEntity.position.z - ball.position.z, 2)
      );

      const KICK_DISTANCE = 3.0;
      if (distance <= KICK_DISTANCE) {
        // Get kick direction from player rotation
        const direction = getDirectionFromRotation(playerEntity.rotation);
        
        // Apply force to ball
        const kickForce = 15; // Base kick force
        ball.applyImpulse({
          x: direction.x * kickForce,
          y: 2, // Some upward force
          z: direction.z * kickForce
        });

        // Update player stats
        playerEntity.stats.ballTouches++;
        
        console.log(`⚽ ${playerEntity.player.username} kicked the ball`);
      }

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.PHYSICS,
        ErrorSeverity.LOW,
        'Error handling ball kicking',
        error,
        { playerId: playerEntity.player.id }
      );
    }
  }

  /**
   * Handle ability activation
   */
  private handleAbilityActivation(playerEntity: SoccerPlayerEntity): void {
    try {
      const ability = playerEntity.abilityHolder.currentAbility;
      if (!ability) {
        return;
      }

      // Get player direction
      const direction = getDirectionFromRotation(playerEntity.rotation);

      // Use the ability
      ability.use(playerEntity.position, direction, playerEntity);

      console.log(`⚡ ${playerEntity.player.username} activated ability`);

    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM,
        'Error activating player ability',
        error,
        { playerId: playerEntity.player.id }
      );
    }
  }

  /**
   * Handle team selection
   */
  private handleTeamSelection(player: any, team: 'team1' | 'team2'): void {
    try {
      const playerEntity = this.findPlayerEntity(player.id);
      if (playerEntity) {
        playerEntity.team = team;
        console.log(`👕 ${player.username} joined ${team}`);
        
        // Send confirmation
        if (player.ui && typeof player.ui.sendData === 'function') {
          player.ui.sendData({
            type: 'team-selected',
            team: team,
            message: `Joined ${team === 'team1' ? 'Red' : 'Blue'} team!`
          });
        }
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.LOW,
        'Error handling team selection',
        error,
        { playerId: player.id, team }
      );
    }
  }

  /**
   * Handle spectator mode
   */
  private handleSpectatorMode(player: any): void {
    try {
      console.log(`👁️ ${player.username} entered spectator mode`);
      
      // Implementation would depend on spectator mode system
      
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.LOW,
        'Error handling spectator mode',
        error,
        { playerId: player.id }
      );
    }
  }

  /**
   * Send welcome message to new player
   */
  private sendWelcomeMessage(player: any): void {
    try {
      if (player.ui && typeof player.ui.sendData === 'function') {
        player.ui.sendData({
          type: 'welcome',
          message: 'Welcome to Hytopia Soccer! Press F to use abilities, move to kick the ball!',
          duration: 5000
        });
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.UI,
        ErrorSeverity.LOW,
        'Error sending welcome message',
        error,
        { playerId: player.id }
      );
    }
  }

  /**
   * Send no ability available message
   */
  private sendNoAbilityMessage(player: any): void {
    try {
      if (player.ui && typeof player.ui.sendData === 'function') {
        player.ui.sendData({
          type: 'info',
          message: 'No ability available. Find a power-up!',
          duration: 2000
        });
      }
    } catch (error) {
      errorHandler.logError(
        ErrorCategory.UI,
        ErrorSeverity.LOW,
        'Error sending no ability message',
        error,
        { playerId: player.id }
      );
    }
  }

  // Placeholder methods for additional functionality
  private updateGameStateForPlayerJoin(playerEntity: SoccerPlayerEntity): void {}
  private updateGameStateForPlayerLeave(playerId: string): void {}
  private updatePlayerMovementStats(playerEntity: SoccerPlayerEntity): void {}
  private handleAggressiveAction(playerEntity: SoccerPlayerEntity): void {}
  private handlePowerUpSpawn(entity: any): void {}
  private handlePowerUpDespawn(entity: any): void {}
  private regeneratePlayerStamina(playerEntity: SoccerPlayerEntity): void {}
  private updatePlayerStats(playerEntity: SoccerPlayerEntity): void {}
}