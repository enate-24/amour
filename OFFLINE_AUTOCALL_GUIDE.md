# Offline Autocall System

## Overview

The Bingo game now uses a **pre-fetched number sequence** stored in IndexedDB for all autocall operations. This ensures consistent number calling whether online or offline, and eliminates network delays during gameplay.

## How It Works

### Game Initialization
1. When a game starts, the backend generates a shuffled sequence of 75 numbers
2. Frontend fetches this sequence via API and stores it in IndexedDB
3. All subsequent number calls use this pre-fetched sequence

### Online Mode (Normal Operation)
1. Autocall gets next number from IndexedDB sequence (in order)
2. Number is displayed and audio is played instantly
3. Called number is synced to backend in the background (fire and forget)
4. No waiting for API responses - instant gameplay

### Offline Mode (Network Disconnected)
1. System detects network is offline
2. Autocall continues using IndexedDB sequence (same as online)
3. Numbers are displayed and audio is played normally
4. Visual "OFFLINE MODE" indicator appears in the game header
5. Backend sync is skipped until network returns

### Network Reconnection
1. When network comes back online, offline indicator disappears
2. Backend sync resumes automatically
3. No interruption to gameplay

## Key Features

### 1. Seamless Transition
- No interruption when network disconnects
- Autocall continues without user intervention
- Automatic switch back to online mode when network returns

### 2. Visual Feedback
- Red "📡 OFFLINE MODE" badge appears when offline
- Badge pulses to draw attention
- Disappears automatically when back online

### 3. Data Persistence
- Game state stored in IndexedDB
- Survives page refreshes
- Maintains called numbers and remaining numbers

### 4. Manual Next Button
- Works in both online and offline modes
- Automatically uses appropriate source (API or IndexedDB)
- Same user experience regardless of connection status

## Technical Implementation

### Components

#### 1. `offlineGameState.ts`
- Manages IndexedDB storage
- Stores game state including:
  - Called numbers
  - Remaining numbers
  - Game metadata
- Provides methods to:
  - Get next random number
  - Sync with server
  - Initialize game state

#### 2. `optimizedPolling.ts` (Enhanced)
- Added `continueOffline` option
- Added `offlineCallback` for offline number generation
- Automatically detects network errors
- Switches between online and offline callbacks

#### 3. `GamePageOptimized.tsx` (Enhanced)
- Initializes IndexedDB on game load
- Syncs called numbers to IndexedDB when online
- Uses offline callback for autocall
- Shows offline indicator badge
- Manual next button supports both modes

### Data Flow

```
Game Start
    ↓
Backend generates shuffled sequence (1-75)
    ↓
Frontend fetches sequence via API
    ↓
Store sequence in IndexedDB
    ↓
Autocall Enabled
    ↓
Get next number from IndexedDB sequence
    ↓
Display number & play audio (instant)
    ↓
┌─────────────────────────────────┐
│  Network Available?             │
├─────────────────────────────────┤
│ YES → Sync to backend           │
│       (fire and forget)         │
│       Continue to next number   │
├─────────────────────────────────┤
│ NO  → Skip backend sync         │
│       Continue to next number   │
└─────────────────────────────────┘
```

## User Experience

### What Users See

**Online Mode:**
- Normal game operation
- Numbers called from server
- No special indicators

**Offline Mode:**
- Red "📡 OFFLINE MODE" badge appears
- Autocall continues without interruption
- Numbers still called at same interval
- Audio still plays normally

**Reconnection:**
- Badge disappears
- System switches back to server
- No user action required

## Benefits

1. **Instant Number Calling**: No API delays - numbers appear immediately
2. **Consistent Sequence**: Same number order online and offline
3. **Uninterrupted Gameplay**: Players can continue even with poor network
4. **Better User Experience**: No waiting, no frustration
5. **Data Safety**: Game state preserved locally
6. **Automatic Recovery**: Seamless transition back to online mode
7. **Transparent Operation**: Works without user intervention
8. **Reduced Server Load**: Backend only receives sync updates, not number requests

## Limitations

1. **Initial Fetch Required**: Must be online when game starts to fetch sequence
2. **No Server Sync While Offline**: Called numbers only stored locally until reconnection
3. **Winner Checking**: May not work offline (requires server validation)
4. **Multi-Device**: Sequence is device-specific (not synced across devices)
5. **Storage Limit**: IndexedDB has browser storage limits (not an issue for 75 numbers)

## Future Enhancements

Possible improvements:
- Sync offline numbers to server when reconnected
- Queue winner checks for offline validation
- Multi-device sync via service workers
- Conflict resolution for simultaneous online/offline play

## Testing

To test offline mode:
1. Start a game with autocall enabled
2. Open browser DevTools → Network tab
3. Set throttling to "Offline"
4. Observe autocall continues
5. Check for "OFFLINE MODE" badge
6. Set back to "Online"
7. Observe badge disappears

## Troubleshooting

### Autocall Stops in Offline Mode
- Check browser console for IndexedDB errors
- Verify game state was initialized
- Check if all 75 numbers were called

### Numbers Not Syncing
- Check network status indicator
- Verify API is accessible
- Check browser console for sync errors

### IndexedDB Not Working
- Check browser supports IndexedDB
- Verify storage quota not exceeded
- Try clearing browser data and restarting

## Browser Support

IndexedDB is supported in:
- Chrome 24+
- Firefox 16+
- Safari 10+
- Edge 12+
- Opera 15+

## Conclusion

The offline autocall system ensures uninterrupted gameplay even with network issues. It provides a seamless experience by automatically switching between online and offline modes, maintaining game state locally, and recovering gracefully when the network returns.
