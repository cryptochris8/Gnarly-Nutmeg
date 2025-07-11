import { Entity, World, type Vector3Like, Audio, RigidBodyType, ColliderShape } from "hytopia";
import SoccerPlayerEntity from "./SoccerPlayerEntity";
import { isArcadeMode } from "../state/gameModes";

export enum ProjectileType {

  FIREBALL = "fireball",
  ENERGY_ORB = "energy_orb"
}

interface ProjectileConfig {
  modelUri: string;
  speed: number;
  damage: number;
  effectRadius: number;
  soundUri: string;
  stunDuration: number; // in milliseconds
}

const PROJECTILE_CONFIGS: Record<ProjectileType, ProjectileConfig> = {
  [ProjectileType.FIREBALL]: {
    modelUri: "models/projectiles/fireball.gltf", 
    speed: 12,
    damage: 2,
    effectRadius: 4,
    soundUri: "audio/sfx/fire/fire-ignite.mp3",
    stunDuration: 1500 // 1.5 seconds
  },
  [ProjectileType.ENERGY_ORB]: {
    modelUri: "models/projectiles/energy-orb-projectile.gltf",
    speed: 10,
    damage: 1,
    effectRadius: 3,
    soundUri: "audio/sfx/damage/explode.mp3",
    stunDuration: 3000 // 3 seconds
  }
};

export class ProjectileEntity extends Entity {
  private projectileType: ProjectileType;
  private owner: SoccerPlayerEntity;
  private direction: Vector3Like;
  private config: ProjectileConfig;
  private lifeTime: number = 0;
  private maxLifeTime: number = 5000; // 5 seconds max flight time

  constructor(
    type: ProjectileType, 
    owner: SoccerPlayerEntity, 
    startPosition: Vector3Like, 
    direction: Vector3Like
  ) {
    const config = PROJECTILE_CONFIGS[type];
    
    super({
      name: `Projectile_${type}_${owner.player.username}`,
      modelUri: config.modelUri,
      modelScale: 0.8,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [{
          shape: ColliderShape.BALL,
          radius: 0.3,
          isSensor: true // Sensor so it doesn't physically collide
        }]
      }
    });
    
    this.projectileType = type;
    this.owner = owner;
    this.direction = this.normalizeVector(direction);
    this.config = config;
    
    // Spawn the projectile
    if (owner.world) {
      this.spawn(owner.world, startPosition);
    }
    
    // Play launch sound
    if (owner.world) {
      new Audio({
        uri: config.soundUri,
        loop: false,
        volume: 0.7,
        attachedToEntity: this
      }).play(owner.world);
    }
    
    // Start movement
    this.startMovement();
    
    console.log(`🎯 ${type.toUpperCase()} launched by ${owner.player.username} (Arcade Mode)`);
  }

  private normalizeVector(vector: Vector3Like): Vector3Like {
    const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (magnitude === 0) return { x: 0, y: 0, z: 1 }; // Default forward direction
    
    return {
      x: vector.x / magnitude,
      y: vector.y / magnitude,
      z: vector.z / magnitude
    };
  }

  private startMovement(): void {
    // Update projectile position every frame
    const updateInterval = setInterval(() => {
      if (!this.isSpawned) {
        clearInterval(updateInterval);
        return;
      }
      
      this.lifeTime += 50; // 50ms intervals
      
      // Check if projectile has exceeded max lifetime
      if (this.lifeTime >= this.maxLifeTime) {
        this.explode();
        clearInterval(updateInterval);
        return;
      }
      
      // Move projectile forward
      const currentPos = this.position;
      const speed = this.config.speed * 0.05; // Scale for 50ms intervals
      
      const newPosition = {
        x: currentPos.x + this.direction.x * speed,
        y: currentPos.y + this.direction.y * speed,
        z: currentPos.z + this.direction.z * speed
      };
      
      // Check for collision with players
      const hitPlayer = this.checkPlayerCollision(newPosition);
      if (hitPlayer) {
        this.hitPlayer(hitPlayer);
        clearInterval(updateInterval);
        return;
      }
      
      // Update position
      this.setPosition(newPosition);
      
      // Add rotation for visual effect
      const currentRotation = this.rotation;
      this.setRotation({
        x: currentRotation.x,
        y: currentRotation.y + 0.2, // Spin around Y axis
        z: currentRotation.z,
        w: currentRotation.w
      });
      
    }, 50); // Update every 50ms
  }

  private checkPlayerCollision(position: Vector3Like): SoccerPlayerEntity | null {
    if (!this.world) return null;
    
    // Check collision with all player entities
    const playerEntities = this.world.entityManager.getAllPlayerEntities();
    
    for (const entity of playerEntities) {
      if (!(entity instanceof SoccerPlayerEntity)) continue;
      if (entity === this.owner) continue; // Don't hit the owner
      if (entity.team === this.owner.team) continue; // Don't hit teammates
      
      const distance = Math.sqrt(
        Math.pow(entity.position.x - position.x, 2) +
        Math.pow(entity.position.y - position.y, 2) +
        Math.pow(entity.position.z - position.z, 2)
      );
      
      if (distance <= this.config.effectRadius) {
        return entity;
      }
    }
    
    return null;
  }

  private hitPlayer(target: SoccerPlayerEntity): void {
    // Only work in arcade mode
    if (!isArcadeMode()) {
      this.explode();
      return;
    }
    
    console.log(`🎯 ${this.projectileType.toUpperCase()} hit ${target.player.username}!`);
    
    // Apply effect based on projectile type
    switch (this.projectileType) {
      case ProjectileType.FIREBALL:
        this.applyFireballEffect(target);
        break;
      case ProjectileType.ENERGY_ORB:
        this.applyEnergyOrbEffect(target);
        break;
    }
    
    // Explode on impact
    this.explode();
  }



  private applyFireballEffect(target: SoccerPlayerEntity): void {
    // Stun and apply knockback
    target.stunPlayer();
    
    // Apply knockback impulse
    const knockbackDirection = {
      x: target.position.x - this.position.x,
      y: 0.5, // Slight upward force
      z: target.position.z - this.position.z
    };
    const normalizedKnockback = this.normalizeVector(knockbackDirection);
    
    target.applyImpulse({
      x: normalizedKnockback.x * 8,
      y: normalizedKnockback.y * 3,
      z: normalizedKnockback.z * 8
    });
    
    // Play explosion sound
    if (this.world) {
      new Audio({
        uri: "audio/sfx/damage/explode.mp3",
        loop: false,
        volume: 0.8
      }).play(this.world);
    }
    
    console.log(`🔥 Fireball hit ${target.player.username} with knockback!`);
  }

  private applyEnergyOrbEffect(target: SoccerPlayerEntity): void {
    // Longer stun duration
    target.stunPlayer();
    
    // Freeze effect (if player has freeze method)
    if (typeof target.freeze === 'function') {
      target.freeze();
      setTimeout(() => {
        if (typeof target.unfreeze === 'function') {
          target.unfreeze();
        }
      }, 1000); // 1 second freeze
    }
    
    // Play energy sound
    if (this.world) {
      new Audio({
        uri: "audio/sfx/liquid/large-splash.mp3",
        loop: false,
        volume: 0.7
      }).play(this.world);
    }
    
    console.log(`⚡ Energy orb froze ${target.player.username}!`);
  }

  private explode(): void {
    // Create explosion effect at current position
    console.log(`💥 ${this.projectileType.toUpperCase()} exploded at position`, this.position);
    
    // Play explosion sound
    if (this.world) {
      new Audio({
        uri: "audio/sfx/damage/explode.mp3",
        loop: false,
        volume: 0.4
      }).play(this.world);
    }
    
    // Remove the projectile
    if (this.isSpawned) {
      this.despawn();
    }
  }
}

// Helper function to create and launch projectiles
export function launchProjectile(
  type: ProjectileType,
  owner: SoccerPlayerEntity,
  direction: Vector3Like
): ProjectileEntity | null {
  // Only work in arcade mode
  if (!isArcadeMode()) {
    console.log("🎯 Projectiles only available in Arcade Mode!");
    return null;
  }
  
  // Calculate launch position (slightly in front of player)
  const launchPosition = {
    x: owner.position.x + direction.x * 1.5,
    y: owner.position.y + 1.0, // Launch from chest height
    z: owner.position.z + direction.z * 1.5
  };
  
  return new ProjectileEntity(type, owner, launchPosition, direction);
} 