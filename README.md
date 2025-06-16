# 🚀 Hytopia Soccer Game

This is a full-featured 6v6 multiplayer soccer game built with the Hytopia SDK.

## 🏃‍♂️ Quick Start for Windows + Bun

### Prerequisites
- Node.js (for building native modules)
- Bun runtime
- Windows with Visual Studio Build Tools (for native compilation)

### Setup Instructions

1. **Install dependencies and build native modules:**
```bash
npm run setup
```

2. **Start the game server with Bun:**
```bash
bun run start
```

### Alternative Commands

- **Development mode:** `bun run dev`
- **Run with Node.js (if Bun has issues):** `npm run start:node`

## 🔧 Windows + Bun Compatibility

This project includes automatic mediasoup worker binary detection for Bun on Windows. The setup process:

1. Uses npm to install and build native modules (including mediasoup)
2. Automatically sets the `MEDIASOUP_WORKER_BIN` environment variable
3. Allows Bun to run the server with working WebRTC functionality

## 🎮 Game Features

- **6v6 Multiplayer:** Full team gameplay with AI players
- **Advanced AI System:** Intelligent teammates and opponents
- **Complete Soccer Rules:** Offside detection, throw-ins, corner kicks
- **Real-time Physics:** Realistic ball and player movement
- **Cross-platform:** Works on web browsers and mobile devices

## 🛠️ Troubleshooting

### If mediasoup worker not found:
1. Make sure you ran `npm run setup` first
2. Check that `node_modules/mediasoup/worker/out/Release/mediasoup-worker.exe` exists
3. Try running with Node.js: `npm run start:node`

### If build fails:
1. Install Visual Studio Build Tools
2. Make sure Python is available in PATH
3. Run `npm install` manually to see detailed error messages

## 📁 Project Structure

- `index.ts` - Main server entry point
- `state/` - Game state management
- `entities/` - Player and AI entities
- `controllers/` - Player movement and input handling
- `utils/` - Utility functions and helpers
- `assets/` - Game assets (maps, audio, models)

## 🎯 Development

The server is designed to work with Bun as the preferred runtime while maintaining compatibility with Node.js for development and troubleshooting.
