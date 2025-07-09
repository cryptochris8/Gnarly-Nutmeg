import { World, Entity, type Vector3Like } from 'hytopia';
import { AbilityConsumable } from '../abilities/AbilityConsumable';
import { ALL_POWERUP_OPTIONS } from '../abilities/itemTypes';
import { ABILITY_PICKUP_POSITIONS, ABILITY_RESPAWN_TIME } from './gameConfig';
import { isArcadeMode } from './gameModes';

// Timer type for Node.js compatibility
type Timer = ReturnType<typeof setTimeout>;

/**
 * PickupGameManager - Manages physical ability pickup system for Arcade Mode
 * This replaces the old UI-based power-up system with Mario/Sonic-style collectibles
 */
export class PickupGameManager {
  private world: World;
  private abilityPickups: AbilityConsumable[] = [];
  private isActive: boolean = false;

  constructor(world: World) {
    this.world = world;
    console.log("PickupGameManager initialized - active in Arcade Mode only");
  }

  /**
   * Activate the pickup system (works in Arcade Mode only)
   */
  public activate(): void {
    // Only support Arcade mode now
    if (!isArcadeMode()) {
      console.log("PickupGameManager: Not in Arcade mode, skipping activation");
      return;
    }

    if (this.isActive) {
      console.log("PickupGameManager: Already active");
      return;
    }

    console.log(`🎯 PickupGameManager: Activating physical pickup system for Arcade Mode`);
    this.isActive = true;
    this.spawnPickups();
  }

  /**
   * Deactivate the pickup system and clean up
   */
  public deactivate(): void {
    if (!this.isActive) {
      return;
    }

    console.log("🎯 PickupGameManager: Deactivating pickup system");
    this.isActive = false;
    this.cleanupPickups();
  }

  /**
   * Spawn ability pickups at random positions
   */
  private spawnPickups(): void {
    if (!this.isActive || !isArcadeMode()) {
      console.log("PickupGameManager: Cannot spawn - not active or not in arcade mode");
      return;
    }

    console.log(`🎯 PickupGameManager: Starting pickup spawn process...`);
    console.log(`📍 Available positions: ${ABILITY_PICKUP_POSITIONS.length}`);
    console.log(`⚡ Available power-ups: ${ALL_POWERUP_OPTIONS.length}`);

    // Create strategic distribution of ability pickups
    const numberOfPickups = Math.min(6, ABILITY_PICKUP_POSITIONS.length); // Use available positions efficiently
    const shuffledOptions = [...ALL_POWERUP_OPTIONS].sort(() => Math.random() - 0.5);
    const selectedOptions = shuffledOptions.slice(0, numberOfPickups);

    console.log(`🎮 Selected power-ups for spawning:`, selectedOptions.map(o => o.name));

    // Use different positions for each pickup to avoid clustering
    const usedPositions = new Set<number>();
    this.abilityPickups = selectedOptions.map((options, index) => {
      const position = this.getRandomUnusedPickupPosition(usedPositions);
      console.log(`📦 Creating ${options.name} pickup at position:`, position);
      return new AbilityConsumable(this.world, position, options);
    });

    console.log(`✅ PickupGameManager: Successfully spawned ${this.abilityPickups.length} ability pickups`);
    console.log(`🎯 Active pickups: ${selectedOptions.map((o, i) => `${o.name} (${JSON.stringify(ABILITY_PICKUP_POSITIONS[i])})`).join(', ')}`);
    
    // Log collision setup for debugging
    console.log(`🔍 Pickup collision configuration:`);
    console.log(`  ├─ Collision Shape: Cylinder (radius: 1.2, height: 0.8)`);
    console.log(`  ├─ isSensor: true (pass-through)`);
    console.log(`  ├─ belongsTo: [ENTITY]`);
    console.log(`  ├─ collidesWith: [PLAYER, ENTITY, ENTITY_SENSOR]`);
    console.log(`  └─ Expected player collision group: PLAYER`);
  }

  /**
   * Clean up all pickup entities
   */
  private cleanupPickups(): void {
    this.abilityPickups.forEach(pickup => {
      pickup.destroy();
    });
    this.abilityPickups = [];
    console.log("🎯 PickupGameManager: Cleaned up all ability pickups");
  }

  /**
   * Get a random pickup position from available positions
   */
  private getRandomPickupPosition(): Vector3Like {
    const randomIndex = Math.floor(Math.random() * ABILITY_PICKUP_POSITIONS.length);
    return ABILITY_PICKUP_POSITIONS[randomIndex];
  }

  /**
   * Get a random unused pickup position to ensure better distribution
   */
  private getRandomUnusedPickupPosition(usedPositions: Set<number>): Vector3Like {
    let randomIndex: number;
    let attempts = 0;
    const maxAttempts = ABILITY_PICKUP_POSITIONS.length * 2;
    
    // Try to find an unused position, fallback to any position if needed
    do {
      randomIndex = Math.floor(Math.random() * ABILITY_PICKUP_POSITIONS.length);
      attempts++;
    } while (usedPositions.has(randomIndex) && attempts < maxAttempts);
    
    usedPositions.add(randomIndex);
    return ABILITY_PICKUP_POSITIONS[randomIndex];
  }

  /**
   * Check if pickup system is currently active
   */
  public isPickupSystemActive(): boolean {
    return this.isActive && isArcadeMode();
  }

  /**
   * Get the number of active pickups
   */
  public getActivePickupCount(): number {
    return this.abilityPickups.length;
  }

  /**
   * Force cleanup for game reset
   */
  public forceCleanup(): void {
    this.cleanupPickups();
    this.isActive = false;
  }
} 