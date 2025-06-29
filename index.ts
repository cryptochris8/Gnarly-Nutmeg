import { startServer, Audio, PlayerEntity, PlayerEvent, PlayerUIEvent, PlayerCameraMode, type Vector3Like, EntityEvent } from "hytopia";
import worldMap from "./assets/maps/soccer.json"; // Uncommented to load the soccer map
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
  BALL_CONFIG
} from "./state/gameConfig";
import SoccerPlayerEntity from "./entities/SoccerPlayerEntity";
import AIPlayerEntity, { type SoccerAIRole } from "./entities/AIPlayerEntity";
import sharedState from "./state/sharedState";
import { getDirectionFromRotation } from "./utils/direction";
import observerMode from "./utils/observerMode";
import { soccerMap } from "./state/map";

startServer((world) => {
  // Load the soccer map
  console.log("Loading soccer map...");
  world.loadMap(worldMap); // Uncommented to load the soccer map

  // Store the main background music instance
  const mainMusic = new Audio({
    uri: "audio/music/Ian Post - 8 Bit Samba - No FX.mp3",
    loop: true,
    volume: 0.1,
  });
  mainMusic.play(world); // Start playing immediately

  // Store the gameplay music instance
  const gameplayMusic = new Audio({
    uri: "audio/music/always-win.mp3",
    loop: true,
    volume: 0.1,
  });

  // Create and spawn soccer ball entity
  console.log("Creating soccer ball");
  const soccerBall = createSoccerBall(world);
  
  // Ball is already spawned in createSoccerBall function, no need to spawn again
  console.log("Soccer ball created and spawned successfully");
  
  // Initialize game
  let aiPlayers: AIPlayerEntity[] = [];
  const game = new SoccerGame(world, soccerBall, aiPlayers);

  // Function to spawn AI players for 6v6 setup
  // Takes the human player's chosen team
  // Returns a promise that resolves when AI spawning and activation is complete
  const spawnAIPlayers = (playerTeam: "red" | "blue"): Promise<void> => {
    return new Promise((resolve) => {
      console.log(`Spawning AI players for large stadium setup (6v6). Player team: ${playerTeam}`);
      
      // Clean up any existing AI players and remove from shared state
      aiPlayers.forEach(ai => {
        if (ai.isSpawned) {
          ai.deactivate();
          sharedState.removeAIFromTeam(ai, ai.team);
          ai.despawn();
        }
      });
      aiPlayers = []; // Clear local list
      
      // Determine opponent and AI team
      const aiTeam = playerTeam === "red" ? "blue" : "red";
      console.log(`AI opponent team will be ${aiTeam}`);
      
      // Define the roles needed for a full team (large stadium 6v6)
      const fullTeamRoles: SoccerAIRole[] = [
        'goalkeeper',
        'left-back',
        'right-back',
        'central-midfielder-1',
        'central-midfielder-2',
        'striker'
      ];

      // --- Register and Spawn Opponent AI Team ---
      console.log(`Registering and spawning opponent AI team (${aiTeam})`);
      fullTeamRoles.forEach(role => {
        const aiID = `AI_Opponent_${aiTeam}_${role}`;
        // Register in game state if not already there (e.g., due to reconnect)
        if (game.getTeamOfPlayer(aiID) === null) {
          game.joinGame(aiID, `AI ${role}`);
          game.joinTeam(aiID, aiTeam);
        }
        // Create AI entity
        const opponentAI = new AIPlayerEntity(world, aiTeam, role);
        aiPlayers.push(opponentAI); // Track for cleanup
        // Spawn at role-specific position
        opponentAI.spawn(world, getStartPosition(aiTeam, role));
        // Explicitly set initial rotation to face opponent goal
        if (opponentAI.team === "blue") {
          opponentAI.setRotation({ x: 0, y: 1, z: 0, w: 0 }); // Blue faces -X (towards Red's goal)
        } else {
          opponentAI.setRotation({ x: 0, y: 0, z: 0, w: 1 }); // Red faces +X (towards Blue's goal)
        }
        sharedState.addAIToTeam(opponentAI, aiTeam);
      });
      console.log(`Opponent AI team (${aiTeam}) spawned.`);

      // --- Register and Spawn AI Teammates (Fill player's team) ---
      const playersOnMyTeam = game.getPlayerCountOnTeam(playerTeam);
      const maxPlayers = game.getMaxPlayersPerTeam(); // Should be 6 now
      const neededTeammates = maxPlayers - playersOnMyTeam;
      
      console.log(`Player team (${playerTeam}) needs ${neededTeammates} AI teammates.`);

      // Get roles already taken by human players (assume first joined are humans)
      const humanPlayersOnTeam = Array.from(game.getState().players.values())
                                      .filter(p => p.team === playerTeam && !p.id.startsWith('AI_'))
                                      .map(p => p.id);
      
      // Create a list of roles that excludes the human player's role (which is now 'central-midfielder-1')
      // This ensures we don't have duplicate midfielders if the human is one
      const humanPlayerRole: SoccerAIRole = 'central-midfielder-1'; // Assuming human is now always this role
      const availableRolesForTeammates = fullTeamRoles.filter(role => role !== humanPlayerRole);

      for (let i = 0; i < neededTeammates; i++) {
        // Assign roles sequentially from the available list
        const role = availableRolesForTeammates[i] || 'central-midfielder-1'; // Default to midfielder if list runs out
        const aiID = `AI_Teammate_${playerTeam}_${role}`;
        
        console.log(`Spawning AI teammate ${i + 1}/${neededTeammates} for team ${playerTeam} with role ${role}`);

        // Register this AI player in the game state if needed
        if (game.getTeamOfPlayer(aiID) === null) {
          game.joinGame(aiID, `AI ${role}`);
          game.joinTeam(aiID, playerTeam);
        }
        
        // Create and spawn teammate AI
        const teammateAI = new AIPlayerEntity(world, playerTeam, role);
        aiPlayers.push(teammateAI); // Track for cleanup
        teammateAI.spawn(world, getStartPosition(playerTeam, role));
        // Explicitly set initial rotation to face opponent goal
        if (teammateAI.team === "blue") {
          teammateAI.setRotation({ x: 0, y: 1, z: 0, w: 0 }); // Blue faces -X (towards Red's goal)
        } else {
          teammateAI.setRotation({ x: 0, y: 0, z: 0, w: 1 }); // Red faces +X (towards Blue's goal)
        }
        sharedState.addAIToTeam(teammateAI, playerTeam); 
      }
      console.log(`AI teammates for team ${playerTeam} spawned.`);
      
      // Update the aiPlayersList in the game instance
      game.updateAIPlayersList(aiPlayers);
      console.log(`Updated game AI players list with ${aiPlayers.length} AI players.`);
      
      console.log("All required AI players spawned and registered.");
      resolve(); // Resolve the promise
    });
  };

  // --- Helper Function for Starting Positions ---
  const getStartPosition = (team: "red" | "blue", role: SoccerAIRole): Vector3Like => {
    const isRed = team === 'red';
    const y = SAFE_SPAWN_Y; // Use consistent safe spawn height to prevent surface collision
    let x = 0; // Depth relative to goal lines
    let z = 0; // Width relative to center Z

    // Determine own goal line and forward direction based on team
    const ownGoalLineX = isRed ? AI_GOAL_LINE_X_RED : AI_GOAL_LINE_X_BLUE;
    const forwardXMultiplier = isRed ? -1 : 1; // Red moves towards negative X, Blue towards positive X

    // Large stadium - use the existing logic with full offsets
    switch (role) {
      case 'goalkeeper':
        x = ownGoalLineX + (1 * forwardXMultiplier * -1); // 1 unit in front of own goal
        z = AI_FIELD_CENTER_Z; // Center of the goal width
        break;
      case 'left-back': // Min Z side
        x = ownGoalLineX + (AI_DEFENSIVE_OFFSET_X * forwardXMultiplier * -1); // Use defensive offset depth
        z = AI_FIELD_CENTER_Z + (AI_WIDE_Z_BOUNDARY_MIN - AI_FIELD_CENTER_Z) * 0.6; // Positioned towards the left sideline
        break;
      case 'right-back': // Max Z side
        x = ownGoalLineX + (AI_DEFENSIVE_OFFSET_X * forwardXMultiplier * -1); // Use defensive offset depth
        z = AI_FIELD_CENTER_Z + (AI_WIDE_Z_BOUNDARY_MAX - AI_FIELD_CENTER_Z) * 0.6; // Positioned towards the right sideline
        break;
      case 'central-midfielder-1': // Min Z side preference
        x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier * -1); // Use midfield offset depth
        z = AI_FIELD_CENTER_Z + (AI_MIDFIELD_Z_BOUNDARY_MIN - AI_FIELD_CENTER_Z) * 0.5; // Left side of center midfield
        break;
      case 'central-midfielder-2': // Max Z side preference
        x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier * -1); // Use midfield offset depth
        z = AI_FIELD_CENTER_Z + (AI_MIDFIELD_Z_BOUNDARY_MAX - AI_FIELD_CENTER_Z) * 0.5; // Right side of center midfield
        break;
      case 'striker':
        x = ownGoalLineX + (AI_FORWARD_OFFSET_X * forwardXMultiplier * -1); // Use forward offset depth
        z = AI_FIELD_CENTER_Z; // Central width
        break;
      default: // Fallback, place near center midfield
        x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier * -1);
        z = AI_FIELD_CENTER_Z;
    }

    return { x, y, z };
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
      
      // Clean up AI players and remove from shared state
      aiPlayers.forEach(ai => {
        if (ai.isSpawned) {
          ai.deactivate();
          sharedState.removeAIFromTeam(ai, ai.team);
        }
      });
      aiPlayers = []; // Clear local list

      game.resetGame(); // Reset the game state to waiting

      // Reload UI for all players after game reset
      world.entityManager.getAllPlayerEntities().forEach((playerEntity) => {
        const player = playerEntity.player;
        player.ui.load("ui/index.html");
        player.ui.sendData({
          type: "team-counts",
          red: game.getPlayerCountOnTeam("red"),
          blue: game.getPlayerCountOnTeam("blue"),
          maxPlayers: 6,
          singlePlayerMode: true,
        });
        player.ui.sendData({
          type: "focus-on-instructions",
        });
      });
    }) as any
  );

  // Handle penalty shot detection from ball movement
  world.on("penalty-shot-taken" as any, (() => {
    console.log("🥅 Penalty shot taken detected by ball movement");
    if (game.getState().status === "penalty-shootout") {
      game.handlePenaltyShot();
    }
  }) as any);

  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`Player ${player.username} joined world`);
    
    // Check if this player is a developer and should auto-enable observer mode
    if (observerMode.isDeveloper(player.username)) {
      // Only auto-enable observer if no game is in progress
      if (!game.inProgress()) {
        world.chatManager.sendPlayerMessage(
          player,
          "Developer detected. Use /observer to enable observer mode or /aitraining to start AI training match."
        );
      }
    }
    
    // Load UI first before any game state checks
    player.ui.load("ui/index.html");

    // Check game state
    if (game.inProgress()) {
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
      red: game.getPlayerCountOnTeam("red"),
      blue: game.getPlayerCountOnTeam("blue"),
      maxPlayers: 6,
      singlePlayerMode: true,
    });

    player.ui.sendData({
      type: "focus-on-instructions",
    });

    player.ui.on(PlayerUIEvent.DATA, async ({ playerUI, data }) => {
      if (data.type === "team-selected" && data.team) {
        // Handle game mode selection if provided
        if (data.gameMode) {
          console.log(`Player selected game mode: ${data.gameMode}${data.playerCount ? ` with ${data.playerCount}v${data.playerCount}` : ''}`);
          // Game mode switching removed - large stadium only
        }
        
        // Join team and try to start game when team is selected
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
        console.log("Switching from opening music to gameplay music");
        mainMusic.pause();
        gameplayMusic.play(world);

        // Single player mode - uses the new spawnAIPlayers
        if (data.singlePlayerMode) {
          console.log(`Starting single player mode for team ${data.team} (6v6)`);
          await spawnAIPlayers(data.team); // Call the updated function
          console.log("AI spawning complete, attempting to start game...");
          const gameStarted = game.startGame();
          if (gameStarted) {
            console.log("Game started successfully, unfreezing player.");
            if (playerEntity && typeof playerEntity.unfreeze === 'function') {
              playerEntity.unfreeze();
            }
          } else {
            console.error("Failed to start game even after spawning AI. Check game state logic.");
            player.ui.sendData({ type: "error", message: "Failed to start single-player game." });
          }
        } // End singlePlayerMode check

      } // End team-selected check
      else if (data.type === "coin-toss-choice" && data.choice) {
        // Handle coin toss choice
        console.log(`Player ${player.username} chose ${data.choice} for coin toss`);
        
        // Process coin toss only if game is in starting state
        if (game.getState().status === "starting") {
          game.performCoinToss({
            playerId: player.username,
            choice: data.choice
          });
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
      else if (data.type === "penalty-shot-taken") {
        // Handle penalty shot detection
        console.log(`🥅 Penalty shot taken by ${player.username}`);
        
        // Notify the game that a penalty shot was taken
        if (game.getState().status === "penalty-shootout") {
          game.handlePenaltyShot();
        }
      }
      else if (data.type === "penalty-shootout-mode") {
        // Handle penalty shootout mode selection
        console.log(`🥅 Player ${player.username} selected penalty shootout mode for team ${data.team}`);
        
        // Check if this player is already in a game
        if (game.getTeamOfPlayer(player.username) !== null) {
          console.log("Player already on a team");
          return;
        }

        // Join game and team
        game.joinGame(player.username, player.username);
        game.joinTeam(player.username, data.team);

        // Create player entity with the assigned role
        const humanPlayerRole: SoccerAIRole = 'central-midfielder-1'; // Human player is now a midfielder
        const playerEntity = new SoccerPlayerEntity(player, data.team, humanPlayerRole);
        console.log(`Creating player entity for penalty shootout team ${data.team} as ${humanPlayerRole}`);
        
        // Add spawn event listener to verify when entity is actually spawned
        playerEntity.on(EntityEvent.SPAWN, () => {
          console.log(`Player entity ${playerEntity.id} successfully spawned for penalty shootout`);
        });
        
        // Get correct spawn position for penalty shootout (use center field)
        const spawnPosition = {
          x: 0, // Center field
          y: SAFE_SPAWN_Y,
          z: AI_FIELD_CENTER_Z
        };
        console.log(`Using penalty shootout spawn position: X=${spawnPosition.x.toFixed(2)}, Y=${spawnPosition.y.toFixed(2)}, Z=${spawnPosition.z.toFixed(2)}`);
        
        // Spawn player entity immediately at calculated position
        console.log(`Spawning player entity for penalty shootout at center field`);
        playerEntity.spawn(world, spawnPosition);
        console.log(`Player entity ${playerEntity.id} spawn command issued for penalty shootout mode.`);
        
        // Freeze the human player initially
        playerEntity.freeze();
        
        // Music change - switch from opening music to gameplay music
        console.log("Switching from opening music to gameplay music for penalty shootout");
        mainMusic.pause();
        gameplayMusic.play(world);

        // Set penalty-only mode flag IMMEDIATELY to prevent regular game conflicts
        console.log("🥅 Setting penalty-only mode flag to prevent regular game interference");
        game.getState().penaltyOnlyMode = true;
        game.getState().status = "penalty-shootout";
        
        // Spawn AI players for penalty shootout mode
        console.log(`Starting penalty shootout mode for team ${data.team}`);
        await spawnAIPlayers(data.team); // Use existing AI spawning function
        console.log("AI spawning complete for penalty shootout, starting penalty-only mode immediately...");
        
        // Send immediate UI update to switch to penalty-only mode display
        world.entityManager.getAllPlayerEntities().forEach((playerEntity) => {
          // Hide regular game UI and show penalty-only mode
          playerEntity.player.ui.sendData({
            type: "penalty-only-mode-start",
            message: "Penalty Shootout Mode - Regular game scoreboard hidden"
          });
          
          // Send clean penalty game state
          playerEntity.player.ui.sendData({
            type: "game-state",
            timeRemaining: 0,
            score: { red: 0, blue: 0 }, // Clear regular game score for penalty mode
            status: "penalty-shootout",
            penaltyOnlyMode: true
          });
        });
        
        // Unfreeze the player immediately
        if (playerEntity && typeof playerEntity.unfreeze === 'function') {
          playerEntity.unfreeze();
        }
        
        // Start penalty-only mode immediately (bypasses all regular game delays)
        setTimeout(() => {
          console.log("🥅 Starting penalty-only mode with immediate penalty setup...");
          game.startPenaltyOnlyMode(); // Use the new dedicated method
        }, 500); // Minimal delay just to ensure AI spawning is complete
      }
    });

    // Attempt to start multiplayer game (logic needs adjustment for 6v6)
    const state = game.getState();
    if (
      state.status === "waiting" &&
      !state.penaltyOnlyMode && // Don't auto-start if penalty-only mode is set
      game.getPlayerCountOnTeam("red") >= state.minPlayersPerTeam && // Check each team individually
      game.getPlayerCountOnTeam("blue") >= state.minPlayersPerTeam &&
      (game.getPlayerCountOnTeam("red") + game.getPlayerCountOnTeam("blue")) >= state.minPlayersPerTeam * 2 && // Check total players
      aiPlayers.length === 0 // Ensure we're not in single player mode (handled above)
    ) {
      // Potentially wait slightly or add a ready check before starting multiplayer
      console.log("Enough players for multiplayer, attempting start...");
      game.startGame(); 
    }
  });

  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`Player ${player.username} left world - checking if game reset needed`);
    
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
      
      if (game.inProgress() && aiPlayers.length > 0 && humanPlayerCount === 0 && !playerStillConnected) {
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
         gameplayMusic.pause();
         mainMusic.play(world);
      } else if (game.inProgress() && playerTeam && game.getPlayerCountOnTeam(playerTeam) === 0 && !playerStillConnected) {
         // Check if a team is now empty in multiplayer
         console.log(`Team ${playerTeam} is now empty. Ending game.`);
         game.resetGame(); // Or implement forfeit logic
         
         // Reset music back to opening music
         console.log("Resetting music back to opening music");
         gameplayMusic.pause();
         mainMusic.play(world);
      } else {
         console.log(`Player left but game continues - Human players: ${humanPlayerCount}, Player still connected: ${playerStillConnected}`);
      }
    }, 500); // 500ms delay to let any repositioning settle
  });

  world.chatManager.registerCommand("/stuck", (player, message) => {
    // Only allow this command during active gameplay
    if (!game.inProgress()) {
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
    game.updateAIPlayersList([]);
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
        "Usage: /music <opening|gameplay> - Switch between music tracks"
      );
      return;
    }
    
    const musicType = args[1].toLowerCase();
    if (musicType === "opening") {
      console.log("Manual switch to opening music");
      gameplayMusic.pause();
      mainMusic.play(world);
      world.chatManager.sendPlayerMessage(player, "Switched to opening music");
    } else if (musicType === "gameplay") {
      console.log("Manual switch to gameplay music");
      mainMusic.pause();
      gameplayMusic.play(world);
      world.chatManager.sendPlayerMessage(player, "Switched to gameplay music");
    } else {
      world.chatManager.sendPlayerMessage(
        player,
        "Invalid option. Use 'opening' or 'gameplay'"
      );
    }
  });

  // Add a debug command to check AI status
  world.chatManager.registerCommand("/debugai", (player, message) => {
    game.updateAIPlayersList(aiPlayers);
    const gameAICount = aiPlayers.length;
    const activeAICount = aiPlayers.filter(ai => ai.isSpawned && !ai.isPlayerFrozen).length;
    const frozenAICount = aiPlayers.filter(ai => ai.isSpawned && ai.isPlayerFrozen).length;
    
    world.chatManager.sendPlayerMessage(
      player,
      `AI Status: ${aiPlayers.length} total, ${activeAICount} active, ${frozenAICount} frozen, ${gameAICount} registered with game`
    );
    
    // Force activate all AI if they're spawned but not active
    if (game.inProgress() && frozenAICount > 0) {
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
}); 