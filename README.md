# 🏆 Hytopia Soccer - Advanced Multiplayer Soccer Game

![Hytopia Soccer](assets/ui/logos/hysports-soccer-logo.png)

> A professional-grade 6v6 multiplayer soccer game built with the Hytopia SDK featuring advanced AI, multiple game modes, tournament system, and comprehensive performance optimization.

## 🌟 **Key Features**

### 🎮 **Multiple Game Modes**
- **FIFA Mode**: Realistic soccer simulation with professional rules, crowd atmosphere, and authentic commentary
- **Arcade Mode**: Enhanced gameplay with 6 unique power-ups, special effects, and unlimited F-key abilities
- **Pickup Mode**: Physical ability collection system with collectible power-ups scattered across the field
- **Tournament Mode**: Competitive bracket system with single/double elimination and round-robin formats

### 🤖 **Advanced AI System**
- **Dual AI Architecture**: SoccerAgent for strategic decisions + BehaviorTree for execution
- **6 Distinct Roles**: Goalkeeper, defenders, midfielders, and strikers with unique behaviors
- **Role-Based Positioning**: Tactical awareness with preferred areas and coordinated team movement
- **Dynamic Decision Making**: Context-aware AI that adapts to game situations

### 🏟️ **Professional Soccer Features**
- **Complete Rule Set**: Throw-ins, corner kicks, goal kicks, offside detection
- **Realistic Physics**: Advanced ball physics with proper damping, friction, and collision detection
- **Out-of-Bounds Handling**: Proper restart procedures for sideline and goal line exits
- **Goal Detection**: Precise goal boundaries with confirmation delays
- **Mercy Rule System**: Automatic game ending for large score differences

### 🎵 **Immersive Audio & Atmosphere**
- **FIFA Crowd Manager**: Dynamic crowd reactions, chants, and ambient stadium sounds
- **Professional Commentary**: Announcer voice-overs for key game moments
- **Dynamic Music System**: Seamless transitions between opening and gameplay tracks
- **Mode-Specific Audio**: Different audio experiences for each game mode

### 🏆 **Tournament System**
- **Multiple Bracket Types**: Single elimination, double elimination, round-robin
- **Player Registration**: Automated signup and ready-check systems
- **Match Scheduling**: Automatic bracket progression and match coordination
- **Statistics Tracking**: Comprehensive player and team performance data

### ⚡ **Power-Up System** (Arcade Mode)
- **Freeze Blast**: Temporarily freeze opponents
- **Fireball**: Explosive projectile with area damage
- **Mega Kick**: Supercharged shots with increased power
- **Shield**: Temporary invincibility and protection
- **Speed Boost**: Enhanced movement speed
- **Precision**: Improved accuracy and ball control

### 🎥 **Spectator Mode**
- **Multiple Camera Angles**: Follow player, side view, aerial view, ball cam
- **Stadium Overview**: Wide-angle tactical view of the entire field
- **Dynamic Switching**: Seamless transitions between different viewing modes
- **Player Following**: Automatic tracking of specific players or AI

### 🚀 **Performance Optimization**
- **Real-Time Profiling**: Comprehensive performance monitoring with detailed metrics
- **Memory Management**: Automatic garbage collection and memory optimization
- **GPU Optimization**: Adaptive quality settings for different hardware
- **Performance Targets**: Configurable optimization levels (High Performance, Balanced, High Quality)

## 🏃‍♂️ **Quick Start**

### **Prerequisites**
- Node.js (v16+ recommended)
- Bun runtime (preferred) or Node.js
- Visual Studio Build Tools (Windows)

### **Installation**

1. **Install dependencies and build native modules:**
```bash
npm run setup
```

2. **Start the game server:**
```bash
# With Bun (recommended)
bun run start

# With Node.js (fallback)
npm run start:node
```

### **Development Commands**
```bash
# Development mode with auto-restart
bun run dev

# Performance profiling mode
bun run start --profile

# Windows memory cleanup
./simple_memory_cleanup.ps1
```

## 🎮 **Game Controls**

### **Player Movement**
- **WASD**: Move player
- **Space**: Jump/Header
- **Shift**: Sprint
- **Mouse**: Look around

### **Ball Actions**
- **Left Click**: Pass to teammate
- **Right Click**: Shoot at goal
- **Q**: Charge power shot
- **E**: Tackle/Slide

### **Power-Ups** (Arcade Mode)
- **F**: Activate collected power-up
- **1-6**: Direct power-up activation (unlimited in Arcade)

### **Spectator Commands**
- **Arrow Keys**: Switch camera views
- **Tab**: Cycle through players
- **C**: Switch camera modes

## 🎯 **Game Modes Guide**

### **FIFA Mode**
- **Duration**: 6 minutes (2 halves)
- **Features**: Realistic soccer, crowd atmosphere, commentary
- **Focus**: Pure soccer simulation
- **Command**: `/fifa`

### **Arcade Mode**  
- **Duration**: 6 minutes (2 halves)
- **Features**: Unlimited F-key power-ups, enhanced physics
- **Focus**: Action-packed gameplay with special abilities
- **Command**: `/arcade`

### **Pickup Mode**
- **Duration**: 6 minutes (2 halves)
- **Features**: Collectible power-ups, physical ability pickups
- **Focus**: Strategy and resource management
- **Command**: `/pickup`

### **Tournament Mode**
- **Duration**: Variable
- **Features**: Bracket competition, player registration
- **Focus**: Competitive organized play
- **Command**: `/tournament`

## 🔧 **Console Commands**

### **Game Management**
- `/stuck` - Reset ball position during gameplay
- `/resetai` - Reset all AI players
- `/fixposition [all]` - Fix player positions if stuck
- `/testgoal <red|blue>` - Test goal detection
- `/endgame` - Check end-game rules and timing

### **Mode Switching**
- `/fifa` - Switch to FIFA mode
- `/arcade` - Switch to Arcade mode
- `/pickup` - Switch to Pickup mode
- `/tournament create [name]` - Create tournament

### **Spectator Mode**
- `/spectate` - Join as spectator
- `/nextplayer` - Switch to next player
- `/nextcamera` - Change camera angle
- `/ballcam` - Follow the ball
- `/leavespectator` - Exit spectator mode

### **Audio & Atmosphere**
- `/music <opening|gameplay|status>` - Control music
- `/crowd <start|stop|goal|status>` - Control crowd atmosphere
- `/lighting` - Show lighting commands

### **Performance & Debugging**
- `/profiler report` - View performance statistics
- `/profiler start/stop` - Control performance monitoring
- `/debugai` - Check AI system status
- `/config` - Show current configuration

## 🏗️ **Architecture**

### **Core Systems**
```
📁 Project Structure
├── 🎮 Game Logic
│   ├── state/          # Game state management
│   ├── entities/       # Player and AI entities
│   └── controllers/    # Input and movement handling
├── 🤖 AI System
│   ├── SoccerAgent     # Strategic decision making
│   └── BehaviorTree    # Tactical execution
├── 🎵 Audio System
│   ├── FIFACrowdManager # Crowd atmosphere
│   └── Dynamic Music    # Context-aware audio
├── 🏆 Tournament System
│   ├── Bracket Management
│   └── Player Coordination
├── 🚀 Performance System
│   ├── Real-time Profiling
│   └── Optimization Engine
└── 📊 UI System
    ├── Web Interface
    └── Real-time Data
```

### **Technical Stack**
- **Engine**: Hytopia SDK v0.6.21
- **Language**: TypeScript
- **Runtime**: Bun (preferred) / Node.js
- **Physics**: Built-in Hytopia physics engine
- **Networking**: WebRTC via mediasoup
- **UI**: HTML/CSS/JavaScript
- **Audio**: Hytopia Audio System

## 🎨 **Assets**

### **3D Models**
- Player models (Red/Blue teams)
- Soccer ball with realistic physics
- Stadium environment and decorations
- Power-up visual effects

### **Audio Assets**
- **Music**: Opening theme, FIFA mode, Arcade mode tracks
- **Crowd**: Ambient stadium sounds, chants, reactions
- **Commentary**: Professional announcer voice-overs
- **SFX**: Ball kicks, tackles, power-ups, UI sounds

### **UI Elements**
- Team selection interface
- Live scoreboard and statistics
- Tournament bracket display
- Performance monitoring overlay

## 🛠️ **Development**

### **Performance Optimization**
The game includes comprehensive performance monitoring and optimization:

```bash
# Enable performance profiling
/profiler start

# View detailed performance report
/profiler report

# Optimize for different hardware
/optimizedlighting  # For standard hardware
/domelighting      # For high-end hardware
/noshadows         # For low-end hardware
```

### **Memory Management**
Automatic systems for optimal performance:
- Server-side garbage collection every 30 seconds
- AI decision-making optimization
- Physics simulation efficiency
- GPU memory conservation

### **Cross-Platform Compatibility**
- **Windows**: Full support with Bun and Node.js
- **macOS/Linux**: Node.js compatibility
- **Mobile**: Responsive web interface
- **Web**: Browser-based gameplay

## 🔍 **Troubleshooting**

### **Common Issues**

**mediasoup worker not found:**
```bash
npm run setup
# Verify: node_modules/mediasoup/worker/out/Release/mediasoup-worker.exe
```

**Performance issues:**
```bash
# Check performance stats
/profiler report

# Optimize settings
/noshadows
/profiler start
```

**AI not responding:**
```bash
/debugai
/resetai
```

**Ball stuck:**
```bash
/stuck
/ballpos
```

### **System Requirements**
- **Minimum**: 4GB RAM, integrated graphics
- **Recommended**: 8GB RAM, dedicated graphics
- **Optimal**: 16GB RAM, gaming graphics card

## 📈 **Statistics & Analytics**

The game tracks comprehensive statistics:
- **Player Performance**: Goals, assists, tackles, passes, shots, saves
- **Team Statistics**: Possession, shots on target, passing accuracy
- **Match Data**: Duration, score progression, key events
- **AI Performance**: Decision-making efficiency, positioning accuracy
- **System Performance**: Frame rates, memory usage, optimization levels

## 🏆 **Tournament Features**

### **Tournament Types**
- **Single Elimination**: Standard knockout format
- **Double Elimination**: Losers bracket for second chances
- **Round Robin**: Everyone plays everyone format

### **Management Commands**
```bash
# Create tournament
/tournament create "Championship" single-elimination 8 fifa

# Join tournament
/tournament join [tournament-id]

# Check status
/tournament status

# Mark ready for match
/tournament ready
```

## 🎯 **Future Enhancements**

### **Planned Features**
- [ ] Mobile app interface
- [ ] Enhanced visual effects
- [ ] More power-up types
- [ ] League system
- [ ] Player customization
- [ ] Replay system
- [ ] Voice chat integration

### **Performance Improvements**
- [ ] Advanced GPU optimization
- [ ] Predictive AI loading
- [ ] Dynamic LOD system
- [ ] Network optimization

## 📄 **Documentation**

Additional documentation available:
- `ARCADE_MODE_GUIDE.md` - Comprehensive Arcade mode features
- `TOURNAMENT_PLAYER_GUIDE.md` - Tournament participation guide
- `SPECTATOR_MODE.md` - Spectator functionality details
- `PERFORMANCE_PROFILING_SUMMARY.md` - Performance optimization guide
- `WINDOWS_SETUP.md` - Windows-specific setup instructions

## 🤝 **Contributing**

This project demonstrates advanced game development practices with:
- **Professional Architecture**: Clean separation of concerns
- **Advanced AI**: Sophisticated decision-making systems
- **Performance Focus**: Real-time optimization and monitoring
- **User Experience**: Comprehensive UI and accessibility features

## 📞 **Support**

For technical issues or questions:
1. Check the troubleshooting section
2. Review the performance profiling guide
3. Use in-game debug commands
4. Check the comprehensive documentation

---

**Built with ❤️ using the Hytopia SDK**

*A showcase of professional game development practices in the Hytopia ecosystem.*
