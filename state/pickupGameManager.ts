import { World, Entity, type Vector3Like } from 'hytopia';
import { AbilityConsumable } from '../abilities/AbilityConsumable';
import { shurikenThrowOptions, speedBoostOptions } from '../abilities/itemTypes';
import { ABILITY_PICKUP_POSITIONS, ABILITY_RESPAWN_TIME } from './gameConfig';
import { isPickupMode } from './gameModes';

// Timer type for Node.js compatibility
type Timer = ReturnType<typeof setTimeout>;

/**
 * PickupGameManager - Manages ability pickup system for Pickup Mode
 * This system is completely separate from Arcade Mode's random power-ups
 */
export class PickupGameManager {
  private world: World;
  private abilityPickups: AbilityConsumable[] = [];
  private isActive: boolean = false;

  constructor(world: World) {
    this.world = world;
    console.log("PickupGameManager initialized - only active in Pickup Mode");
  }

  /**
   * Activate the pickup system (only works in Pickup Mode)
   */
  public activate(): void {
    // SAFETY CHECK: Only activate in pickup mode
    if (!isPickupMode()) {
      console.log("PickupGameManager: Not in Pickup mode, skipping activation");
      return;
    }

    if (this.isActive) {
      console.log("PickupGameManager: Already active");
      return;
    }

    console.log("🎯 PickupGameManager: Activating pickup system for Pickup Mode");
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
    if (!this.isActive || !isPickupMode()) {
      return;
    }

    // Create ability pickups
    this.abilityPickups = [
      new AbilityConsumable(this.world, this.getRandomPickupPosition(), shurikenThrowOptions),
      new AbilityConsumable(this.world, this.getRandomPickupPosition(), speedBoostOptions),
    ];

    console.log(`🎯 PickupGameManager: Spawned ${this.abilityPickups.length} ability pickups`);
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
   * Check if pickup system is currently active
   */
  public isPickupSystemActive(): boolean {
    return this.isActive && isPickupMode();
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