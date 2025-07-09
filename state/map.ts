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
    // FIXED: Realistic soccer goal dimensions
    // Standard soccer goal: 8 yards (24 feet) wide x 8 feet (2.4m) high
    // In Minecraft blocks: ~8-10 blocks wide x 3-4 blocks high
    const GOAL_WIDTH = 10; // Realistic goal width (5 blocks each side of center)
    const GOAL_HEIGHT_MIN = 0; // Ground level (no below-ground goals)
    const GOAL_HEIGHT_MAX = 4; // Realistic goal height (4 blocks high)
    
    return [
      {
        // Red Goal (Defended by Red Team) - Located at FIELD_MIN_X (X = -37)
        // When ball enters here, Blue team scores
        x: { min: GAME_CONFIG.AI_GOAL_LINE_X_RED - 3, max: GAME_CONFIG.AI_GOAL_LINE_X_RED + 1 }, // 4 blocks deep
        z: { min: GAME_CONFIG.AI_FIELD_CENTER_Z - GOAL_WIDTH/2, max: GAME_CONFIG.AI_FIELD_CENTER_Z + GOAL_WIDTH/2 }, // 10 blocks wide
        y: { min: GOAL_HEIGHT_MIN, max: GOAL_HEIGHT_MAX }, // Ground level to 4 blocks high
        team: 'blue' // Blue team scores when ball enters Red's goal
      },
      {
        // Blue Goal (Defended by Blue Team) - Located at FIELD_MAX_X (X = 52)  
        // When ball enters here, Red team scores
        x: { min: GAME_CONFIG.AI_GOAL_LINE_X_BLUE - 1, max: GAME_CONFIG.AI_GOAL_LINE_X_BLUE + 3 }, // 4 blocks deep
        z: { min: GAME_CONFIG.AI_FIELD_CENTER_Z - GOAL_WIDTH/2, max: GAME_CONFIG.AI_FIELD_CENTER_Z + GOAL_WIDTH/2 }, // 10 blocks wide  
        y: { min: GOAL_HEIGHT_MIN, max: GOAL_HEIGHT_MAX }, // Ground level to 4 blocks high
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
    
    // ENHANCED: Additional validation to prevent false goals
    // Check if ball is clearly above field level (no goals from underground)
    if (position.y < 0) {
      console.log(`❌ Goal detection REJECTED: Ball below ground level at Y=${position.y.toFixed(2)}`);
      return null;
    }
    
    // Check if ball is reasonably close to goal area (prevent long-distance false positives)
    const isNearRedGoal = Math.abs(position.x - GAME_CONFIG.AI_GOAL_LINE_X_RED) < 10;
    const isNearBlueGoal = Math.abs(position.x - GAME_CONFIG.AI_GOAL_LINE_X_BLUE) < 10;
    
    if (!isNearRedGoal && !isNearBlueGoal) {
      // Ball is too far from any goal to be a valid goal
      return null;
    }
    
    // Check goals with enhanced logging
    for (const goal of goals) {
      if (this.isPositionInBounds(position, goal)) {
        const scoringTeam = goal.team;
        const defendingTeam = goal.team === 'red' ? 'Blue' : 'Red';
        
        // ENHANCED: Detailed goal validation logging
        console.log(`✅ VALID GOAL DETECTED!`);
        console.log(`   Ball Position: X=${position.x.toFixed(2)}, Y=${position.y.toFixed(2)}, Z=${position.z.toFixed(2)}`);
        console.log(`   Goal Bounds: X[${goal.x.min} to ${goal.x.max}], Y[${goal.y.min} to ${goal.y.max}], Z[${goal.z.min} to ${goal.z.max}]`);
        console.log(`   ${defendingTeam} goal entered - ${scoringTeam.toUpperCase()} TEAM SCORES!`);
        
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
