# 🎥 Spectator Mode Documentation

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Camera Modes](#camera-modes)
- [User Interface](#user-interface)
- [Technical Implementation](#technical-implementation)
- [API Reference](#api-reference)
- [Game Integration](#game-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The Spectator Mode system allows players to observe ongoing soccer matches when teams are full or when they choose to watch rather than play. This feature enhances the overall user experience by accommodating more players and providing an engaging viewing experience.

### Key Benefits
- **Increased Player Capacity**: Allows unlimited spectators even when team slots are full
- **Enhanced Viewing Experience**: Multiple camera angles and automatic event tracking
- **Social Engagement**: Players can watch friends and learn from other players
- **Seamless Integration**: Automatically activates when needed, no manual setup required

## Features

### 🎮 Automatic Activation
- **Smart Team Detection**: Automatically offers spectator mode when teams are full
- **Seamless Transition**: Smooth transition from team selection to spectator view
- **Welcome Messages**: Clear instructions and controls for new spectators

### 📹 Multiple Camera Perspectives
- **Follow Player Mode**: Third-person view following selected players
- **Overview Camera**: Top-down tactical view of the entire field
- **Sideline Camera**: Traditional broadcast-style side view
- **Ball Camera**: Dynamic camera following the ball during play
- **Stadium View**: Wide overview showing the entire stadium

### 🎯 Intelligent Event Tracking
- **Goal Celebrations**: Automatically switches to ball camera during goals
- **Halftime Breaks**: Stadium view during halftime for best overview
- **Game Events**: Dynamic camera switching based on game state

### 🎨 Beautiful User Interface
- **Modern Design**: Clean, animated overlays with gradient backgrounds
- **Intuitive Controls**: Easy-to-use buttons for camera and player switching
- **Visual Feedback**: Smooth animations and clear status indicators
- **Responsive Layout**: Works across different screen sizes

## How It Works

### 1. Activation Scenarios

#### Automatic Activation
```typescript
// When teams are full, new players automatically join as spectators
if(game.isTeamFull(data.team)) {
  spectatorMode.joinAsSpectator(player, world);
  // Shows spectator UI and camera controls
}
```

#### Manual Commands
Players can also use chat commands:
- `/spectate` - Join as spectator
- `/leavespectator` - Exit spectator mode

### 2. Spectator Lifecycle
1. **Join as Spectator**: Player is added to spectator list
2. **Camera Setup**: Initial camera positioning and mode selection
3. **UI Display**: Spectator controls and status indicators appear
4. **Event Tracking**: Camera automatically responds to game events
5. **User Control**: Player can manually switch cameras and targets
6. **Exit**: Player can leave spectator mode to return to lobby

## Camera Modes

### 📹 Follow Player Mode
- **Description**: Third-person camera following selected player
- **Best For**: Watching individual player techniques and movements
- **Controls**: Cycle through different players with "Next Player" button

### 🗺️ Overview Camera
- **Description**: Top-down tactical view of the entire field
- **Best For**: Understanding team formations and strategy
- **Features**: Shows all players and ball positions simultaneously

### 📺 Sideline Camera
- **Description**: Traditional broadcast-style camera from the sideline
- **Best For**: Classic soccer viewing experience
- **Angle**: Positioned at optimal viewing height and distance

### ⚽ Ball Camera
- **Description**: Dynamic camera that follows the ball
- **Best For**: Intense action sequences and goal scoring
- **Auto-Activation**: Automatically triggered during goal events

### 🏟️ Stadium View
- **Description**: Wide overview showing the entire stadium
- **Best For**: Halftime breaks and general match overview
- **Features**: Shows crowd, stadium atmosphere, and full field

## User Interface

### 🎥 Spectator Mode Indicator
```css
/* Animated overlay showing spectator status */
position: fixed;
top: 20px;
left: 20px;
background: linear-gradient(135deg, rgba(147, 51, 234, 0.9), rgba(79, 70, 229, 0.9));
```

### 🎮 Control Panel
Located at the bottom center of the screen:

- **Next Player** 🔵: Cycle through available players to follow
- **Camera View** 🟢: Switch between different camera perspectives
- **Leave** 🔴: Exit spectator mode and return to lobby

### 📱 Responsive Design
- **Desktop**: Full control panel with all features
- **Mobile**: Optimized layout for touch controls
- **Animations**: Smooth slide-in/slide-out transitions

## Technical Implementation

### 🏗️ Architecture Overview

#### Core Classes
```typescript
class SpectatorMode {
  // Main spectator management system
  private _spectators: Map<string, Player>
  private _spectatorStates: Map<string, SpectatorState>
  private _cameraModes: CameraMode[]
}
```

#### Key Components
- **`utils/observerMode.ts`**: Main spectator mode logic
- **`index.ts`**: UI event handlers and integration
- **`state/gameState.ts`**: Game event integration
- **`assets/ui/index.html`**: UI components and styling

### 🔧 Hytopia SDK Integration

#### Camera System
```typescript
// Following Hytopia Camera Rules ✨
player.camera.setMode(PlayerCameraMode.THIRD_PERSON);
player.camera.setAttachedToPosition(spectatorPosition);
```

#### Entity Following
```typescript
// Proper entity attachment for player following
const followingEntity = allPlayers[currentIndex];
player.camera.setAttachedToEntity(followingEntity);
```

### 📊 State Management
```typescript
interface SpectatorState {
  followingEntity: SoccerPlayerEntity | AIPlayerEntity | null;
  currentViewIndex: number;
  currentCameraMode: number;
  isFollowingBall: boolean;
}
```

## API Reference

### 🔌 Public Methods

#### `joinAsSpectator(player: Player, world: World): void`
Adds a player to spectator mode when teams are full.

#### `nextPlayer(player: Player): void`
Cycles to the next available player for the spectator to follow.

#### `nextCameraMode(player: Player): void`
Switches to the next camera perspective for the spectator.

#### `removeSpectator(player: Player): void`
Removes a player from spectator mode and returns them to normal gameplay.

#### `updateSpectatorsForGameEvent(eventType: string, data?: any): void`
Automatically updates spectator cameras based on game events.

### 📡 UI Events

#### Client to Server
```typescript
// Player wants to switch to next player
{
  type: "spectator-next-player"
}

// Player wants to change camera mode
{
  type: "spectator-next-camera"
}

// Player wants to leave spectator mode
{
  type: "spectator-leave"
}
```

#### Server to Client
```typescript
// Spectator mode activation
{
  type: "spectator-mode-active",
  message: "Welcome message for spectator"
}
```

## Game Integration

### 🎯 Event Triggers

#### Goal Events
```typescript
// Automatic camera switching during goals
spectatorMode.updateSpectatorsForGameEvent("goal-scored", { 
  team, 
  score: this.state.score 
});
```

#### Game State Changes
- **Game Start**: Ensures spectators have optimal starting view
- **Halftime**: Switches to stadium overview for break periods
- **Overtime**: Maintains spectator engagement during extended play

### 🔄 Team Full Logic
```typescript
if(game.isTeamFull(data.team)) {
  // Offer spectator mode instead of rejection
  spectatorMode.joinAsSpectator(player, world);
  player.ui.sendData({
    type: "spectator-mode-active",
    message: "Team is full - you've joined as a spectator!"
  });
}
```

## Troubleshooting

### 🐛 Common Issues

#### Camera Not Following Player
**Problem**: Camera stays in fixed position
**Solution**: Check if entity is properly spawned and accessible
```typescript
const allPlayers = this.getAllActivePlayers();
if (allPlayers.length === 0) {
  // Switch to ball camera as fallback
  this.switchToBallCam(spectator);
}
```

#### UI Controls Not Responding
**Problem**: Spectator buttons don't work
**Solution**: Verify player is properly added to spectator list
```typescript
if (!this._spectators.has(player.username)) {
  console.log("Player is not in spectator mode");
  return;
}
```

#### Performance Issues
**Problem**: Camera switching causes lag
**Solution**: Implement camera update throttling
```typescript
// Limit camera updates to reasonable frequency
const UPDATE_INTERVAL = 100; // milliseconds
```

### 📋 Debug Commands

#### Developer Console
```javascript
// Check spectator status
spectatorMode.isSpectator(player)

// Get current spectators
spectatorMode.getSpectators()

// Force camera mode switch
spectatorMode.nextCameraMode(player)
```

### 🔍 Logging
The system includes comprehensive logging for debugging:
- Spectator join/leave events
- Camera mode switches
- Game event triggers
- Error conditions

## Best Practices

### 👍 Recommended Usage
- **Encourage Spectating**: Let players know spectator mode is available
- **Event Promotion**: Use spectator mode for tournaments and special matches
- **Learning Tool**: New players can watch experienced players

### ⚠️ Considerations
- **Performance**: Monitor performance with many simultaneous spectators
- **Bandwidth**: Camera updates require network communication
- **User Experience**: Ensure smooth transitions between modes

### 🔄 Future Enhancements
- **Replay System**: Add ability to rewind and replay key moments
- **Commentary Mode**: Audio commentary for spectated matches
- **Social Features**: Chat and reactions for spectators
- **Statistics Overlay**: Real-time player and team statistics

---

## 📝 Version History

### v1.0.0 (Current)
- Initial spectator mode implementation
- Multiple camera perspectives
- Automatic team full handling
- Game event integration
- Modern UI with animated controls

---

*This documentation is maintained as part of the Hytopia Soccer project. For technical support or feature requests, please refer to the project's issue tracker.* 