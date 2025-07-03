import { PlayerEntity, Entity } from "hytopia";
import AIPlayerEntity from "../entities/AIPlayerEntity";

type AISystem = 'agent' | 'behaviortree';

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
}

export default SharedState.getInstance(); 