// Large Stadium Configuration (Now the only configuration)
export const GAME_CONFIG = {
  // Mathematical center: X = (-37 + 52) / 2 = 7.5, Z = (-33 + 26) / 2 = -3.5
  // Using X = 7, Y = 6, Z = -3 for positioning (elevated well above ground to prevent surface collision)
  BALL_SPAWN_POSITION: { x: 7, y: 6, z: -3 },
  
  // Safe Y coordinate for all entity spawning to prevent surface collision
  SAFE_SPAWN_Y: 2,
  
  // Field Boundary Dimensions
  FIELD_MIN_X: -37,
  FIELD_MAX_X: 52,
  FIELD_MIN_Y: 0,
  FIELD_MAX_Y: 15,
  FIELD_MIN_Z: -33,
  FIELD_MAX_Z: 26,
  
  // AI Positioning Constants
  AI_GOAL_LINE_X_RED: -37, // Red Goal line
  AI_GOAL_LINE_X_BLUE: 52,  // Blue Goal line
  AI_FIELD_CENTER_X: 7,    // Center point X coordinate
  AI_FIELD_CENTER_Z: -3,   // Center point Z coordinate
  AI_DEFENSIVE_OFFSET_X: 12, // X-offset from own goal line for defenders
  AI_MIDFIELD_OFFSET_X: 34, // X-offset from own goal line for midfielders
  AI_FORWARD_OFFSET_X: 43, // X-offset from own goal line for forwards
  AI_WIDE_Z_BOUNDARY_MAX: 26, // Max Z for wide players
  AI_WIDE_Z_BOUNDARY_MIN: -33, // Min Z for wide players
  AI_MIDFIELD_Z_BOUNDARY_MAX: 20, // Max Z for midfielders
  AI_MIDFIELD_Z_BOUNDARY_MIN: -27, // Min Z for midfielders
  
  // Team setup
  MAX_PLAYERS_PER_TEAM: 6,
  MIN_PLAYERS_PER_TEAM: 1,
  
  // Map file
  MAP_FILE: "soccer.json"
};

// Simple getter for the single configuration
export const getGameConfig = () => GAME_CONFIG;

// Direct exports for easy access (no more dynamic switching)
export const BALL_SPAWN_POSITION = GAME_CONFIG.BALL_SPAWN_POSITION;
export const SAFE_SPAWN_Y = GAME_CONFIG.SAFE_SPAWN_Y;
export const FIELD_MIN_X = GAME_CONFIG.FIELD_MIN_X;
export const FIELD_MAX_X = GAME_CONFIG.FIELD_MAX_X;
export const FIELD_MIN_Y = GAME_CONFIG.FIELD_MIN_Y;
export const FIELD_MAX_Y = GAME_CONFIG.FIELD_MAX_Y;
export const FIELD_MIN_Z = GAME_CONFIG.FIELD_MIN_Z;
export const FIELD_MAX_Z = GAME_CONFIG.FIELD_MAX_Z;
export const AI_GOAL_LINE_X_RED = GAME_CONFIG.AI_GOAL_LINE_X_RED;
export const AI_GOAL_LINE_X_BLUE = GAME_CONFIG.AI_GOAL_LINE_X_BLUE;
export const AI_FIELD_CENTER_X = GAME_CONFIG.AI_FIELD_CENTER_X;
export const AI_FIELD_CENTER_Z = GAME_CONFIG.AI_FIELD_CENTER_Z;
export const AI_DEFENSIVE_OFFSET_X = GAME_CONFIG.AI_DEFENSIVE_OFFSET_X;
export const AI_MIDFIELD_OFFSET_X = GAME_CONFIG.AI_MIDFIELD_OFFSET_X;
export const AI_FORWARD_OFFSET_X = GAME_CONFIG.AI_FORWARD_OFFSET_X;
export const AI_WIDE_Z_BOUNDARY_MAX = GAME_CONFIG.AI_WIDE_Z_BOUNDARY_MAX;
export const AI_WIDE_Z_BOUNDARY_MIN = GAME_CONFIG.AI_WIDE_Z_BOUNDARY_MIN;
export const AI_MIDFIELD_Z_BOUNDARY_MAX = GAME_CONFIG.AI_MIDFIELD_Z_BOUNDARY_MAX;
export const AI_MIDFIELD_Z_BOUNDARY_MIN = GAME_CONFIG.AI_MIDFIELD_Z_BOUNDARY_MIN;
export const MAX_PLAYERS_PER_TEAM = GAME_CONFIG.MAX_PLAYERS_PER_TEAM;

// Game timing configuration - Updated to 2 halves system
export const HALF_DURATION = 5 * 60; // 5 minutes per half in seconds
export const TOTAL_HALVES = 2; // First half and second half
export const MATCH_DURATION = TOTAL_HALVES * HALF_DURATION; // 10 minutes total
export const HALFTIME_DURATION = 2 * 60; // 2 minutes halftime break

export const PASS_FORCE = 3.5;

export const STUN_DURATION = 1.5 * 1000;
export const TACKLE_KNOCKBACK_FORCE = 12;

export const BALL_CONFIG = {
  // Ball properties
  SCALE: 0.2,
  RADIUS: 0.2,
  FRICTION: 0.4, // Increased from 0.3 to slow down ball movement more

  // Movement damping - increase to slow the ball down faster
  LINEAR_DAMPING: 0.7, // Reduced from 0.8 for better crossbar bouncing
  ANGULAR_DAMPING: 3.0, // Reduced from 3.5 for more natural ball rotation

  // ENHANCED: Impact forces for realistic crossbar bouncing
  HORIZONTAL_FORCE: 0.4, // Increased from 0.3 for better bounce response
  VERTICAL_FORCE: 0.6, // Increased from 0.5 for better upward bounce off crossbar
  UPWARD_BIAS: 0.2, // Increased from 0.15 for more realistic ball trajectory
};

export const ABILITY_RESPAWN_TIME = 8 * 1000; // Reduced from 15s to 8s for faster testing

// Ability pickup positions for large stadium - ENHANCED for better visibility and spacing
export const ABILITY_PICKUP_POSITIONS = [
  { x: AI_FIELD_CENTER_X - 15, y: SAFE_SPAWN_Y + 0.5, z: AI_FIELD_CENTER_Z },      // Left center
  { x: AI_FIELD_CENTER_X + 15, y: SAFE_SPAWN_Y + 0.5, z: AI_FIELD_CENTER_Z },      // Right center  
  { x: AI_FIELD_CENTER_X - 15, y: SAFE_SPAWN_Y + 0.5, z: AI_FIELD_CENTER_Z + 12 }, // Left top
  { x: AI_FIELD_CENTER_X + 15, y: SAFE_SPAWN_Y + 0.5, z: AI_FIELD_CENTER_Z + 12 }, // Right top
  { x: AI_FIELD_CENTER_X - 15, y: SAFE_SPAWN_Y + 0.5, z: AI_FIELD_CENTER_Z - 12 }, // Left bottom
  { x: AI_FIELD_CENTER_X + 15, y: SAFE_SPAWN_Y + 0.5, z: AI_FIELD_CENTER_Z - 12 }, // Right bottom
];
