export interface Goal {
  x: { min: number; max: number };
  z: { min: number; max: number };
  y: { min: number; max: number };
  team: 'red' | 'blue';
}

export interface Boundary {
  x: { min: number; max: number };
  z: { min: number; max: number };
  y: { min: number; max: number };
}

// New interface for detailed boundary information
export interface BoundaryInfo {
  isOutOfBounds: boolean;
  boundaryType?: 'sideline' | 'goal-line';
  side?: 'min-x' | 'max-x' | 'min-z' | 'max-z';
  position?: { x: number; y: number; z: number };
}

// Import field boundaries from gameConfig
import {
  GAME_CONFIG,
  FIELD_MIN_X,
  FIELD_MAX_X,
  FIELD_MIN_Y,
  FIELD_MAX_Y,
  FIELD_MIN_Z,
  FIELD_MAX_Z,
  AI_FIELD_CENTER_Z,
} from "./gameConfig";

export class SoccerMap {
  private getGoals(): Goal[] {
    // Large stadium goals only
    return [
      {
        // Red Goal (Defended by Red Team) - Located at FIELD_MIN_X (X = -37)
        // When ball enters here, Blue team scores
        x: { min: GAME_CONFIG.AI_GOAL_LINE_X_RED - 5, max: GAME_CONFIG.AI_GOAL_LINE_X_RED + 3 },
        z: { min: GAME_CONFIG.AI_FIELD_CENTER_Z - 20, max: GAME_CONFIG.AI_FIELD_CENTER_Z + 20 }, // Wider goal area
        y: { min: -1, max: 6 }, // Allow for slight ground variations
        team: 'blue' // Blue team scores when ball enters Red's goal
      },
      {
        // Blue Goal (Defended by Blue Team) - Located at FIELD_MAX_X (X = 52)
        // When ball enters here, Red team scores
        x: { min: GAME_CONFIG.AI_GOAL_LINE_X_BLUE - 3, max: GAME_CONFIG.AI_GOAL_LINE_X_BLUE + 5 },
        z: { min: GAME_CONFIG.AI_FIELD_CENTER_Z - 20, max: GAME_CONFIG.AI_FIELD_CENTER_Z + 20 }, // Wider goal area
        y: { min: -1, max: 6 }, // Allow for slight ground variations
        team: 'red' // Red team scores when ball enters Blue's goal
      }
    ];
  }

  private getBoundary(): Boundary {
    return {
      x: { min: GAME_CONFIG.FIELD_MIN_X, max: GAME_CONFIG.FIELD_MAX_X },
      z: { min: GAME_CONFIG.FIELD_MIN_Z, max: GAME_CONFIG.FIELD_MAX_Z },
      y: { min: GAME_CONFIG.FIELD_MIN_Y, max: GAME_CONFIG.FIELD_MAX_Y }
    };
  }

  public checkGoal(position: { x: number; y: number; z: number }): Goal | null {
    const goals = this.getGoals();
    
    // Check goals without logging every check
    for (const goal of goals) {
      if (this.isPositionInBounds(position, goal)) {
        const scoringTeam = goal.team;
        const defendingTeam = goal.team === 'red' ? 'Blue' : 'Red';
        console.log(`GOAL DETECTED! Ball entered ${defendingTeam} goal at X=${position.x.toFixed(2)}, Z=${position.z.toFixed(2)}`);
        console.log(`${scoringTeam.toUpperCase()} TEAM SCORES!`);
        return goal;
      }
    }
    return null;
  }

  /**
   * Check for detailed boundary information to determine restart type
   * @param position - Ball position to check
   * @returns BoundaryInfo with details about which boundary was crossed
   */
  public checkBoundaryDetails(position: { x: number; y: number; z: number }): BoundaryInfo {
    const boundary = this.getBoundary();
    
    // Skip boundary check if position is clearly below the field - likely a physics issue
    if (position.y < boundary.y.min - 1) {
      console.log(`Position below field at Y=${position.y}, ignoring boundary check`);
      return { isOutOfBounds: false };
    }

    // Check if ball is in goal area first (goals are not out of bounds)
    if (this.checkGoal(position)) {
      return { isOutOfBounds: false };
    }

    // Check side boundaries (Z-axis boundaries for throw-ins)
    if (position.z < boundary.z.min) {
      console.log(`Ball crossed MIN-Z sideline at position:`, position);
      return {
        isOutOfBounds: true,
        boundaryType: 'sideline',
        side: 'min-z',
        position: { ...position }
      };
    }
    
    if (position.z > boundary.z.max) {
      console.log(`Ball crossed MAX-Z sideline at position:`, position);
      return {
        isOutOfBounds: true,
        boundaryType: 'sideline', 
        side: 'max-z',
        position: { ...position }
      };
    }

    // Check goal line boundaries (X-axis boundaries for corner kicks/goal kicks)
    if (position.x < boundary.x.min) {
      console.log(`Ball crossed MIN-X goal line at position:`, position);
      return {
        isOutOfBounds: true,
        boundaryType: 'goal-line',
        side: 'min-x',
        position: { ...position }
      };
    }
    
    if (position.x > boundary.x.max) {
      console.log(`Ball crossed MAX-X goal line at position:`, position);
      return {
        isOutOfBounds: true,
        boundaryType: 'goal-line',
        side: 'max-x', 
        position: { ...position }
      };
    }

    // Check vertical boundaries (unlikely but possible)
    if (position.y > boundary.y.max) {
      console.log(`Ball went too high at position:`, position);
      return {
        isOutOfBounds: true,
        boundaryType: 'sideline', // Treat as general out of bounds
        side: 'max-y' as any,
        position: { ...position }
      };
    }

    // Ball is within all boundaries
    return { isOutOfBounds: false };
  }

  public isOutOfBounds(position: { x: number; y: number; z: number }): boolean {
    // Use the new detailed boundary check but only return the boolean result
    return this.checkBoundaryDetails(position).isOutOfBounds;
  }

  private isPositionInBounds(
    position: { x: number; y: number; z: number },
    bounds: { x: { min: number; max: number }; y: { min: number; max: number }; z: { min: number; max: number } }
  ): boolean {
    return (
      position.x >= bounds.x.min &&
      position.x <= bounds.x.max &&
      position.y >= bounds.y.min &&
      position.y <= bounds.y.max &&
      position.z >= bounds.z.min &&
      position.z <= bounds.z.max
    );
  }

  public getSpawnPosition(team: 'red' | 'blue'): { x: number; y: number; z: number } {
    // Large stadium spawn positions only
    return {
      x: GAME_CONFIG.AI_FIELD_CENTER_X, // Center X (7)
      y: GAME_CONFIG.SAFE_SPAWN_Y,      // Safe Y (2)
      z: team === 'red' ? GAME_CONFIG.AI_FIELD_CENTER_Z + 8 : GAME_CONFIG.AI_FIELD_CENTER_Z - 8  // Spread teams apart
    };
  }
}

export const soccerMap = new SoccerMap();
