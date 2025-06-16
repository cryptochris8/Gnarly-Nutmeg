import { PlayerCameraMode, type Player, type Vector3Like, type World } from "hytopia";
import sharedState from "../state/sharedState";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import AIPlayerEntity, { type SoccerAIRole } from "../entities/AIPlayerEntity";
import { AI_GOAL_LINE_X_RED, AI_GOAL_LINE_X_BLUE, AI_FIELD_CENTER_Z, AI_DEFENSIVE_OFFSET_X, AI_MIDFIELD_OFFSET_X, AI_FORWARD_OFFSET_X, AI_WIDE_Z_BOUNDARY_MAX, AI_WIDE_Z_BOUNDARY_MIN, SAFE_SPAWN_Y } from "../state/gameConfig";

/**
 * Observer Mode State
 * Controls the state and functionality of the observer mode.
 */
class ObserverMode {
    private static instance: ObserverMode;
    
    // Settings
    private _isEnabled: boolean = false;
    private _developerNames: string[] = []; // Add your username(s) here
    
    // Camera control
    private _followingEntity: AIPlayerEntity | null = null;
    private _followingPlayer: Player | null = null;
    private _currentViewIndex: number = 0;
    private _cameraModes: Array<{name: string, setup: (player: Player, entity?: AIPlayerEntity) => void}> = [];
    private _currentCameraMode: number = 0;

    private constructor() {
        // Define camera modes
        this._cameraModes = [
            {
                name: "Follow Player",
                setup: (player: Player, entity?: AIPlayerEntity) => {
                    if (!entity) return;
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToEntity(entity);
                    player.camera.setOffset({ x: 0, y: 3, z: 6 }); // Higher and further back
                    player.camera.setZoom(1.5);
                }
            },
            {
                name: "Bird's Eye",
                setup: (player: Player, entity?: AIPlayerEntity) => {
                    // Get the soccer ball position
                    const ball = sharedState.getSoccerBall();
                    if (!ball) return;
                    
                    // Position camera high above the field, looking down
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToPosition(ball.position);
                    player.camera.setOffset({ x: 0, y: 20, z: 0 }); // High above
                    player.camera.setTrackedEntity(ball);
                    player.camera.setZoom(4); // Wider view
                }
            },
            {
                name: "Player View",
                setup: (player: Player, entity?: AIPlayerEntity) => {
                    if (!entity) return;
                    player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
                    player.camera.setAttachedToEntity(entity);
                    player.camera.setOffset({ x: 0, y: 0.6, z: 0 }); // Eye level
                    player.camera.setForwardOffset(0.1);
                    player.camera.setModelHiddenNodes(['head']); // Hide head to avoid view obstruction
                }
            },
        ];
    }

    public static getInstance(): ObserverMode {
        if (!ObserverMode.instance) {
            ObserverMode.instance = new ObserverMode();
        }
        return ObserverMode.instance;
    }

    /**
     * Checks if a player is a developer
     * @param username The player's username to check
     */
    public isDeveloper(username: string): boolean {
        // Note: Replace the string below with your actual Hytopia username
        // You may add multiple usernames as needed
        // Example: return username === "YourUsername" || username === "AnotherDevUsername"
        return this._developerNames.includes(username) || 
               username === "athletedomains";
    }

    /**
     * Add a developer username to the list
     * @param username Developer's username
     */
    public addDeveloper(username: string): void {
        if (!this._developerNames.includes(username)) {
            this._developerNames.push(username);
        }
    }

    /**
     * Enable observer mode
     */
    public enable(): void {
        this._isEnabled = true;
    }

    /**
     * Disable observer mode
     */
    public disable(): void {
        this._isEnabled = false;
    }

    /**
     * Check if observer mode is enabled
     */
    public isEnabled(): boolean {
        return this._isEnabled;
    }

    /**
     * Set up observer mode for a player
     * @param player The player to set up observer mode for
     */
    public setupObserver(player: Player): void {
        this._followingPlayer = player;
        
        // Get all AI players from both teams
        const redTeam = sharedState.getRedAITeam();
        const blueTeam = sharedState.getBlueAITeam();
        const allAIs = [...redTeam, ...blueTeam].filter(ai => ai.isSpawned);
        
        if (allAIs.length === 0) {
            console.log("No AI players to observe");
            return;
        }
        
        // Start following the first AI player
        this._followingEntity = allAIs[0];
        this._currentViewIndex = 0;
        
        // Apply the first camera mode
        this._currentCameraMode = 0;
        this.applyCameraMode(player);
        
        // Notify player
        if (player.world) {
            player.world.chatManager.sendPlayerMessage(
                player,
                `Now observing ${this._followingEntity?.player?.username || "None"} (${this._followingEntity?.team || "None"}) in ${this._cameraModes[this._currentCameraMode].name} mode`
            );
        }
    }

    /**
     * Apply the current camera mode to the player
     * @param player The player to apply the camera mode to
     */
    private applyCameraMode(player: Player): void {
        const mode = this._cameraModes[this._currentCameraMode];
        if (this._followingEntity) {
            mode.setup(player, this._followingEntity);
        }

        // Notify player about camera mode
        if (player.world) {
            player.world.chatManager.sendPlayerMessage(
                player,
                `Camera mode: ${mode.name}`
            );
        }
    }

    /**
     * Handle the command to cycle to the next AI player
     * @param player The player issuing the command
     */
    public cycleNextPlayer(player: Player): void {
        // Get all AI players from both teams
        const redTeam = sharedState.getRedAITeam();
        const blueTeam = sharedState.getBlueAITeam();
        const allAIs = [...redTeam, ...blueTeam].filter(ai => ai.isSpawned);
        
        if (allAIs.length === 0) {
            console.log("No AI players to observe");
            return;
        }
        
        // Cycle to the next AI player
        this._currentViewIndex = (this._currentViewIndex + 1) % allAIs.length;
        this._followingEntity = allAIs[this._currentViewIndex];
        
        // Apply the current camera mode
        this.applyCameraMode(player);
        
        // Notify player
        if (player.world) {
            player.world.chatManager.sendPlayerMessage(
                player,
                `Now observing ${this._followingEntity?.player?.username || "None"} (${this._followingEntity?.team || "None"}) in ${this._cameraModes[this._currentCameraMode].name} mode`
            );
        }
    }

    /**
     * Handle the command to cycle to the next camera mode
     * @param player The player issuing the command
     */
    public cycleCameraMode(player: Player): void {
        this._currentCameraMode = (this._currentCameraMode + 1) % this._cameraModes.length;
        this.applyCameraMode(player);
    }

    /**
     * Get a role-specific start position
     * @param team Team (red/blue)
     * @param role Player role
     */
    private getStartPosition(team: "red" | "blue", role: SoccerAIRole): Vector3Like {
        const isRed = team === 'red';
        const y = SAFE_SPAWN_Y; // Use safe spawn height
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
                z = AI_FIELD_CENTER_Z - 4; // Left side of center midfield
                break;
            case 'central-midfielder-2': // Max Z side preference
                x = ownGoalLineX + (AI_MIDFIELD_OFFSET_X * forwardXMultiplier * -1); // Use midfield offset depth
                z = AI_FIELD_CENTER_Z + 4; // Right side of center midfield
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
    }

    /**
     * Set up AI vs AI match - create 6v6 with all AI players and observe them
     * @param world The game world
     * @param player The player (observer)
     * @param game The SoccerGame instance
     */
    public startAITrainingMatch(world: World, player: Player, game: any): Promise<void> {
        return new Promise(async (resolve) => {
            // Clean up any existing AI players
            const aiPlayers = [...sharedState.getRedAITeam(), ...sharedState.getBlueAITeam()];
            aiPlayers.forEach(ai => {
                if (ai.isSpawned) {
                    ai.deactivate();
                    sharedState.removeAIFromTeam(ai, ai.team);
                    ai.despawn();
                }
            });
            
            // Reset game state
            game.resetGame();
            
            // Roles for a full team
            const fullTeamRoles: SoccerAIRole[] = [
                'goalkeeper',
                'left-back',
                'right-back',
                'central-midfielder-1',
                'central-midfielder-2',
                'striker'
            ];
            
            const newAIPlayers: AIPlayerEntity[] = [];
            
            // Spawn Red team
            console.log("Spawning RED team AI players");
            for (const role of fullTeamRoles) {
                const aiID = `AI_Red_${role}_${Math.random().toString(36).substring(2, 6)}`;
                game.joinGame(aiID, `AI Red ${role}`);
                game.joinTeam(aiID, "red");
                
                // Create AI entity
                const aiPlayer = new AIPlayerEntity(world, "red", role);
                newAIPlayers.push(aiPlayer);
                
                // Spawn at role-specific position
                aiPlayer.spawn(world, this.getStartPosition("red", role));
                
                // Set initial rotation
                aiPlayer.setRotation({ x: 0, y: 1, z: 0, w: 0 }); // Red faces -X
                
                sharedState.addAIToTeam(aiPlayer, "red");
            }
            
            // Spawn Blue team
            console.log("Spawning BLUE team AI players");
            for (const role of fullTeamRoles) {
                const aiID = `AI_Blue_${role}_${Math.random().toString(36).substring(2, 6)}`;
                game.joinGame(aiID, `AI Blue ${role}`);
                game.joinTeam(aiID, "blue");
                
                // Create AI entity
                const aiPlayer = new AIPlayerEntity(world, "blue", role);
                newAIPlayers.push(aiPlayer);
                
                // Spawn at role-specific position
                aiPlayer.spawn(world, this.getStartPosition("blue", role));
                
                // Set initial rotation
                aiPlayer.setRotation({ x: 0, y: 0, z: 0, w: 1 }); // Blue faces +X
                
                sharedState.addAIToTeam(aiPlayer, "blue");
            }
            
            // Update AI players list in game instance
            game["aiPlayersList"] = newAIPlayers;
            
            // Start the game
            const gameStarted = game.startGame();
            if (gameStarted) {
                console.log("AI training match started successfully");
                
                // Set up observer mode for the player
                this.enable();
                this.setupObserver(player);
                
                // Notify player
                if (player.world) {
                    player.world.chatManager.sendPlayerMessage(
                        player,
                        "AI training match started. Use /nextplayer and /nextcamera to change views."
                    );
                }
            } else {
                console.error("Failed to start AI training match");
                if (player.world) {
                    player.world.chatManager.sendPlayerMessage(
                        player,
                        "Failed to start AI training match"
                    );
                }
            }
            
            resolve();
        });
    }
}

export default ObserverMode.getInstance(); 