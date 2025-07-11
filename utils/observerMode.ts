import { PlayerCameraMode, type Player, type Vector3Like, type World } from "hytopia";
import sharedState from "../state/sharedState";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";
import AIPlayerEntity, { type SoccerAIRole } from "../entities/AIPlayerEntity";
import { AI_GOAL_LINE_X_RED, AI_GOAL_LINE_X_BLUE, AI_FIELD_CENTER_X, AI_FIELD_CENTER_Z, AI_DEFENSIVE_OFFSET_X, AI_MIDFIELD_OFFSET_X, AI_FORWARD_OFFSET_X, AI_WIDE_Z_BOUNDARY_MAX, AI_WIDE_Z_BOUNDARY_MIN, SAFE_SPAWN_Y } from "../state/gameConfig";

/**
 * Enhanced Spectator Mode System
 * Controls spectator camera views and functionality for soccer matches.
 */
class SpectatorMode {
    private static instance: SpectatorMode;
    
    // Settings
    private _isEnabled: boolean = false;
    private _spectators: Map<string, Player> = new Map(); // Track active spectators
    
    // Camera control per spectator
    private _spectatorStates: Map<string, {
        followingEntity: SoccerPlayerEntity | AIPlayerEntity | null;
        currentViewIndex: number;
        currentCameraMode: number;
        isFollowingBall: boolean;
    }> = new Map();
    
    private _cameraModes: Array<{name: string, setup: (player: Player, entity?: SoccerPlayerEntity | AIPlayerEntity) => void}> = [];

    private constructor() {
        // Define enhanced camera modes for spectating
        this._cameraModes = [
            {
                name: "Follow Player",
                setup: (player: Player, entity?: SoccerPlayerEntity | AIPlayerEntity) => {
                    if (!entity) return;
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToEntity(entity);
                    player.camera.setOffset({ x: 0, y: 3, z: 6 }); // Behind and above player
                    player.camera.setZoom(1.5);
                }
            },
            {
                name: "Side View",
                setup: (player: Player, entity?: SoccerPlayerEntity | AIPlayerEntity) => {
                    if (!entity) return;
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToEntity(entity);
                    player.camera.setOffset({ x: 8, y: 2, z: 0 }); // Side view like TV broadcast
                    player.camera.setZoom(2.0);
                }
            },
            {
                name: "Player View",
                setup: (player: Player, entity?: SoccerPlayerEntity | AIPlayerEntity) => {
                    if (!entity) return;
                    player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
                    player.camera.setAttachedToEntity(entity);
                    player.camera.setOffset({ x: 0, y: 0.6, z: 0 }); // Eye level
                    player.camera.setForwardOffset(0.1);
                    player.camera.setModelHiddenNodes(['head']); // Hide head to avoid view obstruction
                }
            },
            {
                name: "Aerial View",
                setup: (player: Player, entity?: SoccerPlayerEntity | AIPlayerEntity) => {
                    if (!entity) return;
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToEntity(entity);
                    player.camera.setOffset({ x: 0, y: 15, z: 0 }); // High above for tactical view
                    player.camera.setZoom(3.0);
                }
            },
            {
                name: "Ball Cam",
                setup: (player: Player) => {
                    const ball = sharedState.getSoccerBall();
                    if (!ball) return;
                    
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToEntity(ball);
                    player.camera.setOffset({ x: 0, y: 8, z: 12 }); // Follow ball from behind and above
                    player.camera.setZoom(2.5);
                }
            },
            {
                name: "Stadium View",
                setup: (player: Player) => {
                    // Position camera for stadium overview
                    const centerPosition = { x: AI_FIELD_CENTER_X, y: 25, z: AI_FIELD_CENTER_Z };
                    player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
                    player.camera.setAttachedToPosition(centerPosition);
                    
                    // Track the ball if available
                    const ball = sharedState.getSoccerBall();
                    if (ball) {
                        player.camera.setTrackedEntity(ball);
                    }
                    player.camera.setZoom(4.0);
                }
            }
        ];
    }

    public static getInstance(): SpectatorMode {
        if (!SpectatorMode.instance) {
            SpectatorMode.instance = new SpectatorMode();
        }
        return SpectatorMode.instance;
    }

    /**
     * Enable spectator mode
     */
    public enable(): void {
        this._isEnabled = true;
        console.log("🎥 Spectator mode enabled");
    }

    /**
     * Disable spectator mode
     */
    public disable(): void {
        this._isEnabled = false;
        this._spectators.clear();
        this._spectatorStates.clear();
        console.log("🎥 Spectator mode disabled");
    }

    /**
     * Check if spectator mode is enabled
     */
    public isEnabled(): boolean {
        return this._isEnabled;
    }

    /**
     * Add a player as a spectator
     * @param player The player to add as spectator
     */
    public addSpectator(player: Player): void {
        if (!this._isEnabled) {
            this.enable(); // Auto-enable when first spectator joins
        }

        this._spectators.set(player.username, player);
        
        // Initialize spectator state
        this._spectatorStates.set(player.username, {
            followingEntity: null,
            currentViewIndex: 0,
            currentCameraMode: 0,
            isFollowingBall: false
        });

        // Set up initial spectator view
        this.setupSpectatorView(player);
        
        // Send spectator controls to UI
        this.sendSpectatorControls(player);
        
        console.log(`🎥 ${player.username} joined as spectator`);
        
        if (player.world) {
            player.world.chatManager.sendPlayerMessage(
                player,
                "🎥 Welcome to Spectator Mode! Use arrow keys or /nextplayer, /nextcamera to change views."
            );
        }
    }

    /**
     * Remove a player from spectators
     * @param player The player to remove
     */
    public removeSpectator(player: Player): void {
        this._spectators.delete(player.username);
        this._spectatorStates.delete(player.username);
        
        console.log(`🎥 ${player.username} left spectator mode`);
    }

    /**
     * Check if a player is a spectator
     * @param player The player to check
     */
    public isSpectator(player: Player): boolean {
        return this._spectators.has(player.username);
    }

    /**
     * Get all active spectators
     */
    public getSpectators(): Player[] {
        return Array.from(this._spectators.values());
    }

    /**
     * Set up initial spectator view for a player
     * @param player The spectator player
     */
    private setupSpectatorView(player: Player): void {
        const state = this._spectatorStates.get(player.username);
        if (!state) return;

        // Get all active players (both human and AI)
        const allPlayers = this.getAllActivePlayers();
        
        if (allPlayers.length > 0) {
            // Start following the first player
            state.followingEntity = allPlayers[0];
            state.currentViewIndex = 0;
            state.currentCameraMode = 0;
            state.isFollowingBall = false;
            
            this.applyCameraMode(player);
        } else {
            // No players to follow, start with ball cam
            state.currentCameraMode = 4; // Ball cam
            state.isFollowingBall = true;
            this.applyCameraMode(player);
        }
    }

    /**
     * Get all active players (human and AI) that can be followed
     */
    private getAllActivePlayers(): (SoccerPlayerEntity | AIPlayerEntity)[] {
        const redTeam = sharedState.getRedAITeam();
        const blueTeam = sharedState.getBlueAITeam();
        
        // For now, focus on AI players. Human players can be added later if needed.
        // TODO: Add support for following human players in spectator mode
        const allPlayers = [
            ...redTeam.filter(ai => ai.isSpawned),
            ...blueTeam.filter(ai => ai.isSpawned)
        ];
        
        return allPlayers;
    }

    /**
     * Apply the current camera mode to the spectator
     * @param player The spectator player
     */
    private applyCameraMode(player: Player): void {
        const state = this._spectatorStates.get(player.username);
        if (!state) return;

        const mode = this._cameraModes[state.currentCameraMode];
        
        if (state.isFollowingBall || state.currentCameraMode === 4 || state.currentCameraMode === 5) {
            // Ball cam or stadium view
            mode.setup(player);
        } else if (state.followingEntity) {
            // Following a player
            mode.setup(player, state.followingEntity);
        }

        // Notify player about current view
        const targetName = state.isFollowingBall ? "Ball" : 
                          state.followingEntity?.player?.username || 
                          (state.followingEntity as AIPlayerEntity)?.team || "Unknown";
        
        if (player.world) {
            player.world.chatManager.sendPlayerMessage(
                player,
                `📺 ${mode.name} - Following: ${targetName}`
            );
        }
    }

    /**
     * Cycle to the next player/target for spectator
     * @param player The spectator player
     */
    public cycleNextTarget(player: Player): void {
        const state = this._spectatorStates.get(player.username);
        if (!state) return;

        const allPlayers = this.getAllActivePlayers();
        
        if (allPlayers.length === 0) {
            // No players, switch to ball cam
            state.isFollowingBall = true;
            state.currentCameraMode = 4; // Ball cam
            this.applyCameraMode(player);
            return;
        }

        if (state.isFollowingBall) {
            // Currently following ball, switch to first player
            state.isFollowingBall = false;
            state.currentViewIndex = 0;
            state.followingEntity = allPlayers[0];
            state.currentCameraMode = 0; // Follow Player mode
        } else {
            // Cycle to next player
            state.currentViewIndex = (state.currentViewIndex + 1) % (allPlayers.length + 1);
            
            if (state.currentViewIndex === allPlayers.length) {
                // Last index is ball cam
                state.isFollowingBall = true;
                state.currentCameraMode = 4; // Ball cam
            } else {
                state.followingEntity = allPlayers[state.currentViewIndex];
                state.isFollowingBall = false;
            }
        }
        
        this.applyCameraMode(player);
    }

    /**
     * Cycle to the next camera mode for spectator
     * @param player The spectator player
     */
    public cycleCameraMode(player: Player): void {
        const state = this._spectatorStates.get(player.username);
        if (!state) return;

        if (state.isFollowingBall) {
            // Cycling between ball-specific modes
            const ballModes = [4, 5]; // Ball cam, Stadium view
            const currentIndex = ballModes.indexOf(state.currentCameraMode);
            const nextIndex = (currentIndex + 1) % ballModes.length;
            state.currentCameraMode = ballModes[nextIndex];
        } else {
            // Cycling between player-following modes (0-3)
            state.currentCameraMode = (state.currentCameraMode + 1) % 4;
        }
        
        this.applyCameraMode(player);
    }

    /**
     * Send spectator controls to the UI
     * @param player The spectator player
     */
    private sendSpectatorControls(player: Player): void {
        player.ui.sendData({
            type: "spectator-mode",
            enabled: true,
            controls: {
                nextTarget: "Right Arrow / /nextplayer",
                prevTarget: "Left Arrow / /prevplayer", 
                nextCamera: "Up Arrow / /nextcamera",
                prevCamera: "Down Arrow / /prevcamera",
                ballCam: "/ballcam",
                stadiumView: "/stadium"
            }
        });
    }

    /**
     * Handle spectator joining (called when teams are full)
     * @param player The player joining as spectator
     * @param world The game world
     */
    public joinAsSpectator(player: Player, world: World): void {
        this.addSpectator(player);
        
        // Position spectator camera at a good starting position
        const spectatorPosition = { 
            x: AI_FIELD_CENTER_X, 
            y: SAFE_SPAWN_Y + 10, 
            z: AI_FIELD_CENTER_Z 
        };
        
        // Set initial camera
        player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
        player.camera.setAttachedToPosition(spectatorPosition);
        
        // Unlock pointer for UI interaction
        player.ui.lockPointer(false);
        
        world.chatManager.sendPlayerMessage(
            player,
            "🎥 Teams are full - you've joined as a spectator! Enjoy the match!"
        );
    }

    /**
     * Quick switch to ball camera
     * @param player The spectator player
     */
    public switchToBallCam(player: Player): void {
        const state = this._spectatorStates.get(player.username);
        if (!state) return;

        state.isFollowingBall = true;
        state.currentCameraMode = 4; // Ball cam
        this.applyCameraMode(player);
    }

    /**
     * Quick switch to stadium view
     * @param player The spectator player
     */
    public switchToStadiumView(player: Player): void {
        const state = this._spectatorStates.get(player.username);
        if (!state) return;

        state.isFollowingBall = true;
        state.currentCameraMode = 5; // Stadium view
        this.applyCameraMode(player);
    }

    /**
     * Update spectator cameras when game events happen
     */
    public updateSpectatorsForGameEvent(eventType: string, data?: any): void {
        for (const spectator of this._spectators.values()) {
            const state = this._spectatorStates.get(spectator.username);
            if (!state) continue;

            // Handle different game events
            switch (eventType) {
                case "goal-scored":
                    // Auto-switch to ball cam for goal celebrations
                    this.switchToBallCam(spectator);
                    break;
                case "half-end":
                    // Switch to stadium view during breaks
                    this.switchToStadiumView(spectator);
                    break;
                case "game-start":
                    // Ensure spectators have good starting view
                    this.setupSpectatorView(spectator);
                    break;
            }
        }
    }

    /**
     * Alias for cycleNextTarget - used by UI event handlers
     */
    public nextPlayer(player: Player): void {
        this.cycleNextTarget(player);
    }

    /**
     * Alias for cycleCameraMode - used by UI event handlers
     */
    public nextCameraMode(player: Player): void {
        this.cycleCameraMode(player);
    }
}

export default SpectatorMode.getInstance(); 