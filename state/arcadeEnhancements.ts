// Arcade Enhancement System - Only Active in Arcade Mode
// This system enhances existing gameplay without modifying FIFA mode

import { World, Audio, Entity, RigidBodyType, type Vector3Like } from "hytopia";
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
        this.executeShurikenProjectile(playerId);
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

  // Execute freeze blast power-up with area effect and visual feedback
  private executeFreezeBlast(playerId: string): void {
    console.log(`🧊 FREEZE BLAST: ${playerId} activating freeze blast!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for freeze blast: ${playerId}`);
      return;
    }

    // Play freeze blast activation sound
    const freezeActivationAudio = new Audio({
      uri: "audio/sfx/liquid/large-splash.mp3", // Using splash as ice crackling sound
      loop: false,
      volume: 0.6,
      position: playerEntity.position,
      referenceDistance: 15
    });
    freezeActivationAudio.play(this.world);

    // Create spectacular visual effect for freeze blast activation
    this.createPowerUpEffect(playerEntity.position, 'freeze_blast');

    // Create visual freeze effect entity
    const freezeEffect = new Entity({
      name: 'freeze-effect',
      modelUri: 'models/misc/selection-indicator.gltf', // Using existing model as freeze indicator
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
        uri: "audio/sfx/liquid/water-splash.mp3", // Using water splash as freeze hit sound
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

  // Freeze a player by disabling movement and adding visual indicator
  private freezePlayer(player: SoccerPlayerEntity): void {
    // Disable player movement by setting velocity to zero and adding mass
    player.setLinearVelocity({ x: 0, y: 0, z: 0 });
    player.setAngularVelocity({ x: 0, y: 0, z: 0 });
    
    // Store original state
    (player as any)._frozenState = {
      originalMass: player.mass,
      wasFrozen: true
    };

    // Make player much heavier to prevent movement
    player.setAdditionalMass(1000);

    // Create ice effect indicator above player
    const iceEffect = new Entity({
      name: 'ice-indicator',
      modelUri: 'models/misc/selection-indicator.gltf',
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

  // Execute shuriken projectile power-up with advanced physics and effects
  private executeShurikenProjectile(playerId: string): void {
    console.log(`🌟 SHURIKEN: ${playerId} launching shuriken projectile!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for shuriken: ${playerId}`);
      return;
    }

    // Play shuriken throw sound
    const throwAudio = new Audio({
      uri: "audio/sfx/player/bow-01.mp3", // Using bow sound as throwing sound
      loop: false,
      volume: 0.7,
      position: playerEntity.position,
      referenceDistance: 12
    });
    throwAudio.play(this.world);

    // Create spectacular visual effect for shuriken activation
    this.createPowerUpEffect(playerEntity.position, 'shuriken_throw');

    // Calculate throw direction from player's facing direction
    const rotation = playerEntity.rotation;
    const direction = this.calculateDirectionFromRotation(rotation);
    
    // Create shuriken projectile entity
    const shuriken = new Entity({
      name: 'shuriken-projectile',
      modelUri: 'models/projectiles/arrow.gltf', // Using arrow model as shuriken base
      modelScale: 0.8,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        ccdEnabled: true, // Enable continuous collision detection for fast-moving projectiles
        linearDamping: 0.1, // Slight air resistance
        angularDamping: 0.05, // Minimal rotational damping for spinning effect
        enabledRotations: { x: true, y: true, z: true }, // Allow full rotation for spinning
        gravityScale: 0.3, // Reduced gravity for projectile flight
      },
    });

    // Spawn shuriken slightly in front of player
    const spawnOffset = 1.5;
    const shurikenPosition = {
      x: playerEntity.position.x + direction.x * spawnOffset,
      y: playerEntity.position.y + 1.0, // Eye level
      z: playerEntity.position.z + direction.z * spawnOffset
    };

    shuriken.spawn(this.world, shurikenPosition);

    // Apply launch velocity and spinning motion
    const launchForce = 15.0;
    const launchVelocity = {
      x: direction.x * launchForce,
      y: 2.0, // Slight upward trajectory
      z: direction.z * launchForce
    };
    
    shuriken.setLinearVelocity(launchVelocity);
    
    // Add spinning motion for visual effect
    shuriken.setAngularVelocity({
      x: 0,
      y: 20, // Fast spinning around Y axis
      z: 0
    });

    // Play whoosh sound that follows the projectile
    const whooshAudio = new Audio({
      uri: "audio/sfx/player/bow-02.mp3", // Projectile flight sound
      loop: true,
      volume: 0.4,
      attachedToEntity: shuriken,
      referenceDistance: 8
    });
    whooshAudio.play(this.world);

    // Track projectile for collision detection and cleanup
    this.trackShurikenProjectile(shuriken, playerId, whooshAudio);

    console.log(`🌟 SHURIKEN LAUNCHED: Direction [${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}], Force: ${launchForce}`);
  }

  // Track shuriken projectile for collision detection and effects
  private trackShurikenProjectile(shuriken: Entity, playerId: string, whooshAudio: Audio): void {
    let hasHit = false;
    const maxFlightTime = 5000; // 5 seconds max flight time
    const checkInterval = 100; // Check every 100ms
    let flightTime = 0;

    const trackingInterval = setInterval(() => {
      flightTime += checkInterval;

      // Check if projectile still exists
      if (!shuriken.isSpawned || hasHit) {
        clearInterval(trackingInterval);
        whooshAudio.pause();
        return;
      }

      // Check for collision with players
      const shurikenPos = shuriken.position;
      const allPlayers = this.world.entityManager.getAllPlayerEntities()
        .filter(entity => entity instanceof SoccerPlayerEntity) as SoccerPlayerEntity[];

      const hitPlayer = allPlayers.find(player => {
        // Skip self
        if (player.player.username === playerId) return false;
        
        // Calculate distance to player
        const distance = Math.sqrt(
          Math.pow(player.position.x - shurikenPos.x, 2) +
          Math.pow(player.position.y - shurikenPos.y, 2) +
          Math.pow(player.position.z - shurikenPos.z, 2)
        );

        return distance <= 1.2; // Hit radius
      });

      if (hitPlayer) {
        hasHit = true;
        this.applyShurikenHit(hitPlayer, shurikenPos);
        
        // Stop tracking and clean up
        clearInterval(trackingInterval);
        whooshAudio.pause();
        
        // Remove shuriken after impact
        setTimeout(() => {
          if (shuriken.isSpawned) {
            shuriken.despawn();
          }
        }, 500);
        
        return;
      }

      // Check for out of bounds or max flight time
      if (flightTime >= maxFlightTime || shurikenPos.y < -10) {
        console.log(`🌟 SHURIKEN: Projectile expired or went out of bounds`);
        hasHit = true;
        clearInterval(trackingInterval);
        whooshAudio.pause();
        
        // Clean up projectile
        if (shuriken.isSpawned) {
          shuriken.despawn();
        }
      }
    }, checkInterval);
  }

  // Apply shuriken hit effects to target player
  private applyShurikenHit(hitPlayer: SoccerPlayerEntity, impactPosition: { x: number, y: number, z: number }): void {
    console.log(`🌟 SHURIKEN HIT: ${hitPlayer.player.username} hit by shuriken!`);

    // Play impact sound at hit location
    const impactAudio = new Audio({
      uri: "audio/sfx/damage/fall-big.mp3", // Using damage sound for impact
      loop: false,
      volume: 0.8,
      position: impactPosition,
      referenceDistance: 10
    });
    impactAudio.play(this.world);

    // Apply knockback force to hit player
    const knockbackForce = 8.0;
    const knockbackDirection = this.calculateKnockbackDirection(impactPosition, hitPlayer.position);
    
    hitPlayer.applyImpulse({
      x: knockbackDirection.x * knockbackForce * hitPlayer.mass,
      y: 2.0 * hitPlayer.mass, // Slight upward knock
      z: knockbackDirection.z * knockbackForce * hitPlayer.mass
    });

    // Create impact effect at hit location
    const impactEffect = new Entity({
      name: 'shuriken-impact',
      modelUri: 'models/misc/firework.gltf', // Using firework as impact effect
      modelScale: 1.0,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
    });

    impactEffect.spawn(this.world, impactPosition);

    // Stun the hit player briefly
    this.stunPlayer(hitPlayer, 2000); // 2 second stun

    // Remove impact effect after 2 seconds
    setTimeout(() => {
      if (impactEffect.isSpawned) {
        impactEffect.despawn();
      }
    }, 2000);

    console.log(`🌟 SHURIKEN IMPACT: Applied knockback and 2s stun to ${hitPlayer.player.username}`);
  }

  // Calculate direction from quaternion rotation
  private calculateDirectionFromRotation(rotation: { x: number, y: number, z: number, w: number }): { x: number, z: number } {
    // Convert quaternion to forward direction vector
    // For Hytopia, forward is typically the negative Z direction before rotation
    const { x, y, z, w } = rotation;
    
    // Calculate forward vector from quaternion
    const forwardX = 2 * (x * z + w * y);
    const forwardZ = 2 * (y * z - w * x);
    
    // Normalize the direction
    const magnitude = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ);
    
    if (magnitude > 0) {
      return {
        x: forwardX / magnitude,
        z: forwardZ / magnitude
      };
    }
    
    // Default forward direction if calculation fails
    return { x: 0, z: -1 };
  }

  // Calculate knockback direction from impact point to target
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

  // Stun a player temporarily
  private stunPlayer(player: SoccerPlayerEntity, durationMs: number): void {
    // Store stun state
    (player as any)._stunState = {
      isStunned: true,
      originalMass: player.mass
    };

    // Increase mass to reduce mobility
    player.setAdditionalMass(500);

    // Create stun effect above player
    const stunEffect = new Entity({
      name: 'stun-indicator',
      modelUri: 'models/misc/selection-indicator.gltf',
      modelScale: 1.0,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
      },
    });

    stunEffect.spawn(this.world, {
      x: player.position.x,
      y: player.position.y + 2.0,
      z: player.position.z
    });

    // Store effect reference
    (player as any)._stunEffect = stunEffect;

    // Remove stun after duration
    setTimeout(() => {
      this.unstunPlayer(player);
    }, durationMs);
  }

  // Remove stun effect from player
  private unstunPlayer(player: SoccerPlayerEntity): void {
    const stunState = (player as any)._stunState;
    if (!stunState || !stunState.isStunned) {
      return;
    }

    // Restore original mass
    player.setAdditionalMass(0);

    // Remove stun effect
    const stunEffect = (player as any)._stunEffect;
    if (stunEffect && stunEffect.isSpawned) {
      stunEffect.despawn();
    }

    // Clear stun state
    delete (player as any)._stunState;
    delete (player as any)._stunEffect;

    console.log(`🌟 UNSTUNNED: ${player.player.username} recovered from stun`);
  }

  // Execute fireball power-up with explosive area damage and spectacular effects
  private executeFireball(playerId: string): void {
    console.log(`🔥 FIREBALL: ${playerId} launching explosive fireball!`);
    
    const playerEntity = this.findPlayerEntity(playerId);
    if (!playerEntity) {
      console.error(`Player entity not found for fireball: ${playerId}`);
      return;
    }

    // Play fireball launch sound
    const launchAudio = new Audio({
      uri: "audio/sfx/fire/fire-ignite.mp3", // Fire ignition sound for launch
      loop: false,
      volume: 0.8,
      position: playerEntity.position,
      referenceDistance: 15
    });
    launchAudio.play(this.world);

    // Create spectacular visual effect for fireball activation
    this.createPowerUpEffect(playerEntity.position, 'fireball');

    // Calculate launch direction from player's facing direction
    const rotation = playerEntity.rotation;
    const direction = this.calculateDirectionFromRotation(rotation);
    
    // Create fireball projectile entity with fire model
    const fireball = new Entity({
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

    // Spawn fireball in front of player at chest height
    const spawnOffset = 2.0;
    const fireballPosition = {
      x: playerEntity.position.x + direction.x * spawnOffset,
      y: playerEntity.position.y + 1.2, // Chest level
      z: playerEntity.position.z + direction.z * spawnOffset
    };

    fireball.spawn(this.world, fireballPosition);

    // Apply powerful launch velocity
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

    // Play continuous burning sound that follows the fireball
    const burnAudio = new Audio({
      uri: "audio/sfx/fire/fire-burning.mp3", // Continuous burning sound
      loop: true,
      volume: 0.5,
      attachedToEntity: fireball,
      referenceDistance: 12
    });
    burnAudio.play(this.world);

    // Track fireball for explosion detection
    this.trackFireballProjectile(fireball, playerId, burnAudio);

    console.log(`🔥 FIREBALL LAUNCHED: Direction [${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}], Force: ${launchForce}`);
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

    // Play massive explosion sound
    const explosionAudio = new Audio({
      uri: "audio/sfx/damage/explode.mp3", // Main explosion sound
      loop: false,
      volume: 1.0,
      position: explosionPos,
      referenceDistance: 25 // Large radius for explosion
    });
    explosionAudio.play(this.world);

    // Create massive explosion visual effect
    const explosionEffect = new Entity({
      name: 'fireball-explosion',
      modelUri: 'models/misc/firework.gltf', // Using firework as explosion base
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
      modelUri: 'models/misc/selection-indicator.gltf', // Visual indicator of burn
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
        modelUri: 'models/misc/firework.gltf',
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
    }
    
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
      case 'shuriken_throw':
        effectModel = 'models/misc/selection-indicator.gltf';
        effectScale = 2.0;
        effectColor = '#C0C0C0'; // Silver
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
        modelUri: 'models/misc/selection-indicator.gltf',
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
    // Since direct lighting entities are complex, use audio with 3D positioning
    // to create an immersive effect that represents the light/energy
    const lightEffectAudio = new Audio({
      uri: "audio/sfx/ui/inventory-grab-item.mp3",
      loop: false,
      volume: 0.3,
      position: {
        x: position.x,
        y: position.y + 2.0,
        z: position.z
      },
      referenceDistance: 8
    });

    lightEffectAudio.play(this.world);
    
    console.log(`✨ Light effect simulated for ${effectType} at position:`, position);
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