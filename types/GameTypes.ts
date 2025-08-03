/**
 * Comprehensive Type Definitions for Hytopia Soccer Game
 * 
 * Eliminates 'any' types and provides strong typing throughout the application.
 * Improves IDE support, reduces runtime errors, and enhances maintainability.
 */

import type { Vector3Like, Entity, World, Player } from 'hytopia';

// ========== PLAYER & GAME STATE TYPES ==========

export interface PlayerStats {
  id: string;
  username: string;
  goals: number;
  assists: number;
  saves: number;
  tackles: number;
  passes: number;
  shots: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  matchTime: number;
  distance: number;
  topSpeed: number;
  ballTouches: number;
  possession: number;
  stamina: number;
  position: Vector3Like;
  team?: 'team1' | 'team2';
  role?: SoccerRole;
}

export interface PlayerUIStats {
  id: string;
  name: string;
  goals: number;
  assists: number;
  saves: number;
  team: 'team1' | 'team2' | 'spectator';
  isActive: boolean;
  stamina: number;
  role: string;
}

export interface TeamStats {
  name: string;
  score: number;
  players: PlayerStats[];
  possession: number;
  shots: number;
  corners: number;
  fouls: number;
  cards: { yellow: number; red: number };
}

export interface GameState {
  mode: GameMode;
  isActive: boolean;
  isPaused: boolean;
  currentHalf: number;
  totalHalves: number;
  timeRemaining: number;
  isHalftime: boolean;
  score: { team1: number; team2: number };
  teamStats: { team1: TeamStats; team2: TeamStats };
  lastEvent?: GameEvent;
}

// ========== GAME MODES & CONFIGURATION ==========

export type GameMode = 'fifa' | 'arcade' | 'tournament';

export interface GameModeConfig {
  realisticPhysics: boolean;
  enhancedAbilities: boolean;
  aiEnabled: boolean;
  powerUpsEnabled: boolean;
  tournamentMode: boolean;
  ballPhysics: BallPhysicsConfig;
  audioConfig: AudioConfig;
}

export interface BallPhysicsConfig {
  scale: number;
  radius: number;
  friction: number;
  linearDamping: number;
  angularDamping: number;
  horizontalForce: number;
  verticalForce: number;
  upwardBias: number;
  gravityScale?: number;
}

export interface AudioConfig {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  crowdVolume: number;
  commentaryEnabled: boolean;
  crowdReactionsEnabled: boolean;
}

// ========== AI SYSTEM TYPES ==========

export type SoccerRole = 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'winger' | 'striker';

export interface AIDecision {
  action: AIAction;
  target?: Vector3Like | Entity;
  priority: number;
  reasoning: string;
  timestamp: number;
}

export type AIAction = 
  | 'move_to_ball'
  | 'move_to_position'
  | 'pass_ball'
  | 'shoot_ball'
  | 'defend_goal'
  | 'intercept'
  | 'support_attack'
  | 'mark_player'
  | 'clear_ball'
  | 'idle';

export interface AIBehaviorNode {
  id: string;
  type: 'condition' | 'action' | 'composite';
  priority: number;
  execute(context: AIContext): AINodeResult;
}

export interface AIContext {
  player: SoccerPlayerEntity;
  ball: Entity;
  teammates: SoccerPlayerEntity[];
  opponents: SoccerPlayerEntity[];
  gameState: GameState;
  deltaTime: number;
}

export type AINodeResult = 'success' | 'failure' | 'running';

// ========== ABILITY & POWER-UP TYPES ==========

export interface AbilityOptions {
  name: string;
  icon: string;
  description: string;
  cooldown: number;
  duration: number;
  range: number;
  damage?: number;
  speed?: number;
  modelUri: string;
  modelScale: number;
}

export interface PowerUpEffect {
  type: PowerUpType;
  target: Entity;
  strength: number;
  duration: number;
  startTime: number;
  isActive: boolean;
}

export type PowerUpType = 
  | 'speed_boost'
  | 'power_boost'
  | 'precision'
  | 'stamina'
  | 'shield'
  | 'mega_kick'
  | 'time_slow'
  | 'ball_magnet'
  | 'crystal_barrier'
  | 'elemental_mastery'
  | 'tidal_wave'
  | 'reality_warp'
  | 'honey_trap'
  | 'freeze_blast'
  | 'fireball'
  | 'shuriken';

// ========== EVENT SYSTEM TYPES ==========

export interface GameEvent {
  id: string;
  type: GameEventType;
  timestamp: number;
  players: string[];
  position?: Vector3Like;
  data?: Record<string, unknown>;
}

export type GameEventType =
  | 'goal'
  | 'assist'
  | 'save'
  | 'tackle'
  | 'foul'
  | 'card'
  | 'substitution'
  | 'kickoff'
  | 'halftime'
  | 'fulltime'
  | 'power_up_activated'
  | 'player_joined'
  | 'player_left';

// ========== TOURNAMENT SYSTEM TYPES ==========

export interface TournamentConfig {
  name: string;
  maxPlayers: number;
  matchDuration: number;
  eliminationRounds: boolean;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
}

export interface TournamentMatch {
  id: string;
  round: number;
  team1: string[];
  team2: string[];
  score: { team1: number; team2: number };
  status: 'pending' | 'active' | 'completed';
  startTime?: number;
  endTime?: number;
  stats: MatchStats;
}

export interface MatchStats {
  possession: { team1: number; team2: number };
  shots: { team1: number; team2: number };
  corners: { team1: number; team2: number };
  fouls: { team1: number; team2: number };
  cards: { 
    team1: { yellow: number; red: number }; 
    team2: { yellow: number; red: number };
  };
  playerStats: Record<string, PlayerStats>;
}

// ========== PERFORMANCE MONITORING TYPES ==========

export interface PerformanceMetrics {
  frameTime: number;
  aiDecisionTime: number;
  physicsTime: number;
  renderTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  entityCount: number;
  playerCount: number;
  activePowerUps: number;
}

export interface PerformanceTarget {
  targetFrameTime: number;
  maxAIDecisionTime: number;
  maxPhysicsTime: number;
  maxMemoryUsage: number;
  maxEntityCount: number;
}

export type OptimizationLevel = 'HIGH_PERFORMANCE' | 'BALANCED' | 'HIGH_QUALITY' | 'MOBILE';

// ========== AUDIO SYSTEM TYPES ==========

export interface AudioTrack {
  uri: string;
  volume: number;
  loop: boolean;
  category: AudioCategory;
}

export type AudioCategory = 'music' | 'sfx' | 'crowd' | 'commentary' | 'ui';

export interface CrowdReaction {
  trigger: 'goal' | 'near_miss' | 'save' | 'foul' | 'card';
  intensity: 'low' | 'medium' | 'high';
  duration: number;
  audioTracks: string[];
}

// ========== ENTITY EXTENSIONS ==========

export interface SoccerPlayerEntity extends Entity {
  player: Player;
  stats: PlayerStats;
  role: SoccerRole;
  team: 'team1' | 'team2';
  isAI: boolean;
  aiAgent?: SoccerAIAgent;
  abilityHolder: AbilityHolder;
  customProperties: Map<string, unknown>;
  
  // Methods
  restoreStamina(): void;
  applyPowerUp(powerUp: PowerUpEffect): void;
  removePowerUp(type: PowerUpType): void;
}

export interface AbilityHolder {
  currentAbility?: Ability;
  cooldowns: Map<string, number>;
  
  setAbility(ability: Ability): void;
  removeAbility(): void;
  canUseAbility(): boolean;
  showAbilityUI(player: Player): void;
  hideAbilityUI(player: Player): void;
}

export interface Ability {
  getIcon(): string;
  use(origin: Vector3Like, direction: Vector3Like, source: Entity): void;
  canActivate?(): boolean;
}

export interface SoccerAIAgent {
  role: SoccerRole;
  decisionHistory: AIDecision[];
  behaviorTree: AIBehaviorNode;
  
  makeDecision(context: AIContext): AIDecision;
  executeDecision(decision: AIDecision): void;
}

// ========== WORLD EXTENSIONS ==========

export interface SoccerWorld extends World {
  ball: Entity;
  goals: Entity[];
  players: SoccerPlayerEntity[];
  gameState: GameState;
  arcadeManager?: ArcadeEnhancementManager;
  pickupManager?: PickupGameManager;
  tournamentManager?: TournamentManager;
  performanceProfiler?: PerformanceProfiler;
}

export interface ArcadeEnhancementManager {
  activatePowerUp(playerId: string, powerUpType: string): boolean;
  getPlayerMultiplier(playerId: string, stat: string): number;
  cleanup(): void;
}

export interface PickupGameManager {
  spawnPowerUp(position: Vector3Like): void;
  cleanup(): void;
}

export interface TournamentManager {
  startTournament(config: TournamentConfig): void;
  getCurrentMatch(): TournamentMatch | null;
  updateMatchScore(matchId: string, team1Score: number, team2Score: number): void;
  endMatch(matchId: string): void;
}

export interface PerformanceProfiler {
  startProfiling(): void;
  stopProfiling(): void;
  getMetrics(): PerformanceMetrics;
  setOptimizationLevel(level: OptimizationLevel): void;
}

// ========== UTILITY TYPES ==========

export interface TimedCallback {
  callback: () => void;
  delay: number;
  context?: string;
}

export interface ConfigurationError {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: string[];
}

// ========== TYPE GUARDS ==========

export function isSoccerPlayerEntity(entity: Entity): entity is SoccerPlayerEntity {
  return 'player' in entity && 'stats' in entity && 'role' in entity;
}

export function isGameEvent(obj: unknown): obj is GameEvent {
  return typeof obj === 'object' && obj !== null && 
    'id' in obj && 'type' in obj && 'timestamp' in obj;
}

export function isValidGameMode(mode: string): mode is GameMode {
  return ['fifa', 'arcade', 'tournament'].includes(mode);
}

export function isPowerUpType(type: string): type is PowerUpType {
  const validTypes: PowerUpType[] = [
    'speed_boost', 'power_boost', 'precision', 'stamina', 'shield', 'mega_kick',
    'time_slow', 'ball_magnet', 'crystal_barrier', 'elemental_mastery',
    'tidal_wave', 'reality_warp', 'honey_trap', 'freeze_blast', 'fireball', 'shuriken'
  ];
  return validTypes.includes(type as PowerUpType);
}

// ========== EXPORTS ==========

export type {
  // Re-export commonly used Hytopia types
  Vector3Like,
  Entity,
  World, 
  Player
};