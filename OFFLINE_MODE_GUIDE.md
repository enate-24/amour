# Offline Mode Implementation Guide

## Overview

The application now supports comprehensive offline mode functionality, allowing users to continue using cached features when network connectivity is lost.

## Features

### 1. Network Status Detection (`src/utils/networkStatus.ts`)

**Capabilities:**
- Real-time network status monitoring using browser events
- Periodic connectivity checks (every 30 seconds)
- React hook for easy integration: `useNetworkStatus()`
- Automatic notification of status changes

**Usage:**
```typescript
import { useNetworkStatus } from './utils/networkStatus';

function MyComponent() {
  const { isOnline, isOffline, forceCheck } = useNetworkStatus();
  
  return (
    <div>
      Status: {isOnline ? 'Online' : 'Offline'}
      <button onClick={forceCheck}>Check Now</button>
    </div>
  );
}
```

### 2. Offline Request Queue (`src/utils/offlineQueue.ts`)

**Capabilities:**
- Automatically queues failed API mutations (POST, PUT, DELETE)
- Retries queued requests when network is restored
- Persistent storage using localStorage
- Maximum queue size: 50 requests
- Maximum retries per request: 3

**Features:**
- GET requests are NOT queued (they use cache instead)
- Client errors (4xx) are not retried
- Server errors (5xx) trigger retry with exponential backoff
- Queue is automatically processed when network is restored

**Usage:**
```typescript
import { offlineAwareFetch, offlineQueue } from './utils/offlineQueue';

// Use offline-aware fetch
try {
  const response = await offlineAwareFetch('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  });
} catch (error) {
  // Request was queued if offline
  console.log('Request queued:', error);
}

// Check queue status
console.log('Queue size:', offlineQueue.getQueueSize());

// Manually process queue
await offlineQueue.processQueue();

// Clear queue
offlineQueue.clear();
```

### 3. Offline-Aware Audio Manager (`src/utils/UnifiedAudioManager.ts`)

**Enhancements:**
- Checks network status before downloading audio files
- Works seamlessly with cached audio files in offline mode
- Provides clear error messages when audio is not available offline
- Logs offline mode status for debugging

**Behavior:**
- **Online:** Downloads missing audio files on-demand
- **Offline:** Only plays cached audio files
- **Error:** Throws descriptive error if audio not cached and offline

### 4. Offline Indicator UI (`src/components/OfflineIndicator.tsx`)

**Features:**
- Fixed position indicator in top-right corner
- Shows current network status (Online/Offline)
- Displays count of queued requests
- Click to view queue details
- Option to clear queue manually
- Auto-hides when online with empty queue

**Visual States:**
- 🔴 Red: Offline mode
- 🟡 Orange: Online but syncing queued requests
- Hidden: Online with no pending requests

### 5. Enhanced API Layer (`src/lib/api.ts`)

**Improvements:**
- All API calls are now offline-aware
- GET requests use cache when offline
- Mutations are queued when offline
- Automatic cache invalidation on successful mutations
- Network recovery triggers queue processing

**Error Handling:**
- Graceful degradation when offline
- Clear error messages for debugging
- Automatic retry on network recovery

## How It Works

### Network Detection Flow

```
1. Browser online/offline events
   ↓
2. NetworkStatusManager updates status
   ↓
3. Notifies all subscribers
   ↓
4. Components update UI
   ↓
5. Periodic connectivity checks (fallback)
```

### Offline Request Flow

```
1. User makes API request
   ↓
2. Check network status
   ↓
3a. Online: Send request normally
3b. Offline: Queue request (if mutation)
   ↓
4. Network restored
   ↓
5. Process queue automatically
   ↓
6. Retry failed requests
   ↓
7. Update UI on completion
```

### Audio Playback Flow

```
1. Request to play audio
   ↓
2. Check cache for audio file
   ↓
3a. Cached: Play immediately (works offline)
3b. Not cached:
   ↓
   4. Check network status
   ↓
   5a. Online: Download and cache
   5b. Offline: Show error
```

## Configuration

### Network Status Check Interval

Default: 30 seconds

To change, modify `CHECK_INTERVAL` in `src/utils/networkStatus.ts`:
```typescript
private readonly CHECK_INTERVAL = 30000; // milliseconds
```

### Offline Queue Settings

Modify in `src/utils/offlineQueue.ts`:
```typescript
private readonly MAX_QUEUE_SIZE = 50;    // Maximum queued requests
private readonly MAX_RETRIES = 3;        // Retries per request
```

### API Cache TTL

Default: 5 seconds

To change, modify cache TTL in API calls:
```typescript
const response = await fetchWithAuth(url, {}, 10000); // 10 second cache
```

## Testing Offline Mode

### Chrome DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from throttling dropdown
4. Test application functionality

### Manual Testing Checklist

- [ ] Offline indicator appears when network is lost
- [ ] Cached audio files play in offline mode
- [ ] Uncached audio shows appropriate error
- [ ] API mutations are queued when offline
- [ ] Queue processes automatically when online
- [ ] Queue count updates in real-time
- [ ] Clear queue button works
- [ ] GET requests use cache when offline
- [ ] Error messages are user-friendly

## Best Practices

### For Developers

1. **Always use `fetchWithAuth` for API calls** - It includes offline support
2. **Cache important data** - Use appropriate TTL for different endpoints
3. **Handle offline errors gracefully** - Show user-friendly messages
4. **Test offline scenarios** - Use DevTools to simulate offline mode
5. **Monitor queue size** - Large queues may indicate issues

### For Users

1. **Pre-cache audio files** - Play all numbers once while online
2. **Check offline indicator** - Know when you're offline
3. **Monitor queued requests** - See pending operations
4. **Wait for sync** - Let queued requests complete when online
5. **Clear queue if needed** - Remove stuck requests manually

## Troubleshooting

### Audio Won't Play Offline

**Cause:** Audio file not cached
**Solution:** Play the audio once while online to cache it

### Requests Not Queuing

**Cause:** Queue is full (50 requests max)
**Solution:** Clear old requests or wait for processing

### Queue Not Processing

**Cause:** Network still offline or server errors
**Solution:** Check network status, wait for stable connection

### Cache Not Working

**Cause:** IndexedDB disabled or quota exceeded
**Solution:** Check browser settings, clear old cache

## Performance Impact

### Memory Usage
- Network status manager: ~1KB
- Offline queue: ~10-50KB (depends on queue size)
- Audio cache: ~5-10MB (78 audio files)
- API cache: ~100KB-1MB (depends on usage)

### Network Impact
- Reduced API calls due to caching
- Batch processing of queued requests
- Periodic connectivity checks (minimal overhead)

### Storage Impact
- localStorage: Offline queue (~50KB max)
- IndexedDB: Audio cache (~10MB)
- sessionStorage: API cache (cleared on close)

## Future Enhancements

1. **Service Worker Integration** - Full PWA support
2. **Background Sync** - Sync when app is closed
3. **Conflict Resolution** - Handle concurrent edits
4. **Selective Sync** - Choose what to sync
5. **Offline Analytics** - Track offline usage patterns

## Related Files

- `src/utils/networkStatus.ts` - Network detection
- `src/utils/offlineQueue.ts` - Request queuing
- `src/utils/apiCache.ts` - Response caching
- `src/utils/UnifiedAudioManager.ts` - Audio management
- `src/components/OfflineIndicator.tsx` - UI indicator
- `src/lib/api.ts` - API layer integration
- `src/App.tsx` - App-level integration

## Support

For issues or questions about offline mode:
1. Check browser console for error messages
2. Verify network status in DevTools
3. Check offline queue status
4. Review cache statistics
5. Test with different network conditions
