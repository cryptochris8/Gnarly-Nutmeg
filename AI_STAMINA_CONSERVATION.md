# AI Stamina Conservation System

## Overview

The AI Stamina Conservation System is a comprehensive behavioral modification system that makes AI players intelligently manage their stamina throughout the match. This prevents AI players from exhausting their stamina early in the game and becoming ineffective later.

## Core Philosophy

The system operates on the principle that **tired players should play smarter, not harder**. When AI players detect low stamina levels, they automatically switch to more conservative, energy-efficient behaviors while still maintaining tactical effectiveness.

## System Components

### 1. Main Conservation Logic (`AIPlayerEntity.ts`)

Located in the `makeDecision()` method, this is the primary entry point for stamina conservation:

```typescript
// **STAMINA CONSERVATION LOGIC**
const staminaPercentage = this.getStaminaPercentage();
const shouldConserveStamina = this.shouldConserveStamina(staminaPercentage);

if (shouldConserveStamina) {
  this.handleStaminaConservation(ballPosition, hasBall, staminaPercentage);
  return;
}
```

### 2. Enhanced SoccerAgent (`SoccerAgent.ts`)

Modifies high-level decision-making:
- **Shooting range** reduced when stamina is low
- **Ball intercept distance** reduced when tired
- More conservative tactical decisions

### 3. Enhanced BehaviorTree (`BehaviorTree.ts`)

Integrates stamina considerations into the behavior tree system:
- **Shooting conditions** consider stamina levels
- Same conservation logic as SoccerAgent

## Role-Based Stamina Thresholds

Different positions have different stamina conservation strategies:

| Role | Threshold | Reasoning |
|------|-----------|-----------|
| **Striker** | 40% | Needs energy for finishing opportunities |
| **Central Midfielders** | 35% | Balance between offense and defense |
| **Defenders (L/R Back)** | 25% | Can be more aggressive with stamina |
| **Goalkeeper** | 20% | Less movement required |

## Conservation Behaviors

### When AI Has the Ball (Low Stamina)
1. **Quick Pass Priority**: Immediately attempts to pass to a teammate
2. **Hold Position**: If passing fails, holds current position instead of dribbling
3. **Logging**: Logs successful stamina-conserving passes

### When AI Doesn't Have the Ball (Low Stamina)
1. **Reduced Pursuit**: Only chases ball if very close (< 8 units)
2. **Formation Recovery**: Moves slowly toward formation position
3. **Stamina Recovery Position**: Holds position when close to formation spot
4. **Limited Movement**: Moves maximum 2 units at a time when conserving

## Technical Implementation

### Core Methods

#### `shouldConserveStamina(staminaPercentage: number): boolean`
- Determines if AI should enter conservation mode
- Role-based threshold calculation
- Returns true when stamina falls below threshold

#### `handleStaminaConservation(ballPosition, hasBall, staminaPercentage): void`
- Handles all conservation behaviors
- Ball possession vs. non-possession logic
- Formation positioning and recovery

### Integration Points

#### SoccerAgent Modifications
```typescript
// Shooting range reduction
if (staminaPercentage < 30) {
  maxShootingRange *= 0.7; // 30% reduction
} else if (staminaPercentage < 50) {
  maxShootingRange *= 0.85; // 15% reduction
}

// Intercept distance reduction
if (staminaPercentage < 25) {
  extendedInterceptDistance *= 0.6; // 40% reduction
} else if (staminaPercentage < 40) {
  extendedInterceptDistance *= 0.8; // 20% reduction
}
```

#### BehaviorTree Modifications
- Same stamina-based range reductions as SoccerAgent
- Integrated into shooting condition checks
- Maintains behavior tree structure while adding stamina awareness

## Performance Considerations

### Logging System
- **Rate-limited logging**: Only 2% chance per decision to log conservation
- **Specific event logging**: Logs successful stamina-conserving passes
- **Debug information**: Includes player name, role, and stamina percentage

### Computational Efficiency
- **Early exit**: Conservation check happens before expensive AI calculations
- **Cached calculations**: Stamina percentage calculated once per decision
- **Minimal overhead**: Simple threshold comparisons

## Tuning Parameters

### Threshold Adjustments
To modify conservation aggressiveness, adjust values in `shouldConserveStamina()`:

```typescript
// More aggressive conservation (higher thresholds)
case 'striker': conservationThreshold = 50; // Was 40
case 'central-midfielder-1': conservationThreshold = 45; // Was 35

// Less aggressive conservation (lower thresholds)
case 'striker': conservationThreshold = 30; // Was 40
case 'central-midfielder-1': conservationThreshold = 25; // Was 35
```

### Behavior Modifications
To adjust conservation behaviors, modify `handleStaminaConservation()`:

```typescript
// Increase pursuit distance when conserving
const shouldPursue = distanceToBall < 12 && // Was 8

// Increase movement speed when conserving
const moveDistance = Math.min(4, distance); // Was 2
```

## Benefits

### Gameplay Improvements
- **Realistic stamina management**: AI players behave like real players managing energy
- **Extended effectiveness**: AI remains competitive throughout the match
- **Strategic depth**: Different roles conserve stamina differently
- **Natural flow**: Conservation feels organic, not artificial

### Technical Benefits
- **Performance optimization**: Reduces unnecessary AI calculations when conserving
- **Modular design**: Easy to modify thresholds and behaviors
- **Debug friendly**: Clear logging for troubleshooting
- **Maintainable**: Well-documented and organized code

## Future Enhancements

### Potential Improvements
1. **Dynamic thresholds**: Adjust based on match situation (losing team more aggressive)
2. **Team coordination**: Ensure minimum number of players always pursue ball
3. **Stamina prediction**: Anticipate stamina needs based on match time remaining
4. **Role switching**: Temporarily switch roles based on stamina levels

### Integration Opportunities
- **Tournament mode**: Different conservation strategies for tournament play
- **Weather effects**: Modify thresholds based on weather conditions
- **Crowd pressure**: Adjust conservation based on crowd noise/momentum

## Troubleshooting

### Common Issues
1. **AI too passive**: Lower conservation thresholds
2. **AI still exhausted**: Increase thresholds or improve stamina recovery rates
3. **Logging spam**: Reduce logging probability in `handleStaminaConservation()`

### Debug Commands
- Monitor stamina conservation with console logs
- Check `shouldConserveStamina()` return values
- Verify `handleStaminaConservation()` execution

## Conclusion

The AI Stamina Conservation System provides a robust, realistic approach to AI stamina management that enhances gameplay while maintaining performance. The system is designed to be easily tunable and maintainable, with clear separation of concerns and comprehensive logging for debugging.

The role-based approach ensures that different positions behave appropriately when managing stamina, creating a more authentic soccer experience where tired players make smarter decisions rather than simply becoming ineffective. 