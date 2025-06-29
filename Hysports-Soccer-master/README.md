# ⚽ Hytopia Soccer Game

A sophisticated 6v6 multiplayer soccer game built with the Hytopia SDK, featuring advanced AI systems, physics-based gameplay, and professional-level architecture.

## 🚀 Quick Start

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.45. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## 📊 Project Overview

### **Statistics**
- **Total Codebase**: 10,000+ lines across key files
- **Main Server**: `index.ts` (939 lines)
- **Dependencies**: Hytopia SDK v0.6.6, TypeScript, Bun runtime
- **Architecture**: Modular design with clear separation of concerns

### **Core Features**
- **6v6 Multiplayer**: Red vs Blue teams with AI filling empty slots
- **Advanced AI**: 3,451 lines of sophisticated behavior tree logic
- **Physics-Based**: Realistic ball mechanics and player interactions
- **Complete Soccer Rules**: Throw-ins, corner kicks, goal kicks, offside
- **Mobile Support**: Touch controls and responsive UI
- **Abilities System**: Speed boosts and special power-ups

## 🏗️ Architecture

### **Core Game Logic**
- `state/gameState.ts` (1,236 lines) - Main game state management
- `state/gameConfig.ts` - Stadium setup and AI configuration
- `state/map.ts` - Goal detection and boundary systems

### **Entity System**
- `entities/SoccerPlayerEntity.ts` - Custom player with team mechanics
- `entities/AIPlayerEntity.ts` (3,451 lines) - Advanced AI with behavior trees
- `entities/BehaviorTree.ts` (676 lines) - AI decision-making logic

### **Controllers**
- `controllers/SoccerPlayerController.ts` (1,241 lines) - Player controls
- `controllers/AIController.ts` - AI movement coordination

### **Utilities**
- `utils/ball.ts` - Physics-based soccer ball system
- `utils/observer.ts` - Spectator camera functionality
- `utils/direction.ts` - Movement calculations

### **User Interface**
- `assets/ui/index.html` (707 lines) - Complete web-based UI

## 🤖 AI System

The AI system is one of the most sophisticated aspects of this project:

- **Behavior Trees**: Complex decision-making with role-specific logic
- **Role-Based Positioning**: Goalkeeper, defenders, midfielders, strikers
- **Dynamic Pathfinding**: Smart movement coordination
- **Situational Awareness**: Responds to ball position and game state
- **Team Coordination**: AI players work together strategically

## ⚽ Game Features

### **Stadium & Field**
- Large stadium environment with precise boundaries
- Field dimensions: X(-37 to 52), Z(-33 to 26), Y(0 to 15)
- Accurate goal detection and scoring system

### **Game Flow**
- **Match States**: waiting → starting → playing → overtime → finished
- **Team Management**: Dynamic player assignment with AI filling
- **Timer Systems**: Match countdown, ability cooldowns, respawn timers

### **Physics & Mechanics**
- Realistic ball physics with damping and collision detection
- Player tackling, stunning, and dodging mechanics
- Force-based ball interactions and movement

## 🎮 Controls & UI

- **Desktop**: Keyboard and mouse controls
- **Mobile**: Touch controls with responsive design
- **Team Selection**: Red/Blue team assignment interface
- **Game HUD**: Health bars, timers, inventory, scoreboard
- **Spectator Mode**: Observer camera for non-playing users

## 🛠️ Technical Implementation

- **TypeScript Server**: Event-driven architecture with proper typing
- **Real-time Multiplayer**: Player management and state synchronization
- **Modular Design**: Clear separation of concerns
- **Physics Integration**: Hytopia SDK physics for realistic gameplay
- **Asset Management**: Proper CDN paths and resource loading

## 📱 Mobile Support

The game includes comprehensive mobile support:
- Touch controls for movement and actions
- Responsive UI that adapts to different screen sizes
- Mobile-optimized interface elements
- Touch-friendly button layouts

## 🎯 Development Notes

This is a production-quality game demonstrating:
- Professional code organization and architecture
- Advanced AI programming with behavior trees
- Complete physics simulation integration
- Comprehensive game state management
- Mobile-first responsive design principles
- Extensive use of Hytopia SDK features

## 🔧 Common Development Areas

When working on this project, common areas include:
- **AI Behavior**: Modifying behavior trees and positioning logic
- **Game Rules**: Adjusting soccer mechanics and restart conditions
- **UI Updates**: Enhancing the web-based interface
- **Physics Tuning**: Ball mechanics and player interactions
- **Performance**: Optimizing AI calculations and game loops
