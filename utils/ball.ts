import {
  BlockType,
  ColliderShape,
  Entity,
  RigidBodyType,
  World,
  Audio,
  EntityEvent,
  Collider,
  CollisionGroup,
} from "hytopia";
import sharedState from "../state/sharedState";
import { getDirectionFromRotation } from "./direction";
import { BALL_CONFIG, BALL_SPAWN_POSITION, FIELD_MIN_Y, GAME_CONFIG } from "../state/gameConfig";
import { soccerMap } from "../state/map";
import type { BoundaryInfo } from "../state/map";
import SoccerPlayerEntity from "../entities/SoccerPlayerEntity";

// Goal sensor tracking
let redGoalSensor: Collider | null = null;
let blueGoalSensor: Collider | null = null;
let ballHasEnteredGoal = false;
let goalSensorDebounce = 0;
let worldRef: World | null = null; // Store world reference for goal sensor callbacks

/**
 * Create goal line sensors for reliable goal detection
 * These sensors detect when the ball crosses the goal line, regardless of bouncing
 */
function createGoalSensors(world: World) {
  // Store world reference for goal sensor callbacks
  worldRef = world;
  
  // Red goal sensor (Blue team scores when ball enters)
  // FIXED: Position sensor INSIDE the goal, not on the goal line
  redGoalSensor = new Collider({
    shape: ColliderShape.BLOCK,
    halfExtents: { x: 1.5, y: 4, z: 5 }, // 3x8x10 goal area (smaller to fit inside goal)
    isSensor: true,
    tag: 'red-goal-sensor',
    relativePosition: { 
      x: GAME_CONFIG.AI_GOAL_LINE_X_RED - 1.5, // Position 1.5 units INSIDE the goal
      y: 2, 
      z: GAME_CONFIG.AI_FIELD_CENTER_Z 
    },
    onCollision: (other: BlockType | Entity, started: boolean) => {
      if (other instanceof Entity && other.name === 'SoccerBall' && started) {
        console.log('🥅 Ball entered RED goal sensor - BLUE TEAM SCORES!');
        handleGoalSensorTrigger('blue', other);
      }
    },
  });

  // Blue goal sensor (Red team scores when ball enters)
  // FIXED: Position sensor INSIDE the goal, not on the goal line
  blueGoalSensor = new Collider({
    shape: ColliderShape.BLOCK,
    halfExtents: { x: 1.5, y: 4, z: 5 }, // 3x8x10 goal area (smaller to fit inside goal)
    isSensor: true,
    tag: 'blue-goal-sensor',
    relativePosition: { 
      x: GAME_CONFIG.AI_GOAL_LINE_X_BLUE + 1.5, // Position 1.5 units INSIDE the goal
      y: 2, 
      z: GAME_CONFIG.AI_FIELD_CENTER_Z 
    },
    onCollision: (other: BlockType | Entity, started: boolean) => {
      if (other instanceof Entity && other.name === 'SoccerBall' && started) {
        console.log('🥅 Ball entered BLUE goal sensor - RED TEAM SCORES!');
        handleGoalSensorTrigger('red', other);
      }
    },
  });

  // Add sensors to world simulation
  redGoalSensor.addToSimulation(world.simulation);
  blueGoalSensor.addToSimulation(world.simulation);
  
  console.log('⚽ Goal sensors created and added to simulation');
  console.log(`   Red goal sensor: X=${GAME_CONFIG.AI_GOAL_LINE_X_RED - 1.5}, Z=${GAME_CONFIG.AI_FIELD_CENTER_Z} (inside Red goal)`);
  console.log(`   Blue goal sensor: X=${GAME_CONFIG.AI_GOAL_LINE_X_BLUE + 1.5}, Z=${GAME_CONFIG.AI_FIELD_CENTER_Z} (inside Blue goal)`);
}

/**
 * Handle goal sensor trigger with debouncing to prevent multiple rapid goals
 */
function handleGoalSensorTrigger(scoringTeam: 'red' | 'blue', ballEntity: Entity) {
  const currentTime = Date.now();
  
  // Debounce goals to prevent multiple rapid triggers (2 second cooldown)
  if (currentTime - goalSensorDebounce < 2000) {
    console.log('🚫 Goal sensor triggered but debounced (too recent)');
    return;
  }
  
  // Skip if ball is attached to a player (shouldn't happen in goal area, but safety check)
  if (sharedState.getAttachedPlayer() !== null) {
    console.log('🚫 Goal sensor triggered but ball is attached to player');
    return;
  }
  
  // Skip if goal is already being handled
  if (ballHasEnteredGoal) {
    console.log('🚫 Goal sensor triggered but goal already being handled');
    return;
  }
  
  // ADDITIONAL VALIDATION: Verify ball is actually inside the goal boundaries
  const ballPos = ballEntity.position;
  const GOAL_WIDTH = 10;
  const GOAL_MIN_Z = GAME_CONFIG.AI_FIELD_CENTER_Z - GOAL_WIDTH/2; // -8
  const GOAL_MAX_Z = GAME_CONFIG.AI_FIELD_CENTER_Z + GOAL_WIDTH/2; // 2
  
  // Check if ball is within the goal's Z boundaries
  if (ballPos.z < GOAL_MIN_Z || ballPos.z > GOAL_MAX_Z) {
    console.log(`🚫 Goal sensor triggered but ball outside goal Z boundaries: ${ballPos.z.toFixed(2)} (must be between ${GOAL_MIN_Z} and ${GOAL_MAX_Z})`);
    return;
  }
  
  // Check if ball is within the goal's Y boundaries (above ground, below crossbar)
  if (ballPos.y < 0 || ballPos.y > 4) {
    console.log(`🚫 Goal sensor triggered but ball outside goal Y boundaries: ${ballPos.y.toFixed(2)} (must be between 0 and 4)`);
    return;
  }
  
  // Check team-specific X boundaries
  if (scoringTeam === 'blue') {
    // Blue scores in Red goal: X should be between -40 and -36
    const RED_GOAL_MIN_X = GAME_CONFIG.AI_GOAL_LINE_X_RED - 3; // -40
    const RED_GOAL_MAX_X = GAME_CONFIG.AI_GOAL_LINE_X_RED + 1; // -36
    if (ballPos.x < RED_GOAL_MIN_X || ballPos.x > RED_GOAL_MAX_X) {
      console.log(`🚫 Blue goal attempt rejected: Ball X position ${ballPos.x.toFixed(2)} outside Red goal boundaries [${RED_GOAL_MIN_X} to ${RED_GOAL_MAX_X}]`);
      return;
    }
  } else {
    // Red scores in Blue goal: X should be between 51 and 55
    const BLUE_GOAL_MIN_X = GAME_CONFIG.AI_GOAL_LINE_X_BLUE - 1; // 51
    const BLUE_GOAL_MAX_X = GAME_CONFIG.AI_GOAL_LINE_X_BLUE + 3; // 55
    if (ballPos.x < BLUE_GOAL_MIN_X || ballPos.x > BLUE_GOAL_MAX_X) {
      console.log(`🚫 Red goal attempt rejected: Ball X position ${ballPos.x.toFixed(2)} outside Blue goal boundaries [${BLUE_GOAL_MIN_X} to ${BLUE_GOAL_MAX_X}]`);
      return;
    }
  }
  
  goalSensorDebounce = currentTime;
  ballHasEnteredGoal = true;
  
  console.log(`✅ GOAL CONFIRMED! ${scoringTeam.toUpperCase()} TEAM SCORES!`);
  console.log(`   Ball position: X=${ballEntity.position.x.toFixed(2)}, Y=${ballEntity.position.y.toFixed(2)}, Z=${ballEntity.position.z.toFixed(2)}`);
  console.log(`   ✅ Verified ball is inside goal boundaries`);
  
  // Emit goal event immediately - no confirmation delay needed
  if (worldRef) {
    worldRef.emit("goal" as any, scoringTeam as any);
  }
  
  // Reset ball after short celebration delay
  setTimeout(() => {
    if (worldRef) {
      ballEntity.despawn();
      ballEntity.spawn(worldRef, BALL_SPAWN_POSITION);
      ballEntity.setLinearVelocity({ x: 0, y: 0, z: 0 });
      ballEntity.setAngularVelocity({ x: 0, y: 0, z: 0 });
      ballHasEnteredGoal = false;
    } else {
      console.error('❌ Cannot respawn ball: worldRef is null');
    }
  }, 3000);
}

export default function createSoccerBall(world: World) {
  console.log("Creating soccer ball with config:", JSON.stringify(BALL_CONFIG));
  console.log("Ball spawn position:", JSON.stringify(BALL_SPAWN_POSITION));
  
  // Create goal sensors for reliable goal detection
  createGoalSensors(world);
  
  const soccerBall = new Entity({
    name: "SoccerBall",
    modelUri: "models/soccer/scene.gltf",
    modelScale: BALL_CONFIG.SCALE,
    rigidBodyOptions: {
      type: RigidBodyType.DYNAMIC,
      ccdEnabled: true, // Continuous collision detection to prevent tunneling
      linearDamping: BALL_CONFIG.LINEAR_DAMPING,
      angularDamping: BALL_CONFIG.ANGULAR_DAMPING,
      colliders: [
        {
          shape: ColliderShape.BALL,
          radius: BALL_CONFIG.RADIUS,
          friction: BALL_CONFIG.FRICTION,
          // ENHANCED: Improved collision groups for better crossbar/goal post interaction
          collisionGroups: {
            belongsTo: [1], // Default collision group for ball
            collidesWith: [1, 2, 4, 8] // Collide with terrain(1), blocks(2), entities(4), and goal structures(8)
          }
          // Note: Ball bounce physics handled by BALL_CONFIG settings in gameConfig.ts
        },
      ],
    },
  });

  sharedState.setSoccerBall(soccerBall);

  let inGoal = false;
  let isRespawning = false;
  let lastPosition = { ...BALL_SPAWN_POSITION };
  let ticksSinceLastPositionCheck = 0;
  let isInitializing = true; // Flag to prevent whistle during startup
  let whistleDebounceTimer = 0; // Add a timer to prevent multiple whistles

  console.log("Ball entity created, spawning at proper ground position");
  
  // Only spawn the ball if it's not already spawned
  if (!soccerBall.isSpawned) {
    // Simple spawn at the correct position (now with guaranteed ground block)
    soccerBall.spawn(world, BALL_SPAWN_POSITION);
    // Reset physics state
    soccerBall.setLinearVelocity({ x: 0, y: 0, z: 0 });
    soccerBall.setAngularVelocity({ x: 0, y: 0, z: 0 });
    // Force physics update
    soccerBall.wakeUp();
    
    console.log("Ball spawned successfully at:", JSON.stringify(BALL_SPAWN_POSITION));
    console.log("Ball spawn status:", soccerBall.isSpawned ? "SUCCESS" : "FAILED");
  } else {
    console.log("Ball is already spawned, skipping spawn");
  }
  
  // Short delay to complete initialization and enable boundary checks
  setTimeout(() => {
    isInitializing = false;
    console.log("Ball initialization complete, enabling boundary checks");
    console.log("Current ball position:", 
      soccerBall.isSpawned ? 
      `x=${soccerBall.position.x}, y=${soccerBall.position.y}, z=${soccerBall.position.z}` : 
      "Ball not spawned");
  }, 1000); // 1 second delay is sufficient

  soccerBall.on(EntityEvent.TICK, ({ entity, tickDeltaMs }) => {
    // Performance profiling: Start timing ball physics
    const ballPhysicsStartTime = performance.now();
    
    // Check if ball has moved from spawn
    if (!sharedState.getBallHasMoved()) {
      const currentPos = { ...entity.position }; // Clone position
      const spawnPos = BALL_SPAWN_POSITION;
      const dx = currentPos.x - spawnPos.x;
      const dy = currentPos.y - spawnPos.y;
      const dz = currentPos.z - spawnPos.z;
      // Use a small threshold to account for minor physics jitter
      const distanceMoved = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (distanceMoved > 0.1) {
        sharedState.setBallHasMoved();
      }
    }

    // Check for sudden large position changes that could cause camera shaking
    ticksSinceLastPositionCheck++;
    if (ticksSinceLastPositionCheck >= 5) { // Check every 5 ticks
      ticksSinceLastPositionCheck = 0;
      const currentPos = { ...entity.position };
      const dx = currentPos.x - lastPosition.x;
      const dy = currentPos.y - lastPosition.y;
      const dz = currentPos.z - lastPosition.z;
      const positionChange = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Use more subtle position correction only for extreme cases
      if (positionChange > 5.0) {
        entity.setPosition({
          x: lastPosition.x + dx * 0.7,
          y: lastPosition.y + dy * 0.7,
          z: lastPosition.z + dz * 0.7
        });
      }
      
      lastPosition = { ...entity.position };
    }
    
    // **BALL STATIONARY DETECTION SYSTEM**
    // Update stationary tracking for AI pursuit logic
    // This ensures balls that sit idle get retrieved by AI players
    const currentPos = { ...entity.position };
    sharedState.updateBallStationaryStatus(currentPos);
    
    const attachedPlayer = sharedState.getAttachedPlayer();

    // If the ball falls significantly below the field, reset it immediately
    // Allow ball to rest on ground (Y=1) but reset if it goes below Y=0.5
    if (entity.position.y < FIELD_MIN_Y + 0.5 && !isRespawning && !inGoal && !isInitializing) {
      console.log(`Ball unexpectedly below field at Y=${entity.position.y}, resetting to spawn position`);
      isRespawning = true;
      
      // Reset the ball position without playing the whistle (this is a physics issue, not gameplay)
      entity.despawn();
      sharedState.setAttachedPlayer(null);
      
      // Spawn at the proper ground position (higher Y to ensure it's above ground)
      entity.spawn(world, BALL_SPAWN_POSITION);
      entity.setLinearVelocity({ x: 0, y: 0, z: 0 });
      entity.setAngularVelocity({ x: 0, y: 0, z: 0 });
      
      // Reset respawning flag after a delay
      setTimeout(() => {
        isRespawning = false;
      }, 1000);
      
      return; // Skip the rest of the checks
    }

    // Skip all goal and boundary checks during initialization or if already handling an event
    if (attachedPlayer == null && !inGoal && !isRespawning && !isInitializing) {
      const currentPos = { ...entity.position }; // Clone position
      
      // Skip boundary check if the ball is clearly below the field
      if (currentPos.y < FIELD_MIN_Y - 1) {
        return;
      }
      
      // NOTE: Goal detection now handled by collision sensors instead of position checking
      // This eliminates the bounce-out issue where balls quickly exit the goal area
      // during the confirmation delay, causing goals to be incorrectly rejected
      
      // Enhanced out-of-bounds detection with detailed boundary information
      {
        const boundaryInfo: BoundaryInfo = soccerMap.checkBoundaryDetails(currentPos);
        
        if (boundaryInfo.isOutOfBounds && !isRespawning) {
          console.log(`Ball out of bounds:`, boundaryInfo);
          
          // Check if a whistle was recently played
          const currentTime = Date.now();
          if (currentTime - whistleDebounceTimer < 3000) {
            // Skip playing the whistle if one was played less than 3 seconds ago
            console.log("Skipping whistle sound (debounced)");
          } else {
            console.log(`Ball out of bounds at position ${currentPos.x}, ${currentPos.y}, ${currentPos.z} - playing whistle`);
            whistleDebounceTimer = currentTime;
            
            // Play a single whistle for out of bounds
            new Audio({
              uri: "audio/sfx/soccer/whistle.mp3",
              volume: 0.1,
              loop: false
            }).play(world);
          }
          
          isRespawning = true;
          
          setTimeout(() => {
            if (isRespawning) { // Make sure we're still handling this out-of-bounds event
              // Reset the ball position
              entity.despawn();
              sharedState.setAttachedPlayer(null);
              
              // Emit different events based on boundary type
              if (boundaryInfo.boundaryType === 'sideline') {
                // Ball went out on sideline - throw-in
                console.log("Emitting throw-in event");
                world.emit("ball-out-sideline" as any, {
                  side: boundaryInfo.side,
                  position: boundaryInfo.position,
                  lastPlayer: sharedState.getLastPlayerWithBall()
                } as any);
              } else if (boundaryInfo.boundaryType === 'goal-line') {
                // Ball went out over goal line - corner kick or goal kick
                console.log("Emitting goal-line out event");
                world.emit("ball-out-goal-line" as any, {
                  side: boundaryInfo.side,
                  position: boundaryInfo.position,
                  lastPlayer: sharedState.getLastPlayerWithBall()
                } as any);
              } else {
                // Fallback to old system for other cases
                console.log("Emitting general out-of-bounds event");
                world.emit("ball-reset-out-of-bounds" as any, {} as any);
              }
              
              // Set a short delay before allowing the ball to trigger another out-of-bounds event
              // This prevents rapid whistle sounds if the ball spawns in a weird location
              setTimeout(() => {
                isRespawning = false;
              }, 1000);
            }
          }, 1500);
        }
      }
    }

    // Proximity-based ball possession for better passing mechanics
    if (attachedPlayer == null && !inGoal && !isRespawning && !isInitializing) {
      // Check for nearby teammates when ball is loose
      const ballPosition = entity.position;
      const ballVelocity = entity.linearVelocity;
      
      // Enhanced reception assistance - different logic for moving vs stationary balls
      const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);
      
      // Enhanced settings for better pass reception
      let PROXIMITY_POSSESSION_DISTANCE = 1.5; // Base distance for automatic possession
      let MAX_BALL_SPEED_FOR_PROXIMITY = 3.0; // Base max speed for auto-possession
      
      // RECEPTION ASSISTANCE: If ball is moving (likely a pass), increase reception assistance
      if (ballSpeed > 1.0) {
        // Ball is moving - likely a pass, so provide enhanced reception assistance
        PROXIMITY_POSSESSION_DISTANCE = 2.2; // Increased from 1.5 to 2.2 for easier pass reception
        MAX_BALL_SPEED_FOR_PROXIMITY = 6.0; // Increased from 3.0 to 6.0 to help with faster passes
      }
      
      if (ballSpeed < MAX_BALL_SPEED_FOR_PROXIMITY) {
        // Get all player entities in the world
        const allPlayerEntities = world.entityManager.getAllPlayerEntities();
        let closestPlayer: SoccerPlayerEntity | null = null;
        let closestDistance = Infinity;
        
        for (const playerEntity of allPlayerEntities) {
          if (playerEntity instanceof SoccerPlayerEntity && playerEntity.isSpawned && !playerEntity.isStunned) {
            const distance = Math.sqrt(
              Math.pow(playerEntity.position.x - ballPosition.x, 2) +
              Math.pow(playerEntity.position.z - ballPosition.z, 2)
            );
            
            // ENHANCED RECEPTION: Additional assistance for balls moving toward the player
            let effectiveDistance = distance;
            if (ballSpeed > 1.0) {
              // Calculate if ball is moving toward this player
              const ballDirection = { x: ballVelocity.x, z: ballVelocity.z };
              const ballToPlayer = {
                x: playerEntity.position.x - ballPosition.x,
                z: playerEntity.position.z - ballPosition.z
              };
              
              // Normalize vectors for dot product calculation
              const ballDirLength = Math.sqrt(ballDirection.x * ballDirection.x + ballDirection.z * ballDirection.z);
              const ballToPlayerLength = Math.sqrt(ballToPlayer.x * ballToPlayer.x + ballToPlayer.z * ballToPlayer.z);
              
              if (ballDirLength > 0 && ballToPlayerLength > 0) {
                const dotProduct = (ballDirection.x * ballToPlayer.x + ballDirection.z * ballToPlayer.z) / 
                                  (ballDirLength * ballToPlayerLength);
                
                // If ball is moving toward player (dot product > 0.5), reduce effective distance for easier reception
                if (dotProduct > 0.5) {
                  effectiveDistance = distance * 0.7; // Make it 30% easier to receive when ball is coming toward player
                  console.log(`Reception assistance for ${playerEntity.player.username}: ball moving toward player (dot: ${dotProduct.toFixed(2)})`);
                }
              }
            }
            
            if (effectiveDistance < PROXIMITY_POSSESSION_DISTANCE && effectiveDistance < closestDistance) {
              closestDistance = effectiveDistance;
              closestPlayer = playerEntity;
            }
          }
        }
        
        // Automatically attach ball to closest player if within range
        if (closestPlayer) {
          sharedState.setAttachedPlayer(closestPlayer);
          
          // Play a subtle sound to indicate automatic ball attachment
          new Audio({
            uri: "audio/sfx/soccer/kick.mp3", 
            volume: 0.08,
            loop: false,
          }).play(entity.world as World);
          
          console.log(`Ball automatically attached to ${closestPlayer.player.username} (proximity: ${closestDistance.toFixed(2)} units, speed: ${ballSpeed.toFixed(1)})`);
        }
      }
    }

    if (attachedPlayer != null) {
      const playerRotation = { ...attachedPlayer.rotation }; // Clone rotation
      const playerPos = { ...attachedPlayer.position }; // Clone position
      const direction = getDirectionFromRotation(playerRotation);
      
      // Calculate ball position with a small offset from player
      const ballPosition = {
        x: playerPos.x - direction.x * 0.7,
        y: playerPos.y - 0.5,
        z: playerPos.z - direction.z * 0.7,
      };

      const currentPos = { ...entity.position }; // Clone ball position
      
      // Simple follow logic
      entity.setPosition(ballPosition);
      entity.setLinearVelocity({ x: 0, y: 0, z: 0 });
      
      // Add ball rotation based on player movement for realistic dribbling effect
      const playerVelocity = attachedPlayer.linearVelocity;
      const playerSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
      
      // Only rotate the ball if the player is moving at a reasonable speed
      if (playerSpeed > 0.5) {
        // Calculate rotation speed based on player movement speed
        // Higher speed = faster rotation, simulating ball rolling
        const rotationMultiplier = 2.0; // Adjust this to make rotation faster/slower
        const rotationSpeed = playerSpeed * rotationMultiplier;
        
        // Calculate rotation direction based on movement direction
        // The ball should rotate perpendicular to the movement direction
        const movementDirection = {
          x: playerVelocity.x / playerSpeed,
          z: playerVelocity.z / playerSpeed
        };
        
        // Set angular velocity to make ball rotate as if rolling
        // For forward movement, rotate around the X-axis (perpendicular to movement)
        // For sideways movement, rotate around the Z-axis
        entity.setAngularVelocity({
          x: -movementDirection.z * rotationSpeed, // Negative for correct rotation direction
          y: 0, // No spinning around vertical axis
          z: movementDirection.x * rotationSpeed
        });
      } else {
        // Player is stationary or moving slowly, stop ball rotation
        entity.setAngularVelocity({ x: 0, y: 0, z: 0 });
      }
    }
    
    // Performance profiling: Record ball physics timing
    const ballPhysicsEndTime = performance.now();
    const ballPhysicsDuration = ballPhysicsEndTime - ballPhysicsStartTime;
    
    // Get performance profiler from world if available
    const profiler = (world as any)._performanceProfiler;
    if (profiler) {
      profiler.recordBallPhysics(ballPhysicsDuration);
    }
  });

  soccerBall.on(EntityEvent.ENTITY_COLLISION, ({ entity, otherEntity, started }) => {
    if (started && otherEntity instanceof SoccerPlayerEntity) {
      const currentAttachedPlayer = sharedState.getAttachedPlayer();
      
      if (currentAttachedPlayer == null && !inGoal) {
        // Ball is loose - attach to any player who touches it
        if (!otherEntity.isStunned) {
          sharedState.setAttachedPlayer(otherEntity);
          
          // Play a subtle sound to indicate ball attachment
          new Audio({
            uri: "audio/sfx/soccer/kick.mp3", 
            volume: 0.15,
            loop: false,
          }).play(entity.world as World);
        }
      } else if (currentAttachedPlayer != null) {
        // Ball is currently possessed
        if (otherEntity.isTackling) {
          // Tackling player steals the ball
          sharedState.setAttachedPlayer(null);
          // Apply a basic impulse to the ball
          const direction = getDirectionFromRotation(otherEntity.rotation);
          entity.applyImpulse({
            x: direction.x * 1.0,
            y: 0.3,
            z: direction.z * 1.0,
          });
          // Reset angular velocity to prevent unwanted spinning/backwards movement
          entity.setAngularVelocity({ x: 0, y: 0, z: 0 });
        } else if (currentAttachedPlayer instanceof SoccerPlayerEntity && 
                   currentAttachedPlayer.team === otherEntity.team && 
                   currentAttachedPlayer !== otherEntity) {
          // Teammate collision - transfer possession to teammate
          sharedState.setAttachedPlayer(otherEntity);
          
          // Play a subtle sound to indicate ball transfer
          new Audio({
            uri: "audio/sfx/soccer/kick.mp3", 
            volume: 0.1,
            loop: false,
          }).play(entity.world as World);
          
          console.log(`Ball transferred from ${currentAttachedPlayer.player.username} to teammate ${otherEntity.player.username}`);
        }
      }
    }
  });

  soccerBall.on(EntityEvent.BLOCK_COLLISION, ({ entity, blockType, started }) => {
    if (started) {
      // Allow ball to bounce off ALL blocks to prevent falling through ground
      // Realistic soccer ball bounce - maintain forward momentum with slight damping
      const velocity = entity.linearVelocity;
      const dampingFactor = 0.85; // Reduce speed slightly on bounce
      entity.setLinearVelocity({
        x: velocity.x * dampingFactor, // Keep forward momentum, just reduce speed
        y: Math.abs(velocity.y) * 0.6, // Bounce up with reduced height
        z: velocity.z * dampingFactor, // Keep lateral momentum, just reduce speed
      });
      // Reset angular velocity to prevent unwanted spinning from collision
      entity.setAngularVelocity({ x: 0, y: 0, z: 0 });
    }
  });

  return soccerBall;
}
