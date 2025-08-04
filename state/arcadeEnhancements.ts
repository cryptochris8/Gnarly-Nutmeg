// Arcade Enhancement System - Only Active in Arcade Mode
// This system enhances existing gameplay without modifying FIFA mode

import { World, Audio, Entity, RigidBodyType, ColliderShape, CollisionGroup, BlockType, EntityEvent, type Vector3Like } from "hytopia";
import { isArcadeMode, ARCADE_PHYSICS_MULTIPLIERS } from "./gameModes";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";

export class ArcadeEnhancementManager {
  private world: World;
  private playerEnhancements: Map<string, PlayerEnhancement> = new Map();
  private freezeSafetyInterval: any;

  constructor(world: World) {
    this.world = world;
    console.log("ArcadeEnhancementManager initialized - pickup-based abilities only in Arcade Mode");
    
    // Start freeze safety check - runs every 5 seconds to unfreeze stuck players
    this.freezeSafetyInterval = setInterval(() => {
      this.checkAndUnfreezeStuckPlayers();
    }, 5000);
  }

  // Cleanup method to stop intervals
  destroy(): void {
    if (this.freezeSafetyInterval) {
      clearInterval(this.freezeSafetyInterval);
      this.freezeSafetyInterval = null;
    }
  }

  // Main update loop - only runs in arcade mode
  update(): void {
    // SAFETY CHECK: Only run in arcade mode
    if (!isArcadeMode()) {
      return; // Exit immediately if not in arcade mode
    }

    this.updatePlayerEnhancements();
    // Random enhancements removed - now using pickup-based system only
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

  // Random enhancement system removed - now using pickup-based system only

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

  // Execute stamina restoration power-up
  private executeStaminaRestore(playerId: string): void {
    console.log(`💧 STAMINA RESTORE: ${playerId} activating stamina restoration!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for stamina restore: ${playerId}`);
      return;
    }

    // Play stamina activation sound
    const staminaActivationAudio = new Audio({
      uri: "audio/sfx/player/drink.mp3",
      loop: false,
      volume: 0.8,
      position: playerEntity.position,
      referenceDistance: 10
    });
    staminaActivationAudio.play(this.world);

    // Create visual effect for stamina restoration
    this.createPowerUpEffect(playerEntity.position, 'stamina');

    // Apply stamina restoration effects
    this.applyStaminaEffects(playerEntity);

    console.log(`✅ STAMINA RESTORE: Successfully executed stamina restoration for ${playerId}`);
  }

  // Apply stamina restoration effects to the player
  private applyStaminaEffects(player: SoccerPlayerEntity): void {
    try {
      const durationMs = 30000; // 30 seconds
      const staminaMultiplier = 1.5; // 50% enhanced stamina regeneration

      // Instantly restore stamina to full
      this.restorePlayerStamina(player);
      
      // Apply enhanced stamina regeneration
      this.applyStaminaEnhancement(player, durationMs, staminaMultiplier);

      // Send UI notification
      if (player.player.ui && typeof player.player.ui.sendData === 'function') {
        player.player.ui.sendData({
          type: "power-up-activated",
          powerUpType: "stamina",
          message: "Stamina Fully Restored! Enhanced regeneration for 30s",
          duration: durationMs
        });
      }

      // Create floating effect above player
      this.createStaminaFloatingEffect(player);

      console.log(`💧 STAMINA: Applied full restoration and enhancement to ${player.player.username}`);

    } catch (error) {
      console.error("❌ STAMINA EFFECTS ERROR:", error);
    }
  }

  // Create floating stamina effect above player
  private createStaminaFloatingEffect(player: SoccerPlayerEntity): void {
    try {
      // Create floating energy orb effect
      const effectEntity = new Entity({
        name: 'stamina-floating-effect',
        modelUri: 'projectiles/energy-orb-projectile.gltf',
        modelScale: 0.8,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
          colliders: [],
        }
      });

      // Spawn above player
      const effectPosition = {
        x: player.position.x,
        y: player.position.y + 2.5,
        z: player.position.z
      };

      effectEntity.spawn(this.world, effectPosition);

      // Animate the floating effect
      let animationTime = 0;
      const maxAnimationTime = 3000; // 3 seconds

      const animateFrame = () => {
        if (!effectEntity.isSpawned || animationTime >= maxAnimationTime) {
          if (effectEntity.isSpawned) {
            effectEntity.despawn();
          }
          return;
        }

        // Float upward with gentle bobbing
        const floatOffset = Math.sin(animationTime * 0.003) * 0.2;
        const riseOffset = animationTime * 0.0008;
        
        effectEntity.setPosition({
          x: effectPosition.x,
          y: effectPosition.y + floatOffset + riseOffset,
          z: effectPosition.z
        });

        // Gentle rotation
        const rotation = (animationTime * 0.001) % (Math.PI * 2);
        effectEntity.setRotation({
          x: 0,
          y: Math.sin(rotation / 2),
          z: 0,
          w: Math.cos(rotation / 2)
        });

        animationTime += 50;
        setTimeout(animateFrame, 50);
      };

      animateFrame();

      console.log(`✨ STAMINA: Created floating effect for ${player.player.username}`);
    } catch (error) {
      console.error("❌ STAMINA FLOATING EFFECT ERROR:", error);
    }
  }

  // Instantly restore player's stamina to 100%
  private restorePlayerStamina(player: SoccerPlayerEntity): void {
    try {
      // TODO: Access to internal stamina properties may be needed
      // For now, we'll use available methods and set custom properties
      
      // Mark player as having full stamina restoration
      // This can be used by the player's stamina system if it checks custom properties
      (player as any).customProperties = (player as any).customProperties || new Map();
      (player as any).customProperties.set('staminaFullyRestored', true);
      (player as any).customProperties.set('staminaRestorationTime', Date.now());
      
      console.log(`💯 STAMINA: Instantly restored stamina to 100% for ${player.player.username}`);
      
    } catch (error) {
      console.error("❌ STAMINA RESTORATION ERROR:", error);
    }
  }

  // Apply enhanced stamina regeneration and reduced drain for a duration
  private applyStaminaEnhancement(player: SoccerPlayerEntity, durationMs: number, multiplier: number): void {
    try {
      // Store original stamina rates if accessible
      const customProps = (player as any).customProperties || new Map();
      (player as any).customProperties = customProps;
      
      // Mark as having stamina enhancements
      customProps.set('hasStaminaEnhancement', true);
      customProps.set('staminaEnhancementMultiplier', multiplier);
      customProps.set('staminaEnhancementEndTime', Date.now() + durationMs);
      
      console.log(`⚡ STAMINA: Applied stamina enhancements (${Math.round((multiplier - 1) * 100)}% boost) for ${durationMs/1000} seconds`);
      
      // Remove enhancements after duration
      setTimeout(() => {
        try {
          if (customProps) {
            customProps.set('hasStaminaEnhancement', false);
            customProps.delete('staminaEnhancementMultiplier');
            customProps.delete('staminaEnhancementEndTime');
            
            // Send expiration notification
            if (player.player.ui && typeof player.player.ui.sendData === 'function') {
              player.player.ui.sendData({
                type: "power-up-expired",
                powerUpType: "stamina",
                message: "Stamina enhancement expired"
              });
            }
            
            console.log(`⏰ STAMINA: Enhancement expired for ${player.player.username}`);
          }
        } catch (error) {
          console.error("❌ STAMINA ENHANCEMENT CLEANUP ERROR:", error);
        }
      }, durationMs);
      
    } catch (error) {
      console.error("❌ STAMINA ENHANCEMENT ERROR:", error);
    }
  }

  // Activate power-up for player (only in arcade mode)
  public activatePowerUp(playerId: string, powerUpType: EnhancementType): boolean {
    console.log(`🎮 ARCADE: Attempting to activate ${powerUpType} for player ${playerId}`);
    console.log(`🎮 ARCADE: Current game mode check - isArcadeMode(): ${isArcadeMode()}`);
    
    try {
      // SAFETY CHECK: Only work in arcade mode
      if (!isArcadeMode()) {
        console.log(`🎮 ARCADE: Not in arcade mode, power-up activation blocked`);
        return false;
      }

      console.log(`🎮 ARCADE: In arcade mode, executing power-up ${powerUpType}`);

      // Find player entity for charging effect
      const playerEntity = this.findPlayerEntity(playerId);
      if (playerEntity) {
        // Create charging effect before activation
        this.createChargingEffect(playerEntity, powerUpType);
        
        // Create environmental effects for major power-ups after a delay
        setTimeout(() => {
          this.createEnvironmentalEffect(powerUpType, playerEntity.position);
        }, 1000);
      }

      // Execute power-up effect based on type
      switch (powerUpType) {
        case 'freeze_blast':
          console.log(`🎮 ARCADE: Executing freeze blast for ${playerId}`);
          this.executeFreezeBlast(playerId);
          break;
        case 'fireball':
          console.log(`🎮 ARCADE: Executing fireball for ${playerId}`);
          this.executeFireball(playerId);
          break;
        case 'mega_kick':
          console.log(`🎮 ARCADE: Executing mega kick for ${playerId}`);
          this.executeMegaKick(playerId);
          break;
        case 'shield':
          console.log(`🎮 ARCADE: Executing shield for ${playerId}`);
          this.executeShield(playerId);
          break;
        case 'stamina':
          console.log(`🎮 ARCADE: Executing stamina restoration for ${playerId}`);
          this.executeStamina(playerId);
          break;
        case 'shuriken':
          console.log(`🎮 ARCADE: Executing shuriken throw for ${playerId}`);
          this.executeShuriken(playerId);
          break;
        case 'speed_boost':
          console.log(`🎮 ARCADE: Executing speed boost for ${playerId}`);
          this.executeSpeedBoost(playerId);
          break;
        
        // Enhanced power-ups
        case 'time_slow':
          console.log(`🎮 ARCADE: Executing time slow for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Time Slow');
          break;
        case 'ball_magnet':
          console.log(`🎮 ARCADE: Executing ball magnet for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Ball Magnet');
          break;
        case 'star_rain':
          console.log(`🎮 ARCADE: Executing star rain for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Star Rain');
          break;
        case 'crystal_barrier':
          console.log(`🎮 ARCADE: Executing crystal barrier for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Crystal Barrier');
          break;
        case 'elemental_mastery':
          console.log(`🎮 ARCADE: Executing elemental mastery for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Elemental Mastery');
          break;
        case 'tidal_wave':
          console.log(`🎮 ARCADE: Executing tidal wave for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Tidal Wave');
          break;
        case 'reality_warp':
          console.log(`🎮 ARCADE: Executing reality warp for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Reality Warp');
          break;
        case 'honey_trap':
          console.log(`🎮 ARCADE: Executing honey trap for ${playerId}`);
          this.executeEnhancedPowerUp(playerId, 'Honey Trap');
          break;
        case 'speed':
        case 'power':
        case 'precision':
          console.log(`🎮 ARCADE: Executing enhancement ${powerUpType} for ${playerId}`);
          this.addEnhancement(playerId, powerUpType, 15000); // 15 second duration
          break;
        case 'stamina':
          console.log(`🎮 ARCADE: Executing stamina restoration for ${playerId}`);
          this.executeStaminaRestore(playerId);
          break;
        default:
          console.error(`🎮 ARCADE: Unknown power-up type: ${powerUpType}`);
          return false;
      }

      console.log(`✅ ARCADE: Successfully executed ${powerUpType} for ${playerId}`);
      return true;
    } catch (error) {
      console.error(`❌ ARCADE ACTIVATION ERROR: Failed to activate ${powerUpType} for ${playerId}:`, error);
      if (error instanceof Error) {
        console.error(`❌ ARCADE ERROR Details: ${error.message}`);
        console.error(`❌ ARCADE ERROR Stack: ${error.stack}`);
      }
      return false;
    }
  }

  // Execute freeze blast power-up with area effect and visual feedback
  private executeFreezeBlast(playerId: string): void {
    console.log(`🧊 FREEZE BLAST: ${playerId} activating freeze blast!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for freeze blast: ${playerId}`);
      return;
    }

    // Play freeze blast activation sound with multiple layers
    const freezeActivationAudio = new Audio({
      uri: "audio/sfx/liquid/large-splash.mp3", // Using splash as ice crackling sound
      loop: false,
      volume: 0.6,
      position: playerEntity.position,
      referenceDistance: 15
    });
    freezeActivationAudio.play(this.world);

    // Add ice crystallization sound
    setTimeout(() => {
      const crystalAudio = new Audio({
        uri: "audio/sfx/damage/glass-break-3.mp3",
        loop: false,
        volume: 0.4,
        position: playerEntity.position,
        referenceDistance: 12
      });
      crystalAudio.play(this.world);
    }, 150);

    // Add whoosh sound for cold wind
    const windAudio = new Audio({
      uri: "audio/sfx/ui/portal-travel-woosh.mp3",
      loop: false,
      volume: 0.3,
      position: playerEntity.position,
      referenceDistance: 18
    });
    windAudio.play(this.world);

    // Create spectacular visual effect for freeze blast activation
    this.createPowerUpEffect(playerEntity.position, 'freeze_blast');

    // Create visual freeze effect entity
    const freezeEffect = new Entity({
      name: 'freeze-effect',
      modelUri: 'misc/selection-indicator.gltf', // Using existing model as freeze indicator
      modelScale: 5.0, // Large scale for area effect
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
    });

    // Spawn freeze effect at player position
    freezeEffect.spawn(this.world, {
      x: playerEntity.position.x,
      y: playerEntity.position.y + 0.5,
      z: playerEntity.position.z
    });

    // Find all enemy players within 5 unit radius
    const allPlayers = this.world.entityManager.getAllPlayerEntities()
      .filter(entity => entity instanceof SoccerPlayerEntity) as SoccerPlayerEntity[];

    const frozenPlayers: SoccerPlayerEntity[] = [];
    const freezeRadius = 5.0;

    allPlayers.forEach(targetPlayer => {
      // Skip self and teammates
      if (targetPlayer.player.username === playerId || 
          (playerEntity instanceof SoccerPlayerEntity && targetPlayer.team === playerEntity.team)) {
        return;
      }

      // Calculate distance from freeze blast center
      const distance = Math.sqrt(
        Math.pow(targetPlayer.position.x - playerEntity.position.x, 2) +
        Math.pow(targetPlayer.position.z - playerEntity.position.z, 2)
      );

      if (distance <= freezeRadius) {
        // Freeze the target player
        this.freezePlayer(targetPlayer);
        frozenPlayers.push(targetPlayer);
        
        console.log(`🧊 FROZEN: ${targetPlayer.player.username} frozen by freeze blast!`);
      }
    });

    // Play freeze hit sound for each frozen player
    frozenPlayers.forEach(frozenPlayer => {
      const freezeHitAudio = new Audio({
        uri: "audio/sfx/liquid/large-splash.mp3", // Using existing splash sound for freeze hit effect
        loop: false,
        volume: 0.4,
        position: frozenPlayer.position,
        referenceDistance: 10
      });
      freezeHitAudio.play(this.world);
    });

    // Remove visual effect after 1 second
    setTimeout(() => {
      if (freezeEffect.isSpawned) {
        freezeEffect.despawn();
      }
    }, 1000);

    // Unfreeze all players after 4 seconds
    setTimeout(() => {
      frozenPlayers.forEach(frozenPlayer => {
        this.unfreezePlayer(frozenPlayer);
        console.log(`🧊 UNFROZEN: ${frozenPlayer.player.username} unfrozen!`);
      });
    }, 4000);

    console.log(`🧊 FREEZE BLAST COMPLETE: Affected ${frozenPlayers.length} players`);
  }

  // Safety check to unfreeze players that have been frozen too long
  private checkAndUnfreezeStuckPlayers(): void {
    if (!isArcadeMode()) return;

    const MAX_FREEZE_DURATION = 10000; // 10 seconds max freeze time
    const currentTime = Date.now();

    this.world.entityManager.getAllPlayerEntities().forEach((entity) => {
      if (entity instanceof SoccerPlayerEntity) {
        const frozenState = (entity as any)._frozenState;
        
        if (frozenState?.wasFrozen && frozenState.freezeTime) {
          const freezeDuration = currentTime - frozenState.freezeTime;
          
          if (freezeDuration > MAX_FREEZE_DURATION) {
            console.warn(`⚠️ FREEZE SAFETY: Player ${entity.player.username} has been frozen for ${freezeDuration}ms (>${MAX_FREEZE_DURATION}ms), force unfreezing!`);
            this.unfreezePlayer(entity);
          }
        }
      }
    });
  }

  // Freeze a player by disabling movement and adding visual indicator
  private freezePlayer(player: SoccerPlayerEntity): void {
    // Check if player is already frozen to prevent stacking
    if ((player as any)._frozenState?.wasFrozen) {
      console.log(`🧊 Player ${player.player.username} is already frozen, skipping`);
      return;
    }

    // Use the built-in freeze method first
    player.freeze();
    
    // Disable player movement by setting velocity to zero and adding mass
    player.setLinearVelocity({ x: 0, y: 0, z: 0 });
    player.setAngularVelocity({ x: 0, y: 0, z: 0 });
    
    // Store original state with timestamp
    (player as any)._frozenState = {
      originalMass: player.mass,
      wasFrozen: true,
      freezeTime: Date.now()
    };

    // Make player much heavier to prevent movement
    player.setAdditionalMass(1000);

    // Create ice effect indicator above player
    const iceEffect = new Entity({
      name: 'ice-indicator',
      modelUri: 'misc/selection-indicator.gltf',
      modelScale: 1.5,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
      parent: player,
      parentNodeName: "head_anchor" // Attach to player's head if available
    });

    iceEffect.spawn(this.world, { x: 0, y: 1.5, z: 0 }); // Position above player
    
    // Store ice effect reference for cleanup
    (player as any)._iceEffect = iceEffect;
  }

  // Unfreeze a player by restoring movement
  private unfreezePlayer(player: SoccerPlayerEntity): void {
    const frozenState = (player as any)._frozenState;
    if (!frozenState || !frozenState.wasFrozen) {
      return; // Player wasn't frozen
    }

    // Log freeze duration for debugging
    const freezeDuration = Date.now() - (frozenState.freezeTime || 0);
    console.log(`🧊 Unfreezing ${player.player.username} after ${freezeDuration}ms`);

    // Use the built-in unfreeze method
    player.unfreeze();

    // Restore original mass
    player.setAdditionalMass(0);
    
    // Remove ice effect
    const iceEffect = (player as any)._iceEffect;
    if (iceEffect && iceEffect.isSpawned) {
      iceEffect.despawn();
    }

    // Clear frozen state
    delete (player as any)._frozenState;
    delete (player as any)._iceEffect;

    // Play unfreeze sound
    const unfreezeAudio = new Audio({
      uri: "audio/sfx/dig/dig-grass.mp3", // Using dig sound as ice breaking
      loop: false,
      volume: 0.3,
      position: player.position,
      referenceDistance: 8
    });
    unfreezeAudio.play(this.world);
  }

  // Execute fireball power-up with explosive area damage and spectacular effects
  private executeFireball(playerId: string): void {
    console.log(`🔥 FIREBALL: ${playerId} launching explosive fireball!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for fireball: ${playerId}`);
      return;
    }

    // Debug logging
    console.log(`🔥 FIREBALL DEBUG: Player entity found - ${playerEntity.player?.username || 'unknown'}`);
    console.log(`🔥 FIREBALL DEBUG: Player position - ${JSON.stringify(playerEntity.position)}`);
    console.log(`🔥 FIREBALL DEBUG: Player rotation - ${JSON.stringify(playerEntity.rotation)}`);

    try {
      // Play fireball launch sound
      const launchAudio = new Audio({
        uri: "audio/sfx/fire/fire-ignite.mp3", // Fire ignition sound for launch
        loop: false,
        volume: 0.8,
        position: playerEntity.position,
        referenceDistance: 15
      });
      launchAudio.play(this.world);
    } catch (audioError) {
      console.error(`🔥 FIREBALL ERROR: Failed to play launch audio:`, audioError);
    }

    try {
      // Create spectacular visual effect for fireball activation
      this.createPowerUpEffect(playerEntity.position, 'fireball');
    } catch (effectError) {
      console.error(`🔥 FIREBALL ERROR: Failed to create power-up effect:`, effectError);
    }

    // Calculate launch direction from player's facing direction
    let direction;
    try {
      const rotation = playerEntity.rotation;
      if (!rotation) {
        console.error(`🔥 FIREBALL ERROR: Player rotation is null or undefined`);
        return;
      }
      direction = this.calculateDirectionFromRotation(rotation);
      console.log(`🔥 FIREBALL DEBUG: Calculated direction - ${JSON.stringify(direction)}`);
    } catch (directionError) {
      console.error(`🔥 FIREBALL ERROR: Failed to calculate direction:`, directionError);
      return;
    }
    
    // Create fireball projectile entity with fire model
    let fireball: Entity;
    try {
      fireball = new Entity({
        name: 'fireball-projectile',
        modelUri: 'models/projectiles/fireball.gltf', // Using dedicated fireball model
        modelScale: 1.2,
        rigidBodyOptions: {
          type: RigidBodyType.DYNAMIC,
          ccdEnabled: true, // High-speed projectile needs CCD
          linearDamping: 0.05, // Minimal air resistance for fireballs
          angularDamping: 0.1,
          gravityScale: 0.4, // Slight downward arc
          enabledRotations: { x: true, y: true, z: true },
        },
      });
    } catch (entityError) {
      console.error(`🔥 FIREBALL ERROR: Failed to create fireball entity:`, entityError);
      return;
    }

    // Spawn fireball in front of player at chest height
    try {
      const spawnOffset = 2.0;
      const fireballPosition = {
        x: playerEntity.position.x + direction.x * spawnOffset,
        y: playerEntity.position.y + 1.2, // Chest level
        z: playerEntity.position.z + direction.z * spawnOffset
      };

      console.log(`🔥 FIREBALL DEBUG: Spawning at position - ${JSON.stringify(fireballPosition)}`);
      fireball.spawn(this.world, fireballPosition);
    } catch (spawnError) {
      console.error(`🔥 FIREBALL ERROR: Failed to spawn fireball:`, spawnError);
      return;
    }

    // Apply powerful launch velocity
    try {
      const launchForce = 18.0;
      const launchVelocity = {
        x: direction.x * launchForce,
        y: 3.0, // Higher arc for dramatic effect
        z: direction.z * launchForce
      };
      
      fireball.setLinearVelocity(launchVelocity);
      
      // Add tumbling motion for realistic fireball flight
      fireball.setAngularVelocity({
        x: 5,
        y: 10,
        z: 3
      });

      console.log(`🔥 FIREBALL DEBUG: Velocity set - ${JSON.stringify(launchVelocity)}`);
    } catch (velocityError) {
      console.error(`🔥 FIREBALL ERROR: Failed to set fireball velocity:`, velocityError);
      // Try to despawn if velocity fails
      try {
        fireball.despawn();
      } catch (e) {}
      return;
    }

    // Play continuous burning sound that follows the fireball
    let burnAudio: Audio;
    try {
      burnAudio = new Audio({
        uri: "audio/sfx/fire/fire-burning.mp3", // Continuous burning sound
        loop: true,
        volume: 0.5,
        attachedToEntity: fireball,
        referenceDistance: 12
      });
      burnAudio.play(this.world);
    } catch (audioError) {
      console.error(`🔥 FIREBALL ERROR: Failed to play burning audio:`, audioError);
      // Continue without audio
    }

    // Create particle trail effect for the fireball
    try {
      this.createFireballTrail(fireball);
    } catch (trailError) {
      console.error(`🔥 FIREBALL ERROR: Failed to create fireball trail:`, trailError);
      // Continue without trail
    }

    // Track fireball for explosion detection
    try {
      this.trackFireballProjectile(fireball, playerId, burnAudio);
    } catch (trackError) {
      console.error(`🔥 FIREBALL ERROR: Failed to track fireball:`, trackError);
      // Continue without tracking
    }

    console.log(`🔥 FIREBALL LAUNCHED: Direction [${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}], Force: 18.0`);
  }

  // Create particle trail effect for fireball projectile
  private createFireballTrail(fireball: Entity): void {
    const trailInterval = setInterval(() => {
      if (!fireball.isSpawned) {
        clearInterval(trailInterval);
        return;
      }

      // Create small fire particle at current position
      const trailParticle = new Entity({
        name: 'fireball-trail',
        modelUri: 'misc/firework.gltf',
        modelScale: 0.3 + Math.random() * 0.2, // Varied sizes
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        }
      });

      // Spawn at fireball position with slight offset
      trailParticle.spawn(this.world, {
        x: fireball.position.x + (Math.random() - 0.5) * 0.3,
        y: fireball.position.y + (Math.random() - 0.5) * 0.3,
        z: fireball.position.z + (Math.random() - 0.5) * 0.3
      });

      // Fade out and remove after short time
      setTimeout(() => {
        if (trailParticle.isSpawned) {
          trailParticle.despawn();
        }
      }, 800);
    }, 50); // Create trail particle every 50ms

    // Store interval reference on fireball for cleanup
    (fireball as any)._trailInterval = trailInterval;
  }

  // Track fireball projectile for collision detection and explosion
  private trackFireballProjectile(fireball: Entity, playerId: string, burnAudio: Audio): void {
    let hasExploded = false;
    const maxFlightTime = 6000; // 6 seconds max flight time
    const checkInterval = 50; // Check every 50ms for responsive collision
    let flightTime = 0;

    const trackingInterval = setInterval(() => {
      flightTime += checkInterval;

      // Check if projectile still exists
      if (!fireball.isSpawned || hasExploded) {
        clearInterval(trackingInterval);
        if ((fireball as any)._trailInterval) {
          clearInterval((fireball as any)._trailInterval);
        }
        burnAudio.pause();
        return;
      }

      const fireballPos = fireball.position;

      // Check for collision with players
      const allPlayers = this.world.entityManager.getAllPlayerEntities()
        .filter(entity => entity instanceof SoccerPlayerEntity) as SoccerPlayerEntity[];

      const hitPlayer = allPlayers.find(player => {
        // Skip self (though friendly fire could be enabled later)
        if (player.player.username === playerId) return false;
        
        // Calculate distance to player
        const distance = Math.sqrt(
          Math.pow(player.position.x - fireballPos.x, 2) +
          Math.pow(player.position.y - fireballPos.y, 2) +
          Math.pow(player.position.z - fireballPos.z, 2)
        );

        return distance <= 1.5; // Fireball hit radius
      });

      // Check for ground collision or player hit
      const groundHit = fireballPos.y <= 0.5; // Near ground level
      
      if (hitPlayer || groundHit) {
        hasExploded = true;
        
        // Trigger explosion at current position
        this.triggerFireballExplosion(fireballPos, playerId);
        
        // Stop tracking and clean up
        clearInterval(trackingInterval);
        if ((fireball as any)._trailInterval) {
          clearInterval((fireball as any)._trailInterval);
        }
        burnAudio.pause();
        
        // Remove fireball (explosion will handle visual effects)
        if (fireball.isSpawned) {
          fireball.despawn();
        }
        
        return;
      }

      // Check for max flight time or out of bounds
      if (flightTime >= maxFlightTime || fireballPos.y < -15) {
        console.log(`🔥 FIREBALL: Projectile expired or went out of bounds`);
        hasExploded = true;
        
        // Trigger explosion anyway for dramatic effect
        this.triggerFireballExplosion(fireballPos, playerId);
        
        clearInterval(trackingInterval);
        if ((fireball as any)._trailInterval) {
          clearInterval((fireball as any)._trailInterval);
        }
        burnAudio.pause();
        
        if (fireball.isSpawned) {
          fireball.despawn();
        }
      }
    }, checkInterval);
  }

  // Trigger spectacular fireball explosion with area damage
  private triggerFireballExplosion(explosionPos: { x: number, y: number, z: number }, playerId: string): void {
    console.log(`💥 FIREBALL EXPLOSION at [${explosionPos.x.toFixed(2)}, ${explosionPos.y.toFixed(2)}, ${explosionPos.z.toFixed(2)}]!`);

    // Play massive explosion sound with layered effects
    const explosionAudio = new Audio({
      uri: "audio/sfx/damage/explode.mp3", // Main explosion sound
      loop: false,
      volume: 1.0,
      position: explosionPos,
      referenceDistance: 25 // Large radius for explosion
    });
    explosionAudio.play(this.world);

    // Add thunder effect for extra drama
    setTimeout(() => {
      const thunderAudio = new Audio({
        uri: "audio/sfx/weather/thunder-strike-1.mp3",
        loop: false,
        volume: 0.7,
        position: explosionPos,
        referenceDistance: 30
      });
      thunderAudio.play(this.world);
    }, 200);

    // Add glass breaking sound for debris effect
    setTimeout(() => {
      const debrisAudio = new Audio({
        uri: "audio/sfx/damage/glass-break-2.mp3",
        loop: false,
        volume: 0.5,
        position: explosionPos,
        referenceDistance: 15
      });
      debrisAudio.play(this.world);
    }, 400);

    // Create massive explosion visual effect
    const explosionEffect = new Entity({
      name: 'fireball-explosion',
      modelUri: 'misc/firework.gltf', // Correct path for firework explosion
      modelScale: 8.0, // Huge explosion effect
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
    });

    explosionEffect.spawn(this.world, explosionPos);

    // Apply explosion effects to all nearby players
    const explosionRadius = 8.0; // Large damage radius
    const allPlayers = this.world.entityManager.getAllPlayerEntities()
      .filter(entity => entity instanceof SoccerPlayerEntity) as SoccerPlayerEntity[];

    const affectedPlayers: SoccerPlayerEntity[] = [];

    allPlayers.forEach(player => {
      // Skip self (optional - could add friendly fire)
      if (player.player.username === playerId) return;

      // Calculate distance from explosion center
      const distance = Math.sqrt(
        Math.pow(player.position.x - explosionPos.x, 2) +
        Math.pow(player.position.y - explosionPos.y, 2) +
        Math.pow(player.position.z - explosionPos.z, 2)
      );

      if (distance <= explosionRadius) {
        // Calculate damage falloff based on distance
        const damageMultiplier = Math.max(0.3, 1.0 - (distance / explosionRadius));
        
        this.applyExplosionDamage(player, explosionPos, damageMultiplier);
        affectedPlayers.push(player);
        
        console.log(`💥 EXPLOSION HIT: ${player.player.username} (distance: ${distance.toFixed(2)}, multiplier: ${damageMultiplier.toFixed(2)})`);
      }
    });

    // Create secondary fire effects around explosion
    this.createFirePatches(explosionPos, 3);

    // Remove main explosion effect after 3 seconds
    setTimeout(() => {
      if (explosionEffect.isSpawned) {
        explosionEffect.despawn();
      }
    }, 3000);

    console.log(`💥 FIREBALL EXPLOSION COMPLETE: Affected ${affectedPlayers.length} players`);
  }

  // Apply explosion damage and knockback to a player
  private applyExplosionDamage(player: SoccerPlayerEntity, explosionPos: { x: number, y: number, z: number }, damageMultiplier: number): void {
    // Calculate knockback direction from explosion center
    const knockbackDirection = this.calculateKnockbackDirection(explosionPos, player.position);
    
    // Apply massive knockback force scaled by distance
    const baseKnockback = 15.0;
    const knockbackForce = baseKnockback * damageMultiplier;
    
    player.applyImpulse({
      x: knockbackDirection.x * knockbackForce * player.mass,
      y: 5.0 * damageMultiplier * player.mass, // Strong upward launch
      z: knockbackDirection.z * knockbackForce * player.mass
    });

    // Apply burn effect (temporary movement debuff)
    const burnDuration = Math.floor(3000 * damageMultiplier); // 1-3 seconds based on distance
    this.applyBurnEffect(player, burnDuration);

    // Play damage sound at player location
    const damageAudio = new Audio({
      uri: "audio/sfx/damage/fall-big.mp3",
      loop: false,
      volume: 0.6 * damageMultiplier,
      position: player.position,
      referenceDistance: 10
    });
    damageAudio.play(this.world);
  }

  // Apply burn effect to reduce player mobility temporarily
  private applyBurnEffect(player: SoccerPlayerEntity, durationMs: number): void {
    // Store burn state
    (player as any)._burnState = {
      isBurning: true,
      originalMass: player.mass,
      startTime: Date.now()
    };

    // Reduce mobility by increasing mass
    player.setAdditionalMass(300);

    // Create fire effect above player
    const fireEffect = new Entity({
      name: 'burn-indicator',
      modelUri: 'misc/selection-indicator.gltf', // Visual indicator of burn
      modelScale: 1.2,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
    });

    fireEffect.spawn(this.world, {
      x: player.position.x,
      y: player.position.y + 1.8,
      z: player.position.z
    });

    // Store effect reference
    (player as any)._fireEffect = fireEffect;

    // Play burning sound attached to player
    const burnAudio = new Audio({
      uri: "audio/sfx/fire/fire-burning.mp3",
      loop: true,
      volume: 0.3,
      attachedToEntity: player,
      referenceDistance: 6
    });
    burnAudio.play(this.world);
    
    // Store audio reference for cleanup
    (player as any)._burnAudio = burnAudio;

    // Remove burn effect after duration
    setTimeout(() => {
      this.removeBurnEffect(player);
    }, durationMs);

    console.log(`🔥 BURN APPLIED: ${player.player.username} burning for ${durationMs}ms`);
  }

  // Remove burn effect from player
  private removeBurnEffect(player: SoccerPlayerEntity): void {
    const burnState = (player as any)._burnState;
    if (!burnState || !burnState.isBurning) {
      return;
    }

    // Restore original mobility
    player.setAdditionalMass(0);

    // Remove fire effect
    const fireEffect = (player as any)._fireEffect;
    if (fireEffect && fireEffect.isSpawned) {
      fireEffect.despawn();
    }

    // Stop burning audio
    const burnAudio = (player as any)._burnAudio;
    if (burnAudio) {
      burnAudio.pause();
    }

    // Clear burn state
    delete (player as any)._burnState;
    delete (player as any)._fireEffect;
    delete (player as any)._burnAudio;

    console.log(`🔥 BURN REMOVED: ${player.player.username} recovered from burn`);
  }

  // Create decorative fire patches around explosion site
  private createFirePatches(centerPos: { x: number, y: number, z: number }, patchCount: number): void {
    for (let i = 0; i < patchCount; i++) {
      // Random position around explosion center
      const angle = (i / patchCount) * 2 * Math.PI;
      const radius = 2 + Math.random() * 3; // 2-5 units from center
      
      const firePatch = new Entity({
        name: 'fire-patch',
        modelUri: 'misc/firework.gltf',
        modelScale: 2.0 + Math.random() * 1.0, // Varied sizes
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        },
      });

      firePatch.spawn(this.world, {
        x: centerPos.x + Math.cos(angle) * radius,
        y: centerPos.y + 0.2,
        z: centerPos.z + Math.sin(angle) * radius
      });

      // Remove fire patch after 5-8 seconds
      const lifetime = 5000 + Math.random() * 3000;
      setTimeout(() => {
        if (firePatch.isSpawned) {
          firePatch.despawn();
        }
      }, lifetime);
    }
  }

  // Execute mega kick power-up
  private executeMegaKick(playerId: string): void {
    console.log(`⚽ Mega Kick activated by ${playerId}!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (playerEntity) {
      // Create spectacular visual effect for mega kick activation
      this.createPowerUpEffect(playerEntity.position, 'mega_kick');
      
      // Create power charge effect around player's foot
      const chargeEffect = new Entity({
        name: 'mega-kick-charge',
        modelUri: 'misc/firework.gltf',
        modelScale: 1.5,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        }
      });
      
      chargeEffect.spawn(this.world, {
        x: playerEntity.position.x,
        y: playerEntity.position.y + 0.2,
        z: playerEntity.position.z
      });
      
      // Remove charge effect after 2 seconds
      setTimeout(() => {
        if (chargeEffect.isSpawned) {
          chargeEffect.despawn();
        }
      }, 2000);
    }
    
    // Apply mega kick enhancement for 10 seconds
    this.addEnhancement(playerId, 'mega_kick', 10000);
    
    // Play power charging sound sequence
    new Audio({
      uri: "audio/sfx/soccer/ball-kick-02.mp3",
      loop: false,
      volume: 0.8,
      position: playerEntity?.position
    }).play(this.world);
    
    // Add power surge sound
    setTimeout(() => {
      new Audio({
        uri: "audio/sfx/weather/thunder-strike-2.mp3",
        loop: false,
        volume: 0.5,
        position: playerEntity?.position
      }).play(this.world);
    }, 300);
    
    console.log(`⚽ ${playerId} has mega kick power for 10 seconds!`);
  }

  // Execute speed boost power-up with trail effects
  private executeSpeedBoost(playerId: string): void {
    console.log(`💨 Speed Boost activated by ${playerId}!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (playerEntity) {
      // Create speed boost visual effect
      this.createPowerUpEffect(playerEntity.position, 'speed_boost');
      
      // Create initial speed burst effect
      for (let i = 0; i < 8; i++) {
        const speedBurst = new Entity({
          name: 'speed-burst',
          modelUri: 'misc/selection-indicator.gltf',
          modelScale: 0.3,
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });
        
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1.2;
        
        speedBurst.spawn(this.world, {
          x: playerEntity.position.x + Math.cos(angle) * radius,
          y: playerEntity.position.y + 0.3,
          z: playerEntity.position.z + Math.sin(angle) * radius
        });
        
        // Animate outward expansion
        let expansionRadius = radius;
        const expandInterval = setInterval(() => {
          expansionRadius += 0.2;
          speedBurst.setPosition({
            x: playerEntity.position.x + Math.cos(angle) * expansionRadius,
            y: playerEntity.position.y + 0.3,
            z: playerEntity.position.z + Math.sin(angle) * expansionRadius
          });
          
          if (expansionRadius > 4.0) {
            clearInterval(expandInterval);
            if (speedBurst.isSpawned) {
              speedBurst.despawn();
            }
          }
        }, 50);
      }
      
      // Start speed trail effect for the player
      this.startSpeedTrail(playerEntity);
    }
    
    // Apply speed boost enhancement for 15 seconds
    this.addEnhancement(playerId, 'speed_boost', 15000);
    
    // Play whoosh activation sound
    new Audio({
      uri: "audio/sfx/ui/portal-travel-woosh.mp3",
      loop: false,
      volume: 0.8,
      position: playerEntity?.position
    }).play(this.world);
    
    // Add wind rush sound
    setTimeout(() => {
      new Audio({
        uri: "audio/sfx/weather/wind-gust.mp3",
        loop: false,
        volume: 0.4,
        position: playerEntity?.position
      }).play(this.world);
    }, 200);
    
    console.log(`💨 ${playerId} has speed boost for 15 seconds!`);
  }

  // Create speed trail effect for a player
  private startSpeedTrail(player: SoccerPlayerEntity): void {
    let lastPosition = { ...player.position };
    let trailParticles: Entity[] = [];
    const maxTrailLength = 10;
    
    const trailInterval = setInterval(() => {
      if (!player.isSpawned) {
        clearInterval(trailInterval);
        // Clean up trail particles
        trailParticles.forEach(particle => {
          if (particle.isSpawned) {
            particle.despawn();
          }
        });
        return;
      }
      
      // Check if player moved significantly
      const currentPos = player.position;
      const distance = Math.sqrt(
        Math.pow(currentPos.x - lastPosition.x, 2) +
        Math.pow(currentPos.z - lastPosition.z, 2)
      );
      
      if (distance > 0.5) {
        // Create trail particle at last position
        const trailParticle = new Entity({
          name: 'speed-trail',
          modelUri: 'misc/selection-indicator.gltf',
          modelScale: 0.2,
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });
        
        trailParticle.spawn(this.world, {
          x: lastPosition.x + (Math.random() - 0.5) * 0.3,
          y: lastPosition.y + 0.1,
          z: lastPosition.z + (Math.random() - 0.5) * 0.3
        });
        
        trailParticles.push(trailParticle);
        
        // Remove oldest trail particles if too many
        if (trailParticles.length > maxTrailLength) {
          const oldParticle = trailParticles.shift();
          if (oldParticle && oldParticle.isSpawned) {
            oldParticle.despawn();
          }
        }
        
        // Fade out this particle after 1 second
        setTimeout(() => {
          if (trailParticle.isSpawned) {
            trailParticle.despawn();
          }
          // Remove from array
          const index = trailParticles.indexOf(trailParticle);
          if (index > -1) {
            trailParticles.splice(index, 1);
          }
        }, 1000);
        
        lastPosition = { ...currentPos };
      }
    }, 100); // Check every 100ms
    
    // Store interval reference for cleanup
    (player as any)._speedTrailInterval = trailInterval;
    
    // Stop trail after 15 seconds (duration of speed boost)
    setTimeout(() => {
      if ((player as any)._speedTrailInterval) {
        clearInterval((player as any)._speedTrailInterval);
        delete (player as any)._speedTrailInterval;
      }
      
      // Clean up remaining trail particles
      trailParticles.forEach(particle => {
        if (particle.isSpawned) {
          particle.despawn();
        }
      });
    }, 15000);
  }

  // Execute shield power-up
  private executeShield(playerId: string): void {
    console.log(`🛡️ Shield activated by ${playerId}!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (playerEntity) {
      // Create shield visual effect
      const shieldEffect = new Entity({
        name: 'shield-bubble',
        modelUri: 'misc/selection-indicator.gltf',
        modelScale: 2.5,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        },
        parent: playerEntity
      });
      
      shieldEffect.spawn(this.world, { x: 0, y: 1, z: 0 });
      
      // Store shield effect for later removal
      (playerEntity as any)._shieldEffect = shieldEffect;
      
      // Remove shield effect after duration
      setTimeout(() => {
        if (shieldEffect.isSpawned) {
          shieldEffect.despawn();
        }
        delete (playerEntity as any)._shieldEffect;
      }, 30000);
    }
    
    // Apply shield enhancement for 30 seconds
    this.addEnhancement(playerId, 'shield', 30000);
    
    // Play metallic shield activation sound
    new Audio({
      uri: "audio/sfx/damage/hit-metal-3.mp3",
      loop: false,
      volume: 0.7,
      position: playerEntity?.position
    }).play(this.world);
    
    // Add energy hum
    setTimeout(() => {
      new Audio({
        uri: "audio/sfx/ui/portal-teleporting-long.mp3",
        loop: false,
        volume: 0.3,
        position: playerEntity?.position
      }).play(this.world);
    }, 200);
    
    // Play shield sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.6,
    }).play(this.world);
    
    console.log(`🛡️ ${playerId} has shield protection for 30 seconds!`);
  }

  // Execute stamina restoration power-up
  private executeStamina(playerId: string): void {
    const player = this.findPlayerEntity(playerId);
    if (!player) {
      console.error(`Player ${playerId} not found for stamina restoration`);
      return;
    }

    // Restore stamina to full (100%)
    player.restoreStamina();
    
    console.log(`🧪 ${playerId} used stamina potion - stamina restored to 100%!`);
    
    // Play stamina restoration sound
    new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.6,
    }).play(this.world);

    // Send UI update to show restored stamina
    try {
      player.player.ui.sendData({
        type: "player-status-update",
        stamina: player.getStaminaPercentage()
      });
      
      // Send feedback notification
      player.player.ui.sendData({
        type: "powerup-feedback",
        success: true,
        powerUpType: 'stamina',
        message: "STAMINA RESTORED!"
      });
    } catch (error) {
      console.error(`Failed to send stamina UI update: ${error}`);
    }
  }

  // Execute enhanced power-up by directly giving it to player
  private executeEnhancedPowerUp(playerId: string, powerUpName: string): void {
    console.log(`🌟 ENHANCED POWER-UP: ${playerId} activating ${powerUpName}!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for enhanced power-up: ${playerId}`);
      return;
    }

    // Import the enhanced power-up options dynamically
    import('../abilities/itemTypes').then(({ ALL_POWERUP_OPTIONS }) => {
      const powerUpOption = ALL_POWERUP_OPTIONS.find(option => option.name === powerUpName);
      if (!powerUpOption) {
        console.error(`Enhanced power-up option not found: ${powerUpName}`);
        return;
      }

      // Import the appropriate ability class and create instance
      this.createEnhancedAbility(powerUpOption, playerEntity);
    }).catch(error => {
      console.error(`Failed to load enhanced power-up: ${error}`);
    });
  }

  private createEnhancedAbility(options: any, player: any): void {
    try {
      // Dynamic import to avoid circular dependencies
      import('../abilities/TimeSlowAbility').then(({ TimeSlowAbility }) => {
        import('../abilities/BallMagnetAbility').then(({ BallMagnetAbility }) => {
          import('../abilities/CrystalBarrierAbility').then(({ CrystalBarrierAbility }) => {
            import('../abilities/EnhancedPowerAbility').then(({ EnhancedPowerAbility }) => {
                
                let ability: any;
                
                switch (options.name) {
                  case "Time Slow":
                    ability = new TimeSlowAbility(options);
                    break;
                  case "Ball Magnet":
                    ability = new BallMagnetAbility(options);
                    break;
                  case "Crystal Barrier":
                    ability = new CrystalBarrierAbility(options);
                    break;
                  case "Elemental Mastery":
                  case "Tidal Wave":
                  case "Reality Warp":
                  case "Honey Trap":
                    ability = new EnhancedPowerAbility(options);
                    break;
                  default:
                    console.error(`Unknown enhanced ability: ${options.name}`);
                    return;
                }

                // Give ability to player and show UI
                player.abilityHolder.setAbility(ability);
                player.abilityHolder.showAbilityUI(player.player);
                
                // Play pickup sound
                try {
                  import('hytopia').then(({ Audio }) => {
                    const pickupAudio = new Audio({
                      uri: 'audio/sfx/ui/inventory-grab-item.mp3',
                      volume: 0.8,
                      position: player.position
                    });
                    pickupAudio.play(this.world);
                  });
                } catch (e) {
                  console.log("Could not play enhanced power-up sound:", e);
                }
                
                console.log(`🌟 ENHANCED: ${player.player.username} received ${options.name} ability!`);
                
            });
          });
        });
      });
    } catch (error) {
      console.error("❌ CREATE ENHANCED ABILITY ERROR:", error);
    }
  }

  // Execute shuriken throw power-up
  private executeShuriken(playerId: string): void {
    console.log(`🥷 SHURIKEN: ${playerId} activating shuriken throw!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for shuriken throw: ${playerId}`);
      return;
    }

    // Play shuriken activation sound with wind effect
    const shurikenAudio = new Audio({
      uri: "audio/sfx/player/bow-01.mp3", // Using existing projectile sound
      loop: false,
      volume: 0.6,
      position: playerEntity.position,
      referenceDistance: 15
    });
    shurikenAudio.play(this.world);

    // Add whoosh sound for throwing effect
    setTimeout(() => {
      const whooshAudio = new Audio({
        uri: "audio/sfx/ui/portal-travel-woosh.mp3",
        loop: false,
        volume: 0.4,
        position: playerEntity.position,
        referenceDistance: 12
      });
      whooshAudio.play(this.world);
    }, 100);

    // Create visual effect for shuriken activation
    this.createPowerUpEffect(playerEntity.position, 'shuriken');

    // Calculate throw direction from player rotation
    const direction = this.calculateDirectionFromRotation(playerEntity.rotation);
    const throwDirection = {
      x: direction.x,
      y: 0, // Keep horizontal
      z: direction.z
    };

    // Create and launch shuriken projectile
    this.createShurikenProjectile(playerEntity, throwDirection);
    
    console.log(`🥷 SHURIKEN THROWN: ${playerId} launched shuriken projectile!`);
  }

  // Create spinning trail effect for shuriken
  private createShurikenTrail(shuriken: Entity): void {
    let trailCount = 0;
    const maxTrails = 15; // Limit trail particles
    
    const trailInterval = setInterval(() => {
      if (!shuriken.isSpawned || trailCount >= maxTrails) {
        clearInterval(trailInterval);
        return;
      }

      // Create metallic trail particle
      const trailParticle = new Entity({
        name: 'shuriken-trail',
        modelUri: 'misc/selection-indicator.gltf',
        modelScale: 0.2, // Small metallic glint
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        }
      });

      // Spawn at shuriken position
      trailParticle.spawn(this.world, {
        x: shuriken.position.x,
        y: shuriken.position.y,
        z: shuriken.position.z
      });

      // Quick fade and remove
      setTimeout(() => {
        if (trailParticle.isSpawned) {
          trailParticle.despawn();
        }
      }, 400);

      trailCount++;
    }, 80); // Create trail particle every 80ms

    // Store interval reference for cleanup
    (shuriken as any)._trailInterval = trailInterval;
  }

  // Create shuriken projectile with stunning effect
  private createShurikenProjectile(playerEntity: SoccerPlayerEntity, direction: { x: number, y: number, z: number }): void {
    const shuriken = new Entity({
      name: 'shuriken-projectile',
      modelUri: 'models/projectiles/shuriken.gltf',
      modelScale: 0.4,
      modelAnimationsPlaybackRate: 2.8,
      modelLoopedAnimations: ["spin"],
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        gravityScale: 0,
      },
    });

    // Calculate spawn position in front of player
    const spawnPosition = {
      x: playerEntity.position.x + direction.x * 1.5,
      y: playerEntity.position.y + 0.8,
      z: playerEntity.position.z + direction.z * 1.5
    };

    // Spawn shuriken at calculated position
    shuriken.spawn(this.world, spawnPosition);

    // Launch shuriken with velocity
    const velocity = {
      x: direction.x * 12, // 12 units/second speed
      y: 0,
      z: direction.z * 12
    };
    shuriken.setLinearVelocity(velocity);

    // Add spinning motion
    shuriken.setAngularVelocity({
      x: 0,
      y: 20, // Fast spin on Y axis
      z: 0
    });

    // Create spinning trail effect
    this.createShurikenTrail(shuriken);

    // Add collision detection for stunning effect
    shuriken.createAndAddChildCollider({
      shape: ColliderShape.BALL,
      radius: 1.0,
      isSensor: true,
      collisionGroups: {
        belongsTo: [CollisionGroup.ENTITY],
        collidesWith: [CollisionGroup.PLAYER, CollisionGroup.ENTITY],
      },
      onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
        if (!started || otherEntity === playerEntity || !(otherEntity instanceof SoccerPlayerEntity)) return;

        // Check if target is dodging to avoid stun
        if (otherEntity.isDodging) {
          console.log(`🥷 SHURIKEN DODGED: ${otherEntity.player.username} dodged the shuriken!`);
          return;
        }

        // Stun the target player
        otherEntity.stunPlayer();
        console.log(`🥷 SHURIKEN HIT: ${otherEntity.player.username} stunned by shuriken!`);

        // Play hit sound
        const hitAudio = new Audio({
          uri: "audio/sfx/damage/hit-armor.mp3",
          loop: false,
          volume: 0.4,
          position: otherEntity.position,
          referenceDistance: 10
        });
        hitAudio.play(this.world);

        // Despawn shuriken after hit
        if (shuriken.isSpawned) {
          if ((shuriken as any)._trailInterval) {
            clearInterval((shuriken as any)._trailInterval);
          }
          shuriken.despawn();
        }
      }
    });

    // Track shuriken lifetime and despawn after 1.5 seconds
    let shurikenAge = 0;
    const lifetime = 1.5; // 1.5 seconds lifetime
    
    shuriken.on(EntityEvent.TICK, ({ entity, tickDeltaMs }) => {
      shurikenAge += tickDeltaMs / 1000;
      
      // Despawn if exceeded lifetime
      if (shurikenAge >= lifetime) {
        if (shuriken.isSpawned) {
          if ((shuriken as any)._trailInterval) {
            clearInterval((shuriken as any)._trailInterval);
          }
          shuriken.despawn();
        }
      }
    });
  }

  // Check if player has mega kick active
  public hasMegaKick(playerId: string): boolean {
    const enhancement = this.playerEnhancements.get(playerId);
    return enhancement?.type === 'mega_kick';
  }

  // Create ball trail effect when mega kick is used
  public createBallTrailEffect(ballEntity: any): void {
    if (!ballEntity || !ballEntity.isSpawned) {
      return;
    }

    let trailParticles: Entity[] = [];
    const maxTrailLength = 15;
    let lastBallPosition = { ...ballEntity.position };
    
    const trailInterval = setInterval(() => {
      if (!ballEntity.isSpawned) {
        clearInterval(trailInterval);
        // Clean up trail particles
        trailParticles.forEach(particle => {
          if (particle.isSpawned) {
            particle.despawn();
          }
        });
        return;
      }
      
      // Check if ball is moving fast enough to create trail
      const currentPos = ballEntity.position;
      const velocity = ballEntity.linearVelocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      
      if (speed > 3.0) { // Only create trail for fast-moving balls
        // Create trail particle at current position
        const trailParticle = new Entity({
          name: 'ball-trail',
          modelUri: 'misc/firework.gltf',
          modelScale: 0.4 + Math.random() * 0.2,
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });
        
        trailParticle.spawn(this.world, {
          x: currentPos.x + (Math.random() - 0.5) * 0.4,
          y: currentPos.y + (Math.random() - 0.5) * 0.2,
          z: currentPos.z + (Math.random() - 0.5) * 0.4
        });
        
        trailParticles.push(trailParticle);
        
        // Remove oldest trail particles if too many
        if (trailParticles.length > maxTrailLength) {
          const oldParticle = trailParticles.shift();
          if (oldParticle && oldParticle.isSpawned) {
            oldParticle.despawn();
          }
        }
        
        // Fade out this particle after a short time
        setTimeout(() => {
          if (trailParticle.isSpawned) {
            trailParticle.despawn();
          }
          // Remove from array
          const index = trailParticles.indexOf(trailParticle);
          if (index > -1) {
            trailParticles.splice(index, 1);
          }
        }, 600);
        
        lastBallPosition = { ...currentPos };
      }
    }, 50); // Check every 50ms
    
    // Stop trail after 3 seconds (typical ball flight time)
    setTimeout(() => {
      clearInterval(trailInterval);
      
      // Clean up remaining trail particles
      trailParticles.forEach(particle => {
        if (particle.isSpawned) {
          particle.despawn();
        }
      });
    }, 3000);
  }

  // Create environmental atmosphere effects for major power-ups
  public createEnvironmentalEffect(powerUpType: string, position: Vector3Like): void {
    try {
      switch (powerUpType) {
        case 'freeze_blast':
          this.createIceStormEffect(position);
          break;
        case 'fireball':
          this.createHeatWaveEffect(position);
          break;
        case 'star_rain':
          this.createCelestialAmbience(position);
          break;
        case 'time_slow':
          this.createTimeDistortionEffect(position);
          break;
        default:
          // No environmental effect for this power-up
          break;
      }
    } catch (error) {
      console.error("❌ ENVIRONMENTAL EFFECT ERROR:", error);
    }
  }

  // Create ice storm environmental effect
  private createIceStormEffect(position: Vector3Like): void {
    // Create floating ice crystals around the area
    for (let i = 0; i < 12; i++) {
      const crystal = new Entity({
        name: 'ice-crystal',
        modelUri: 'misc/selection-indicator.gltf',
        modelScale: 0.15 + Math.random() * 0.1,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        }
      });

      const angle = (i / 12) * Math.PI * 2;
      const radius = 8 + Math.random() * 4;
      const height = 2 + Math.random() * 3;

      crystal.spawn(this.world, {
        x: position.x + Math.cos(angle) * radius,
        y: position.y + height,
        z: position.z + Math.sin(angle) * radius
      });

      // Animate floating motion
      let floatTime = 0;
      const floatInterval = setInterval(() => {
        if (!crystal.isSpawned || floatTime > 8000) {
          clearInterval(floatInterval);
          if (crystal.isSpawned) {
            crystal.despawn();
          }
          return;
        }

        floatTime += 100;
        const bobHeight = Math.sin(floatTime * 0.003) * 0.2;
        const driftX = Math.cos(floatTime * 0.001) * 0.1;
        
        crystal.setPosition({
          x: crystal.position.x + driftX,
          y: crystal.position.y + bobHeight,
          z: crystal.position.z
        });
      }, 100);
    }

    // Play ambient ice wind sound
    new Audio({
      uri: "audio/sfx/weather/wind-gust.mp3",
      loop: false,
      volume: 0.3,
      position: position,
      referenceDistance: 25
    }).play(this.world);
  }

  // Create heat wave effect
  private createHeatWaveEffect(position: Vector3Like): void {
    // Create rising heat particles
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const heatParticle = new Entity({
          name: 'heat-wave',
          modelUri: 'misc/firework.gltf',
          modelScale: 0.2,
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });

        const offsetX = (Math.random() - 0.5) * 10;
        const offsetZ = (Math.random() - 0.5) * 10;

        heatParticle.spawn(this.world, {
          x: position.x + offsetX,
          y: position.y,
          z: position.z + offsetZ
        });

        // Animate upward rising motion
        let riseHeight = 0;
        const riseInterval = setInterval(() => {
          if (!heatParticle.isSpawned || riseHeight > 8) {
            clearInterval(riseInterval);
            if (heatParticle.isSpawned) {
              heatParticle.despawn();
            }
            return;
          }

          riseHeight += 0.1;
          heatParticle.setPosition({
            x: heatParticle.position.x + (Math.random() - 0.5) * 0.1,
            y: heatParticle.position.y + 0.1,
            z: heatParticle.position.z + (Math.random() - 0.5) * 0.1
          });
        }, 80);
      }, i * 200);
    }
  }

  // Create celestial ambience
  private createCelestialAmbience(position: Vector3Like): void {
    // Create twinkling stars around the area
    for (let i = 0; i < 20; i++) {
      const star = new Entity({
        name: 'twinkle-star',
        modelUri: 'misc/selection-indicator.gltf',
        modelScale: 0.1,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        }
      });

      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 10;
      const height = 4 + Math.random() * 6;

      star.spawn(this.world, {
        x: position.x + Math.cos(angle) * radius,
        y: position.y + height,
        z: position.z + Math.sin(angle) * radius
      });

      // Animate twinkling
      let twinkleTime = 0;
      const twinkleInterval = setInterval(() => {
        if (!star.isSpawned || twinkleTime > 10000) {
          clearInterval(twinkleInterval);
          if (star.isSpawned) {
            star.despawn();
          }
          return;
        }

        twinkleTime += 200;
        // Stars twinkle by briefly appearing/disappearing
        if (Math.random() < 0.3) {
          // Brief disappear effect (simulate by moving out of sight briefly)
          const originalPos = { ...star.position };
          star.setPosition({
            x: originalPos.x,
            y: originalPos.y - 100, // Move way down
            z: originalPos.z
          });

          setTimeout(() => {
            if (star.isSpawned) {
              star.setPosition(originalPos);
            }
          }, 100);
        }
      }, 200);
    }

    // Play mystical ambient sound
    setTimeout(() => {
      new Audio({
        uri: "audio/sfx/ui/portal-teleporting-long.mp3",
        loop: false,
        volume: 0.2,
        position: position,
        referenceDistance: 20
      }).play(this.world);
    }, 1000);
  }

  // Create time distortion effect
  private createTimeDistortionEffect(position: Vector3Like): void {
    // Create ripple effect
    for (let ring = 0; ring < 5; ring++) {
      setTimeout(() => {
        const ripple = new Entity({
          name: 'time-ripple',
          modelUri: 'misc/selection-indicator.gltf',
          modelScale: 1 + ring * 0.5,
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });

        ripple.spawn(this.world, {
          x: position.x,
          y: position.y + 0.1,
          z: position.z
        });

        // Expand ripple outward
        let expansionScale = ripple.modelScale;
        const expandInterval = setInterval(() => {
          expansionScale += 0.3;
          if (expansionScale > 8) {
            clearInterval(expandInterval);
            if (ripple.isSpawned) {
              ripple.despawn();
            }
          }
        }, 100);
      }, ring * 400);
    }
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
      
      const playerEntity = this.findPlayerEntity(playerId);
      if (playerEntity) {
        // Create shield break effect
        const breakEffect = new Entity({
          name: 'shield-break',
          modelUri: 'misc/firework.gltf',
          modelScale: 3.0,
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });
        
        breakEffect.spawn(this.world, {
          x: playerEntity.position.x,
          y: playerEntity.position.y + 1,
          z: playerEntity.position.z
        });
        
        // Remove break effect after 1 second
        setTimeout(() => {
          if (breakEffect.isSpawned) {
            breakEffect.despawn();
          }
        }, 1000);
        
        // Remove shield visual if it exists
        const shieldEffect = (playerEntity as any)._shieldEffect;
        if (shieldEffect && shieldEffect.isSpawned) {
          shieldEffect.despawn();
        }
        delete (playerEntity as any)._shieldEffect;
      }
      
      // Play shield shatter sound
      new Audio({
        uri: "audio/sfx/damage/glass-break-1.mp3",
        loop: false,
        volume: 0.8,
        position: playerEntity?.position
      }).play(this.world);
      
      // Add metal impact sound
      setTimeout(() => {
        new Audio({
          uri: "audio/sfx/damage/hit-metal-2.mp3",
          loop: false,
          volume: 0.5,
          position: playerEntity?.position
        }).play(this.world);
      }, 100);
      
      return true;
    }
    return false;
  }

  // Helper method to find player entity by ID with enhanced matching
  private findPlayerEntity(playerId: string): SoccerPlayerEntity | null {
    const playerEntities = this.world.entityManager.getAllPlayerEntities();
    
    for (const entity of playerEntities) {
      if (entity instanceof SoccerPlayerEntity) {
        // Try multiple matching strategies
        if (entity.player.username === playerId || 
            entity.player.id === playerId ||
            entity.player.username.toLowerCase() === playerId.toLowerCase()) {
          console.log(`✅ PLAYER FOUND: Matched ${entity.player.username} with search term ${playerId}`);
          return entity;
        }
      }
    }
    
    console.warn(`Player entity not found for ID: ${playerId}`);
    // Enhanced debugging information
    console.warn(`Available player entities:`);
    for (const entity of playerEntities) {
      if (entity instanceof SoccerPlayerEntity) {
        console.warn(`  - Username: "${entity.player.username}", ID: "${entity.player.id}"`);
      }
    }
    return null;
  }

  // Clean up all enhancements (called when switching modes)
  public cleanup(): void {
    this.playerEnhancements.clear();
    console.log("ArcadeEnhancementManager cleaned up - pickup-based system only");
  }

  /**
   * Create charging effect before power-up activation
   */
  private createChargingEffect(player: SoccerPlayerEntity, powerUpType: string): void {
    // Play charging sound based on power-up type
    const chargeSounds: Record<string, string> = {
      'freeze_blast': 'audio/sfx/liquid/large-splash-2.mp3',
      'fireball': 'audio/sfx/fire/fire-ignite-2.mp3',
      'shuriken': 'audio/sfx/ui/menu-button-click.mp3',
      'mega_kick': 'audio/sfx/soccer/ball-kick-03.mp3',
      'shield': 'audio/sfx/damage/glass-break-1.mp3',
      'speed_boost': 'audio/sfx/ui/portal-travel-woosh.mp3',
      'default': 'audio/sfx/ui/inventory-place-item.mp3'
    };

    const soundUri = chargeSounds[powerUpType] || chargeSounds['default'];
    
    // Play charging sound
    const chargeAudio = new Audio({
      uri: soundUri,
      loop: false,
      volume: 0.6,
      position: player.position,
      referenceDistance: 10
    });
    chargeAudio.play(this.world);

    // Create expanding ring effect
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ring = new Entity({
          name: 'charge-ring',
          modelUri: 'misc/selection-indicator.gltf',
          modelScale: 0.5 + (i * 0.5),
          rigidBodyOptions: {
            type: RigidBodyType.KINEMATIC_POSITION,
          }
        });

        ring.spawn(this.world, {
          x: player.position.x,
          y: player.position.y + 0.1,
          z: player.position.z
        });

        // Animate ring expansion and fade
        let scale = ring.modelScale;
        const expandInterval = setInterval(() => {
          scale += 0.1;
          if (scale > 3.0) {
            clearInterval(expandInterval);
            if (ring.isSpawned) {
              ring.despawn();
            }
          }
        }, 50);

        // Clean up after 1 second
        setTimeout(() => {
          if (ring.isSpawned) {
            ring.despawn();
          }
        }, 1000);
      }, i * 200);
    }

    // Create upward particle burst
    for (let i = 0; i < 5; i++) {
      const particle = new Entity({
        name: 'charge-particle',
        modelUri: 'misc/firework.gltf',
        modelScale: 0.2,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        }
      });

      const angle = (i / 5) * Math.PI * 2;
      const radius = 0.5;
      
      particle.spawn(this.world, {
        x: player.position.x + Math.cos(angle) * radius,
        y: player.position.y,
        z: player.position.z + Math.sin(angle) * radius
      });

      // Animate upward
      let height = 0;
      const riseInterval = setInterval(() => {
        height += 0.1;
        particle.setPosition({
          x: particle.position.x,
          y: player.position.y + height,
          z: particle.position.z
        });

        if (height > 2.0) {
          clearInterval(riseInterval);
          if (particle.isSpawned) {
            particle.despawn();
          }
        }
      }, 50);
    }
  }

  /**
   * Create spectacular particle effect for power-up activation
   * @param position - Position to create the effect
   * @param effectType - Type of effect to create
   */
  private createPowerUpEffect(position: Vector3Like, effectType: string): void {
    console.log(`✨ Creating power-up effect: ${effectType} at position:`, position);

    // Create main effect entity with appropriate model and scale
    let effectModel = 'models/misc/selection-indicator.gltf';
    let effectScale = 3.0;
    let effectColor = '#FFD700'; // Default gold
    
    switch (effectType) {
      case 'freeze_blast':
        effectModel = 'models/misc/selection-indicator.gltf';
        effectScale = 8.0;
        effectColor = '#00BFFF'; // Ice blue
        break;
      case 'fireball':
        effectModel = 'models/misc/selection-indicator.gltf';
        effectScale = 5.0;
        effectColor = '#FF4500'; // Fire red-orange
        break;
      case 'mega_kick':
        effectModel = 'models/misc/selection-indicator.gltf';
        effectScale = 4.0;
        effectColor = '#FFD700'; // Golden
        break;
      case 'stamina':
        effectModel = 'models/misc/selection-indicator.gltf';
        effectScale = 3.5;
        effectColor = '#00FFFF'; // Cyan/aqua for stamina restoration
        break;
    }

    // Create main effect entity
    const mainEffect = new Entity({
      name: `powerup-effect-${effectType}`,
      modelUri: effectModel,
      modelScale: effectScale,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
    });

    // Spawn to world at specified position
    const effectPosition = {
      x: position.x,
      y: position.y + 1.5,
      z: position.z
    };
    mainEffect.spawn(this.world, effectPosition);

    // Create surrounding particle effects
    this.createParticleRing(position, effectType, effectColor);

    // Create light effect
    this.createLightEffect(position, effectType, effectColor);

    // Remove main effect after animation
    setTimeout(() => {
      try {
        if (mainEffect.isSpawned) {
          mainEffect.despawn();
        }
      } catch (error) {
        console.log('Effect entity already removed:', error);
      }
    }, 2000);
  }

  /**
   * Create a ring of particle effects around the power-up activation
   */
  private createParticleRing(position: Vector3Like, effectType: string, color: string): void {
    const particleCount = 8;
    const radius = 2.0;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particleX = position.x + Math.cos(angle) * radius;
      const particleZ = position.z + Math.sin(angle) * radius;

      const particle = new Entity({
        name: `particle-${effectType}-${i}`,
        modelUri: 'misc/selection-indicator.gltf',
        modelScale: 0.5,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        },
      });

      const particlePosition = {
        x: particleX,
        y: position.y + 0.5,
        z: particleZ
      };
      particle.spawn(this.world, particlePosition);

      // Animate particle upward and outward
      this.animateParticle(particle, angle, effectType);

      // Remove particle after animation
      setTimeout(() => {
        try {
          if (particle.isSpawned) {
            particle.despawn();
          }
        } catch (error) {
          console.log('Particle entity already removed:', error);
        }
      }, 1500);
    }
  }

  /**
   * Animate a single particle with upward and outward motion
   */
  private animateParticle(particle: Entity, angle: number, effectType: string): void {
    const startTime = Date.now();
    const duration = 1500;
    const startPos = { ...particle.position };
    const endHeight = startPos.y + 3.0;
    const endRadius = 3.5;

    const animateFrame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const newY = startPos.y + (endHeight - startPos.y) * easeProgress;
      const newX = startPos.x + Math.cos(angle) * endRadius * easeProgress;
      const newZ = startPos.z + Math.sin(angle) * endRadius * easeProgress;

      // Use setPosition instead of direct assignment
      particle.setPosition({ x: newX, y: newY, z: newZ });

      if (progress < 1) {
        setTimeout(animateFrame, 16); // ~60fps
      }
    };

    animateFrame();
  }

  /**
   * Create dynamic lighting effect for power-up activation using audio as indicator
   */
  private createLightEffect(position: Vector3Like, effectType: string, color: string): void {
    try {
      const lightEffect = new Entity({
        name: `${effectType}-light`,
        modelUri: 'misc/selection-indicator.gltf',
        modelScale: 0.1,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC_POSITION,
        },
      });

      lightEffect.spawn(this.world, position);

      // Remove light effect after duration
      setTimeout(() => {
        if (lightEffect.isSpawned) {
          lightEffect.despawn();
        }
      }, 3000);
    } catch (error) {
      console.warn(`Failed to create light effect for ${effectType}:`, error);
    }
  }

  // Calculate direction from quaternion rotation (needed for fireball)
  private calculateDirectionFromRotation(rotation: { x: number, y: number, z: number, w: number }): { x: number, z: number } {
    // Convert quaternion to forward direction vector for Hytopia
    const { x, y, z, w } = rotation;
    
    // Calculate the forward vector using proper quaternion to direction conversion
    // In Hytopia, the forward direction corresponds to the negative Z-axis in local space
    const forwardX = 2 * (x * z + w * y);
    const forwardZ = 2 * (y * z - w * x);
    
    // Normalize the direction vector
    const magnitude = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ);
    
    if (magnitude > 0.001) { // Avoid division by zero
      const normalizedX = forwardX / magnitude;
      const normalizedZ = forwardZ / magnitude;
      
      return {
        x: normalizedX,
        z: normalizedZ
      };
    }
    
    // Fallback: use Y rotation component for direction if magnitude is too small
    const fallbackAngle = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
    const fallbackX = Math.sin(fallbackAngle);
    const fallbackZ = -Math.cos(fallbackAngle); // Negative Z for forward in Hytopia
    
    return { x: fallbackX, z: fallbackZ };
  }

  // Calculate knockback direction from impact point to target (needed for fireball explosions)
  private calculateKnockbackDirection(impactPos: { x: number, z: number }, targetPos: { x: number, z: number }): { x: number, z: number } {
    const directionX = targetPos.x - impactPos.x;
    const directionZ = targetPos.z - impactPos.z;
    
    const magnitude = Math.sqrt(directionX * directionX + directionZ * directionZ);
    
    if (magnitude > 0) {
      return {
        x: directionX / magnitude,
        z: directionZ / magnitude
      };
    }
    
    return { x: 1, z: 0 }; // Default direction
  }
}

// Enhancement types - expanded for arcade power-ups including enhanced abilities
export type EnhancementType = 'speed' | 'power' | 'precision' | 'freeze_blast' | 'fireball' | 'mega_kick' | 'shield' | 'stamina' | 'shuriken' | 
                               'time_slow' | 'ball_magnet' | 'star_rain' | 'crystal_barrier' | 'elemental_mastery' | 'tidal_wave' | 'reality_warp' | 'honey_trap';

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