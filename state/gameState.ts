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
  SAFE_SPAWN_Y
  // ABILITY_PICKUP_POSITIONS 
} from "./gameConfig";
import sharedState from "./sharedState";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
// import { AbilityConsumable } from "../abilities/AbilityConsumable";
// import { shurikenThrowOptions, speedBoostOptions } from "../abilities/itemTypes";
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

export interface Player {
  id: string;
  name: string;
  team: "red" | "blue" | null;
}

export interface GameState {
  status:
    | "waiting"
    | "starting"
    | "playing"
    | "overtime"
    | "finished"
    | "goal-scored";
  players: Map<string, Player>;
  score: {
    red: number;
    blue: number;
  };
  timeRemaining: number; // in seconds
  maxPlayersPerTeam: number;
  minPlayersPerTeam: number;
  kickoffTeam: "red" | "blue" | null; // Team that gets to kick off
}

export class SoccerGame {
  private state: GameState;
  private world: World;
  private soccerBall: Entity;
  private attachedPlayer: PlayerEntity | null = null;
  private gameLoopInterval: Timer | null = null;
  // private abilityPickups: AbilityConsumable[] = [];
  private aiPlayersList: AIPlayerEntity[] = [];
  private arcadeManager: ArcadeEnhancementManager | null = null;
  private fifaCrowdManager: any | null = null; // FIFA crowd manager for stadium atmosphere

  constructor(world: World, entity: Entity, aiPlayers: AIPlayerEntity[]) {
    this.state = {
      status: "waiting",
      players: new Map(),
      score: {
        red: 0,
        blue: 0,
      },
      timeRemaining: MATCH_DURATION,
      maxPlayersPerTeam: 6,
      minPlayersPerTeam: 1,
      kickoffTeam: null
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

    if (
      redTeamCount < this.state.minPlayersPerTeam ||
      blueTeamCount < this.state.minPlayersPerTeam
    ) {
      console.log("Not enough players to start game");
      return false;
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
    console.log("Beginning match");
    
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
    
    // Set the game status to playing and start the game loop
    this.state.status = "playing";
    this.state.timeRemaining = MATCH_DURATION;
    
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

    if (this.state.timeRemaining <= 0) {
      console.log(`Time up! Status: ${this.state.status}, Score: ${this.state.score.red}-${this.state.score.blue}`);
      this.handleTimeUp();
      TICKING_AUDIO.pause();
      return;
    }

    if (this.state.status !== "goal-scored") {
      this.state.timeRemaining--;
    }

    if (this.state.timeRemaining === 5) {
      TICKING_AUDIO.play(this.world);
    }

    // Log overtime progress
    if (this.state.status === "overtime" && this.state.timeRemaining % 10 === 0) {
      console.log(`Overtime: ${this.state.timeRemaining} seconds remaining`);
    }

    // Update player movement statistics
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        entity.updateDistanceTraveled();
      }
    });

    // Send game state to UI
    this.sendDataToAllPlayers({
      type: "game-state",
      timeRemaining: this.state.timeRemaining,
      score: this.state.score,
      status: this.state.status,
    });
  }

  private handleTimeUp() {
    // Clear the game loop interval to stop the timer
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    if (this.state.score.red === this.state.score.blue) {
      if (this.state.status !== "overtime") {
        // First show regulation time stats before going to overtime
        this.showRegulationTimeStats();
        
        // Start overtime after a brief delay
        setTimeout(() => {
          console.log("Starting overtime setup...");
          this.state.status = "overtime";
          this.world.chatManager.sendBroadcastMessage(
            "Tie game, going to overtime!"
          );
          this.state.timeRemaining = 60; // 1 minute overtime
          this.sendDataToAllPlayers({
            type: "countdown",
            count: "Overtime!"
          });
          this.sendDataToAllPlayers({
            type: "game-state",
            timeRemaining: this.state.timeRemaining,
            score: this.state.score,
            status: this.state.status,
          });

          setTimeout(() => {
            console.log("Starting overtime game loop...");
            this.sendDataToAllPlayers({
              type: "countdown",
              count: ""
            });
            
            // Ensure all players are unfrozen for overtime
            this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
              if (entity instanceof SoccerPlayerEntity) {
                entity.unfreeze();
                console.log(`Unfroze ${entity.player.username} for overtime`);
              }
            });
            
            // Restart the game loop for overtime
            this.gameLoopInterval = setInterval(() => {
              this.gameLoop();
            }, 1000);
            console.log("Overtime game loop started with interval:", this.gameLoopInterval);
          }, 2000);
        }, 3000); // 3 second delay to show stats
      } else {
        // Overtime ended and still tied, finish the game
        this.world.chatManager.sendBroadcastMessage(
          "Overtime ended! Match ends in a tie!"
        );
        this.endGame();
      }
    } else {
      // Game has a winner
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
    } else {
      this.world.chatManager.sendBroadcastMessage(
        `Goal scored for the ${team} team!`
      );
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
    
    // Play goal celebration sounds
    new Audio({
      uri: "audio/sfx/soccer/whistle.mp3",
      loop: false,
      volume: 0.3,
    }).play(this.world);

    // Play goal commentator sound
    new Audio({
      uri: "audio/sfx/soccer/soccer-goal-commentator.wav",
      loop: false,
      volume: 0.8,
    }).play(this.world);

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

    // Send updated score immediately
    this.sendDataToAllPlayers({
      type: "game-state",
      timeRemaining: this.state.timeRemaining,
      score: this.state.score,
      status: this.state.status,
      kickoffTeam: this.state.kickoffTeam, // Also include kickoff team here
    });

    if (
      this.state.status === "overtime" ||
      Math.abs(this.state.score["red"] - this.state.score["blue"]) >= 5
    ) {
      this.endGame();
    }
  }

  private endGame() {
    console.log("Ending game");

    // Collect comprehensive player stats
    const playerStats = this.world.entityManager
      .getAllPlayerEntities()
      .filter(
        (entity): entity is SoccerPlayerEntity =>
          entity instanceof SoccerPlayerEntity
      )
      .map((player) => player.getPlayerStats());

    // Calculate team statistics
    const redTeamStats = playerStats.filter(p => p.team === 'red');
    const blueTeamStats = playerStats.filter(p => p.team === 'blue');
    
    const teamStats = {
      red: {
        goals: redTeamStats.reduce((sum, p) => sum + p.goals, 0),
        tackles: redTeamStats.reduce((sum, p) => sum + p.tackles, 0),
        passes: redTeamStats.reduce((sum, p) => sum + p.passes, 0),
        shots: redTeamStats.reduce((sum, p) => sum + p.shots, 0),
        saves: redTeamStats.reduce((sum, p) => sum + p.saves, 0),
        distanceTraveled: redTeamStats.reduce((sum, p) => sum + p.distanceTraveled, 0)
      },
      blue: {
        goals: blueTeamStats.reduce((sum, p) => sum + p.goals, 0),
        tackles: blueTeamStats.reduce((sum, p) => sum + p.tackles, 0),
        passes: blueTeamStats.reduce((sum, p) => sum + p.passes, 0),
        shots: blueTeamStats.reduce((sum, p) => sum + p.shots, 0),
        saves: blueTeamStats.reduce((sum, p) => sum + p.saves, 0),
        distanceTraveled: blueTeamStats.reduce((sum, p) => sum + p.distanceTraveled, 0)
      }
    };

    // this.abilityPickups.forEach((ability) => {
    //   ability.destroy();
    // });

    // Determine winner
    let winner = 'tie';
    if (this.state.score.red > this.state.score.blue) {
      winner = 'red';
    } else if (this.state.score.blue > this.state.score.red) {
      winner = 'blue';
    }

    // Use type assertions for custom event name and payload
    this.world.emit("game-over" as any, {
      redScore: this.state.score.red,
      blueScore: this.state.score.blue,
      playerStats,
      teamStats,
      winner,
      matchDuration: MATCH_DURATION - this.state.timeRemaining,
      wasOvertime: this.state.status === "overtime"
    } as any);

    this.world.chatManager.sendBroadcastMessage(
      `Game over! Final Score: Red ${this.state.score.red} - ${this.state.score.blue} Blue`
    );

    // Reset the game state immediately after emitting game-over
    this.resetGame();
  }

  public resetGame() {
    // Clear all intervals
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    // Deactivate all AI players first to clear their intervals
    this.aiPlayersList.forEach(ai => {
      if (ai.isSpawned) {
        ai.deactivate();
        ai.despawn();
      }
    });

    // Reset player stats and clean up entities
    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        entity.resetStats();
        entity.player.ui.sendData({
          type: "update-goals",
          goals: 0,
        });
        // Ensure no ball attachments remain
        if (this.attachedPlayer === entity) {
          this.attachedPlayer = null;
          sharedState.setAttachedPlayer(null);
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
      maxPlayersPerTeam: 6,
      minPlayersPerTeam: 1,
      kickoffTeam: null
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

    this.sendTeamCounts();
  }

  public getState(): GameState {
    return this.state;
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

  public setFIFACrowdManager(fifaCrowdManager: any): void {
    this.fifaCrowdManager = fifaCrowdManager;
    console.log("FIFA crowd manager set for SoccerGame");
  }

  /**
   * Get ability pickup position based on current game mode
   * @param index - Index of the pickup position (0 or 1)
   */
  // private getAbilityPickupPosition(index: number): { x: number; y: number; z: number } {
  //   // Large stadium ability pickup positions only
  //   const positions = ABILITY_PICKUP_POSITIONS;
  //   return positions[index] || positions[0];
  // }

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
}