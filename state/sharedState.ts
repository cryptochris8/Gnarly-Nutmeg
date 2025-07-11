import { PlayerEntity, Entity } from "hytopia";
import AIPlayerEntity from "../entities/AIPlayerEntity";

type AISystem = 'agent' | 'behaviortree';

// Forward declaration to avoid circular imports
interface GameState {
    isHalftime: boolean;
    status: string;
    // Add other properties as needed
}

// Ball stationary detection system to prevent balls sitting idle
interface BallStationaryTracker {
    lastPosition: { x: number; y: number; z: number } | null;
    lastMoveTime: number;
    isStationary: boolean;
    stationaryDuration: number;
}

class SharedState {
    private static instance: SharedState;
    private attachedPlayer: PlayerEntity | null = null;
    private soccerBall: Entity | null = null;
    private lastPlayerWithBall: PlayerEntity | null = null;
    private activePlayer: PlayerEntity | null = null;
    private redAITeam: AIPlayerEntity[] = [];
    private blueAITeam: AIPlayerEntity[] = [];
    private ballHasMovedFromSpawn: boolean = false;
    private _aiSystem: AISystem = 'agent'; // Default to agent
    private gameState: GameState | null = null; // Reference to current game state
    
    // Ball stationary detection system
    private ballStationaryTracker: BallStationaryTracker = {
        lastPosition: null,
        lastMoveTime: Date.now(),
        isStationary: false,
        stationaryDuration: 0
    };
    
    // Configuration for stationary ball detection
    private readonly STATIONARY_THRESHOLD = 1.0; // Ball must move less than 1 unit to be considered stationary
    private readonly STATIONARY_TIME_LIMIT = 5000; // 5 seconds before ball is considered idle
    private readonly STATIONARY_CHECK_INTERVAL = 1000; // Check every 1 second

    private constructor() {}

    public static getInstance(): SharedState {
        if (!SharedState.instance) {
            SharedState.instance = new SharedState();
        }
        return SharedState.instance;
    }

    public setAttachedPlayer(player: PlayerEntity | null) {
        if(player == null) {
            // Clear ball possession for previous player
            if (this.attachedPlayer && 'setBallPossession' in this.attachedPlayer) {
                (this.attachedPlayer as any).setBallPossession(false);
            }
            
            this.lastPlayerWithBall = this.attachedPlayer;
            this.attachedPlayer = null;
            
            // Reset ball stationary tracking when ball becomes loose
            // This ensures fresh tracking when ball is released
            this.resetBallStationaryStatus();
            
            // this.soccerBall?.setParent(undefined);
        } else {
            // Set ball possession for new player
            if ('setBallPossession' in player) {
                (player as any).setBallPossession(true);
            }
            
            // Clear possession for previous player if different
            if (this.attachedPlayer && this.attachedPlayer !== player && 'setBallPossession' in this.attachedPlayer) {
                (this.attachedPlayer as any).setBallPossession(false);
            }
            
            this.attachedPlayer = player;
            if(this.lastPlayerWithBall == null) {
                this.lastPlayerWithBall = player;
            }
            
            // Reset ball stationary tracking when ball is picked up
            // This prevents false positives when player has control
            this.resetBallStationaryStatus();
        }
    }

    public getAttachedPlayer(): PlayerEntity | null {
        return this.attachedPlayer;
    }

    public setSoccerBall(ball: Entity) {
        this.soccerBall = ball;
    }

    public getSoccerBall(): Entity | null {
        return this.soccerBall;
    }

    public getLastPlayerWithBall(): PlayerEntity | null {
        return this.lastPlayerWithBall;
    }
    
    public setActivePlayer(player: PlayerEntity | null) {
        this.activePlayer = player;
    }
    
    public getActivePlayer(): PlayerEntity | null {
        return this.activePlayer;
    }

    public addAIToTeam(aiPlayer: AIPlayerEntity, team: 'red' | 'blue') {
        if (team === 'red') {
            if (!this.redAITeam.includes(aiPlayer)) {
                this.redAITeam.push(aiPlayer);
            }
        } else {
            if (!this.blueAITeam.includes(aiPlayer)) {
                this.blueAITeam.push(aiPlayer);
            }
        }
    }

    public removeAIFromTeam(aiPlayer: AIPlayerEntity, team: 'red' | 'blue') {
        if (team === 'red') {
            this.redAITeam = this.redAITeam.filter(p => p !== aiPlayer);
        } else {
            this.blueAITeam = this.blueAITeam.filter(p => p !== aiPlayer);
        }
    }

    public getRedAITeam(): AIPlayerEntity[] {
        return this.redAITeam;
    }

    public getBlueAITeam(): AIPlayerEntity[] {
        return this.blueAITeam;
    }

    public getAITeammates(player: AIPlayerEntity): AIPlayerEntity[] {
        const teamList = player.team === 'red' ? this.redAITeam : this.blueAITeam;
        return teamList.filter(p => p !== player);
    }

    // --- Ball Movement Tracking ---
    public setBallHasMoved() {
        if (!this.ballHasMovedFromSpawn) {
            console.log("Ball has moved from spawn for the first time.");
            this.ballHasMovedFromSpawn = true;
        }
    }

    public getBallHasMoved(): boolean {
        return this.ballHasMovedFromSpawn;
    }

    public resetBallMovementFlag() {
        console.log("Resetting ball movement flag.");
        this.ballHasMovedFromSpawn = false;
    }
    // --- End Ball Movement Tracking ---

    // --- AI System Management ---
    public setAISystem(system: AISystem) {
        this._aiSystem = system;
        console.log(`AI system set to: ${system}`);
    }

    public getAISystem(): AISystem {
        return this._aiSystem;
    }
    // --- End AI System Management ---

    // --- Game State Management ---
    public setGameState(gameState: GameState | null) {
        this.gameState = gameState;
    }

    public getGameState(): GameState | null {
        return this.gameState;
    }
    // --- End Game State Management ---

    // --- Ball Stationary Detection System ---
    /**
     * Update ball stationary tracking - call this regularly during gameplay
     * @param ballPosition Current position of the ball
     */
    public updateBallStationaryStatus(ballPosition: { x: number; y: number; z: number }): void {
        const currentTime = Date.now();
        
        // Skip tracking if ball is possessed by a player
        if (this.attachedPlayer !== null) {
            this.resetBallStationaryStatus();
            return;
        }
        
        // Skip tracking during halftime or non-playing states
        const gameState = this.getGameState();
        if (gameState && (gameState.isHalftime || gameState.status !== 'playing')) {
            this.resetBallStationaryStatus();
            return;
        }
        
        if (this.ballStationaryTracker.lastPosition === null) {
            // First time tracking this ball position
            this.ballStationaryTracker.lastPosition = { ...ballPosition };
            this.ballStationaryTracker.lastMoveTime = currentTime;
            this.ballStationaryTracker.isStationary = false;
            this.ballStationaryTracker.stationaryDuration = 0;
            return;
        }
        
        // Calculate distance moved since last check
        const lastPos = this.ballStationaryTracker.lastPosition;
        const distanceMoved = Math.sqrt(
            Math.pow(ballPosition.x - lastPos.x, 2) +
            Math.pow(ballPosition.y - lastPos.y, 2) +
            Math.pow(ballPosition.z - lastPos.z, 2)
        );
        
        // Check if ball has moved significantly
        if (distanceMoved > this.STATIONARY_THRESHOLD) {
            // Ball has moved - reset stationary tracking
            this.ballStationaryTracker.lastPosition = { ...ballPosition };
            this.ballStationaryTracker.lastMoveTime = currentTime;
            this.ballStationaryTracker.isStationary = false;
            this.ballStationaryTracker.stationaryDuration = 0;
        } else {
            // Ball hasn't moved much - update stationary duration
            this.ballStationaryTracker.stationaryDuration = currentTime - this.ballStationaryTracker.lastMoveTime;
            
            // Check if ball has been stationary long enough to be considered idle
            if (this.ballStationaryTracker.stationaryDuration >= this.STATIONARY_TIME_LIMIT) {
                if (!this.ballStationaryTracker.isStationary) {
                    this.ballStationaryTracker.isStationary = true;
                    console.log(`⚠️  Ball detected as stationary for ${this.ballStationaryTracker.stationaryDuration}ms at position (${ballPosition.x.toFixed(1)}, ${ballPosition.z.toFixed(1)}) - AI should retrieve it`);
                }
            }
        }
    }
    
    /**
     * Check if the ball is currently stationary and needs to be retrieved
     * @returns True if ball is stationary and should be pursued aggressively
     */
    public isBallStationary(): boolean {
        return this.ballStationaryTracker.isStationary;
    }
    
    /**
     * Get how long the ball has been stationary (in milliseconds)
     * @returns Duration in milliseconds, or 0 if ball is not stationary
     */
    public getBallStationaryDuration(): number {
        return this.ballStationaryTracker.stationaryDuration;
    }
    
    /**
     * Reset ball stationary tracking (call when ball is picked up or game state changes)
     */
    public resetBallStationaryStatus(): void {
        this.ballStationaryTracker.lastPosition = null;
        this.ballStationaryTracker.lastMoveTime = Date.now();
        this.ballStationaryTracker.isStationary = false;
        this.ballStationaryTracker.stationaryDuration = 0;
    }
    
    /**
     * Get ball position for stationary tracking purposes
     * @returns Current tracked ball position or null if not being tracked
     */
    public getTrackedBallPosition(): { x: number; y: number; z: number } | null {
        return this.ballStationaryTracker.lastPosition;
    }
    // --- End Ball Stationary Detection System ---
}

export default SharedState.getInstance(); 