# Windows Setup Guide - Hytopia Soccer Game

## 🚨 Windows-Specific Issues & Solutions

This guide addresses Windows-specific compatibility issues with the Hytopia Soccer game.

### Issue 1: Mediasoup Worker Binary Missing
**Error**: `ENOENT: no such file or directory, uv_spawn 'mediasoup-worker'`

**Root Cause**: The mediasoup native worker binary doesn't compile properly with Bun on Windows.

**Solution**: Use Node.js with tsx instead of Bun.

### Issue 2: Deprecated startServer Parameters
**Warning**: `using deprecated parameters for the initialization function`

**Status**: This is a known issue with the current Hytopia SDK version and can be safely ignored.

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
**✅ WORKING METHOD:**
```bash
npm run start
# OR
npm run dev
# OR
npx tsx index.ts
```

**❌ PROBLEMATIC METHOD (Don't use on Windows):**
```bash
bun run index.ts  # This will fail with mediasoup worker error
```

### 3. Expected Output
When working correctly, you should see:
```
🚨 HYTOPIA PLATFORM GATEWAY IS NOT INITIALIZED 🚨
⚠️ WARNING: Socket._constructor(): Failed to initialize WebRTC, falling back to Websockets...
Loading soccer map...
Creating soccer ball
Soccer ball created and spawned successfully
```

## 🎮 Game Features Working

- ✅ 6v6 Soccer gameplay
- ✅ AI players with roles (goalkeeper, defenders, midfielders, strikers)
- ✅ Ball physics and collision detection
- ✅ Goal detection and scoring
- ✅ Team selection UI
- ✅ Single-player mode with AI opponents
- ✅ Observer mode for developers
- ✅ Chat commands (/stuck, /resetai, /debugai, etc.)

## 🌐 Development Notes

- **WebRTC Warning**: The WebRTC fallback warning is expected in local development
- **Platform Gateway**: The "not initialized" message is normal for local development
- **Performance**: Game runs at full performance despite the warnings

## 🚀 Deployment

For production deployment, the Hytopia platform will automatically handle:
- Platform Gateway initialization
- WebRTC configuration
- Environment variables

This Windows-specific setup is only needed for local development.

## 🔧 Troubleshooting

If you still encounter issues:

1. **Clean Install**:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Alternative**: Use WSL2 (Windows Subsystem for Linux) for a more Unix-like development environment.

3. **Check Dependencies**: Ensure you have Node.js 18+ installed. 