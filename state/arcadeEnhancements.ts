// Arcade Enhancement System - Only Active in Arcade Mode
// This system enhances existing gameplay without modifying FIFA mode

import { World, Audio } from "hytopia";
import { isArcadeMode, ARCADE_PHYSICS_MULTIPLIERS } from "./gameModes";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";

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
    
    const enhancementTypes: EnhancementType[] = [
      'speed', 'power', 'precision', 'freeze_blast', 'shuriken_throw', 
      'fireball', 'mega_kick', 'shield'
    ];
    const randomType = enhancementTypes[Math.floor(Math.random() * enhancementTypes.length)];
    
    // Play enhancement sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.4,
    }).play(this.world);

    console.log(`Random ${randomType} power-up available in arcade mode!`);
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
      case 'mega_kick':
        return 3.0; // Triple kick power
      case 'shield':
      case 'freeze_blast':
      case 'shuriken_throw':
      case 'fireball':
        return 1.0; // These are special effects, not multipliers
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

  // Activate power-up for player (only in arcade mode)
  public activatePowerUp(playerId: string, powerUpType: EnhancementType): boolean {
    // SAFETY CHECK: Only work in arcade mode
    if (!isArcadeMode()) {
      return false;
    }

    // Execute power-up effect based on type
    switch (powerUpType) {
      case 'freeze_blast':
        this.executeFreezeBlast(playerId);
        break;
      case 'shuriken_throw':
        this.executeShurikenThrow(playerId);
        break;
      case 'fireball':
        this.executeFireball(playerId);
        break;
      case 'mega_kick':
        this.executeMegaKick(playerId);
        break;
      case 'shield':
        this.executeShield(playerId);
        break;
      default:
        // For temporary enhancements like speed/power
        this.addEnhancement(playerId, powerUpType, 10000);
        break;
    }

    return true;
  }

  // Execute freeze blast power-up
  private executeFreezeBlast(playerId: string): void {
    console.log(`🧊 Freeze Blast activated by ${playerId}!`);
    
    // Find the player entity
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) return;
    
    // Find nearby opponents within radius (5 units)
    const freezeRadius = 5;
    const nearbyOpponents = this.world.entityManager.getAllPlayerEntities()
      .filter(entity => {
        if (!(entity instanceof SoccerPlayerEntity)) return false;
        if (entity === playerEntity) return false; // Don't freeze self
        if (entity.team === playerEntity.team) return false; // Don't freeze teammates
        
        const distance = Math.sqrt(
          Math.pow(entity.position.x - playerEntity.position.x, 2) +
          Math.pow(entity.position.z - playerEntity.position.z, 2)
        );
        
        return distance <= freezeRadius;
      });
    
    // Apply freeze effect to nearby opponents
    nearbyOpponents.forEach(opponent => {
      if (opponent instanceof SoccerPlayerEntity) {
        opponent.freeze();
        opponent.stunPlayer();
        
        // Unfreeze after 4 seconds
        setTimeout(() => {
          if (opponent.isSpawned) {
            opponent.unfreeze();
          }
        }, 4000);
        
        console.log(`🧊 Froze ${opponent.player.username} for 4 seconds`);
      }
    });
    
    // Play freeze sound effect
    new Audio({
      uri: "audio/sfx/liquid/water-freeze.mp3",
      loop: false,
      volume: 0.8,
    }).play(this.world);
    
    console.log(`🧊 Freeze Blast affected ${nearbyOpponents.length} opponents!`);
    
    // Add temporary enhancement to track the effect
    this.addEnhancement(playerId, 'freeze_blast', 1000); // Very short duration for instant effect
  }

  // Execute shuriken throw power-up
  private executeShurikenThrow(playerId: string): void {
    console.log(`🥷 Shuriken Throw activated by ${playerId}!`);
    
    // Find the player entity
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) return;
    
    // Import and launch shuriken projectile
    import("../entities/ProjectileEntity").then(({ launchProjectile, ProjectileType }) => {
      // Get player's facing direction
      const facingDirection = {
        x: Math.sin(playerEntity.rotation.y * 2), // Convert quaternion to direction
        y: 0,
        z: Math.cos(playerEntity.rotation.y * 2)
      };
      
      // Launch shuriken
      const projectile = launchProjectile(ProjectileType.SHURIKEN, playerEntity, facingDirection);
      
      if (projectile) {
        console.log(`🥷 Shuriken launched by ${playerId}!`);
      }
    }).catch(error => {
      console.error("Failed to load ProjectileEntity:", error);
      
      // Fallback: just play sound
      new Audio({
        uri: "audio/sfx/player/bow-01.mp3",
        loop: false,
        volume: 0.7,
      }).play(this.world);
    });
    
    // Add temporary enhancement to track the effect
    this.addEnhancement(playerId, 'shuriken_throw', 1000);
  }

  // Execute fireball power-up
  private executeFireball(playerId: string): void {
    console.log(`🔥 Fireball activated by ${playerId}!`);
    
    // Find the player entity
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) return;
    
    // Import and launch fireball projectile
    import("../entities/ProjectileEntity").then(({ launchProjectile, ProjectileType }) => {
      // Get player's facing direction
      const facingDirection = {
        x: Math.sin(playerEntity.rotation.y * 2),
        y: 0.1, // Slight upward angle
        z: Math.cos(playerEntity.rotation.y * 2)
      };
      
      // Launch fireball
      const projectile = launchProjectile(ProjectileType.FIREBALL, playerEntity, facingDirection);
      
      if (projectile) {
        console.log(`🔥 Fireball launched by ${playerId}!`);
      }
    }).catch(error => {
      console.error("Failed to load ProjectileEntity:", error);
      
      // Fallback: just play sound
      new Audio({
        uri: "audio/sfx/fire/fire-ignite.mp3",
        loop: false,
        volume: 0.7,
      }).play(this.world);
    });
    
    // Add temporary enhancement to track the effect
    this.addEnhancement(playerId, 'fireball', 1000);
  }

  // Execute mega kick power-up
  private executeMegaKick(playerId: string): void {
    console.log(`⚽ Mega Kick activated by ${playerId}!`);
    
    // Apply mega kick enhancement for 10 seconds
    this.addEnhancement(playerId, 'mega_kick', 10000);
    
    // Play power-up sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.8,
    }).play(this.world);
    
    console.log(`⚽ ${playerId} has mega kick power for 10 seconds!`);
  }

  // Execute shield power-up
  private executeShield(playerId: string): void {
    console.log(`🛡️ Shield activated by ${playerId}!`);
    
    // Apply shield enhancement for 30 seconds
    this.addEnhancement(playerId, 'shield', 30000);
    
    // Play shield sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.6,
    }).play(this.world);
    
    console.log(`🛡️ ${playerId} has shield protection for 30 seconds!`);
  }

  // Check if player has mega kick active
  public hasMegaKick(playerId: string): boolean {
    const enhancement = this.playerEnhancements.get(playerId);
    return enhancement?.type === 'mega_kick';
  }

  // Check if player has shield active
  public hasShield(playerId: string): boolean {
    const enhancement = this.playerEnhancements.get(playerId);
    return enhancement?.type === 'shield';
  }

  // Consume mega kick (call when player kicks ball)
  public consumeMegaKick(playerId: string): boolean {
    const enhancement = this.playerEnhancements.get(playerId);
    if (enhancement?.type === 'mega_kick') {
      this.removeEnhancement(playerId);
      return true;
    }
    return false;
  }

  // Consume shield (call when player is attacked)
  public consumeShield(playerId: string): boolean {
    const enhancement = this.playerEnhancements.get(playerId);
    if (enhancement?.type === 'shield') {
      this.removeEnhancement(playerId);
      
      // Play shield block sound
      new Audio({
        uri: "audio/sfx/ui/inventory-place-item.mp3",
        loop: false,
        volume: 0.7,
      }).play(this.world);
      
      return true;
    }
    return false;
  }

  // Helper method to find player entity by ID
  private findPlayerEntity(playerId: string): SoccerPlayerEntity | null {
    const playerEntities = this.world.entityManager.getAllPlayerEntities();
    
    for (const entity of playerEntities) {
      if (entity instanceof SoccerPlayerEntity && entity.player.username === playerId) {
        return entity;
      }
    }
    
    console.warn(`Player entity not found for ID: ${playerId}`);
    return null;
  }

  // Clean up all enhancements (called when switching modes)
  public cleanup(): void {
    this.playerEnhancements.clear();
    this.lastEnhancementTime = 0;
    console.log("ArcadeEnhancementManager cleaned up");
  }
}

// Enhancement types - expanded for arcade power-ups
export type EnhancementType = 'speed' | 'power' | 'precision' | 'freeze_blast' | 'shuriken_throw' | 'fireball' | 'mega_kick' | 'shield';

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