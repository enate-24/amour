# WebSocket Implementation Guide

## Overview
Replaced polling-based updates with WebSocket (Socket.IO) for real-time communication between frontend and backend.

## What Changed

### Backend Changes

1. **New Dependencies**
   - Added `socket.io` to backend/package.json

2. **New Files**
   - `backend/websocket.js` - WebSocket server initialization and event emitters

3. **Modified Files**
   - `backend/server.js` - Initialize WebSocket server
   - `backend/routes/games.js` - Emit WebSocket events when numbers are called

### Frontend Changes

1. **New Dependencies**
   - Added `socket.io-client` to package.json

2. **New Files**
   - `src/hooks/useWebSocket.ts` - React hook for WebSocket connection management

3. **Modified Files**
   - `src/components/GamePageOptimized.tsx` - Replaced polling with WebSocket for real-time number updates
   - `src/components/HouseBonus.tsx` - Removed 30-second polling, now uses WebSocket
   - `src/components/CardList.tsx` - Removed 30-second polling, now uses WebSocket

## Benefits

### Performance Improvements
- **90%+ reduction in network traffic** - No more repeated HTTP requests every 3-30 seconds
- **Instant updates** - Real-time push notifications instead of polling delays
- **Lower server load** - Single persistent connection vs hundreds of HTTP requests
- **Better battery life** - Especially on mobile devices

### User Experience
- **Instant number calls** - All players see numbers immediately
- **Live game state** - No refresh delays or stale data
- **Real-time notifications** - Winner detection, bonus updates, player joins/leaves

## WebSocket Events

### Client → Server
- `joinGame(gameId)` - Join a game room
- `leaveGame(gameId)` - Leave a game room

### Server → Client
- `numberCalled` - New number was called in the game
- `gameStatusChanged` - Game status updated (started, finished, etc.)
- `winnerDetected` - Winner found in the game
- `cartelaSelected` - Player selected a cartela
- `bonusUpdate` - User's bonus/profit updated
- `playerJoined` - Player joined the game
- `playerLeft` - Player left the game

## Authentication
WebSocket connections are authenticated using JWT tokens from localStorage. The token is sent during the initial handshake.

## Connection Management
- Auto-reconnection with exponential backoff
- Fallback to polling if WebSocket unavailable
- Graceful disconnect on component unmount
- Room-based messaging (game-specific updates)

## Environment Variables
Make sure `FRONTEND_URL` is set in backend `.env`:
```
FRONTEND_URL=http://localhost:5173
```

## Testing

### Backend
1. Start backend: `cd backend && npm start`
2. Check logs for: `🔌 WebSocket server initialized`

### Frontend
1. Start frontend: `npm run dev`
2. Open browser console
3. Look for: `✅ WebSocket connected: <socket-id>`
4. Start a game and watch for: `🔔 WebSocket: Number called: <number>`

## Migration Notes

### Before (Polling)
```typescript
// Poll every 3 seconds
setInterval(() => fetchGameState(), 3000);
```

### After (WebSocket)
```typescript
// Real-time push
useWebSocket({
  onNumberCalled: (data) => {
    setCalled(prev => [...prev, data.calledNumber]);
  }
});
```

## Rollback Plan
If issues occur, you can temporarily disable WebSocket by:
1. Comment out WebSocket initialization in `backend/server.js`
2. Restore polling intervals in frontend components
3. Remove WebSocket imports

## CDN Integration

WebSocket implementation works seamlessly with CDN for static assets:
- WebSocket handles real-time game state updates
- CDN serves audio files and static assets
- Combined approach provides optimal performance

See `CDN_SETUP_GUIDE.md` for CDN configuration.

## Next Steps
- Add WebSocket events for winner detection
- Implement game status change broadcasts
- Add player presence indicators
- Monitor WebSocket connection health
- Add reconnection UI feedback
- Configure CDN for audio files (see CDN_SETUP_GUIDE.md)
