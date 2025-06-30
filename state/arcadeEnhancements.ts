// Arcade Enhancement System - Only Active in Arcade Mode
// This system enhances existing gameplay without modifying FIFA mode

import { World, Audio } from "hytopia";
import { isArcadeMode, ARCADE_PHYSICS_MULTIPLIERS } from "./gameModes";

export class ArcadeEnhancementManager {
  private world: World;
  private playerEnhancements: Map<string, PlayerEnhancement> = new Map();
  private lastEnhancementTime: number = 0;

  constructor(world: World) {
    this.world = world;
    console.log("ArcadeEnhancementManager initialized - only active in Arcade Mode");
  }

  // Main update loop - only runs in arcade mode
  update(): void {
    // SAFETY CHECK: Only run in arcade mode
    if (!isArcadeMode()) {
      return; // Exit immediately if not in arcade mode
    }

    this.updatePlayerEnhancements();
    this.checkForRandomEnhancements();
  }

  // Update active player enhancements
  private updatePlayerEnhancements(): void {
    const currentTime = Date.now();
    
    for (const [playerId, enhancement] of this.playerEnhancements.entries()) {
      // Remove expired enhancements
      if (enhancement.endTime < currentTime) {
        this.removeEnhancement(playerId);
      }
    }
  }

  // Randomly give players temporary enhancements in arcade mode
  private checkForRandomEnhancements(): void {
    const currentTime = Date.now();
    
    // Only trigger every 30 seconds
    if (currentTime - this.lastEnhancementTime < 30000) {
      return;
    }

    // 20% chance to give someone an enhancement
    if (Math.random() < 0.2) {
      this.giveRandomEnhancement();
      this.lastEnhancementTime = currentTime;
    }
  }

  // Give a random player a random enhancement
  private giveRandomEnhancement(): void {
    // Get all players (this would need to be connected to your player system)
    // For now, we'll create a simple notification system
    
    const enhancementTypes = ['speed', 'power', 'precision'];
    const randomType = enhancementTypes[Math.floor(Math.random() * enhancementTypes.length)];
    
    // Play enhancement sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.4,
    }).play(this.world);

    console.log(`Random ${randomType} enhancement activated in arcade mode!`);
  }

  // Add enhancement to a specific player
  public addEnhancement(playerId: string, type: EnhancementType, duration: number = 10000): void {
    // SAFETY CHECK: Only work in arcade mode
    if (!isArcadeMode()) {
      return;
    }

    const enhancement: PlayerEnhancement = {
      playerId: playerId,
      type: type,
      startTime: Date.now(),
      endTime: Date.now() + duration,
      multiplier: this.getEnhancementMultiplier(type)
    };

    this.playerEnhancements.set(playerId, enhancement);

    // Play activation sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.5,
    }).play(this.world);

    console.log(`Player ${playerId} received ${type} enhancement for ${duration/1000} seconds`);
  }

  // Remove enhancement from player
  private removeEnhancement(playerId: string): void {
    this.playerEnhancements.delete(playerId);
    console.log(`Enhancement expired for player ${playerId}`);
  }

  // Get multiplier for enhancement type
  private getEnhancementMultiplier(type: EnhancementType): number {
    switch (type) {
      case 'speed':
        return ARCADE_PHYSICS_MULTIPLIERS.PLAYER_SPEED;
      case 'power':
        return ARCADE_PHYSICS_MULTIPLIERS.SHOT_POWER;
      case 'precision':
        return 1.3; // 30% better accuracy
      default:
        return 1.0;
    }
  }

  // Get player's current enhancement multiplier for a specific stat
  public getPlayerMultiplier(playerId: string, stat: 'speed' | 'shotPower' | 'precision'): number {
    // SAFETY CHECK: Only work in arcade mode
    if (!isArcadeMode()) {
      return 1.0; // No multipliers in FIFA mode
    }

    const enhancement = this.playerEnhancements.get(playerId);
    if (!enhancement) {
      return 1.0;
    }

    // Map stat to enhancement type
    const statToType: { [key: string]: EnhancementType } = {
      'speed': 'speed',
      'shotPower': 'power',
      'precision': 'precision'
    };

    if (enhancement.type === statToType[stat]) {
      return enhancement.multiplier;
    }

    return 1.0;
  }

  // Check if player has any active enhancement
  public hasActiveEnhancement(playerId: string): boolean {
    return this.playerEnhancements.has(playerId);
  }

  // Get player's active enhancement info
  public getPlayerEnhancement(playerId: string): PlayerEnhancement | null {
    return this.playerEnhancements.get(playerId) || null;
  }

  // Clean up all enhancements (called when switching modes)
  public cleanup(): void {
    this.playerEnhancements.clear();
    this.lastEnhancementTime = 0;
    console.log("ArcadeEnhancementManager cleaned up");
  }
}

// Enhancement types
export type EnhancementType = 'speed' | 'power' | 'precision';

// Player enhancement interface
export interface PlayerEnhancement {
  playerId: string;
  type: EnhancementType;
  startTime: number;
  endTime: number;
  multiplier: number;
}

// Arcade-specific ball physics helper (only used in arcade mode)
export function getArcadeBallForce(baseForceName: string, baseForce: number): number {
  // SAFETY CHECK: Only modify in arcade mode
  if (!isArcadeMode()) {
    return baseForce; // Return original force in FIFA mode
  }

  // Apply arcade multipliers
  switch (baseForceName) {
    case 'shot':
      return baseForce * ARCADE_PHYSICS_MULTIPLIERS.SHOT_POWER;
    case 'pass':
      return baseForce * ARCADE_PHYSICS_MULTIPLIERS.PASS_SPEED;
    default:
      return baseForce;
  }
}

// Arcade-specific player speed helper (only used in arcade mode)
export function getArcadePlayerSpeed(baseSpeed: number, playerId: string, enhancementManager?: ArcadeEnhancementManager): number {
  // SAFETY CHECK: Only modify in arcade mode
  if (!isArcadeMode()) {
    return baseSpeed; // Return original speed in FIFA mode
  }

  let arcadeSpeed = baseSpeed * ARCADE_PHYSICS_MULTIPLIERS.PLAYER_SPEED;

  // Apply individual player enhancements if available
  if (enhancementManager) {
    const speedMultiplier = enhancementManager.getPlayerMultiplier(playerId, 'speed');
    arcadeSpeed *= speedMultiplier;
  }

  return arcadeSpeed;
} 