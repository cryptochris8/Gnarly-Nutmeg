// === MEDIASOUP WORKER BINARY PATH SETUP FOR BUN ON WINDOWS ===
// This ensures mediasoup can find its native worker binary when using Bun runtime
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Set up mediasoup worker binary path for Bun compatibility on Windows
if (!process.env.MEDIASOUP_WORKER_BIN) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Construct path to the mediasoup worker binary
  const workerPath = join(__dirname, 'node_modules', 'mediasoup', 'worker', 'out', 'Release', 'mediasoup-worker.exe');
  process.env.MEDIASOUP_WORKER_BIN = workerPath;
  
  console.log(`🔧 Bun + Windows: Set MEDIASOUP_WORKER_BIN to: ${workerPath}`);
}
// === END MEDIASOUP SETUP ===

import { startServer, Audio, PlayerEntity, PlayerEvent, PlayerUIEvent, PlayerCameraMode, PlayerManager, type Vector3Like, EntityEvent } from "hytopia";
import worldMap from "./assets/maps/soccer.json";
import { SoccerGame } from "./state/gameState";
import createSoccerBall from "./utils/ball";
import { 
  GAME_CONFIG,
  BALL_SPAWN_POSITION,
  SAFE_SPAWN_Y,
  AI_FIELD_CENTER_Z,
  AI_GOAL_LINE_X_RED,
  AI_GOAL_LINE_X_BLUE,
  AI_DEFENSIVE_OFFSET_X,
  AI_MIDFIELD_OFFSET_X,
  AI_FORWARD_OFFSET_X,
  AI_WIDE_Z_BOUNDARY_MAX,
  AI_WIDE_Z_BOUNDARY_MIN,
  AI_MIDFIELD_Z_BOUNDARY_MAX,
  AI_MIDFIELD_Z_BOUNDARY_MIN,
  FIELD_MIN_X,
  FIELD_MAX_X,
  FIELD_MIN_Z,
  FIELD_MAX_Z,
  PASS_FORCE,
  BALL_CONFIG,
  MATCH_DURATION
} from "./state/gameConfig";
import SoccerPlayerEntity from "./entities/SoccerPlayerEntity";
import AIPlayerEntity, { type SoccerAIRole } from "./entities/AIPlayerEntity";
import sharedState from "./state/sharedState";
import { getDirectionFromRotation } from "./utils/direction";
import observerMode from "./utils/observerMode";
import { soccerMap } from "./state/map";
import { 
  GameMode, 
  getCurrentGameMode, 
  setGameMode, 
  isFIFAMode, 
  isArcadeMode,
  isPickupMode,
  getCurrentModeConfig 
} from "./state/gameModes";
import { ArcadeEnhancementManager } from "./state/arcadeEnhancements";
import { PickupGameManager } from "./state/pickupGameManager";
import { FIFACrowdManager } from "./utils/fifaCrowdManager";
import PerformanceProfiler from "./utils/performanceProfiler";
import { PerformanceOptimizer } from "./utils/performanceOptimizations";

startServer((world) => {
    console.log("🎮 Starting simplified soccer server...");
    
    // Load map and initialize game immediately at startup
    console.log("🏟️ Loading soccer stadium...");
    world.loadMap(worldMap);
    console.log("✅ Soccer map loaded");
    
    // Set up enhanced lighting for the stadium
    world.setDirectionalLightIntensity(0.6);
    world.setDirectionalLightPosition({ x: 0, y: 300, z: 0 });
    world.setDirectionalLightColor({ r: 255, g: 248, b: 235 });
    world.setAmbientLightIntensity(1.2);
    world.setAmbientLightColor({ r: 250, g: 250, b: 255 });
    console.log("✅ Enhanced stadium lighting configured");
    
    // Create soccer ball
    console.log("⚽ Creating soccer ball...");
    const soccerBall = createSoccerBall(world);
    console.log("✅ Soccer ball created and spawned");
    
    // Initialize game systems
    let aiPlayers: AIPlayerEntity[] = [];
    const game = new SoccerGame(world, soccerBall, aiPlayers);
    
    // Initialize arcade enhancement system
    const arcadeManager = new ArcadeEnhancementManager(world);
    (world as any)._arcadeManager = arcadeManager;
    game.setArcadeManager(arcadeManager);
    
    // Initialize pickup game system
    const pickupManager = new PickupGameManager(world);
    (world as any)._pickupManager = pickupManager;
    game.setPickupManager(pickupManager);
    
    // Initialize FIFA crowd atmosphere system
    const fifaCrowdManager = new FIFACrowdManager(world);
    game.setFIFACrowdManager(fifaCrowdManager);
    
    // Initialize performance systems
    const performanceProfiler = new PerformanceProfiler(world, {
      enabled: false,
      sampleInterval: 1000,
      maxSamples: 60, // Reduced for memory efficiency
      logInterval: 30000,
      trackMemory: true
    });
    (world as any)._performanceProfiler = performanceProfiler;
    
    const performanceOptimizer = new PerformanceOptimizer('HIGH_PERFORMANCE'); // Start with high performance mode
    
    console.log("✅ Game initialized successfully!");

    // Music setup
    const mainMusic = new Audio({
      uri: "audio/music/Ian Post - 8 Bit Samba - No FX.mp3",
      loop: true,
      volume: 0.1,
    });
    mainMusic.play(world);

    const arcadeGameplayMusic = new Audio({
      uri: "audio/music/always-win.mp3",
      loop: true,
      volume: 0.1,
    });

    const fifaGameplayMusic = new Audio({
      uri: "audio/music/Vettore - Silk.mp3",
      loop: true,
      volume: 0.1,
    });

    const getGameplayMusic = (): Audio => {
      return isFIFAMode() ? fifaGameplayMusic : arcadeGameplayMusic;
    };

    // Function to spawn AI players (simplified)
    const spawnAIPlayers = async (playerTeam: "red" | "blue"): Promise<void> => {
      console.log(`🤖 Spawning AI players for team ${playerTeam}...`);
      
      // Define full team roles
      const fullTeamRoles: SoccerAIRole[] = [
        'goalkeeper',
        'left-back',
        'right-back',
        'central-midfielder-1',
        'central-midfielder-2',
        'striker'
      ];
      
      // Spawn AI for player's team (5 AI players since human is central-midfielder-1)
      const playerTeamRoles = fullTeamRoles.filter(role => role !== 'central-midfielder-1');
      for (const role of playerTeamRoles) {
        const aiPlayer = new AIPlayerEntity(world, playerTeam, role);
        const spawnPosition = getStartPosition(playerTeam, role);
        aiPlayer.spawn(world, spawnPosition);
        aiPlayers.push(aiPlayer);
        sharedState.addAIToTeam(aiPlayer, playerTeam);
      }
      
      // Spawn full opponent team (6 AI players)
      const opponentTeam = playerTeam === 'red' ? 'blue' : 'red';
      for (const role of fullTeamRoles) {
        const aiPlayer = new AIPlayerEntity(world, opponentTeam, role);
        const spawnPosition = getStartPosition(opponentTeam, role);
        aiPlayer.spawn(world, spawnPosition);
        aiPlayers.push(aiPlayer);
        sharedState.addAIToTeam(aiPlayer, opponentTeam);
      }
      
      console.log(`✅ Spawned ${aiPlayers.length} AI players total`);
    };

    // Function to get start position for AI players
    const getStartPosition = (team: "red" | "blue", role: SoccerAIRole): Vector3Like => {
      const isRedTeam = team === 'red';
      const baseX = isRedTeam ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
      
      switch (role) {
        case 'goalkeeper':
          return {
            x: baseX,
            y: SAFE_SPAWN_Y,
            z: AI_FIELD_CENTER_Z
          };
        case 'left-back':
          return {
            x: baseX + (isRedTeam ? AI_DEFENSIVE_OFFSET_X : -AI_DEFENSIVE_OFFSET_X),
            y: SAFE_SPAWN_Y,
            z: AI_WIDE_Z_BOUNDARY_MIN + 10
          };
        case 'right-back':
          return {
            x: baseX + (isRedTeam ? AI_DEFENSIVE_OFFSET_X : -AI_DEFENSIVE_OFFSET_X),
            y: SAFE_SPAWN_Y,
            z: AI_WIDE_Z_BOUNDARY_MAX - 10
          };
        case 'central-midfielder-1':
          return {
            x: baseX + (isRedTeam ? AI_MIDFIELD_OFFSET_X : -AI_MIDFIELD_OFFSET_X),
            y: SAFE_SPAWN_Y,
            z: AI_MIDFIELD_Z_BOUNDARY_MIN + 5
          };
        case 'central-midfielder-2':
          return {
            x: baseX + (isRedTeam ? AI_MIDFIELD_OFFSET_X : -AI_MIDFIELD_OFFSET_X),
            y: SAFE_SPAWN_Y,
            z: AI_MIDFIELD_Z_BOUNDARY_MAX - 5
          };
        case 'striker':
          return {
            x: baseX + (isRedTeam ? AI_FORWARD_OFFSET_X : -AI_FORWARD_OFFSET_X),
            y: SAFE_SPAWN_Y,
            z: AI_FIELD_CENTER_Z
          };
        default:
          return {
            x: baseX,
            y: SAFE_SPAWN_Y,
            z: AI_FIELD_CENTER_Z
          };
      }
    };

    world.on(
      "game-over" as any,
      ((data: { 
        redScore: number; 
        blueScore: number; 
        playerStats: Array<{
          name: string; 
          team: string;
          role: string;
          goals: number;
          tackles: number;
          passes: number;
          shots: number;
          saves: number;
          distanceTraveled: number;
        }>; 
        teamStats: any;
        winner: string;
        matchDuration: number;
        wasOvertime: boolean;
      }) => {
        console.log("Game over", data);
        world.entityManager.getAllPlayerEntities().forEach((playerEntity) => {
          playerEntity.player.ui.sendData({
            type: "game-over",
            redScore: data.redScore,
            blueScore: data.blueScore,
            playerStats: data.playerStats,
            teamStats: data.teamStats,
            winner: data.winner,
            matchDuration: data.matchDuration,
            wasOvertime: data.wasOvertime
          });
        });
        
        // Clean up active AI players and remove from shared state
        aiPlayers.forEach(ai => {
          if (ai.isSpawned) {
            ai.deactivate();
            sharedState.removeAIFromTeam(ai, ai.team);
          }
        });
        aiPlayers.length = 0; // Clear the array

        // Reset game state if game is initialized
        if (game) {
          game.resetGame(); // Reset the game state to waiting
        }

        // Reload UI for all players after game reset
        world.entityManager.getAllPlayerEntities().forEach((playerEntity) => {
          const player = playerEntity.player;
          player.ui.load("ui/index.html");
          
          // CRITICAL: Unlock pointer for UI interactions after reset (Hytopia-compliant approach)
          player.ui.lockPointer(false);
          console.log(`🎯 Pointer unlocked for ${player.username} after game reset - UI interactions enabled`);
          
          player.ui.sendData({
            type: "team-counts",
            red: game ? game.getPlayerCountOnTeam("red") : 0,
            blue: game ? game.getPlayerCountOnTeam("blue") : 0,
            maxPlayers: 6,
            singlePlayerMode: true,
          });
          player.ui.sendData({
            type: "focus-on-instructions",
          });
        });
      }) as any
    );

    world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      console.log(`Player ${player.username} joined world`);
      
      // Check if this player is a developer and should auto-enable observer mode
      if (observerMode.isDeveloper(player.username)) {
        // Only auto-enable observer if no game is in progress
        if (!game || !game.inProgress()) {
          world.chatManager.sendPlayerMessage(
            player,
            "Developer detected. Use /observer to enable observer mode or /aitraining to start AI training match."
          );
        }
      }
      
      // Load UI first before any game state checks
      player.ui.load("ui/index.html");
      
      // CRITICAL: Unlock pointer for UI interactions (Hytopia-compliant approach)
      player.ui.lockPointer(false);
      console.log(`🎯 Pointer unlocked for ${player.username} - UI interactions enabled`);

      // Check game state
      if (game && game.inProgress()) {
        return world.chatManager.sendPlayerMessage(
          player,
          "Game is already in progress, you can fly around and spectate!"
        );
      }

      // Don't set camera configuration here - let the entity handle it
      // This prevents conflicts with the entity-based camera attachment
      
            // Send initial UI data
      player.ui.sendData({
        type: "team-counts",
        red: game ? game.getPlayerCountOnTeam("red") : 0,
        blue: game ? game.getPlayerCountOnTeam("blue") : 0,
        maxPlayers: 6,
        singlePlayerMode: true,
      });

      player.ui.sendData({
        type: "focus-on-instructions",
      });

      player.ui.on(PlayerUIEvent.DATA, async ({ playerUI, data }) => {
        if (data.type === "select-game-mode" && data.mode) {
          // Handle game mode selection
          console.log(`Player ${player.username} selected game mode: ${data.mode}`);
          
          // Set the game mode using the imported functions
          if (data.mode === "fifa") {
            setGameMode(GameMode.FIFA);
            console.log("Game mode set to FIFA Mode");
          } else if (data.mode === "arcade") {
            setGameMode(GameMode.ARCADE);
            console.log("Game mode set to Arcade Mode");
          } else if (data.mode === "pickup") {
            setGameMode(GameMode.PICKUP);
            console.log("Game mode set to Pickup Mode");
          }
          
          // Send confirmation back to UI
          player.ui.sendData({
            type: "game-mode-confirmed",
            mode: data.mode,
            config: getCurrentModeConfig()
          });
          
          console.log("🎮 Game mode selected - ready for team selection");
        }
        else if (data.type === "select-single-player") {
          // Handle single player mode selection
          console.log(`Player ${player.username} selected single player mode`);
          
          // Send confirmation - game is ready
          player.ui.sendData({
            type: "single-player-ready",
            message: "Single player mode ready! Select your team to begin."
          });
        }
        else if (data.type === "team-selected" && data.team) {
          console.log(`Player ${player.username} selected team: ${data.team}`);
          
          // Game is already initialized at startup, just join team
          
          if (game.getTeamOfPlayer(player.username) !== null) {
            console.log("Player already on a team");
            return;
          }

          if(game.isTeamFull(data.team)) {
            player.ui.sendData({
              type: "focus-on-instructions",
            });
            world.chatManager.sendPlayerMessage(player, "Team is full");
            return;
          }
          
          // Check if player already has an entity (shouldn't happen after fix)
          const existingEntities = world.entityManager.getPlayerEntitiesByPlayer(player);
          if (existingEntities.length > 0) {
            console.warn(`⚠️  Player ${player.username} already has ${existingEntities.length} entities! Cleaning up...`);
            existingEntities.forEach(entity => {
              if (entity.isSpawned) {
                console.log(`Despawning existing entity: ${entity.id}`);
                entity.despawn();
              }
            });
          }

          // Join game and team
          game.joinGame(player.username, player.username);
          game.joinTeam(player.username, data.team);

          // Create player entity with the assigned role
          const humanPlayerRole: SoccerAIRole = 'central-midfielder-1'; // Human player is now a midfielder
          const playerEntity = new SoccerPlayerEntity(player, data.team, humanPlayerRole);
          console.log(`Creating player entity for team ${data.team} as ${humanPlayerRole}`);
          
          // Add spawn event listener to verify when entity is actually spawned
          playerEntity.on(EntityEvent.SPAWN, () => {
            console.log(`Player entity ${playerEntity.id} successfully spawned with camera attachment`);
          });
          
          // Get correct spawn position for large stadium
          const spawnPosition = getStartPosition(data.team, humanPlayerRole);
          console.log(`Using role-based spawn position for large stadium: X=${spawnPosition.x.toFixed(2)}, Y=${spawnPosition.y.toFixed(2)}, Z=${spawnPosition.z.toFixed(2)}`);
          
          // Spawn player entity immediately at calculated position
          console.log(`Spawning player entity at X=${spawnPosition.x.toFixed(2)}, Y=${spawnPosition.y.toFixed(2)}, Z=${spawnPosition.z.toFixed(2)}`);
          playerEntity.spawn(world, spawnPosition);
          console.log(`Player entity ${playerEntity.id} spawn command issued as ${humanPlayerRole}.`);
          
          // Freeze the human player initially
          playerEntity.freeze();
          
          // Music change - switch from opening music to gameplay music
          console.log(`Switching from opening music to gameplay music (${getCurrentGameMode()} mode)`);
          mainMusic.pause();
          getGameplayMusic().play(world);
          
          // Start FIFA crowd atmosphere if in FIFA mode
          if (isFIFAMode()) {
            fifaCrowdManager.start();
            fifaCrowdManager.playGameStart();
          }

          // Single player mode - spawn AI and start game
          if (data.singlePlayerMode) {
            console.log(`Starting single player mode for team ${data.team}`);
            
            try {
              // Spawn AI players
              console.log("Spawning AI players...");
              await spawnAIPlayers(data.team);
              
              // Start the game
              console.log("Starting game with AI...");
              const gameStarted = game && game.startGame();
              if (gameStarted) {
                console.log("✅ Game started successfully with AI!");
                
                // Activate pickup system if in pickup mode
                if (isPickupMode()) {
                  console.log("🎯 Activating pickup system for Pickup Mode");
                  pickupManager.activate();
                }
                
                // Unfreeze player after short delay
                setTimeout(() => {
                  if (playerEntity && typeof playerEntity.unfreeze === 'function') {
                    playerEntity.unfreeze();
                    console.log("Player unfrozen - game active!");
                  }
                  
                  // CRITICAL: Lock pointer for gameplay (Hytopia-compliant approach)
                  player.ui.lockPointer(true);
                  console.log(`🎮 Pointer locked for ${player.username} - Game controls enabled`);
                  
                  // Clear loading UI
                  player.ui.sendData({
                    type: "loading-complete"
                  });
                }, 500);
                
              } else {
                console.error("Failed to start game with AI");
                player.ui.sendData({ 
                  type: "loading-error", 
                  message: "Failed to start game. Please try again." 
                });
              }
              
            } catch (error) {
              console.error("Error during AI spawning:", error);
              player.ui.sendData({ 
                type: "loading-error", 
                message: "Failed to spawn AI. Please refresh and try again." 
              });
            }
          } // End singlePlayerMode check
          
          // Multiplayer mode - handle differently for 1v1 matches
          else if (data.multiplayerMode) {
            console.log(`Multiplayer mode: Player ${player.username} joined team ${data.team}`);
            
            // Check how many human players are currently in the game
            const humanPlayers = PlayerManager.instance.getConnectedPlayers();
            console.log(`Current human players in game: ${humanPlayers.length}`);
            
            if (humanPlayers.length === 1) {
              // First player - wait for second player
              console.log("First player in multiplayer lobby - waiting for second player");
              player.ui.sendData({
                type: "multiplayer-waiting",
                message: "Waiting for second player to join...",
                playerCount: 1,
                requiredPlayers: 2
              });
            } else if (humanPlayers.length === 2) {
              // Second player joined - start multiplayer game
              console.log("Second player joined - starting multiplayer 1v1 match");
              
              // Assign players to different teams automatically
              const firstPlayer = humanPlayers.find(p => p.username !== player.username);
              const secondPlayer = player;
              
              // Assign teams: first player gets opposite team of what second player chose
              const firstPlayerTeam = data.team === 'red' ? 'blue' : 'red';
              const secondPlayerTeam = data.team;
              
              console.log(`Team assignment: ${firstPlayer?.username} -> ${firstPlayerTeam}, ${secondPlayer.username} -> ${secondPlayerTeam}`);
              
              // Notify both players about team assignments
              firstPlayer?.ui.sendData({
                type: "team-assigned",
                team: firstPlayerTeam,
                message: `You have been assigned to the ${firstPlayerTeam} team`
              });
              
              secondPlayer.ui.sendData({
                type: "team-assigned", 
                team: secondPlayerTeam,
                message: `You have been assigned to the ${secondPlayerTeam} team`
              });
              
              // Start loading for multiplayer game
              [firstPlayer, secondPlayer].forEach((p) => {
                if (p) {
                  p.ui.sendData({
                    type: "loading-progress",
                    current: 50,
                    total: 100,
                    message: "Setting up multiplayer match...",
                    percentage: 50
                  });
                }
              });
              
              // Spawn AI players for both teams (4 AI per team since 1 human per team)
              console.log("Spawning AI players for multiplayer 1v1 match");
              await spawnAIPlayers('red'); // This will spawn for both teams
              
              // Update loading progress
              [firstPlayer, secondPlayer].forEach((p) => {
                if (p) {
                  p.ui.sendData({
                    type: "loading-progress",
                    current: 90,
                    total: 100,
                    message: "Starting multiplayer match...",
                    percentage: 90
                  });
                }
              });
              
              // Start the multiplayer game
              const gameStarted = game.startGame();
              if (gameStarted) {
                console.log("✅ Multiplayer 1v1 game started successfully!");
                
                // Notify both players
                [firstPlayer, secondPlayer].forEach((p) => {
                  if (p) {
                    p.ui.sendData({
                      type: "loading-progress",
                      current: 100,
                      total: 100,
                      message: "Match ready!",
                      percentage: 100
                    });
                    
                    // Clear loading UI after delay
                    setTimeout(() => {
                      p.ui.sendData({
                        type: "loading-complete"
                      });
                    }, 500);
                  }
                });
                
                // Unfreeze both players
                setTimeout(() => {
                  const allPlayerEntities = world.entityManager.getAllPlayerEntities();
                  allPlayerEntities.forEach(entity => {
                    if (entity instanceof SoccerPlayerEntity && typeof entity.unfreeze === 'function') {
                      entity.unfreeze();
                      console.log(`Player ${entity.player.username} unfrozen - multiplayer game active!`);
                    }
                  });
                }, 1000);
                
              } else {
                console.error("Failed to start multiplayer game");
                [firstPlayer, secondPlayer].forEach((p) => {
                  if (p) {
                    p.ui.sendData({ 
                      type: "loading-error", 
                      message: "Failed to start multiplayer game. Please try again." 
                    });
                  }
                });
              }
            }
          } // End multiplayerMode check

        } // End team-selected check
        else if (data.type === "join-multiplayer-lobby") {
          console.log(`Player ${player.username} wants to join multiplayer lobby`);
          // For now, we'll handle this in the team-selected handler
          // In a more complex implementation, this could manage a separate lobby system
          player.ui.sendData({
            type: "multiplayer-lobby-joined",
            message: "Joined multiplayer lobby. Select your preferred team to continue."
          });
        }
        else if (data.type === "coin-toss-choice" && data.choice) {
          // Handle coin toss choice
          console.log(`Player ${player.username} chose ${data.choice} for coin toss`);
          
          // Process coin toss only if game is in starting state
          if (game && game.getState().status === "starting") {
            game.performCoinToss({
              playerId: player.username,
              choice: data.choice
            });
          }
        }
        else if (data.type === "force-pass" && data.action === "pass-to-teammate") {
          console.log(`🎯 SERVER: Received force-pass request from ${player.username}`);
          
          // Find the player's entity
          const playerEntity = world.entityManager.getAllPlayerEntities().find(
            (entity) => entity.player.username === player.username
          );
          
          if (playerEntity && playerEntity instanceof SoccerPlayerEntity) {
            // Check if player has the ball
            const attachedPlayer = sharedState.getAttachedPlayer();
            const hasBall = attachedPlayer?.player?.username === player.username;
            
            if (hasBall) {
              // Simulate a left mouse click to trigger the pass
              const fakeInput = {
                w: false, a: false, s: false, d: false, sp: false,
                ml: true, // Left mouse click for pass
                mr: false, q: false, sh: false, e: false, f: false,
                "1": false
              };
              
              // Call the controller's input handler directly with default camera orientation
              if (playerEntity.controller && playerEntity.controller.tickWithPlayerInput) {
                playerEntity.controller.tickWithPlayerInput(
                  playerEntity,
                  fakeInput,
                  { yaw: 0, pitch: 0 }, // Default camera orientation for pass
                  16 // 16ms delta time (roughly 60fps)
                );
                
                console.log(`✅ SERVER: Force pass executed for ${player.username}`);
                
                // Send feedback to UI
                player.ui.sendData({
                  type: "action-feedback",
                  feedbackType: "success",
                  title: "Pass",
                  message: "Pass executed!"
                });
              }
            } else {
              console.log(`❌ SERVER: ${player.username} doesn't have the ball`);
              player.ui.sendData({
                type: "action-feedback",
                feedbackType: "warning",
                title: "Pass Failed",
                message: "You don't have the ball!"
              });
            }
          }
        }
        else if (data.type === "activate-powerup" && data.powerUpType) {
          // Handle power-up activation (Arcade Mode only)
          console.log(`🎮 SERVER: Player ${player.username} activated power-up: ${data.powerUpType}`);
          console.log(`🎮 SERVER: Arcade mode check - isArcadeMode(): ${isArcadeMode()}`);
          console.log(`🎮 SERVER: Arcade manager exists: ${!!arcadeManager}`);
          
          try {
            // Only allow in arcade mode
            if (isArcadeMode()) {
              console.log(`🎮 SERVER: In arcade mode, calling arcadeManager.activatePowerUp(${player.username}, ${data.powerUpType})`);
              
              const success = arcadeManager.activatePowerUp(player.username, data.powerUpType);
              console.log(`🎮 SERVER: Power-up activation result: ${success}`);
              
              if (success) {
                console.log(`✅ SERVER: Power-up ${data.powerUpType} activated successfully for ${player.username}`);
                
                // Send confirmation to UI
                player.ui.sendData({
                  type: "powerup-activated",
                  powerUpType: data.powerUpType,
                  success: true
                });
                console.log(`✅ SERVER: Sent success response to ${player.username}`);
                
                // Broadcast to all players for visual effects
                // Use the game's sendDataToAllPlayers method through a helper
                const broadcastData = {
                  type: "powerup-effect",
                  playerId: player.username,
                  powerUpType: data.powerUpType
                };
                
                // Send to all connected players
                PlayerManager.instance.getConnectedPlayers().forEach((p) => {
                  p.ui.sendData(broadcastData);
                });
                console.log(`✅ SERVER: Broadcasted power-up effect to all players`);
              } else {
                console.log(`❌ SERVER: Power-up ${data.powerUpType} activation failed for ${player.username}`);
                
                // Send failure message
                player.ui.sendData({
                  type: "powerup-activated",
                  powerUpType: data.powerUpType,
                  success: false,
                  message: "Power-up not available or on cooldown"
                });
                console.log(`❌ SERVER: Sent failure response to ${player.username}`);
              }
            } else {
              console.log(`❌ SERVER: Not in arcade mode, denying power-up activation`);
              
              // Not in arcade mode
              player.ui.sendData({
                type: "powerup-activated",
                success: false,
                message: "Power-ups only available in Arcade Mode"
              });
              console.log(`❌ SERVER: Sent arcade-mode-only response to ${player.username}`);
            }
          } catch (error) {
            console.error(`❌ SERVER POWER-UP ERROR: Exception during power-up activation for ${player.username}:`, error);
            if (error instanceof Error) {
              console.error(`❌ SERVER ERROR Details: ${error.message}`);
              console.error(`❌ SERVER ERROR Stack: ${error.stack}`);
            }
            
            // Send error response to client
            player.ui.sendData({
              type: "powerup-activated",
              powerUpType: data.powerUpType,
              success: false,
              message: "Server error during power-up activation"
            });
            console.log(`❌ SERVER: Sent error response to ${player.username}`);
          }
        }
        else if (data.type === "request-pass") { // Keep pass request logic
          const requestingPlayerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
          if (!requestingPlayerEntity || !(requestingPlayerEntity instanceof SoccerPlayerEntity)) return;
          
          const playerWithBall = sharedState.getAttachedPlayer();
          if (playerWithBall && playerWithBall instanceof AIPlayerEntity && playerWithBall.team === requestingPlayerEntity.team) {
            console.log(`🎯 HUMAN PLAYER REQUESTING PASS: AI ${playerWithBall.player.username} passing to ${requestingPlayerEntity.player.username}`);
            
            // Calculate a target point slightly in front of the requesting player
            const leadDistance = 3.0; // Increased lead distance for better reception
            // Use the direction the player is facing for better ball placement
            const targetDirection = getDirectionFromRotation(requestingPlayerEntity.rotation);
            
            const passTargetPoint: Vector3Like = {
              x: requestingPlayerEntity.position.x + targetDirection.x * leadDistance,
              y: requestingPlayerEntity.position.y, // Keep y the same for a ground pass
              z: requestingPlayerEntity.position.z + targetDirection.z * leadDistance,
            };
            
            // Use higher power for more reliable pass delivery
            const passPower = 1.2; // Increased power to ensure ball reaches human player

            // GUARANTEED PASS: Use forcePass which bypasses all AI decision making
            const passSuccess = playerWithBall.forcePass(requestingPlayerEntity, passTargetPoint, passPower);
            
            if (passSuccess) {
              console.log(`✅ GUARANTEED PASS: Successfully passed ball to human player ${requestingPlayerEntity.player.username}`);
            } else {
              console.warn(`❌ PASS FAILED: Could not pass to human player ${requestingPlayerEntity.player.username}`);
            }
          } else {
            console.log(`❌ PASS REQUEST DENIED: No AI teammate has the ball or wrong team`);
          }
        }
        else if (data.type === "manual-reset-game") {
          // Handle "Back to Lobby" button from game over screen
          console.log(`🔄 Player ${player.username} requested manual game reset from game over screen`);
          
          // Only allow reset if game is finished
          if (game && game.getState().status === "finished") {
            console.log("✅ Game is finished, proceeding with manual reset");
            
            // Reset music back to opening music
            console.log("Resetting music back to opening music");
            getGameplayMusic().pause();
            mainMusic.play(world);
            
            // Stop FIFA crowd atmosphere
            if (fifaCrowdManager && fifaCrowdManager.stop) {
              fifaCrowdManager.stop();
            }
            
            // Perform the actual game reset
            game.manualResetGame();
            
            // CRITICAL: Unlock pointer for UI interactions after manual reset (Hytopia-compliant approach)
            player.ui.lockPointer(false);
            console.log(`🎯 Pointer unlocked for ${player.username} after manual reset - UI interactions enabled`);
            
            // Clear AI players list
            aiPlayers.forEach(ai => {
              if (ai.isSpawned) {
                ai.deactivate();
                sharedState.removeAIFromTeam(ai, ai.team);
                ai.despawn();
              }
            });
            aiPlayers = [];
            game.updateAIPlayersList([]);
            
            console.log("✅ Manual game reset complete - players can now select teams");
          } else {
            console.log(`❌ Manual reset denied - game status is: ${game ? game.getState().status : "null"}`);
            player.ui.sendData({
              type: "error",
              message: "Game reset only available when game is finished"
            });
          }
        }
        else if (data.type === "start-second-half") {
          // Handle manual start of second half from halftime button
          console.log(`🚀 Player ${player.username} requested to start second half`);
          
          // Only allow if game is in halftime
          if (game && game.getState().isHalftime) {
            console.log("✅ Game is in halftime, starting second half");
            
            // Call the game's startSecondHalf method
            game.startSecondHalf();
            
            console.log("✅ Second half started successfully");
          } else {
            console.log(`❌ Start second half denied - game status is: ${game ? game.getState().status : "null"}, halftime: ${game ? game.getState().isHalftime : "null"}`);
            player.ui.sendData({
              type: "error",
              message: "Second half can only be started during halftime"
            });
          }
        }
      });

      // Attempt to start multiplayer game (only for human players, not AI)
      if (game) {
        const state = game.getState();
        
        // Count only human players (not AI) for multiplayer auto-start
        const humanPlayerEntities = world.entityManager.getAllPlayerEntities().filter(
          entity => entity instanceof SoccerPlayerEntity && !(entity instanceof AIPlayerEntity)
        );
        
        const humanPlayersOnRed = humanPlayerEntities.filter(entity => 
          game && game.getTeamOfPlayer(entity.player.username) === "red"
        ).length;
        
        const humanPlayersOnBlue = humanPlayerEntities.filter(entity => 
          game && game.getTeamOfPlayer(entity.player.username) === "blue"
        ).length;
        
        const totalHumanPlayers = humanPlayersOnRed + humanPlayersOnBlue;
        
        if (
          state.status === "waiting" &&
          humanPlayersOnRed >= state.minPlayersPerTeam && // Check each team has enough humans
          humanPlayersOnBlue >= state.minPlayersPerTeam &&
          totalHumanPlayers >= state.minPlayersPerTeam * 2 && // Check total human players
          aiPlayers.length === 0 // Ensure we're not in single player mode (handled above)
        ) {
          // Potentially wait slightly or add a ready check before starting multiplayer
          console.log(`Enough human players for multiplayer (Red: ${humanPlayersOnRed}, Blue: ${humanPlayersOnBlue}), attempting start...`);
          game.startGame(); 
        } else if (aiPlayers.length > 0) {
          // In single-player mode with AI - don't auto-start here, already handled by team selection
          console.log(`Single-player mode detected (${aiPlayers.length} AI players) - skipping multiplayer auto-start`);
        }
      }
    });

    world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      console.log(`Player ${player.username} left world - checking if game reset needed`);
      
      if (game) {
        const playerTeam = game.getTeamOfPlayer(player.username);
        game.removePlayer(player.username);
        
        // Despawn player's entity
        world.entityManager
          .getPlayerEntitiesByPlayer(player)
          .forEach((entity) => entity.despawn());

        // Add a small delay to avoid false positives during goal handling or ball resets
        setTimeout(() => {
          // If game is in progress and was single player, reset AI
          // Only check after delay to ensure this isn't during a game event
          const humanPlayerCount = world.entityManager.getAllPlayerEntities().filter(e => e instanceof SoccerPlayerEntity && !(e instanceof AIPlayerEntity)).length;
          
          // Double-check that the player is actually disconnected (not just entity repositioning)
          const playerStillConnected = world.entityManager.getAllPlayerEntities().some(entity => 
            entity instanceof SoccerPlayerEntity && !(entity instanceof AIPlayerEntity) && entity.player.username === player.username
          );
          
          if (game && game.inProgress() && aiPlayers.length > 0 && humanPlayerCount === 0 && !playerStillConnected) {
             console.log("Confirmed: Last human player left single player game. Resetting AI.");
             aiPlayers.forEach(ai => {
               if (ai.isSpawned) {
                 ai.deactivate();
                 sharedState.removeAIFromTeam(ai, ai.team);
                 ai.despawn();
               }
             });
             aiPlayers = []; // Clear local list
             game.resetGame(); // Reset game as well since AI depended on human
             
             // Reset music back to opening music
             console.log("Resetting music back to opening music");
             getGameplayMusic().pause();
             mainMusic.play(world);
             
             // Stop FIFA crowd atmosphere
             fifaCrowdManager.stop();
          } else if (game && game.inProgress() && playerTeam && game.getPlayerCountOnTeam(playerTeam) === 0 && !playerStillConnected) {
             // Check if a team is now empty in multiplayer
             console.log(`Team ${playerTeam} is now empty. Ending game.`);
             game.resetGame(); // Or implement forfeit logic
             
             // Reset music back to opening music
             console.log("Resetting music back to opening music");
             getGameplayMusic().pause();
             mainMusic.play(world);
             
             // Stop FIFA crowd atmosphere
             fifaCrowdManager.stop();
          } else {
             console.log(`Player left but game continues - Human players: ${humanPlayerCount}, Player still connected: ${playerStillConnected}`);
          }
        }, 500); // 500ms delay to let any repositioning settle
      }
    });

    world.chatManager.registerCommand("/stuck", (player, message) => {
      // Only allow this command during active gameplay
      if (!game || !game.inProgress()) {
        world.chatManager.sendPlayerMessage(
          player,
          "You can only use /stuck during an active game."
        );
        return;
      }
      
      // Check if command was used recently to prevent spam
      const currentTime = Date.now();
      const lastStuckCommandTime = (world as any)._lastStuckCommandTime || 0;
      if (currentTime - lastStuckCommandTime < 5000) { // 5 second cooldown
        world.chatManager.sendPlayerMessage(
          player,
          "Please wait a few seconds before using this command again."
        );
        return;
      }
      (world as any)._lastStuckCommandTime = currentTime;
      
      // Use the new proper ball reset system with kickoff positioning
      // First ensure the game has the current AI players list
      game.updateAIPlayersList(aiPlayers);
      game.handleBallReset(`manual reset by ${player.username}`);
    });

    // Register a command to reset all AI players and remove from shared state
    world.chatManager.registerCommand("/resetai", (player, message) => {
      aiPlayers.forEach(ai => {
        if (ai.isSpawned) {
          ai.deactivate();
          sharedState.removeAIFromTeam(ai, ai.team);
          ai.despawn();
        }
      });
      aiPlayers = [];
      // Update the game's aiPlayersList as well
      if (game) {
        game.updateAIPlayersList([]);
      }
      world.chatManager.sendPlayerMessage(
        player,
        "All AI players have been reset"
      );
    });

    // Add a debug command to test music
    world.chatManager.registerCommand("/music", (player, args) => {
      if (args.length < 2) {
        world.chatManager.sendPlayerMessage(
          player,
          "Usage: /music <opening|gameplay|status> - Switch between music tracks or check status"
        );
        return;
      }
      
      const musicType = args[1].toLowerCase();
      if (musicType === "opening") {
        console.log("Manual switch to opening music");
        // Pause both gameplay tracks
        arcadeGameplayMusic.pause();
        fifaGameplayMusic.pause();
        mainMusic.play(world);
        world.chatManager.sendPlayerMessage(player, "Switched to opening music");
      } else if (musicType === "gameplay") {
        console.log(`Manual switch to gameplay music (${getCurrentGameMode()} mode)`);
        mainMusic.pause();
        getGameplayMusic().play(world);
        world.chatManager.sendPlayerMessage(player, `Switched to gameplay music (${getCurrentGameMode()} mode)`);
      } else if (musicType === "status") {
        const currentMode = getCurrentGameMode();
        const trackName = currentMode === GameMode.FIFA ? "Vettore - Silk.mp3" : "always-win.mp3";
        const crowdStatus = fifaCrowdManager.isActivated() ? "🏟️ Active" : "🔇 Inactive";
        
        world.chatManager.sendPlayerMessage(player, `=== AUDIO STATUS ===`);
        world.chatManager.sendPlayerMessage(player, `Current Mode: ${currentMode.toUpperCase()}`);
        world.chatManager.sendPlayerMessage(player, `Gameplay Track: ${trackName}`);
        world.chatManager.sendPlayerMessage(player, `Game In Progress: ${game ? (game.inProgress() ? "Yes" : "No") : "Not initialized"}`);
        world.chatManager.sendPlayerMessage(player, `FIFA Crowd: ${crowdStatus}`);
        world.chatManager.sendPlayerMessage(player, `Commands: /crowd <action> | /music <action>`);
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          "Invalid option. Use 'opening', 'gameplay', or 'status'"
        );
      }
    });

    // Add FIFA crowd testing commands
    world.chatManager.registerCommand("/crowd", (player, args) => {
      if (args.length < 2) {
        world.chatManager.sendPlayerMessage(
          player,
          "Usage: /crowd <start|stop|goal|foul|miss|applause|momentum|gameend|redcard|save|status|queue|clear>"
        );
        return;
      }
      
      const action = args[1].toLowerCase();
      
      if (action === "start") {
        fifaCrowdManager.start();
        world.chatManager.sendPlayerMessage(player, "🏟️ FIFA crowd atmosphere started");
      } else if (action === "stop") {
        fifaCrowdManager.stop();
        world.chatManager.sendPlayerMessage(player, "🔇 FIFA crowd atmosphere stopped");
      } else if (action === "goal") {
        fifaCrowdManager.playGoalReaction();
        world.chatManager.sendPlayerMessage(player, "🥅 Playing goal celebration");
      } else if (action === "foul") {
        fifaCrowdManager.playFoulReaction();
        world.chatManager.sendPlayerMessage(player, "😠 Playing foul reaction");
      } else if (action === "miss") {
        fifaCrowdManager.playNearMissReaction();
        world.chatManager.sendPlayerMessage(player, "😲 Playing near miss reaction");
      } else if (action === "applause") {
        fifaCrowdManager.playApplause();
        world.chatManager.sendPlayerMessage(player, "👏 Playing applause");
      } else if (action === "momentum") {
        fifaCrowdManager.playMomentumAnnouncement();
        world.chatManager.sendPlayerMessage(player, "🔥 Playing momentum announcement (He's on fire!)");
      } else if (action === "gameend") {
        fifaCrowdManager.playGameEndAnnouncement();
        world.chatManager.sendPlayerMessage(player, "🏁 Playing game end announcement");
      } else if (action === "redcard") {
        fifaCrowdManager.playRedCardAnnouncement();
        world.chatManager.sendPlayerMessage(player, "🔴 Playing red card announcement");
      } else if (action === "save") {
        fifaCrowdManager.playSaveReaction();
        world.chatManager.sendPlayerMessage(player, "🥅 Playing save reaction");
      } else if (action === "queue") {
        const queueStatus = fifaCrowdManager.getQueueStatus();
        world.chatManager.sendPlayerMessage(player, `=== ANNOUNCER QUEUE STATUS ===`);
        world.chatManager.sendPlayerMessage(player, `Queue Length: ${queueStatus.queueLength} announcements`);
        world.chatManager.sendPlayerMessage(player, `Currently Playing: ${queueStatus.isPlaying ? "✅ Yes" : "❌ No"}`);
        world.chatManager.sendPlayerMessage(player, `Announcer Busy: ${fifaCrowdManager.isAnnouncerBusy() ? "🎙️ Speaking" : "🔇 Silent"}`);
        world.chatManager.sendPlayerMessage(player, `Use '/crowd clear' to clear queue if needed`);
      } else if (action === "clear") {
        fifaCrowdManager.clearAnnouncerQueue();
        world.chatManager.sendPlayerMessage(player, "🧹 Cleared announcer queue and stopped current audio");
      } else if (action === "status") {
        const isActive = fifaCrowdManager.isActivated();
        const currentMode = getCurrentGameMode();
        const shouldBeActive = isFIFAMode() && game && game.inProgress();
        const queueStatus = fifaCrowdManager.getQueueStatus();
        
        world.chatManager.sendPlayerMessage(player, `=== FIFA CROWD STATUS ===`);
        world.chatManager.sendPlayerMessage(player, `Current Mode: ${currentMode.toUpperCase()}`);
        world.chatManager.sendPlayerMessage(player, `Crowd Manager: ${isActive ? "🏟️ Active" : "🔇 Inactive"}`);
        world.chatManager.sendPlayerMessage(player, `Game In Progress: ${game ? (game.inProgress() ? "✅ Yes" : "❌ No") : "❌ Not initialized"}`);
        world.chatManager.sendPlayerMessage(player, `Should Be Active: ${shouldBeActive ? "✅ Yes" : "❌ No"}`);
        world.chatManager.sendPlayerMessage(player, `Voice Queue: ${queueStatus.queueLength} pending, ${queueStatus.isPlaying ? "🎙️ Playing" : "🔇 Silent"}`);
        world.chatManager.sendPlayerMessage(player, `Available Commands: goal, momentum, gameend, redcard, save, miss, foul, queue, clear`);
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          "Invalid action. Use: start, stop, goal, foul, miss, applause, momentum, gameend, redcard, save, status, queue, clear"
        );
      }
    });

    // Add a debug command to check AI status
    world.chatManager.registerCommand("/debugai", (player, message) => {
      if (game) {
        game.updateAIPlayersList(aiPlayers);
      }
      const gameAICount = aiPlayers.length;
      const activeAICount = aiPlayers.filter(ai => ai.isSpawned && !ai.isPlayerFrozen).length;
      const frozenAICount = aiPlayers.filter(ai => ai.isSpawned && ai.isPlayerFrozen).length;
      
      world.chatManager.sendPlayerMessage(
        player,
        `AI Status: ${aiPlayers.length} total, ${activeAICount} active, ${frozenAICount} frozen, ${gameAICount} registered with game`
      );
      
      // Force activate all AI if they're spawned but not active
      if (game && game.inProgress() && frozenAICount > 0) {
        aiPlayers.forEach(ai => {
          if (ai.isSpawned && ai.isPlayerFrozen) {
            ai.unfreeze();
            ai.activate();
            world.chatManager.sendPlayerMessage(player, `Activated AI ${ai.player.username}`);
          }
        });
      }
    });

    // Add a command to toggle between SoccerAgent system and behavior tree
    world.chatManager.registerCommand("/agenttoggle", (player, message) => {
      // Toggle between systems
      const currentSystem = sharedState.getAISystem();
      const newSystem = currentSystem === "agent" ? "behaviortree" : "agent";
      sharedState.setAISystem(newSystem as 'agent' | 'behaviortree');
      
      world.chatManager.sendPlayerMessage(
        player,
        `AI system switched from ${currentSystem} to ${newSystem}`
      );
      
      // Notify about recommended command
      if (aiPlayers.length > 0) {
        world.chatManager.sendPlayerMessage(
          player,
          `You may need to run /resetai and rejoin a team to see the effect`
        );
      }
    });

    // Register observer mode commands
    world.chatManager.registerCommand("/observer", (player, message) => {
      if (!observerMode.isDeveloper(player.username)) {
        world.chatManager.sendPlayerMessage(
          player,
          "You don't have permission to use this command"
        );
        return;
      }
      
      observerMode.enable();
      observerMode.setupObserver(player);
      world.chatManager.sendPlayerMessage(
        player,
        "Observer mode enabled. Use /nextplayer and /nextcamera commands to change views."
      );
    });

    world.chatManager.registerCommand("/nextplayer", (player, message) => {
      if (!observerMode.isEnabled() || !observerMode.isDeveloper(player.username)) {
        world.chatManager.sendPlayerMessage(
          player,
          "Observer mode is not enabled or you don't have permission"
        );
        return;
      }
      
      observerMode.cycleNextPlayer(player);
    });

    world.chatManager.registerCommand("/nextcamera", (player, message) => {
      if (!observerMode.isEnabled() || !observerMode.isDeveloper(player.username)) {
        world.chatManager.sendPlayerMessage(
          player,
          "Observer mode is not enabled or you don't have permission"
        );
        return;
      }
      
      observerMode.cycleCameraMode(player);
    });

    // Add command to start AI training match (AI vs AI)
    world.chatManager.registerCommand("/aitraining", async (player, message) => {
      if (!observerMode.isDeveloper(player.username)) {
        world.chatManager.sendPlayerMessage(
          player,
          "You don't have permission to use this command"
        );
        return;
      }
      
      world.chatManager.sendPlayerMessage(
        player,
        "Starting AI training match (all AI players)..."
      );
      
      // Setup for the AI-only match
      await observerMode.startAITrainingMatch(world, player, game);
    });

    // Add a debug command to test goal detection
    world.chatManager.registerCommand("/testgoal", (player, args) => {
      if (args.length < 2) {
        world.chatManager.sendPlayerMessage(
          player,
          "Usage: /testgoal <red|blue> - Tests goal detection by placing ball in goal"
        );
        return;
      }
      
      const team = args[1].toLowerCase();
      let testPosition;
      
      if (team === "red") {
        // Place ball in red goal (blue should score)
        testPosition = { 
          x: AI_GOAL_LINE_X_RED - 1, 
          y: SAFE_SPAWN_Y, 
          z: AI_FIELD_CENTER_Z 
        };
        world.chatManager.sendPlayerMessage(
          player,
          `Placing ball in RED goal at X=${testPosition.x}. BLUE team should score.`
        );
      } else if (team === "blue") {
        // Place ball in blue goal (red should score)
        testPosition = { 
          x: AI_GOAL_LINE_X_BLUE + 1, 
          y: SAFE_SPAWN_Y, 
          z: AI_FIELD_CENTER_Z 
        };
        world.chatManager.sendPlayerMessage(
          player,
          `Placing ball in BLUE goal at X=${testPosition.x}. RED team should score.`
        );
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          "Invalid team. Use 'red' or 'blue'"
        );
        return;
      }
      
      // Despawn and respawn ball at test position
      if (soccerBall.isSpawned) {
        soccerBall.despawn();
      }
      sharedState.setAttachedPlayer(null);
      soccerBall.spawn(world, testPosition);
      soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
      soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
      
      world.chatManager.sendPlayerMessage(
        player,
        `Ball placed at X=${testPosition.x}, Y=${testPosition.y}, Z=${testPosition.z}. Check console for goal detection logs.`
      );
    });

    // Add a command to check current ball position
    world.chatManager.registerCommand("/ballpos", (player, args) => {
      if (soccerBall.isSpawned) {
        const pos = soccerBall.position;
        world.chatManager.sendPlayerMessage(
          player,
          `Ball position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`
        );
        
        // Check if ball is in any goal
        const goal = soccerMap.checkGoal(pos);
        if (goal) {
          world.chatManager.sendPlayerMessage(
            player,
            `Ball is currently in ${goal.team === 'red' ? 'BLUE' : 'RED'} goal! ${goal.team.toUpperCase()} team should be scoring.`
          );
        }
      } else {
        world.chatManager.sendPlayerMessage(
          player,
          "Ball is not currently spawned"
        );
      }
    });

    // Add command to check end-game rules and timing
    world.chatManager.registerCommand("/endgame", (player, args) => {
      if (!game) {
        world.chatManager.sendPlayerMessage(player, "Game not initialized yet. Please select a team first.");
        return;
      }
      const state = game.getState();
      const scoreDiff = Math.abs(state.score.red - state.score.blue);
      const finalTwoMinutes = state.timeRemaining <= 120;
      
      world.chatManager.sendPlayerMessage(
        player,
        `=== END-GAME RULES STATUS ===`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Match Duration: ${MATCH_DURATION / 60} minutes (${MATCH_DURATION} seconds)`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Time Remaining: ${Math.floor(state.timeRemaining / 60)}:${(state.timeRemaining % 60).toString().padStart(2, '0')}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Current Score: Red ${state.score.red} - ${state.score.blue} Blue`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Score Difference: ${scoreDiff} goals`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Final 2 Minutes: ${finalTwoMinutes ? "✅ YES" : "❌ NO"}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `=== MERCY RULE CONDITIONS ===`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Moderate Mercy (5+ goal diff): Only triggers in final 2 minutes`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Current: ${scoreDiff >= 5 ? "✅ 5+ goal diff" : "❌ < 5 goal diff"} + ${finalTwoMinutes ? "✅ Final 2 min" : "❌ Not final 2 min"}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Extreme Mercy (10+ goal diff): Triggers any time`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Current: ${scoreDiff >= 10 ? "✅ WOULD END GAME" : "❌ < 10 goal diff"}`
      );
    });

    // Add command to show goal boundaries
    world.chatManager.registerCommand("/goals", (player, args) => {
      world.chatManager.sendPlayerMessage(
        player,
        "=== GOAL BOUNDARIES ==="
      );
      
      world.chatManager.sendPlayerMessage(
        player,
        `RED GOAL (Blue scores here): X[${AI_GOAL_LINE_X_RED - 5} to ${AI_GOAL_LINE_X_RED + 3}], Z[${AI_FIELD_CENTER_Z - 20} to ${AI_FIELD_CENTER_Z + 20}], Y[-1 to 6]`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `BLUE GOAL (Red scores here): X[${AI_GOAL_LINE_X_BLUE - 3} to ${AI_GOAL_LINE_X_BLUE + 5}], Z[${AI_FIELD_CENTER_Z - 20} to ${AI_FIELD_CENTER_Z + 20}], Y[-1 to 6]`
      );
      
      world.chatManager.sendPlayerMessage(
        player,
        `Field boundaries: X[${FIELD_MIN_X} to ${FIELD_MAX_X}], Z[${FIELD_MIN_Z} to ${FIELD_MAX_Z}]`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Use /testgoal red or /testgoal blue to test goal detection`
      );
    });

    // Add command to test spawn positions
    world.chatManager.registerCommand("/testspawn", (player, args) => {
      if (args.length < 3) {
        world.chatManager.sendPlayerMessage(
          player,
          "Usage: /testspawn <red|blue> <role> - Test spawn position for a specific team and role"
        );
        world.chatManager.sendPlayerMessage(
          player,
          "Roles: goalkeeper, left-back, right-back, central-midfielder-1, central-midfielder-2, striker"
        );
        return;
      }
      
      const team = args[1].toLowerCase() as "red" | "blue";
      const role = args[2] as SoccerAIRole;
      
      if (team !== "red" && team !== "blue") {
        world.chatManager.sendPlayerMessage(player, "Invalid team. Use 'red' or 'blue'");
        return;
      }
      
      const testPosition = getStartPosition(team, role);
      world.chatManager.sendPlayerMessage(
        player,
        `[LARGE STADIUM] ${team.toUpperCase()} ${role} spawn position: X=${testPosition.x.toFixed(2)}, Y=${testPosition.y.toFixed(2)}, Z=${testPosition.z.toFixed(2)}`
      );
      
      // Teleport player to test position for verification
      const playerEntities = world.entityManager.getPlayerEntitiesByPlayer(player);
      if (playerEntities.length > 0) {
        const playerEntity = playerEntities[0];
        playerEntity.setPosition(testPosition);
        world.chatManager.sendPlayerMessage(
          player,
          `Teleported you to the spawn position for testing. Check if you're stuck in blocks.`
        );
      }
    });

    // Add command to show current game mode and configuration
    world.chatManager.registerCommand("/config", (player, args) => {
      world.chatManager.sendPlayerMessage(
        player,
        `=== CURRENT GAME CONFIGURATION ===`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Game Mode: LARGE STADIUM`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Max Players Per Team: ${GAME_CONFIG.MAX_PLAYERS_PER_TEAM}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Safe Spawn Y: ${GAME_CONFIG.SAFE_SPAWN_Y}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Ball Spawn: X=${GAME_CONFIG.BALL_SPAWN_POSITION.x}, Y=${GAME_CONFIG.BALL_SPAWN_POSITION.y}, Z=${GAME_CONFIG.BALL_SPAWN_POSITION.z}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Field Bounds: X[${GAME_CONFIG.FIELD_MIN_X} to ${GAME_CONFIG.FIELD_MAX_X}], Z[${GAME_CONFIG.FIELD_MIN_Z} to ${GAME_CONFIG.FIELD_MAX_Z}]`
      );
    });

    // Add command to debug passing behavior
    world.chatManager.registerCommand("/passinfo", (player, args) => {
      world.chatManager.sendPlayerMessage(
        player,
        "=== PASSING SYSTEM INFO ==="
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Current Pass Force: ${PASS_FORCE}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Game Mode: LARGE STADIUM`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Safe Pass Boundaries: X[${FIELD_MIN_X + 8} to ${FIELD_MAX_X - 8}], Z[${FIELD_MIN_Z + 8} to ${FIELD_MAX_Z - 8}]`
      );
      
      // Show ball physics info
      world.chatManager.sendPlayerMessage(
        player,
        `Ball Damping: Linear=${BALL_CONFIG.LINEAR_DAMPING}, Angular=${BALL_CONFIG.ANGULAR_DAMPING}`
      );
      
      // Show current ball position if spawned
      const soccerBall = sharedState.getSoccerBall();
      if (soccerBall?.isSpawned) {
        const pos = soccerBall.position;
        const vel = soccerBall.linearVelocity;
        world.chatManager.sendPlayerMessage(
          player,
          `Ball Position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`
        );
        world.chatManager.sendPlayerMessage(
          player,
          `Ball Velocity: X=${vel.x.toFixed(2)}, Y=${vel.y.toFixed(2)}, Z=${vel.z.toFixed(2)}`
        );
      }
    });

    // Add command to fix player position if stuck
    world.chatManager.registerCommand("/fixposition", (player, args) => {
      // Get current mode configuration info to display
      world.chatManager.sendPlayerMessage(
        player,
        `Current game mode: LARGE STADIUM`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Field boundaries: X[${GAME_CONFIG.FIELD_MIN_X} to ${GAME_CONFIG.FIELD_MAX_X}], Z[${GAME_CONFIG.FIELD_MIN_Z} to ${GAME_CONFIG.FIELD_MAX_Z}], Y=${GAME_CONFIG.SAFE_SPAWN_Y}`
      );
      
      // Get player entity
      const playerEntities = world.entityManager.getPlayerEntitiesByPlayer(player);
      if (playerEntities.length === 0) {
        world.chatManager.sendPlayerMessage(
          player,
          "Could not find your player entity."
        );
        return;
      }
      
      const playerEntity = playerEntities[0];
      if (!(playerEntity instanceof SoccerPlayerEntity)) {
        world.chatManager.sendPlayerMessage(
          player,
          "You must be a soccer player to use this command."
        );
        return;
      }
      
      // Get current position
      const currentPos = playerEntity.position;
      world.chatManager.sendPlayerMessage(
        player,
        `Current position: X=${currentPos.x.toFixed(2)}, Y=${currentPos.y.toFixed(2)}, Z=${currentPos.z.toFixed(2)}`
      );
      
      // Check if player is inside field boundaries
      const isInBounds = 
        currentPos.x >= GAME_CONFIG.FIELD_MIN_X && 
        currentPos.x <= GAME_CONFIG.FIELD_MAX_X &&
        currentPos.z >= GAME_CONFIG.FIELD_MIN_Z && 
        currentPos.z <= GAME_CONFIG.FIELD_MAX_Z;
      
      world.chatManager.sendPlayerMessage(
        player,
        `Position status: ${isInBounds ? "INSIDE field boundaries" : "OUTSIDE field boundaries"}`
      );
      
      // Move player to a safe position based on their team
      const playerTeam = playerEntity instanceof SoccerPlayerEntity ? playerEntity.team : "red";
      
      // Use the mapper's getSpawnPosition for a guaranteed safe position
      const safePosition = soccerMap.getSpawnPosition(playerTeam);
      
      // Set position and unfreeze if frozen
      playerEntity.setPosition(safePosition);
      if (playerEntity instanceof SoccerPlayerEntity && playerEntity.isPlayerFrozen) {
        playerEntity.unfreeze();
      }
      
      world.chatManager.sendPlayerMessage(
        player,
        `Moved to safe position: X=${safePosition.x.toFixed(2)}, Y=${safePosition.y.toFixed(2)}, Z=${safePosition.z.toFixed(2)}`
      );
      
      // Fix AI teammates too if they appear to be out of bounds
      if (args.length > 0 && args[1] === "all") {
        world.chatManager.sendPlayerMessage(
          player,
          "Fixing positions for all AI players too..."
        );
        
        // Get all AI players
        const aiEntities = world.entityManager.getAllPlayerEntities()
          .filter(entity => entity instanceof AIPlayerEntity) as AIPlayerEntity[];
        
        // Fix each AI player's position if needed
        aiEntities.forEach(ai => {
          // Check if AI is out of bounds
          const aiPos = ai.position;
          const aiInBounds = 
            aiPos.x >= GAME_CONFIG.FIELD_MIN_X && 
            aiPos.x <= GAME_CONFIG.FIELD_MAX_X &&
            aiPos.z >= GAME_CONFIG.FIELD_MIN_Z && 
            aiPos.z <= GAME_CONFIG.FIELD_MAX_Z;
          
          if (!aiInBounds) {
            // Get proper position for this AI based on role
            const newPos = getStartPosition(ai.team, ai.aiRole);
            ai.setPosition(newPos);
            world.chatManager.sendPlayerMessage(
              player,
              `Fixed ${ai.player.username} position from X=${aiPos.x.toFixed(2)},Z=${aiPos.z.toFixed(2)} to X=${newPos.x.toFixed(2)},Z=${newPos.z.toFixed(2)}`
            );
          }
        });
      }
    });

    // Add game mode selection commands
    world.chatManager.registerCommand("/fifa", (player, args) => {
      const previousMode = getCurrentGameMode();
      setGameMode(GameMode.FIFA);
      
      // Switch music if game is in progress and mode actually changed
      if (previousMode !== GameMode.FIFA && game && game.inProgress()) {
        console.log("Switching to FIFA mode music during active game");
        arcadeGameplayMusic.pause();
        fifaGameplayMusic.play(world);
        
        // Start FIFA crowd atmosphere when switching to FIFA during active game
        fifaCrowdManager.start();
        
        world.chatManager.sendPlayerMessage(
          player,
          `🎵 Switched to FIFA mode music`
        );
      }
      
      world.chatManager.sendPlayerMessage(
        player,
        `🏆 Switched to FIFA Mode - Realistic soccer simulation`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Match Duration: ${getCurrentModeConfig().halfDuration * getCurrentModeConfig().totalHalves / 60} minutes`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Features: Pure soccer gameplay, no power-ups or abilities`
      );
    });

    world.chatManager.registerCommand("/arcade", (player, args) => {
      const previousMode = getCurrentGameMode();
      setGameMode(GameMode.ARCADE);
      
      // Switch music if game is in progress and mode actually changed
      if (previousMode !== GameMode.ARCADE && game && game.inProgress()) {
        console.log("Switching to Arcade mode music during active game");
        fifaGameplayMusic.pause();
        arcadeGameplayMusic.play(world);
        
        // Stop FIFA crowd atmosphere when switching to arcade
        fifaCrowdManager.stop();
        
        world.chatManager.sendPlayerMessage(
          player,
          `🎵 Switched to Arcade mode music`
        );
      }
      
      world.chatManager.sendPlayerMessage(
        player,
        `🎪 Switched to Arcade Mode - Enhanced soccer with unlimited F-key power-ups!`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Match Duration: ${getCurrentModeConfig().halfDuration * getCurrentModeConfig().totalHalves / 60} minutes`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Features: Unlimited F-key power-ups, enhanced physics, and special effects!`
      );
    });

    world.chatManager.registerCommand("/pickup", (player, args) => {
      const previousMode = getCurrentGameMode();
      setGameMode(GameMode.PICKUP);
      
      // Switch music if game is in progress and mode actually changed
      if (previousMode !== GameMode.PICKUP && game && game.inProgress()) {
        console.log("Switching to Pickup mode music during active game");
        fifaGameplayMusic.pause();
        arcadeGameplayMusic.play(world); // Use arcade music for pickup mode
        
        // Stop FIFA crowd atmosphere when switching to pickup
        fifaCrowdManager.stop();
        
        world.chatManager.sendPlayerMessage(
          player,
          `🎵 Switched to Pickup mode music`
        );
      }
      
      world.chatManager.sendPlayerMessage(
        player,
        `🎯 Switched to Pickup Mode - Soccer with collectible ability pickups!`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Match Duration: ${getCurrentModeConfig().halfDuration * getCurrentModeConfig().totalHalves / 60} minutes`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Features: Physical ability pickups, collect to use F-key abilities!`
      );
    });

    world.chatManager.registerCommand("/mode", (player, args) => {
      const currentMode = getCurrentGameMode();
      const config = getCurrentModeConfig();
      
      world.chatManager.sendPlayerMessage(
        player,
        `=== CURRENT GAME MODE ===`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Mode: ${config.name} (${currentMode.toUpperCase()})`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Description: ${config.description}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Match Duration: ${config.halfDuration * config.totalHalves / 60} minutes`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Power-ups: ${config.powerUps ? "✅ Enabled" : "❌ Disabled"}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Abilities: ${config.specialAbilities ? "✅ Enabled" : "❌ Disabled"}`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `Commands: /fifa (realistic) | /arcade (unlimited F-key)`
      );
    });

    // Add arcade-specific commands for testing enhancements
    world.chatManager.registerCommand("/speed", (player, args) => {
      if (!isArcadeMode()) {
        world.chatManager.sendPlayerMessage(
          player,
          `❌ Speed enhancement only available in Arcade Mode! Use /arcade first.`
        );
        return;
      }
      
      arcadeManager.addEnhancement(player.id, 'speed', 15000); // 15 seconds
      world.chatManager.sendPlayerMessage(
        player,
        `⚡ Speed enhancement activated for 15 seconds!`
      );
    });

    world.chatManager.registerCommand("/power", (player, args) => {
      if (!isArcadeMode()) {
        world.chatManager.sendPlayerMessage(
          player,
          `❌ Power enhancement only available in Arcade Mode! Use /arcade first.`
        );
        return;
      }
      
      arcadeManager.addEnhancement(player.id, 'power', 15000); // 15 seconds
      world.chatManager.sendPlayerMessage(
        player,
        `💥 Power enhancement activated for 15 seconds!`
      );
    });

    world.chatManager.registerCommand("/precision", (player, args) => {
      if (!isArcadeMode()) {
        world.chatManager.sendPlayerMessage(
          player,
          `❌ Precision enhancement only available in Arcade Mode! Use /arcade first.`
        );
        return;
      }
      
      arcadeManager.addEnhancement(player.id, 'precision', 15000); // 15 seconds
      world.chatManager.sendPlayerMessage(
        player,
        `🎯 Precision enhancement activated for 15 seconds!`
      );
    });

    // Add lighting control commands for performance testing
    world.chatManager.registerCommand("/noshadows", (player, args) => {
      world.setDirectionalLightIntensity(0.05); // Minimal shadows
      world.setAmbientLightIntensity(1.5); // Very bright ambient
      world.chatManager.sendPlayerMessage(
        player,
        `🌞 Shadows minimized for maximum performance`
      );
    });

    world.chatManager.registerCommand("/normallighting", (player, args) => {
      world.setDirectionalLightIntensity(0.7); // Default intensity
      world.setAmbientLightIntensity(0.4); // Default ambient
      world.chatManager.sendPlayerMessage(
        player,
        `🌞 Normal lighting restored`
      );
    });

    world.chatManager.registerCommand("/optimizedlighting", (player, args) => {
      // Restore the domed stadium lighting settings from startup
      world.setDirectionalLightIntensity(0.6); // Moderate daylight intensity
      world.setDirectionalLightPosition({ x: 0, y: 300, z: 0 }); // Very high overhead for dome
      world.setDirectionalLightColor({ r: 255, g: 248, b: 235 }); // Warm daylight color
      world.setAmbientLightIntensity(1.2); // Bright ambient for indoor stadium
      world.setAmbientLightColor({ r: 250, g: 250, b: 255 }); // Very bright ambient
      world.chatManager.sendPlayerMessage(
        player,
        `🏟️ Domed stadium lighting settings restored`
      );
    });

    world.chatManager.registerCommand("/domelighting", (player, args) => {
      // Enhanced domed stadium lighting for maximum brightness
      world.setDirectionalLightIntensity(0.8); // Higher intensity for extra brightness
      world.setDirectionalLightPosition({ x: 0, y: 350, z: 0 }); // Even higher overhead
      world.setDirectionalLightColor({ r: 255, g: 255, b: 245 }); // Very bright warm white
      world.setAmbientLightIntensity(1.5); // Maximum bright ambient
      world.setAmbientLightColor({ r: 255, g: 255, b: 255 }); // Pure white ambient
      world.chatManager.sendPlayerMessage(
        player,
        `☀️ Maximum brightness domed stadium lighting activated`
      );
    });

    world.chatManager.registerCommand("/lighting", (player, args) => {
      world.chatManager.sendPlayerMessage(
        player,
        `=== LIGHTING COMMANDS ===`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `/noshadows - Minimize shadows for max performance`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `/normallighting - Restore default lighting`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `/optimizedlighting - Restore domed stadium settings`
      );
      world.chatManager.sendPlayerMessage(
        player,
        `/domelighting - Maximum brightness for glass dome`
      );
    });

    // Performance Profiler Commands
    world.chatManager.registerCommand("/profiler", (player, args) => {
      const action = args[0]?.toLowerCase();
      
      switch (action) {
        case "start":
          performanceProfiler.start();
          world.chatManager.sendPlayerMessage(
            player,
            "🚀 Performance profiler started. Use '/profiler report' to view stats."
          );
          break;
          
        case "stop":
          performanceProfiler.stop();
          world.chatManager.sendPlayerMessage(
            player,
            "⏹️ Performance profiler stopped."
          );
          break;
          
        case "report":
          const report = performanceProfiler.getDetailedReport();
          world.chatManager.sendPlayerMessage(
            player,
            `📊 === PERFORMANCE REPORT ===`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `🤖 Active AI Players: ${report.activeAICount}`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `🎮 Total Entities: ${report.activeEntityCount}`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `⏱️ Avg AI Decision: ${report.averageStats.avgAIDecisionTime.toFixed(2)}ms`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `🔄 Avg Physics: ${report.averageStats.avgPhysicsTime.toFixed(2)}ms`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `🎯 Avg Entity Tick: ${report.averageStats.avgEntityTickTime.toFixed(2)}ms`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `⚽ Avg Ball Physics: ${report.averageStats.avgBallPhysicsTime.toFixed(2)}ms`
          );
          world.chatManager.sendPlayerMessage(
            player,
            `🖼️ Avg Frame Time: ${report.averageStats.avgFrameTime.toFixed(2)}ms`
          );
          
          if (report.recommendations.length > 0) {
            world.chatManager.sendPlayerMessage(
              player,
              "💡 RECOMMENDATIONS:"
            );
            report.recommendations.forEach(rec => {
              world.chatManager.sendPlayerMessage(player, `   ${rec}`);
            });
          }
          break;
          
        case "debug":
          const debugEnabled = args[1]?.toLowerCase() === "on";
          performanceProfiler.toggleDebugRendering(debugEnabled);
          world.chatManager.sendPlayerMessage(
            player,
            `🔍 Debug rendering ${debugEnabled ? 'enabled' : 'disabled'}`
          );
          break;
          
        case "raycast":
          const raycastEnabled = args[1]?.toLowerCase() === "on";
          performanceProfiler.toggleRaycastDebugging(raycastEnabled);
          world.chatManager.sendPlayerMessage(
            player,
            `🎯 Raycast debugging ${raycastEnabled ? 'enabled' : 'disabled'}`
          );
          break;
          
        default:
          world.chatManager.sendPlayerMessage(
            player,
            "=== PERFORMANCE PROFILER COMMANDS ==="
          );
          world.chatManager.sendPlayerMessage(
            player,
            "/profiler start - Start performance monitoring"
          );
          world.chatManager.sendPlayerMessage(
            player,
            "/profiler stop - Stop performance monitoring"
          );
          world.chatManager.sendPlayerMessage(
            player,
            "/profiler report - View current performance stats"
          );
          world.chatManager.sendPlayerMessage(
            player,
            "/profiler debug on/off - Toggle debug rendering"
          );
          world.chatManager.sendPlayerMessage(
            player,
            "/profiler raycast on/off - Toggle raycast debugging"
          );
          break;
      }
    });
  });