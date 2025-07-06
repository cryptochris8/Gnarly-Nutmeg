import {
  Entity,
  PlayerManager,
  World,
  PlayerEntity,
  Audio,
  ColliderShape,
  BlockType,
  RigidBodyType,
} from "hytopia";
import type { Vector3Like } from "hytopia";
import { 
  MATCH_DURATION, 
  GAME_CONFIG, 
  BALL_SPAWN_POSITION, 
  AI_FIELD_CENTER_X, 
  AI_FIELD_CENTER_Z, 
  FIELD_MIN_X, 
  FIELD_MAX_X, 
  FIELD_MIN_Z, 
  FIELD_MAX_Z, 
  AI_GOAL_LINE_X_RED, 
  AI_GOAL_LINE_X_BLUE, 
  SAFE_SPAWN_Y,
  HALF_DURATION,
  TOTAL_HALVES,
  HALFTIME_DURATION
} from "./gameConfig";
import { getCurrentGameMode, GameMode } from "./gameModes";
import sharedState from "./sharedState";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import AIPlayerEntity from "../entities/AIPlayerEntity";
import { ArcadeEnhancementManager } from "./arcadeEnhancements";

// Custom events for the SoccerGame
declare module "hytopia" {
  interface EventPayloads {
    "goal": string;
    "ball-reset-out-of-bounds": {};
    "ball-out-sideline": {
      side: string;
      position: { x: number; y: number; z: number };
      lastPlayer: PlayerEntity | null;
    };
    "ball-out-goal-line": {
      side: string;
      position: { x: number; y: number; z: number };
      lastPlayer: PlayerEntity | null;
    };
  }
}

// Node.js Timer type
type Timer = ReturnType<typeof setTimeout>;

// Audio resources
const TICKING_AUDIO = new Audio({
  uri: "audio/sfx/soccer/ticking.mp3",
  loop: false,
  volume: 0.3,
  duration: 5,
});

const STOPPAGE_TIME_AUDIO = new Audio({
  uri: "audio/sfx/crowd/stoppage-time.mp3",
  loop: false,
  volume: 0.7,
  duration: 3,
});

// Team statistics interface
export interface TeamStats {
  goals: number;
  shots: number;
  passes: number;
  tackles: number;
  possession: number;
}

export interface Player {
  id: string;
  name: string;
  team: "red" | "blue" | null;
}

export interface GameState {
  status: 'waiting' | 'starting' | 'playing' | 'halftime' | 'overtime' | 'goal-scored' | 'finished';
  
  // Player management (keep existing structure)
  players: Map<string, Player>;
  
  // Half-based timing system
  currentHalf: number; // 1 or 2
  halfTimeRemaining: number; // Time remaining in current half (in seconds)
  isHalftime: boolean; // True during halftime break
  halftimeTimeRemaining: number; // Time remaining in halftime break (in seconds)
  
  // Stoppage time system
  stoppageTimeAdded: number; // Additional stoppage time in seconds
  stoppageTimeNotified: boolean; // Whether stoppage time notification has been sent
  
  // Match info
  timeRemaining: number; // Total time remaining (for backward compatibility)
  matchDuration: number; // Total match time (10 minutes = 600 seconds)
  overtimeTimeRemaining: number; // For overtime periods
  
  // Team and scoring (keep existing structure)
  score: {
    red: number;
    blue: number;
  };
  
  // Team management
  maxPlayersPerTeam: number;
  minPlayersPerTeam: number;
  
  // Game flow
  kickoffTeam: 'red' | 'blue' | null;
  
  // Statistics
  matchStats: {
    redTeam: TeamStats;
    blueTeam: TeamStats;
  };
}

export class SoccerGame {
  private state: GameState;
  private world: World;
  private soccerBall: Entity;
  private attachedPlayer: PlayerEntity | null = null;
  private gameLoopInterval: Timer | null = null;
  private aiPlayersList: AIPlayerEntity[] = [];
  private arcadeManager: ArcadeEnhancementManager | null = null;
  private fifaCrowdManager: any | null = null; // FIFA crowd manager for stadium atmosphere
  
  // Momentum tracking for announcer commentary
  private teamMomentum: {
    red: { consecutiveGoals: number; lastGoalTime: number };
    blue: { consecutiveGoals: number; lastGoalTime: number };
  } = {
    red: { consecutiveGoals: 0, lastGoalTime: 0 },
    blue: { consecutiveGoals: 0, lastGoalTime: 0 }
  };
  
  // Player momentum tracking
  private playerMomentum: Map<string, { consecutiveGoals: number; lastGoalTime: number }> = new Map();

  constructor(world: World, entity: Entity, aiPlayers: AIPlayerEntity[]) {
    this.state = {
      status: "waiting",
      players: new Map(),
      score: {
        red: 0,
        blue: 0,
      },
      timeRemaining: MATCH_DURATION,
      currentHalf: 1,
      halfTimeRemaining: HALF_DURATION,
      isHalftime: false,
      halftimeTimeRemaining: 0,
      stoppageTimeAdded: 0,
      stoppageTimeNotified: false,
      matchDuration: MATCH_DURATION,
      overtimeTimeRemaining: 0,
      maxPlayersPerTeam: 6,
      minPlayersPerTeam: 1,
      kickoffTeam: null,
      matchStats: {
        redTeam: { goals: 0, shots: 0, passes: 0, tackles: 0, possession: 0 },
        blueTeam: { goals: 0, shots: 0, passes: 0, tackles: 0, possession: 0 }
      }
    };
    this.world = world;
    this.soccerBall = entity;
    this.aiPlayersList = aiPlayers;
    this.world.on("goal" as any, ((team: "red" | "blue") => {
      this.handleGoalScored(team);
    }) as any);
    
    // Handle ball reset after out of bounds (old system)
    world.on("ball-reset-out-of-bounds" as any, (() => {
      if (this.state.status === "playing" || this.state.status === "overtime") {
        this.handleBallResetAfterOutOfBounds();
      }
    }) as any);
    
    // Handle throw-ins (sideline out of bounds)
    world.on("ball-out-sideline" as any, ((data: { side: string; position: any; lastPlayer: PlayerEntity | null }) => {
      if (this.state.status === "playing" || this.state.status === "overtime") {
        this.handleThrowIn(data);
      }
    }) as any);
    
    // Handle corner kicks and goal kicks (goal line out of bounds)
    world.on("ball-out-goal-line" as any, ((data: { side: string; position: any; lastPlayer: PlayerEntity | null }) => {
      if (this.state.status === "playing" || this.state.status === "overtime") {
        this.handleGoalLineOut(data);
      }
    }) as any);
  }

  public joinGame(playerId: string, playerName: string): boolean {
    if (this.state.status !== "waiting") {
      return false;
    }

    this.state.players.set(playerId, {
      id: playerId,
      name: playerName,
      team: null
    });

    this.sendTeamCounts();
    return true;
  }

  public getTeamOfPlayer(playerId: string): "red" | "blue" | null {
    return this.state.players.get(playerId)?.team ?? null;
  }

  public getPlayerCountOnTeam(team: "red" | "blue"): number {
    return Array.from(this.state.players.values()).filter(
      (p) => p.team === team
    ).length;
  }

  public inProgress(): boolean {
    return (
      this.state.status === "playing" ||
      this.state.status === "overtime" ||
      this.state.status === "goal-scored"
    );
  }

  public joinTeam(playerId: string, team: "red" | "blue"): boolean {
    let player = this.state.players.get(playerId);
    if (!player) {
      player = {
        id: playerId,
        name: "",
        team: null
      };
      this.state.players.set(playerId, player);
    }

    const teamCount = Array.from(this.state.players.values()).filter(
      (p) => p.team === team
    ).length;

    if (teamCount >= this.state.maxPlayersPerTeam) {
      return false;
    }

    player.team = team;

    this.sendTeamCounts();
    // Try to start game if we have enough players
    const state = this.getState();
    if (
      state.status === "waiting" &&
      Array.from(state.players.values()).filter((p) => p.team !== null)
        .length >=
        state.minPlayersPerTeam * 2
    ) {
      this.world.chatManager.sendBroadcastMessage(
        `${player.name} joined ${team} team - game will start in 3 seconds!`
      );
      this.startGame();
    }

    return true;
  }

  private sendTeamCounts() {
    const redCount = this.getPlayerCountOnTeam("red");
    const blueCount = this.getPlayerCountOnTeam("blue");

    this.sendDataToAllPlayers({
      type: "team-counts",
      red: redCount,
      blue: blueCount,
      maxPlayers: this.state.maxPlayersPerTeam,
    });
  }

  public startGame(): boolean {
    console.log("Attempting to start game");
    
    const redTeamCount = Array.from(this.state.players.values()).filter(
      (p) => p.team === "red"
    ).length;
    const blueTeamCount = Array.from(this.state.players.values()).filter(
      (p) => p.team === "blue"
    ).length;

    console.log(`Team counts: Red = ${redTeamCount}, Blue = ${blueTeamCount}`);
    console.log(`Min players per team: ${this.state.minPlayersPerTeam}`);

    // Check if we have at least one human player total (for single-player mode)
    const totalHumanPlayers = redTeamCount + blueTeamCount;
    console.log(`Total human players: ${totalHumanPlayers}`);
    
    if (totalHumanPlayers === 0) {
      console.log("No human players to start game");
      return false;
    }
    
    // For single-player mode, we only need 1 human player total (AI fills the rest)
    // For multiplayer mode, we need at least 1 human player per team
    const isSinglePlayerMode = totalHumanPlayers === 1;
    
    if (!isSinglePlayerMode) {
      // Multiplayer mode - check both teams have human players
      if (
        redTeamCount < this.state.minPlayersPerTeam ||
        blueTeamCount < this.state.minPlayersPerTeam
      ) {
        console.log("Not enough players to start multiplayer game");
        return false;
      }
    } else {
      console.log("Single-player mode detected - starting with AI players");
    }

    console.log("Starting game sequence");
    this.state.status = "starting";

    // Send initial game state
    this.sendDataToAllPlayers({
      type: "game-state",
      score: this.state.score,
      status: "starting",
      timeUntilStart: 5,
    });

    // Show coin toss UI to all human players
    this.sendDataToAllPlayers({
      type: "coin-toss",
      message: "Coin Toss: Choose Heads or Tails"
    });
    
    this.world.chatManager.sendBroadcastMessage(
      "Coin toss to determine kickoff team! Game will start in 5 seconds."
    );

    setTimeout(() => {
      // Perform coin toss if not already done by player interaction
      if (this.state.kickoffTeam === null) {
        this.performCoinToss();
      }
      
      this.world.chatManager.sendBroadcastMessage(
        "Game will start in 3 seconds!"
      );
      
      // Start the countdown
      this.startCountdown(() => {
        this.beginMatch();
        
        // Ability pickups disabled for clean soccer gameplay
        // this.abilityPickups = [
        //   new AbilityConsumable(this.world, this.getAbilityPickupPosition(0), shurikenThrowOptions),
        //   new AbilityConsumable(this.world, this.getAbilityPickupPosition(1), speedBoostOptions),
        // ];
      });
    }, 2 * 1000);

    return true;
  }

  private startCountdown(onComplete: () => void) {
    let count = 3;
    const countInterval = setInterval(() => {
      if (count === 3) {
        new Audio({
          uri: "audio/sfx/soccer/321.mp3",
          loop: false,
          volume: 0.2,
        }).play(this.world);
      }
      this.sendDataToAllPlayers({
        type: "countdown",
        count: count.toString()
      });
      count--;
      
      if (count === 0) {
        clearInterval(countInterval);
        setTimeout(() => {
          this.sendDataToAllPlayers({
            type: "countdown",
            count: "GO!"
          });
          onComplete();
        }, 1000);
      }
    }, 1000);
  }

  private sendDataToAllPlayers(data: any) {
    PlayerManager.instance.getConnectedPlayers().forEach((player) => {
      player.ui.sendData(data);
    });
  }

  private beginMatch() {
    console.log("Beginning match - Starting 1st Quarter");
    
    // Switch music from opening to gameplay theme
    this.switchToGameplayMusic();
    
    // Send game starting notification to UI for respawn handling - DISABLED
    // this.sendDataToAllPlayers({
    //   type: "game-starting",
    //   message: "New match starting - 1st Quarter begins!"
    // });
    
    // First reset ball position - check and ensure proper spawn
    console.log("Ball position before reset:", this.soccerBall.isSpawned ? 
      `x=${this.soccerBall.position.x}, y=${this.soccerBall.position.y}, z=${this.soccerBall.position.z}` : 
      "Ball not spawned");
    
    // Despawn the ball if it exists
    if (this.soccerBall.isSpawned) {
      console.log("Despawning existing ball");
      this.soccerBall.despawn();
    }
    
    // Make sure the ball is not attached to any player
    sharedState.setAttachedPlayer(null);
    
    // Spawn ball at the safe spawn position (already elevated to prevent ground collision)
    const ballSpawnPos = BALL_SPAWN_POSITION;
    console.log("Spawning ball at:", JSON.stringify(ballSpawnPos));
    this.soccerBall.spawn(this.world, ballSpawnPos);
    
    // Explicitly set zero velocity
    this.soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
    this.soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
    
    // Verify ball spawn status
    console.log("Ball spawn status:", this.soccerBall.isSpawned ? "SUCCESS" : "FAILED");
    console.log("Ball position after spawn:", 
      this.soccerBall.isSpawned ? 
      `x=${this.soccerBall.position.x}, y=${this.soccerBall.position.y}, z=${this.soccerBall.position.z}` : 
      "Ball still not spawned");
    
    // Move all players to their respective positions and ensure proper initialization
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        // Use the role-specific moveToSpawnPoint implementation
        entity.moveToSpawnPoint();
        
        // If it's an AI player, ensure proper activation
        if (entity instanceof AIPlayerEntity) {
          // Deactivate first to clear any existing state
          entity.deactivate();
          // Then activate with fresh state
          entity.activate();
          // Unfreeze the AI player to allow movement
          entity.unfreeze();
        }
      }
    });
    
    // Initialize quarter system - Set the game status to playing and start the 1st quarter
    this.state.status = "playing";
    this.state.currentHalf = 1;
    this.state.halfTimeRemaining = HALF_DURATION;
    this.state.timeRemaining = MATCH_DURATION;
    this.state.isHalftime = false;
    this.state.halftimeTimeRemaining = 0;
    
    // Initialize stoppage time system for first half
    this.state.stoppageTimeAdded = 0;
    this.state.stoppageTimeNotified = false;
    
    console.log(`🏟️ Starting 1st Half - ${HALF_DURATION} seconds per half, ${MATCH_DURATION} seconds total`);
    
    // Update spectator cameras for game start
    const spectatorMode = require("../utils/observerMode").default;
    if (spectatorMode && typeof spectatorMode.updateSpectatorsForGameEvent === 'function') {
      spectatorMode.updateSpectatorsForGameEvent("game-start");
    }

    // Start the game loop for time tracking
    this.gameLoopInterval = setInterval(() => {
      this.gameLoop();
    }, 1000); // Update every second
  }

  private gameLoop() {

    
    // Update arcade enhancements (only active in arcade mode)
    if (this.arcadeManager) {
      this.arcadeManager.update();
    }

    // Update shared state with current game state
    sharedState.setGameState(this.state);

    // MANUAL HALFTIME SYSTEM - No automatic countdown during halftime
    // During halftime, do nothing - wait for manual button click
    if (this.state.isHalftime) {
      return;
    }

    // Handle overtime separately (uses halfTimeRemaining for display)
    if (this.state.status === "overtime") {
      if (this.state.halfTimeRemaining <= 0) {
        console.log("⏰ OVERTIME ENDED!");
        this.handleTimeUp();
        return;
      }
      
      // Update overtime timer
      this.state.halfTimeRemaining--;
      this.state.timeRemaining = this.state.halfTimeRemaining; // Keep in sync
      
      // Play ticking sound in last 5 seconds of overtime
      if (this.state.halfTimeRemaining === 5) {
        TICKING_AUDIO.play(this.world);
      }
      
      // Log overtime progress
      if (this.state.halfTimeRemaining % 10 === 0) {
        console.log(`⏰ OVERTIME: ${this.state.halfTimeRemaining}s remaining, Score: ${this.state.score.red}-${this.state.score.blue}`);
      }
    } else {
      // Handle regular half time countdown with continuous timer and stoppage time
      
      // Always update timers (continuous running clock)
      this.state.halfTimeRemaining--;
      this.state.timeRemaining--;
      
      // Check if we need to add stoppage time (when 60 seconds remaining)
      if (this.state.halfTimeRemaining === 60 && !this.state.stoppageTimeNotified) {
        const stoppageTime = Math.floor(Math.random() * 45) + 15; // Random 15-59 seconds
        this.state.stoppageTimeAdded = stoppageTime;
        this.state.stoppageTimeNotified = true;
        
        console.log(`⏱️ STOPPAGE TIME: ${stoppageTime} seconds added to ${this.state.currentHalf === 1 ? 'first' : 'second'} half`);
        console.log(`⏱️ Game will end when timer reaches -${stoppageTime} seconds (after ${stoppageTime} seconds of stoppage time)`);
        
        // Play stoppage time audio notification
        STOPPAGE_TIME_AUDIO.play(this.world);
        
        // Send stoppage time notification to all players
        this.sendDataToAllPlayers({
          type: "stoppage-time-notification",
          stoppageTimeAdded: stoppageTime,
          message: `${stoppageTime} seconds of stoppage time added`,
          half: this.state.currentHalf
        });
      }
      
      // IMPROVED STOPPAGE TIME LOGIC - Only end when full stoppage time has elapsed
      // Calculate the exact endpoint: negative stoppage time value
      const stoppageTimeEndpoint = 0 - this.state.stoppageTimeAdded;
      
      // Only end half if we've added stoppage time AND reached the endpoint
      if (this.state.stoppageTimeNotified && this.state.halfTimeRemaining <= stoppageTimeEndpoint) {
        console.log(`⏰ HALF ${this.state.currentHalf} ENDED! Timer: ${this.state.halfTimeRemaining}s, Required: ${stoppageTimeEndpoint}s`);
        console.log(`⏰ Stoppage time fully elapsed: ${this.state.stoppageTimeAdded}s added, ${Math.abs(this.state.halfTimeRemaining)}s played`);
        this.handleHalfEnd();
        return;
      }
      
      // Alternative end condition: if no stoppage time and regular time is up
      if (!this.state.stoppageTimeNotified && this.state.halfTimeRemaining <= 0) {
        console.log(`⏰ HALF ${this.state.currentHalf} ENDED! Regular time finished, no stoppage time added`);
        this.handleHalfEnd();
        return;
      }
      
      // Log every 30 seconds during regular time, and every 10 seconds during stoppage time
      const isStoppageTime = this.state.halfTimeRemaining <= 0;
      const logInterval = isStoppageTime ? 10 : 30;
      
      if (this.state.halfTimeRemaining % logInterval === 0) {
        if (isStoppageTime) {
          const stoppageSeconds = Math.abs(this.state.halfTimeRemaining);
          console.log(`⏱️ STOPPAGE TIME: 5+${stoppageSeconds}s (${stoppageSeconds}s into stoppage, ${this.state.stoppageTimeAdded}s total), Status: ${this.state.status}, Score: ${this.state.score.red}-${this.state.score.blue}`);
        } else {
          console.log(`⏰ HALF ${this.state.currentHalf}: ${this.state.halfTimeRemaining}s remaining, Status: ${this.state.status}, Score: ${this.state.score.red}-${this.state.score.blue}`);
        }
      }

      // Play ticking sound in last 5 seconds of regulation OR last 5 seconds of stoppage time
      if (this.state.halfTimeRemaining === 5) {
        TICKING_AUDIO.play(this.world);
      }
      
      // Also play ticking sound 5 seconds before stoppage time ends
      if (this.state.stoppageTimeNotified && this.state.halfTimeRemaining === (stoppageTimeEndpoint + 5)) {
        TICKING_AUDIO.play(this.world);
      }
    }

    // Update player movement statistics and stamina
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        entity.updateDistanceTraveled();
        entity.updateStamina(); // Update stamina system
      }
    });

    // Send game state to UI (now including stoppage time information)
    this.sendDataToAllPlayers({
      type: "game-state",
      timeRemaining: this.state.timeRemaining,
      halfTimeRemaining: this.state.halfTimeRemaining,
      currentHalf: this.state.currentHalf,
      halftimeTimeRemaining: this.state.halftimeTimeRemaining,
      isHalftime: this.state.isHalftime,
      stoppageTimeAdded: this.state.stoppageTimeAdded,
      stoppageTimeNotified: this.state.stoppageTimeNotified,
      score: this.state.score,
      status: this.state.status,
    });

    // Send player stats update every 5 seconds during gameplay
    if (this.state.status === "playing" && this.state.timeRemaining % 5 === 0) {
      this.sendPlayerStatsUpdate();
    }
  }

  private handleHalfEnd() {
    console.log(`⏰ HALF ${this.state.currentHalf} ENDED! Handling half transition`);
    
    // Clear the game loop interval to stop the timer
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    
    // Stop ticking audio
    TICKING_AUDIO.pause();

    // Show half stats
    this.showHalfStats();

    // Check if it's halftime (after 1st half)
    if (this.state.currentHalf === 1) {
      this.startHalftime();
    } else if (this.state.currentHalf === 2) {
      // End of regulation time (after 2nd half)
      this.handleEndOfRegulation();
    }
  }

  private showHalfStats() {
    // Collect current player stats for half display
    const playerStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter(
        (entity): entity is SoccerPlayerEntity =>
          entity instanceof SoccerPlayerEntity
      )
      .map((player) => player.getPlayerStats());

    // Send half stats to all players
    this.sendDataToAllPlayers({
      type: "half-stats",
      redScore: this.state.score.red,
      blueScore: this.state.score.blue,
      playerStats,
      half: this.state.currentHalf,
      message: `End of Half ${this.state.currentHalf}`
    });
  }

  private sendPlayerStatsUpdate() {
    // Collect current player stats
    const playerStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter(
        (entity): entity is SoccerPlayerEntity =>
          entity instanceof SoccerPlayerEntity
      )
      .map((player) => player.getPlayerStats());

    // Send player stats to all players for UI update
    this.sendDataToAllPlayers({
      type: "player-stats-update",
      playerStats
    });
  }

  private startHalftime() {
    console.log("🏟️ Starting halftime break - MANUAL MODE");
    this.state.isHalftime = true;
    this.state.halftimeTimeRemaining = 0; // No automatic countdown
    this.state.status = "halftime";

    // Announce halftime
    this.world.chatManager.sendBroadcastMessage(
      `Halftime! Score: Red ${this.state.score.red} - Blue ${this.state.score.blue}`
    );

    // Send halftime state to UI with manual flag
    this.sendDataToAllPlayers({
      type: "game-state",
      timeRemaining: this.state.timeRemaining,
      halfTimeRemaining: this.state.halfTimeRemaining,
      currentHalf: this.state.currentHalf,
      halftimeTimeRemaining: this.state.halftimeTimeRemaining,
      isHalftime: this.state.isHalftime,
      score: this.state.score,
      status: this.state.status,
      manualHalftime: true, // Flag to indicate manual halftime system
    });

    // ✨ UNLOCK POINTER FOR HALFTIME UI INTERACTION ✨
    // Unlock pointer for all players so they can interact with halftime UI
    PlayerManager.instance.getConnectedPlayers().forEach((player) => {
      player.ui.lockPointer(false);
      console.log(`🎯 Pointer unlocked for ${player.username} - Halftime UI interaction enabled`);
    });

    // Collect current player stats for halftime display
    const playerStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter(
        (entity): entity is SoccerPlayerEntity =>
          entity instanceof SoccerPlayerEntity
      )
      .map((player) => player.getPlayerStats());

    // Send halftime stats display to UI with complete data
    this.sendDataToAllPlayers({
      type: "halftime-stats",
      message: "Halftime Stats - Click 'Start Second Half' to continue",
      canStartSecondHalf: true,
      redScore: this.state.score.red,
      blueScore: this.state.score.blue,
      playerStats,
      half: this.state.currentHalf
    });

    // Update spectator cameras for halftime
    const spectatorMode = require("../utils/observerMode").default;
    if (spectatorMode && typeof spectatorMode.updateSpectatorsForGameEvent === 'function') {
      spectatorMode.updateSpectatorsForGameEvent("half-end");
    }

    // DON'T restart the game loop - wait for manual button click
    console.log("🏟️ Halftime started - waiting for manual 'Start Second Half' button click");
  }

  // Public method to manually start the second half (called from UI button click)
  public startSecondHalf(): void {
    console.log(`🏟️ Second half start requested - Current state: isHalftime=${this.state.isHalftime}, status=${this.state.status}`);
    
    if (!this.state.isHalftime) {
      console.log("⚠️ Cannot start second half - not in halftime!");
      console.log(`⚠️ Current game state: ${JSON.stringify({
        isHalftime: this.state.isHalftime,
        status: this.state.status,
        currentHalf: this.state.currentHalf,
        halfTimeRemaining: this.state.halfTimeRemaining
      })}`);
      return;
    }

    console.log("🏟️ Manual second half start requested - proceeding with transition");
    
    // Call the existing endHalftime method to handle the transition
    this.endHalftime();
    
    // Restart the game loop for the second half
    this.gameLoopInterval = setInterval(() => {
      this.gameLoop();
    }, 1000);
    
    console.log("✅ Second half started successfully - game loop restarted");
  }

  private endHalftime() {
    console.log("🏟️ Ending halftime, starting 2nd half");
    this.state.isHalftime = false;
    this.state.halftimeTimeRemaining = 0;
    this.state.currentHalf = 2;
    this.state.halfTimeRemaining = HALF_DURATION;
    this.state.timeRemaining = HALF_DURATION; // CRITICAL FIX: Reset timeRemaining for second half
    this.state.status = "playing";
    
    // Reset stoppage time for second half
    this.state.stoppageTimeAdded = 0;
    this.state.stoppageTimeNotified = false;

    // ✨ CRITICAL: Send game state update immediately to remove halftime overlay
    this.sendDataToAllPlayers({
      type: "game-state",
      timeRemaining: this.state.timeRemaining,
      halfTimeRemaining: this.state.halfTimeRemaining,
      currentHalf: this.state.currentHalf,
      halftimeTimeRemaining: this.state.halftimeTimeRemaining,
      isHalftime: this.state.isHalftime, // This should be false now
      score: this.state.score,
      status: this.state.status, // This should be "playing" now
      message: "Starting 2nd Half"
    });
    console.log("✅ Game state update sent - halftime overlay should be removed");
    console.log(`✅ Second half timing reset: timeRemaining=${this.state.timeRemaining}s, halfTimeRemaining=${this.state.halfTimeRemaining}s`);

    // Announce start of 2nd half
    this.world.chatManager.sendBroadcastMessage("2nd Half starting!");

    // Perform kickoff positioning for 2nd half
    // In soccer, the team that didn't start the game gets kickoff in 2nd half
    const secondHalfKickoffTeam = this.state.kickoffTeam === "red" ? "blue" : "red";
    this.performKickoffPositioning(secondHalfKickoffTeam, "2nd half start");

    // Send countdown for 2nd half start
    this.sendDataToAllPlayers({
      type: "countdown",
      count: "2nd Half!"
    });

    setTimeout(() => {
      this.sendDataToAllPlayers({
        type: "countdown",
        count: ""
      });
      
      // Ensure all players are unfrozen for 2nd half
      this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
        if (entity instanceof SoccerPlayerEntity) {
          entity.unfreeze();
        }
      });
      
      // ✨ LOCK POINTER FOR GAMEPLAY ✨
      // Lock pointer for all players when returning to gameplay
      PlayerManager.instance.getConnectedPlayers().forEach((player) => {
        player.ui.lockPointer(true);
        console.log(`🎮 Pointer locked for ${player.username} - Game controls enabled`);
      });
    }, 2000);
  }

  private handleEndOfRegulation() {
    console.log("⏰ END OF REGULATION TIME! Handling end of 2 halves");
    console.log(`⏰ Final Score: Red ${this.state.score.red} - Blue ${this.state.score.blue}`);
    
    // Show regulation time stats
    this.showRegulationTimeStats();
    
    // Check if game is tied
    if (this.state.score.red === this.state.score.blue) {
      // Game is tied, go to overtime
      setTimeout(() => {
        console.log("Starting overtime setup...");
        this.state.status = "overtime";
        this.state.halfTimeRemaining = 60; // 1 minute overtime
        this.state.timeRemaining = 60;
        this.world.chatManager.sendBroadcastMessage(
          "Tie game after 2 halves, going to overtime!"
        );
        this.sendDataToAllPlayers({
          type: "countdown",
          count: "Overtime!"
        });

        setTimeout(() => {
          this.sendDataToAllPlayers({
            type: "countdown",
            count: ""
          });
          
          // Ensure all players are unfrozen for overtime
          this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
            if (entity instanceof SoccerPlayerEntity) {
              entity.unfreeze();
            }
          });
          
          // Restart the game loop for overtime
          this.gameLoopInterval = setInterval(() => {
            this.gameLoop();
          }, 1000);
        }, 2000);
      }, 3000);
    } else {
      // Game has a winner after 4 halves
      this.endGame();
    }
  }

  private handleTimeUp() {
    console.log("⏰ OVERTIME TIME UP! Handling end of overtime");
    console.log(`⏰ Score at overtime end: Red ${this.state.score.red} - Blue ${this.state.score.blue}`);
    
    // Clear the game loop interval to stop the timer
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    // Pause the ticking audio
    TICKING_AUDIO.pause();

    if (this.state.score.red === this.state.score.blue) {
      // Overtime ended and still tied, finish the game
      this.world.chatManager.sendBroadcastMessage(
        "Overtime ended! Match ends in a tie!"
      );
      this.endGame();
    } else {
      // Game has a winner after overtime
      this.endGame();
    }
  }

  private showRegulationTimeStats() {
    // Collect current player stats for regulation time display
    const playerStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter(
        (entity): entity is SoccerPlayerEntity =>
          entity instanceof SoccerPlayerEntity
      )
      .map((player) => player.getPlayerStats());

    // Send regulation time stats to all players
    this.sendDataToAllPlayers({
      type: "regulation-time-stats",
      redScore: this.state.score.red,
      blueScore: this.state.score.blue,
      playerStats,
      message: "End of Regulation Time"
    });
  }

  public isTeamFull(team: "red" | "blue"): boolean {
    return this.getPlayerCountOnTeam(team) >= this.state.maxPlayersPerTeam;
  }

  private handleGoalScored(team: "red" | "blue") {
    if (this.state.status !== "playing" && this.state.status !== "overtime") {
      return;
    }

    this.scoreGoal(team);
    this.state.status = "goal-scored";

    // Determine the team that conceded and set them as the kickoff team
    const concedingTeam = team === "red" ? "blue" : "red";
    this.state.kickoffTeam = concedingTeam;
    console.log(`Goal scored by ${team}. Kickoff to ${concedingTeam}.`);

    // Update momentum tracking
    const currentTime = Date.now();
    this.teamMomentum[team].consecutiveGoals++;
    this.teamMomentum[team].lastGoalTime = currentTime;
    this.teamMomentum[concedingTeam].consecutiveGoals = 0; // Reset opponent's momentum

    const lastPlayerWithBall = sharedState.getLastPlayerWithBall();
    if (
      lastPlayerWithBall &&
      lastPlayerWithBall instanceof SoccerPlayerEntity
    ) {
      this.world.chatManager.sendBroadcastMessage(
        `Goal scored by ${lastPlayerWithBall.player.username} for the ${team} team!`
      );
      lastPlayerWithBall.addGoal();
      lastPlayerWithBall.player.ui.sendData({
        type: "update-goals",
        goals: lastPlayerWithBall.getGoalsScored(),
      });
      
      // Update player momentum tracking
      const playerId = lastPlayerWithBall.player.username;
      if (!this.playerMomentum.has(playerId)) {
        this.playerMomentum.set(playerId, { consecutiveGoals: 0, lastGoalTime: 0 });
      }
      const playerMomentumData = this.playerMomentum.get(playerId)!;
      playerMomentumData.consecutiveGoals++;
      playerMomentumData.lastGoalTime = currentTime;
      
      // Check for individual player momentum (hat-trick, etc.)
      if (playerMomentumData.consecutiveGoals >= 3) {
        console.log(`🔥 ${playerId} has scored ${playerMomentumData.consecutiveGoals} consecutive goals!`);
        if (this.fifaCrowdManager && this.fifaCrowdManager.playMomentumAnnouncement) {
          setTimeout(() => {
            this.fifaCrowdManager.playMomentumAnnouncement();
          }, 2500); // Delay so it plays after goal announcement
        }
      }
    } else {
      this.world.chatManager.sendBroadcastMessage(
        `Goal scored for the ${team} team!`
      );
    }
    
    // Check for team momentum (multiple goals in short time)
    if (this.teamMomentum[team].consecutiveGoals >= 2) {
      console.log(`🔥 ${team} team is on fire with ${this.teamMomentum[team].consecutiveGoals} consecutive goals!`);
      if (this.fifaCrowdManager && this.fifaCrowdManager.playMomentumAnnouncement) {
        setTimeout(() => {
          this.fifaCrowdManager.playMomentumAnnouncement();
        }, 3000); // Delay so it plays after goal announcement
      }
    }
    
    this.world.chatManager.sendBroadcastMessage(
      `The ${concedingTeam} team will kick off.`
    );

    // Send goal event to UI
    this.sendDataToAllPlayers({
      type: "goal-scored",
      team: team,
      score: this.state.score,
      kickoffTeam: this.state.kickoffTeam, // Also send kickoff team to UI
    });

    // Update spectator cameras for goal events
    const spectatorMode = require("../utils/observerMode").default;
    if (spectatorMode && typeof spectatorMode.updateSpectatorsForGameEvent === 'function') {
      spectatorMode.updateSpectatorsForGameEvent("goal-scored", { team, score: this.state.score });
    }
    
    // Play goal celebration sounds
    new Audio({
      uri: "audio/sfx/soccer/whistle.mp3",
      loop: false,
      volume: 0.3,
    }).play(this.world);

    // FIFA crowd manager handles all announcer audio through its queue system
    // to prevent multiple voices playing simultaneously
    
    // Play FIFA crowd goal reaction if in FIFA mode and crowd manager is available
    if (this.fifaCrowdManager && this.fifaCrowdManager.playGoalReaction) {
      this.fifaCrowdManager.playGoalReaction();
    }

    // Reset the ball movement flag as we're repositioning the ball
    sharedState.resetBallMovementFlag();

    // Wait a moment, then set up kickoff positioning
    setTimeout(() => {
      console.log("Setting up for kickoff after goal...");
      
      // Use the new kickoff positioning system (this handles all player positioning)
      console.log(`Setting up proper kickoff positioning after goal scored by ${team}`);
      this.performKickoffPositioning(concedingTeam, `goal scored by ${team}`);
      
      // Start countdown after kickoff positioning is complete
      setTimeout(() => {
        this.startCountdown(() => {
          new Audio({
            uri: "audio/sfx/soccer/whistle.mp3",
            loop: false,
            volume: 0.2,
          }).play(this.world);

          // Unfreeze all players after countdown (already handled by performKickoffPositioning)
          this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
            if (entity instanceof SoccerPlayerEntity) {
              entity.unfreeze();
              console.log(`Unfroze ${entity.player.username} after kickoff countdown`);
            }
          });
          
          // Set status back to playing
          this.state.status = "playing";
          
          this.sendDataToAllPlayers({
            type: "game-state",
            timeRemaining: this.state.timeRemaining,
            score: this.state.score,
            status: this.state.status,
            kickoffTeam: this.state.kickoffTeam, // Ensure UI knows who kicks off
          });
        });
      }, 1000); // Start countdown after 1 second
    }, 3000); // Wait 3 seconds after goal before resetting
  }

  public scoreGoal(team: "red" | "blue") {
    this.state.score[team]++;
    console.log(`⚽ Goal scored! New score: Red ${this.state.score.red} - Blue ${this.state.score.blue}`);

    // Don't send game-state update here - the goal-scored event will handle score display
    // This prevents conflicts with the UI scoreboard updates
    console.log(`📊 Score updated internally - UI will receive score via goal-scored event`);

    // Mercy rule removed - games are short (2x 5-minute halves) so let them play to completion
    console.log(`⚽ Goal scored by ${team} team - game will continue to completion`);
  }

  private endGame() {
    console.log("🏁 ENDING GAME - Starting end game sequence");
    console.log(`🏁 Final Score: Red ${this.state.score.red} - Blue ${this.state.score.blue}`);
    console.log(`🏁 Time Remaining: ${this.state.timeRemaining} seconds`);
    console.log(`🏁 Game Status: ${this.state.status}`);

    // Store whether this was an overtime game before changing status
    const wasOvertime = this.state.status === "overtime";

    // Stop the game loop immediately to prevent further time updates
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    // Set game status to finished
    this.state.status = "finished";
    
    // Switch back to opening music
    this.switchToOpeningMusic();
    
    // Play FIFA game end announcement if in FIFA mode and crowd manager is available
    if (this.fifaCrowdManager && this.fifaCrowdManager.playGameEndAnnouncement) {
      this.fifaCrowdManager.playGameEndAnnouncement();
    }

    // Collect comprehensive player stats
    const allEntities = this.world.entityManager.getAllPlayerEntities();
    console.log(`🏁 Found ${allEntities.length} total player entities`);
    
    const soccerPlayerEntities = allEntities.filter(
      (entity): entity is SoccerPlayerEntity =>
        entity instanceof SoccerPlayerEntity
    );
    console.log(`🏁 Found ${soccerPlayerEntities.length} soccer player entities`);
    
    const playerStats = soccerPlayerEntities.map((player) => {
      const stats = player.getPlayerStats();
      console.log(`🏁 Collected stats for ${stats.name} (${stats.team}): ${stats.goals} goals, ${stats.tackles} tackles`);
      return stats;
    });
    
    console.log(`🏁 Total player stats collected: ${playerStats.length}`);

    // Calculate team statistics from player stats
    const redTeamStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter((entity) => entity instanceof SoccerPlayerEntity && entity.team === "red")
      .map((player) => (player as SoccerPlayerEntity).getPlayerStats());
    
    const blueTeamStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter((entity) => entity instanceof SoccerPlayerEntity && entity.team === "blue")
      .map((player) => (player as SoccerPlayerEntity).getPlayerStats());
    
    const finalStats = {
      red: {
        goals: redTeamStats.reduce((sum, p) => sum + p.goals, 0),
        tackles: redTeamStats.reduce((sum, p) => sum + p.tackles, 0),
        passes: redTeamStats.reduce((sum, p) => sum + p.passes, 0),
        shots: redTeamStats.reduce((sum, p) => sum + p.shots, 0),
        possession: redTeamStats.reduce((sum, p) => sum + p.saves, 0) // Using saves as placeholder for possession
      },
      blue: {
        goals: blueTeamStats.reduce((sum, p) => sum + p.goals, 0),
        tackles: blueTeamStats.reduce((sum, p) => sum + p.tackles, 0),
        passes: blueTeamStats.reduce((sum, p) => sum + p.passes, 0),
        shots: blueTeamStats.reduce((sum, p) => sum + p.shots, 0),
        possession: blueTeamStats.reduce((sum, p) => sum + p.saves, 0) // Using saves as placeholder for possession
      }
    };

    // Determine winner
    let winner = 'tie';
    if (this.state.score.red > this.state.score.blue) {
      winner = 'red';
    } else if (this.state.score.blue > this.state.score.red) {
      winner = 'blue';
    }

    // Freeze all players at game end
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        entity.freeze();
      }
    });

    // Send game over data to UI (DO NOT reset game automatically)
    const gameOverData = {
      type: "game-over",
      redScore: this.state.score.red,
      blueScore: this.state.score.blue,
      playerStats,
      teamStats: finalStats,
      winner,
      matchDuration: MATCH_DURATION - this.state.timeRemaining,
      wasOvertime
    };
    
    console.log("🏁 Sending game-over data to UI:", {
      type: gameOverData.type,
      scores: `${gameOverData.redScore}-${gameOverData.blueScore}`,
      winner: gameOverData.winner,
      playerStatsCount: gameOverData.playerStats.length,
      matchDuration: gameOverData.matchDuration,
      wasOvertime: gameOverData.wasOvertime
    });
    
    this.sendDataToAllPlayers(gameOverData);

    // Use type assertions for custom event name and payload
    this.world.emit("game-over" as any, {
      redScore: this.state.score.red,
      blueScore: this.state.score.blue,
      playerStats,
      teamStats: finalStats,
      winner,
      matchDuration: MATCH_DURATION - this.state.timeRemaining,
      wasOvertime
    } as any);

    this.world.chatManager.sendBroadcastMessage(
      `Game over! Final Score: Red ${this.state.score.red} - ${this.state.score.blue} Blue`
    );

    console.log("Game ended. Waiting for manual reset via 'Back to Lobby' button.");
    // DO NOT automatically reset the game - wait for manual trigger
  }

  /**
   * Manually reset the game - called from UI "Back to Lobby" button
   * This is the proper way to reset after a game ends
   */
  public manualResetGame(): void {
    console.log("🔄 MANUAL GAME RESET - Player requested return to lobby");
    this.resetGame();
  }

  public resetGame() {
    console.log("🔄 RESETTING GAME - Starting cleanup process...");
    
    // Clear all intervals
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    
    // Reset momentum tracking
    this.teamMomentum = {
      red: { consecutiveGoals: 0, lastGoalTime: 0 },
      blue: { consecutiveGoals: 0, lastGoalTime: 0 }
    };
    this.playerMomentum.clear();
    console.log("🔄 Reset momentum tracking for new game");

    // Clean up ability pickups (disabled)
    // this.abilityPickups.forEach(pickup => {
    //   pickup.destroy();
    // });
    // this.abilityPickups = [];
    // console.log("🔄 Cleaned up ability pickups for new game");

    // Deactivate all AI players first to clear their intervals
    this.aiPlayersList.forEach(ai => {
      if (ai.isSpawned) {
        ai.deactivate();
        ai.despawn();
      }
    });
    
    // Clear the AI players list to prevent stale references
    this.aiPlayersList = [];

    // Reset player stats and clean up ALL entities (including human players)
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        entity.resetStats();
        
        // Unfreeze players for new game
        entity.unfreeze();
        
        // Send UI update only if player is still connected
        try {
          entity.player.ui.sendData({
            type: "update-goals",
            goals: 0,
          });
        } catch (error) {
          console.log(`Could not send UI update to disconnected player: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Ensure no ball attachments remain
        if (this.attachedPlayer === entity) {
          this.attachedPlayer = null;
          sharedState.setAttachedPlayer(null);
        }
        
        // Despawn ALL player entities to prevent duplicates when restarting
        if (entity.isSpawned) {
          console.log(`Despawning player entity: ${entity.id} (${entity instanceof AIPlayerEntity ? 'AI' : 'Human'})`);
          entity.despawn();
        }
      }
    });

    this.state = {
      status: "waiting",
      players: new Map(),
      score: {
        red: 0,
        blue: 0,
      },
      timeRemaining: MATCH_DURATION,
      currentHalf: 1,
      halfTimeRemaining: HALF_DURATION,
      isHalftime: false,
      halftimeTimeRemaining: 0,
      stoppageTimeAdded: 0,
      stoppageTimeNotified: false,
      matchDuration: MATCH_DURATION,
      overtimeTimeRemaining: 0,
      maxPlayersPerTeam: 6,
      minPlayersPerTeam: 1,
      kickoffTeam: null,
      matchStats: {
        redTeam: { goals: 0, shots: 0, passes: 0, tackles: 0, possession: 0 },
        blueTeam: { goals: 0, shots: 0, passes: 0, tackles: 0, possession: 0 }
      }
    };

    // Reset the ball position and ensure no attachments with proper physics reset
    if (this.soccerBall.isSpawned) {
      this.soccerBall.despawn();
    }
    this.attachedPlayer = null;
    sharedState.setAttachedPlayer(null);
    
    // Spawn ball with proper physics reset
    this.soccerBall.spawn(this.world, BALL_SPAWN_POSITION);
    this.soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
    this.soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
    this.soccerBall.wakeUp(); // Ensure physics state is updated
    
    sharedState.resetBallMovementFlag();

    // Notify all connected players that the game has been reset
    this.sendDataToAllPlayers({
      type: "game-reset",
      message: "Game has been reset. Please select your team again."
    });

    this.sendTeamCounts();
    
    console.log("✅ GAME RESET COMPLETE - All entities cleaned up, UI notified");
  }

  public getState(): GameState {
    return this.state;
  }



  /**
   * Get current player statistics for UI display
   * @returns Array of player statistics
   */
  public getPlayerStatsForUI(): any[] {
    const stats: any[] = [];
    
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        const playerStats = entity.getPlayerStats();
        stats.push({
          name: entity.player.username,
          team: entity.team,
          role: entity.role,
          goals: entity.getGoalsScored(),
          tackles: playerStats.tackles,
          passes: playerStats.passes,
          shots: playerStats.shots,
          saves: playerStats.saves,
          distanceTraveled: Math.round(playerStats.distanceTraveled)
        });
      }
    });
    
    return stats;
  }

  public attachBallToPlayer(player: PlayerEntity) {
    this.attachedPlayer = player;
  }

  public detachBall() {
    this.attachedPlayer = null;
  }

  public getAttachedPlayer(): PlayerEntity | null {
    return this.attachedPlayer;
  }

  public removePlayer(playerId: string) {
    this.state.players.delete(playerId);
    // Update team counts when a player leaves
    this.sendTeamCounts();
  }

  /**
   * Get the maximum number of players allowed per team
   */
  public getMaxPlayersPerTeam(): number {
    return this.state.maxPlayersPerTeam;
  }

  /**
   * Set the maximum number of players allowed per team
   */
  public setMaxPlayersPerTeam(maxPlayers: number): void {
    this.state.maxPlayersPerTeam = maxPlayers;
    console.log(`Updated max players per team to: ${maxPlayers}`);
    this.sendTeamCounts(); // Update UI with new max players
  }

  /**
   * Update the AI players list reference
   * @param aiPlayers - The current list of AI players
   */
  public updateAIPlayersList(aiPlayers: AIPlayerEntity[]): void {
    this.aiPlayersList = aiPlayers;
    console.log(`Updated SoccerGame AI players list: ${aiPlayers.length} players`);
  }

  public setArcadeManager(arcadeManager: ArcadeEnhancementManager): void {
    this.arcadeManager = arcadeManager;
    console.log("Arcade manager set for SoccerGame");
  }

  public setPickupManager(pickupManager: any): void {
    (this as any).pickupManager = pickupManager;
    console.log("Pickup manager set for SoccerGame");
  }

  public setFIFACrowdManager(fifaCrowdManager: any): void {
    this.fifaCrowdManager = fifaCrowdManager;
    console.log("FIFA crowd manager set for SoccerGame");
  }

  public setTournamentManager(tournamentManager: any): void {
    (this as any).tournamentManager = tournamentManager;
    console.log("🏆 Tournament manager set for SoccerGame");
  }



  // Perform coin toss and determine which team kicks off
  public performCoinToss(playerChoice?: { playerId: string, choice: "heads" | "tails" }): void {
    // If kickoff team is already determined, do nothing
    if (this.state.kickoffTeam !== null) {
      return;
    }
    
    // Random coin flip outcome
    const coinResult = Math.random() < 0.5 ? "heads" : "tails";
    
    let kickoffTeam: "red" | "blue";
    let winningPlayerName = "Random selection";
    
    if (playerChoice) {
      // If player made a choice, check if they won
      const playerWon = playerChoice.choice === coinResult;
      const playerTeam = this.getTeamOfPlayer(playerChoice.playerId);
      
      if (playerWon && playerTeam) {
        kickoffTeam = playerTeam;
        winningPlayerName = this.state.players.get(playerChoice.playerId)?.name || "Unknown player";
      } else {
        // If player lost or has no team, opponent team kicks off
        kickoffTeam = playerTeam === "red" ? "blue" : "red";
      }
    } else {
      // Random team gets to kick off if no player choice
      kickoffTeam = Math.random() < 0.5 ? "red" : "blue";
    }
    
    this.state.kickoffTeam = kickoffTeam;
    
    // Announce the result
    this.world.chatManager.sendBroadcastMessage(
      `Coin toss result: ${coinResult.toUpperCase()}! ${kickoffTeam.toUpperCase()} team will kick off.`
    );
    
    if (playerChoice) {
      this.world.chatManager.sendBroadcastMessage(
        `${winningPlayerName} called it ${playerChoice.choice === coinResult ? "correctly" : "incorrectly"}!`
      );
    }
    
    // Notify all players of the result
    this.sendDataToAllPlayers({
      type: "coin-toss-result",
      result: coinResult,
      kickoffTeam: kickoffTeam
    });
  }

  /**
   * Handles ball resets after the ball goes out of bounds
   * Uses the new kickoff positioning system for proper player arrangement
   */
  private handleBallResetAfterOutOfBounds() {
    console.log("Handling ball reset after out of bounds");
    this.handleBallReset("out of bounds");
  }

  /**
   * Handle throw-in when ball goes out on sideline
   * @param data - Information about the out of bounds event
   */
  private handleThrowIn(data: { side: string; position: any; lastPlayer: PlayerEntity | null }) {
    console.log("Handling throw-in:", data);
    
    // Determine which team gets the throw-in (opposite of team that last touched)
    let throwInTeam: "red" | "blue";
    
    if (data.lastPlayer && data.lastPlayer instanceof SoccerPlayerEntity) {
      // Give throw-in to opposing team
      throwInTeam = data.lastPlayer.team === "red" ? "blue" : "red";
      console.log(`${data.lastPlayer.team} team last touched ball, throw-in to ${throwInTeam} team`);
    } else {
      // Fallback: random or based on field position
      throwInTeam = Math.random() < 0.5 ? "red" : "blue";
      console.log(`Unknown last touch, randomly assigning throw-in to ${throwInTeam} team`);
    }
    
    // Calculate throw-in position
    const throwInPosition = this.calculateThrowInPosition(data.side, data.position);
    
    // Notify players
    this.world.chatManager.sendBroadcastMessage(
      `Throw-in to ${throwInTeam.toUpperCase()} team.`
    );
    
    // Simple ball reset for throw-in
    this.resetBallAtPosition(throwInPosition);
  }

  /**
   * Handle corner kick or goal kick when ball goes out over goal line
   * @param data - Information about the out of bounds event
   */
  private handleGoalLineOut(data: { side: string; position: any; lastPlayer: PlayerEntity | null }) {
    console.log("Handling goal line out:", data);
    
    // Determine which goal line was crossed and restart type
    const crossedRedGoalLine = data.side === "min-x"; // Red defends min-x side
    const crossedBlueGoalLine = data.side === "max-x"; // Blue defends max-x side
    
    if (data.lastPlayer && data.lastPlayer instanceof SoccerPlayerEntity) {
      const lastTouchTeam = data.lastPlayer.team;
      
      if (crossedRedGoalLine) {
        if (lastTouchTeam === "red") {
          // Red team last touched, ball went over their own goal line = Corner kick for blue
          console.log("Corner kick for blue team (red last touched over red goal line)");
          const cornerPosition = this.calculateCornerPosition(data.side, data.position);
          this.world.chatManager.sendBroadcastMessage("Corner kick to BLUE team!");
          this.resetBallAtPosition(cornerPosition);
        } else {
          // Blue team last touched, ball went over red goal line = Goal kick for red
          console.log("Goal kick for red team (blue last touched over red goal line)");
          const goalKickPosition = this.calculateGoalKickPosition("red");
          this.world.chatManager.sendBroadcastMessage("Goal kick to RED team!");
          this.resetBallAtPosition(goalKickPosition);
        }
      } else if (crossedBlueGoalLine) {
        if (lastTouchTeam === "blue") {
          // Blue team last touched, ball went over their own goal line = Corner kick for red
          console.log("Corner kick for red team (blue last touched over blue goal line)");
          const cornerPosition = this.calculateCornerPosition(data.side, data.position);
          this.world.chatManager.sendBroadcastMessage("Corner kick to RED team!");
          this.resetBallAtPosition(cornerPosition);
        } else {
          // Red team last touched, ball went over blue goal line = Goal kick for blue
          console.log("Goal kick for blue team (red last touched over blue goal line)");
          const goalKickPosition = this.calculateGoalKickPosition("blue");
          this.world.chatManager.sendBroadcastMessage("Goal kick to BLUE team!");
          this.resetBallAtPosition(goalKickPosition);
        }
      } else {
        // Fallback to center reset for unexpected cases
        console.log("Unexpected goal line crossing, falling back to center reset");
        this.handleBallReset("unexpected goal line crossing");
      }
    } else {
      // No clear last touch, fallback to goal kick for defending team
      const defendingTeam = crossedRedGoalLine ? "red" : "blue";
      console.log(`No clear last touch, goal kick for defending team: ${defendingTeam}`);
      const goalKickPosition = this.calculateGoalKickPosition(defendingTeam);
      this.world.chatManager.sendBroadcastMessage(`Goal kick to ${defendingTeam.toUpperCase()} team!`);
      this.resetBallAtPosition(goalKickPosition);
    }
  }

  /**
   * Simple ball reset at a specific position
   */
  private resetBallAtPosition(position: Vector3Like) {
    // Despawn and respawn ball at position
    if (this.soccerBall.isSpawned) {
      this.soccerBall.despawn();
    }
    sharedState.setAttachedPlayer(null);
    
    this.soccerBall.spawn(this.world, position);
    this.soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
    this.soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
    
    // Reset ball movement flag
    sharedState.resetBallMovementFlag();
    
    // Play whistle
    new Audio({
      uri: "audio/sfx/soccer/whistle.mp3",
      loop: false,
      volume: 0.1,
    }).play(this.world);
  }

  /**
   * Calculate throw-in position based on where ball went out
   */
  private calculateThrowInPosition(side: string, outPosition: { x: number; y: number; z: number }) {
    // Place ball slightly inside the field boundary
    const THROW_IN_INSET = 1.0; // Distance inside field boundary
    
    let throwInX = outPosition.x;
    let throwInZ = outPosition.z;
    
    // Adjust based on which side was crossed
    if (side === "min-z") {
      throwInZ = FIELD_MIN_Z + THROW_IN_INSET;
    } else if (side === "max-z") {
      throwInZ = FIELD_MAX_Z - THROW_IN_INSET;
    }
    
    // Clamp X position to stay within field length
    throwInX = Math.max(FIELD_MIN_X + 2, Math.min(FIELD_MAX_X - 2, throwInX));
    
    return {
      x: throwInX,
      y: 1.5, // Slightly elevated for visibility
      z: throwInZ
    };
  }

  /**
   * Calculate corner kick position
   */
  private calculateCornerPosition(goalLineSide: string, outPosition: { x: number; y: number; z: number }) {
    // Determine which corner based on goal line side and Z position
    let cornerX: number;
    let cornerZ: number;
    
    if (goalLineSide === "min-x") {
      // Red goal line
      cornerX = FIELD_MIN_X + 1; // Slightly inside field
      cornerZ = outPosition.z > AI_FIELD_CENTER_Z ? FIELD_MAX_Z - 1 : FIELD_MIN_Z + 1;
    } else {
      // Blue goal line  
      cornerX = FIELD_MAX_X - 1; // Slightly inside field
      cornerZ = outPosition.z > AI_FIELD_CENTER_Z ? FIELD_MAX_Z - 1 : FIELD_MIN_Z + 1;
    }
    
    return {
      x: cornerX,
      y: 1.5, // Slightly elevated
      z: cornerZ
    };
  }

  /**
   * Calculate goal kick position
   */
  private calculateGoalKickPosition(kickingTeam: "red" | "blue") {
    // Position in penalty area/goal area
    const GOAL_KICK_OFFSET = 8; // Distance from goal line
    
    let goalKickX: number;
    
    if (kickingTeam === "red") {
      goalKickX = AI_GOAL_LINE_X_RED + GOAL_KICK_OFFSET;
    } else {
      goalKickX = AI_GOAL_LINE_X_BLUE - GOAL_KICK_OFFSET;
    }
    
    return {
      x: goalKickX,
      y: 1.5, // Slightly elevated
      z: AI_FIELD_CENTER_Z // Center of goal area
    };
  }

  /**
   * Perform a proper kickoff positioning for all players
   * @param kickoffTeam - The team that gets to kick off
   * @param reason - Why the kickoff is happening (for logging)
   */
  public performKickoffPositioning(kickoffTeam: "red" | "blue", reason: string = "restart"): void {
    console.log(`Setting up kickoff positioning for ${kickoffTeam} team (${reason})`);
    
    // Set the kickoff team in state
    this.state.kickoffTeam = kickoffTeam;
    
    // First, reset ball position and ensure it's stationary
    if (this.soccerBall.isSpawned) {
      this.soccerBall.despawn();
    }
    sharedState.setAttachedPlayer(null);
    
    // Spawn ball at center with proper elevation to prevent collision
    const adjustedSpawnPosition = {
      x: AI_FIELD_CENTER_X,
      y: SAFE_SPAWN_Y, // Use consistent safe spawn height
      z: AI_FIELD_CENTER_Z
    };
    this.soccerBall.spawn(this.world, adjustedSpawnPosition);
    this.soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
    this.soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
    this.soccerBall.wakeUp(); // Ensure physics state is updated
    
    // Reset ball movement flag so AI knows this is a kickoff situation
    sharedState.resetBallMovementFlag();
    
    // Position all players according to kickoff rules
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        this.positionPlayerForKickoff(entity, kickoffTeam);
      }
    });
    
    // Special handling for AI players
    this.setupAIPlayersForKickoff(kickoffTeam);
    
    console.log(`Kickoff positioning complete for ${kickoffTeam} team`);
  }

  /**
   * Position a single player according to kickoff rules
   * @param player - The player to position
   * @param kickoffTeam - The team taking the kickoff
   */
  private positionPlayerForKickoff(player: SoccerPlayerEntity, kickoffTeam: "red" | "blue"): void {
    const isKickoffTeam = player.team === kickoffTeam;
    const isHumanPlayer = !(player instanceof AIPlayerEntity);
    
    let targetPosition: Vector3Like;
    
    if (isKickoffTeam) {
      // Kickoff team positioning
      if (player instanceof AIPlayerEntity && player.aiRole === 'central-midfielder-1') {
        // This AI player will take the kickoff - position near the ball
        targetPosition = {
          x: AI_FIELD_CENTER_X + (kickoffTeam === 'red' ? -2 : 2), // Slightly behind ball
          y: SAFE_SPAWN_Y, // Use safe spawn height
          z: AI_FIELD_CENTER_Z
        };
        console.log(`Positioning AI kickoff taker ${player.player.username} at center`);
      } else if (isHumanPlayer && player.role === 'central-midfielder-1') {
        // Human player taking kickoff
        targetPosition = {
          x: AI_FIELD_CENTER_X + (kickoffTeam === 'red' ? -2 : 2),
          y: SAFE_SPAWN_Y, // Use safe spawn height
          z: AI_FIELD_CENTER_Z
        };
        console.log(`Positioning human kickoff taker ${player.player.username} at center`);
      } else {
        // Other kickoff team players - position in their own half
        targetPosition = this.getKickoffHalfPosition(player, kickoffTeam, true);
      }
    } else {
      // Defending team positioning
      if (player instanceof AIPlayerEntity && player.aiRole === 'central-midfielder-1') {
        // One defending midfielder positions at center circle edge (10-yard rule)
        targetPosition = {
          x: AI_FIELD_CENTER_X + (kickoffTeam === 'red' ? 12 : -12), // 12 units away (10-yard rule)
          y: SAFE_SPAWN_Y, // Use safe spawn height
          z: AI_FIELD_CENTER_Z
        };
        console.log(`Positioning defending AI ${player.player.username} at center circle edge`);
      } else if (isHumanPlayer && player.role === 'central-midfielder-1') {
        // Human defending midfielder
        targetPosition = {
          x: AI_FIELD_CENTER_X + (kickoffTeam === 'red' ? 12 : -12),
          y: SAFE_SPAWN_Y, // Use safe spawn height
          z: AI_FIELD_CENTER_Z
        };
        console.log(`Positioning defending human ${player.player.username} at center circle edge`);
      } else {
        // Other defending players - position in their own half
        targetPosition = this.getKickoffHalfPosition(player, kickoffTeam, false);
      }
    }
    
    // Apply the position with physics reset
    player.setLinearVelocity({ x: 0, y: 0, z: 0 });
    player.setAngularVelocity({ x: 0, y: 0, z: 0 });
    player.setPosition(targetPosition);
    player.wakeUp(); // Ensure physics state is updated
    player.freeze(); // Freeze player until kickoff is taken
    
    console.log(`Positioned ${player.player.username} (${player.team}, ${player.role}) at x=${targetPosition.x.toFixed(1)}, y=${targetPosition.y.toFixed(1)}, z=${targetPosition.z.toFixed(1)}`);
  }

  /**
   * Get appropriate positioning for players in their half during kickoff
   * @param player - The player to position
   * @param kickoffTeam - The team taking kickoff
   * @param isKickoffTeam - Whether this player is on the kickoff team
   */
  private getKickoffHalfPosition(player: SoccerPlayerEntity, kickoffTeam: "red" | "blue", isKickoffTeam: boolean): Vector3Like {
    const playerTeam = player.team;
    
    // Determine which half the player should be in
    // Red team's half: x < AI_FIELD_CENTER_X
    // Blue team's half: x > AI_FIELD_CENTER_X
    const inOwnHalf = playerTeam === 'red' ? 
      (AI_FIELD_CENTER_X - 5) : // Red players stay in negative X area
      (AI_FIELD_CENTER_X + 5);  // Blue players stay in positive X area
    
    // Get base position for the player's role
    let basePosition: Vector3Like;
    
    if (player instanceof AIPlayerEntity) {
      // For AI players, use their role-based positioning but constrain to appropriate half
      const rolePosition = this.getRoleBasedPositionForTeam(player.aiRole, playerTeam);
      
      // Adjust X to ensure player is in correct half
      let adjustedX = rolePosition.x;
      if (playerTeam === 'red' && adjustedX > AI_FIELD_CENTER_X - 5) {
        adjustedX = AI_FIELD_CENTER_X - 8; // Keep red team in their half
      } else if (playerTeam === 'blue' && adjustedX < AI_FIELD_CENTER_X + 5) {
        adjustedX = AI_FIELD_CENTER_X + 8; // Keep blue team in their half
      }
      
      basePosition = {
        x: adjustedX,
        y: SAFE_SPAWN_Y, // Use safe spawn height
        z: rolePosition.z
      };
    } else {
      // For human players, use a default midfielder position in their half
      basePosition = {
        x: inOwnHalf,
        y: SAFE_SPAWN_Y, // Use safe spawn height
        z: AI_FIELD_CENTER_Z
      };
    }
    
    return basePosition;
  }

  /**
   * Get role-based position for a specific team (helper method)
   */
  private getRoleBasedPositionForTeam(role: string, team: "red" | "blue"): Vector3Like {
    const isRed = team === 'red';
    const ownGoalLineX = isRed ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    const forwardXMultiplier = isRed ? -1 : 1;
    
    // Simplified role positioning (based on original getStartPosition logic)
    let x = 0, z = AI_FIELD_CENTER_Z;
    
    switch (role) {
      case 'goalkeeper':
        x = ownGoalLineX + (1 * forwardXMultiplier * -1);
        break;
      case 'left-back':
        x = ownGoalLineX + (12 * forwardXMultiplier * -1); // AI_DEFENSIVE_OFFSET_X
        z = AI_FIELD_CENTER_Z - 15;
        break;
      case 'right-back':
        x = ownGoalLineX + (12 * forwardXMultiplier * -1);
        z = AI_FIELD_CENTER_Z + 15;
        break;
      case 'central-midfielder-1':
        x = ownGoalLineX + (34 * forwardXMultiplier * -1); // AI_MIDFIELD_OFFSET_X
        z = AI_FIELD_CENTER_Z - 8;
        break;
      case 'central-midfielder-2':
        x = ownGoalLineX + (34 * forwardXMultiplier * -1);
        z = AI_FIELD_CENTER_Z + 8;
        break;
      case 'striker':
        x = ownGoalLineX + (43 * forwardXMultiplier * -1); // AI_FORWARD_OFFSET_X
        break;
      default:
        x = ownGoalLineX + (34 * forwardXMultiplier * -1);
        break;
    }
    
    return { x, y: SAFE_SPAWN_Y, z };
  }

  /**
   * Setup AI players specifically for kickoff behavior
   * @param kickoffTeam - The team taking the kickoff
   */
  private setupAIPlayersForKickoff(kickoffTeam: "red" | "blue"): void {
    // Get current AI players from the world instead of relying on stored list
    const currentAIPlayers = this.world.entityManager.getAllPlayerEntities()
      .filter(entity => entity instanceof AIPlayerEntity) as AIPlayerEntity[];
    
    console.log(`Setting up ${currentAIPlayers.length} AI players for kickoff`);
    
    currentAIPlayers.forEach(ai => {
      if (ai.isSpawned) {
        // Don't deactivate during kickoff setup to avoid losing AI players
        // Just set appropriate restart behavior based on role and team
        if (ai.team === kickoffTeam && ai.aiRole === 'central-midfielder-1') {
          // This AI will take the kickoff and should pass to teammates
          ai.setRestartBehavior('pass-to-teammates');
          console.log(`Set AI ${ai.player.username} to kickoff mode (pass-to-teammates)`);
        } else {
          // All other AI players use normal behavior but stay disciplined
          ai.setRestartBehavior('normal');
        }
        
        // Ensure AI is active - activate() is safe to call multiple times
        ai.activate();
      }
    });
  }

  /**
   * Handle ball reset scenarios (used by /stuck command and out-of-bounds)
   * @param triggerReason - Why the reset was triggered
   */
  public handleBallReset(triggerReason: string = "manual reset"): void {
    console.log(`Handling ball reset: ${triggerReason}`);
    
    // Determine kickoff team
    // For manual resets, alternate or use random selection
    let kickoffTeam: "red" | "blue";
    
    if (this.state.kickoffTeam === null) {
      // First reset - choose randomly or use coin toss result
      kickoffTeam = Math.random() < 0.5 ? "red" : "blue";
    } else {
      // Alternate the kickoff team for fairness
      kickoffTeam = this.state.kickoffTeam === "red" ? "blue" : "red";
    }
    
    console.log(`Ball reset: ${kickoffTeam} team will kick off`);
    
    // Notify players
    this.world.chatManager.sendBroadcastMessage(
      `Ball reset to center position. ${kickoffTeam.toUpperCase()} team will kick off.`
    );
    
    // Perform proper kickoff positioning
    this.performKickoffPositioning(kickoffTeam, triggerReason);
    
    // Play whistle sound
    new Audio({
      uri: "audio/sfx/soccer/whistle.mp3",
      loop: false,
      volume: 0.1,
    }).play(this.world);
    
    // Unfreeze players after a short delay to allow positioning to settle
    setTimeout(() => {
      this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
        if (entity instanceof SoccerPlayerEntity) {
          entity.unfreeze();
        }
      });
      console.log(`Players unfrozen, kickoff can begin`);
    }, 2000); // 2 second delay
  }

  /**
   * Switch from opening music to gameplay music based on current game mode
   */
  private switchToGameplayMusic(): void {
    console.log("🎵 Switching to gameplay music");
    
    // Get the music instances from the index.ts global scope
    const mainMusic = (this.world as any)._mainMusic;
    const arcadeGameplayMusic = (this.world as any)._arcadeGameplayMusic;
    const fifaGameplayMusic = (this.world as any)._fifaGameplayMusic;
    
    if (!mainMusic || !arcadeGameplayMusic || !fifaGameplayMusic) {
      console.error("Music system not properly initialized");
      return;
    }
    
    // Stop opening music
    mainMusic.pause();
    console.log("🎵 Paused opening music");
    
    // Start appropriate gameplay music based on current mode
    const currentMode = getCurrentGameMode();
    console.log(`🎵 Current game mode: ${currentMode}`);
    
    if (currentMode === GameMode.FIFA) {
      fifaGameplayMusic.play(this.world);
      console.log("🎵 Started FIFA gameplay music");
      
      // Start FIFA crowd atmosphere
      if (this.fifaCrowdManager) {
        this.fifaCrowdManager.start();
        console.log("🏟️ Started FIFA crowd atmosphere");
        
        // Play game start announcement
        if (this.fifaCrowdManager.playGameStart) {
          this.fifaCrowdManager.playGameStart();
          console.log("🎙️ Playing FIFA game start announcement");
        }
      }
    } else {
      arcadeGameplayMusic.play(this.world);
      console.log("🎵 Started Arcade gameplay music");
      
      // Stop FIFA crowd atmosphere for non-FIFA modes
      if (this.fifaCrowdManager) {
        this.fifaCrowdManager.stop();
      }
    }
  }

  /**
   * Switch back to opening music when game ends
   */
  private switchToOpeningMusic(): void {
    console.log("🎵 Switching back to opening music");
    
    // Get the music instances from the index.ts global scope
    const mainMusic = (this.world as any)._mainMusic;
    const arcadeGameplayMusic = (this.world as any)._arcadeGameplayMusic;
    const fifaGameplayMusic = (this.world as any)._fifaGameplayMusic;
    
    if (!mainMusic || !arcadeGameplayMusic || !fifaGameplayMusic) {
      console.error("Music system not properly initialized");
      return;
    }
    
    // Stop all gameplay music
    arcadeGameplayMusic.pause();
    fifaGameplayMusic.pause();
    console.log("🎵 Paused all gameplay music");
    
    // Start opening music
    mainMusic.play(this.world);
    console.log("🎵 Started opening music");
  }
}