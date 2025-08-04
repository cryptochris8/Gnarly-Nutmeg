import type { Ability } from './Ability';
import type { Vector3Like, Entity } from 'hytopia';
import SoccerPlayerEntity from '../entities/SoccerPlayerEntity';

/**
 * SafeAbilityWrapper - Provides crash protection for all ability executions
 * 
 * This wrapper ensures that any ability execution is protected against common crash scenarios:
 * - Null/undefined properties
 * - Invalid entity states
 * - Missing world references
 * - UI operation failures
 * - Physics operation failures
 */
export class SafeAbilityWrapper {
  /**
   * Safely executes an ability with comprehensive error handling
   * @param ability The ability to execute
   * @param origin The origin position
   * @param direction The direction vector
   * @param source The source entity
   * @returns true if execution was successful, false otherwise
   */
  public static safeExecute(
    ability: Ability | null | undefined,
    origin: Vector3Like,
    direction: Vector3Like,
    source: Entity
  ): boolean {
    // Initial validation
    if (!ability) {
      console.error('❌ SAFE WRAPPER: No ability provided');
      return false;
    }

    if (!source) {
      console.error('❌ SAFE WRAPPER: No source entity provided');
      return false;
    }

    // Validate source entity state
    if (!this.validateEntity(source)) {
      console.error('❌ SAFE WRAPPER: Source entity validation failed');
      return false;
    }

    // Validate origin and direction
    if (!this.validateVector(origin, 'origin') || !this.validateVector(direction, 'direction')) {
      console.error('❌ SAFE WRAPPER: Vector validation failed');
      return false;
    }

    // Create a protected execution context
    const protectedSource = this.createProtectedEntity(source);
    
    try {
      console.log(`🛡️ SAFE WRAPPER: Executing ability ${ability.getIcon ? ability.getIcon() : 'unknown'}`);
      
      // Execute the ability with protected parameters
      ability.use(
        { ...origin }, // Clone to prevent modification
        { ...direction }, // Clone to prevent modification
        protectedSource
      );
      
      console.log(`✅ SAFE WRAPPER: Ability executed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ SAFE WRAPPER: Ability execution failed:`, error);
      console.error(`❌ SAFE WRAPPER: Error stack:`, (error as Error).stack);
      
      // Try to clean up any partial state
      this.attemptCleanup(source);
      
      return false;
    }
  }

  /**
   * Validates that an entity is in a valid state
   */
  private static validateEntity(entity: Entity): boolean {
    try {
      // Check if entity exists and has required properties
      if (!entity) return false;
      
      // Check if it's a player entity
      if (entity instanceof SoccerPlayerEntity) {
        // Validate player-specific properties
        if (!entity.player) {
          console.warn('⚠️ SAFE WRAPPER: Player entity missing player property');
          return false;
        }
        
        // Check if entity is spawned
        if (!entity.isSpawned) {
          console.warn('⚠️ SAFE WRAPPER: Entity is not spawned');
          return false;
        }
        
        // Check world reference
        if (!entity.world) {
          console.warn('⚠️ SAFE WRAPPER: Entity has no world reference');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ SAFE WRAPPER: Entity validation error:', error);
      return false;
    }
  }

  /**
   * Validates a vector has valid numeric values
   */
  private static validateVector(vector: Vector3Like, name: string): boolean {
    try {
      if (!vector) {
        console.warn(`⚠️ SAFE WRAPPER: ${name} is null/undefined`);
        return false;
      }
      
      if (typeof vector.x !== 'number' || typeof vector.y !== 'number' || typeof vector.z !== 'number') {
        console.warn(`⚠️ SAFE WRAPPER: ${name} has invalid coordinates`);
        return false;
      }
      
      if (isNaN(vector.x) || isNaN(vector.y) || isNaN(vector.z)) {
        console.warn(`⚠️ SAFE WRAPPER: ${name} contains NaN values`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ SAFE WRAPPER: Vector validation error for ${name}:`, error);
      return false;
    }
  }

  /**
   * Creates a protected proxy for the entity that guards against null access
   */
  private static createProtectedEntity(entity: Entity): Entity {
    // Return a proxy that intercepts property access
    return new Proxy(entity, {
      get(target, prop, receiver) {
        try {
          const value = Reflect.get(target, prop, receiver);
          
          // Special handling for common crash-prone properties
          if (prop === 'world' && !value) {
            console.warn('⚠️ SAFE WRAPPER: World access returned null, providing safe default');
            return null;
          }
          
          if (prop === 'player' && entity instanceof SoccerPlayerEntity) {
            // Return a protected player proxy
            return SafeAbilityWrapper.createProtectedPlayer(value);
          }
          
          if (prop === 'position' && !value) {
            console.warn('⚠️ SAFE WRAPPER: Position access returned null, providing safe default');
            return { x: 0, y: 0, z: 0 };
          }
          
          if (prop === 'rotation' && !value) {
            console.warn('⚠️ SAFE WRAPPER: Rotation access returned null, providing safe default');
            return { x: 0, y: 0, z: 0, w: 1 };
          }
          
          // For methods, wrap them in error handling
          if (typeof value === 'function') {
            return function(...args: any[]) {
              try {
                return value.apply(target, args);
              } catch (error) {
                console.error(`❌ SAFE WRAPPER: Method ${String(prop)} failed:`, error);
                return undefined;
              }
            };
          }
          
          return value;
        } catch (error) {
          console.error(`❌ SAFE WRAPPER: Property access failed for ${String(prop)}:`, error);
          return undefined;
        }
      },
      
      set(target, prop, value, receiver) {
        try {
          return Reflect.set(target, prop, value, receiver);
        } catch (error) {
          console.error(`❌ SAFE WRAPPER: Property set failed for ${String(prop)}:`, error);
          return false;
        }
      }
    });
  }

  /**
   * Creates a protected proxy for player objects
   */
  private static createProtectedPlayer(player: any): any {
    if (!player) return null;
    
    return new Proxy(player, {
      get(target, prop, receiver) {
        try {
          const value = Reflect.get(target, prop, receiver);
          
          // Special handling for UI
          if (prop === 'ui') {
            return SafeAbilityWrapper.createProtectedUI(value);
          }
          
          // Special handling for camera
          if (prop === 'camera') {
            return SafeAbilityWrapper.createProtectedCamera(value);
          }
          
          return value;
        } catch (error) {
          console.error(`❌ SAFE WRAPPER: Player property access failed for ${String(prop)}:`, error);
          return undefined;
        }
      }
    });
  }

  /**
   * Creates a protected proxy for UI objects
   */
  private static createProtectedUI(ui: any): any {
    if (!ui) {
      // Return a mock UI that safely does nothing
      return {
        sendData: (data: any) => {
          console.warn('⚠️ SAFE WRAPPER: UI sendData called but UI is null');
        }
      };
    }
    
    return new Proxy(ui, {
      get(target, prop, receiver) {
        try {
          const value = Reflect.get(target, prop, receiver);
          
          // Wrap sendData in error handling
          if (prop === 'sendData' && typeof value === 'function') {
            return function(data: any) {
              try {
                return value.call(target, data);
              } catch (error) {
                console.error('❌ SAFE WRAPPER: UI sendData failed:', error);
              }
            };
          }
          
          return value;
        } catch (error) {
          console.error(`❌ SAFE WRAPPER: UI property access failed for ${String(prop)}:`, error);
          return undefined;
        }
      }
    });
  }

  /**
   * Creates a protected proxy for camera objects
   */
  private static createProtectedCamera(camera: any): any {
    if (!camera) {
      // Return a mock camera with safe defaults
      return {
        facingDirection: { x: 0, y: 0, z: 1 },
        position: { x: 0, y: 0, z: 0 }
      };
    }
    
    return new Proxy(camera, {
      get(target, prop, receiver) {
        try {
          const value = Reflect.get(target, prop, receiver);
          
          // Provide safe defaults for common camera properties
          if (prop === 'facingDirection' && !value) {
            console.warn('⚠️ SAFE WRAPPER: Camera facingDirection is null, providing default');
            return { x: 0, y: 0, z: 1 };
          }
          
          if (prop === 'position' && !value) {
            console.warn('⚠️ SAFE WRAPPER: Camera position is null, providing default');
            return { x: 0, y: 0, z: 0 };
          }
          
          return value;
        } catch (error) {
          console.error(`❌ SAFE WRAPPER: Camera property access failed for ${String(prop)}:`, error);
          return undefined;
        }
      }
    });
  }

  /**
   * Attempts to clean up any partial state after a failed ability execution
   */
  private static attemptCleanup(entity: Entity): void {
    try {
      // Check if entity is a player entity with ability holder
      if (entity instanceof SoccerPlayerEntity && entity.abilityHolder) {
        // The ability might have partially executed, but we shouldn't remove it
        // as the player should retain it for another attempt
        console.log('🧹 SAFE WRAPPER: Cleanup completed, ability retained for retry');
      }
    } catch (error) {
      console.error('❌ SAFE WRAPPER: Cleanup failed:', error);
    }
  }
}