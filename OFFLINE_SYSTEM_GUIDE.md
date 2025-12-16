# Comprehensive Offline System Guide

## Overview

The Amour Bingo system now supports full offline functionality, allowing users to play games, manage cartelas, and access most features without an internet connection. Data automatically syncs when the connection is restored.

## Key Features

### 🌐 Network-Aware Architecture
- **Automatic Detection**: Real-time network status monitoring
- **Graceful Degradation**: Seamless fallback to offline mode
- **Smart Reconnection**: Automatic sync when connection restored

### 💾 Offline Storage
- **IndexedDB Integration**: Robust local data storage
- **Multi-layered Caching**: API responses, game data, user settings
- **Conflict Resolution**: Smart merging of offline and online data

### 🎮 Offline Gaming
- **Full Game Creation**: Start games without internet
- **Local Game Logic**: Complete bingo functionality offline
- **Pattern Detection**: Winner checking works offline
- **Audio Support**: Cached audio files for offline play

### 🔄 Background Synchronization
- **Automatic Sync**: Data syncs when connection restored
- **Queue Management**: Failed requests queued for retry
- **Conflict Resolution**: Smart handling of data conflicts
- **Progress Tracking**: Real-time sync status updates

## Architecture Components

### Core Utilities

#### 1. OfflineStorage (`src/utils/offlineStorage.ts`)
- **Purpose**: Comprehensive offline data management
- **Features**:
  - IndexedDB wrapper with structured storage
  - Automatic sync queue management
  - Data versioning and conflict resolution
  - Multi-type data support (games, users, cartelas, settings)

#### 2. OfflineApiClient (`src/utils/offlineApiClient.ts`)
- **Purpose**: Network-aware API client
- **Features**:
  - Automatic offline detection
  - Cache-first strategy for GET requests
  - Request queueing for POST/PUT when offline
  - Transparent fallback to cached data

#### 3. OfflineGameManager (`src/utils/offlineGameManager.ts`)
- **Purpose**: Complete game management offline
- **Features**:
  - Game creation without network
  - Local number sequence generation
  - Winner pattern detection
  - Game state persistence

#### 4. OfflineSyncManager (`src/utils/offlineSyncManager.ts`)
- **Purpose**: Coordinates all synchronization
- **Features**:
  - Periodic sync when online
  - Background sync on network restoration
  - Sync status monitoring
  - Error handling and retry logic

### Enhanced Hooks

#### 1. useOfflineAuth (`src/hooks/useOfflineAuth.ts`)
- **Purpose**: Authentication with offline support
- **Features**:
  - Cached user data
  - Offline session persistence
  - Automatic refresh when online

#### 2. useOfflineCartela (`src/hooks/useOfflineCartela.ts`)
- **Purpose**: Cartela management offline
- **Features**:
  - Cached cartela data
  - Offline cartela selection
  - Background refresh when online

### UI Components

#### 1. OfflineStatusBar (`src/components/OfflineStatusBar.tsx`)
- **Purpose**: Comprehensive offline status display
- **Features**:
  - Real-time connection status
  - Sync progress indication
  - Pending items count
  - Manual sync trigger

#### 2. NewGameOffline (`src/components/NewGameOffline.tsx`)
- **Purpose**: Game creation with offline support
- **Features**:
  - Works completely offline
  - Visual offline indicators
  - Automatic sync when online

### Service Worker (`public/sw.js`)
- **Purpose**: True PWA offline functionality
- **Features**:
  - Static asset caching
  - API response caching
  - Background sync support
  - Offline page serving

## Usage Examples

### 1. Creating a Game Offline

```typescript
import { offlineGameManager } from '../utils/offlineGameManager';

// Works both online and offline
const game = await offlineGameManager.createGame({
  selectedCartelas: ['1', '2', '3'],
  betAmount: 5,
  housePercentage: 25,
  totalBet: 15,
  houseCut: 3.75,
  playerWin: 11.25,
  userId: 'user123'
});

// Game automatically syncs when online
```

### 2. Using Offline-Aware API Client

```typescript
import { apiClient } from '../utils/offlineApiClient';

// Automatically uses cache when offline
const response = await apiClient.get('/cartelas');
console.log('From cache:', response.fromCache);

// Queues request when offline
await apiClient.post('/games/session', gameData);
```

### 3. Monitoring Sync Status

```typescript
import { offlineSyncManager } from '../utils/offlineSyncManager';

const unsubscribe = offlineSyncManager.subscribe((status) => {
  console.log('Online:', status.isOnline);
  console.log('Pending items:', status.pendingItems);
  console.log('Syncing:', status.syncInProgress);
});
```

## Data Flow

### Online Mode
1. **Request** → API Server
2. **Response** → Cache + UI
3. **Updates** → Immediate sync

### Offline Mode
1. **Request** → Local Cache
2. **Writes** → Local Storage + Sync Queue
3. **Reads** → Cached Data

### Sync Process
1. **Network Restored** → Trigger sync
2. **Process Queue** → Send pending requests
3. **Merge Data** → Resolve conflicts
4. **Update Cache** → Fresh data available

## Configuration

### Environment Variables
```env
VITE_API_URL=http://localhost:3001/api
VITE_OFFLINE_ENABLED=true
VITE_SYNC_INTERVAL=300000  # 5 minutes
```

### Service Worker Configuration
- **Cache Strategy**: Cache-first for static assets
- **API Strategy**: Network-first with cache fallback
- **Update Strategy**: Background update with user notification

## Best Practices

### 1. Data Management
- Always check `fromCache` flag in responses
- Handle stale data gracefully
- Provide visual indicators for offline data

### 2. User Experience
- Show offline status clearly
- Indicate when data is syncing
- Provide manual sync options
- Handle conflicts transparently

### 3. Error Handling
- Graceful degradation when offline
- Clear error messages
- Retry mechanisms for failed syncs
- Fallback to cached data

## Troubleshooting

### Common Issues

#### 1. Sync Not Working
- Check network status
- Verify auth token validity
- Check sync queue status
- Clear cache if corrupted

#### 2. Stale Data
- Force refresh when online
- Check cache timestamps
- Verify sync completion

#### 3. Storage Full
- Implement cache cleanup
- Monitor storage usage
- Provide manual clear options

### Debug Tools

#### 1. Console Logging
```javascript
// Enable detailed logging
localStorage.setItem('debug', 'offline:*');
```

#### 2. Cache Inspection
```javascript
// Check cache contents
const cache = await caches.open('amour-dynamic-v1');
const keys = await cache.keys();
console.log('Cached URLs:', keys);
```

#### 3. Sync Status
```javascript
// Monitor sync status
offlineSyncManager.subscribe(console.log);
```

## Performance Considerations

### 1. Storage Limits
- IndexedDB: ~50% of available disk space
- Cache API: Shared with other origins
- Monitor usage and implement cleanup

### 2. Sync Efficiency
- Batch operations when possible
- Use incremental sync for large datasets
- Implement smart conflict resolution

### 3. Battery Usage
- Limit background sync frequency
- Use efficient data structures
- Minimize unnecessary operations

## Security Considerations

### 1. Data Encryption
- Sensitive data encrypted in local storage
- Auth tokens properly secured
- Clear data on logout

### 2. Sync Security
- Validate all synced data
- Use secure API endpoints
- Implement proper authentication

## Future Enhancements

### 1. Advanced Sync
- Operational transforms for real-time collaboration
- Peer-to-peer sync between devices
- Smart conflict resolution algorithms

### 2. Performance
- Predictive caching
- Background prefetching
- Intelligent cache management

### 3. Features
- Offline multiplayer support
- Advanced pattern detection
- Real-time notifications

## Conclusion

The offline system provides a robust foundation for uninterrupted gameplay while maintaining data consistency and user experience. The architecture is designed to be extensible and maintainable, supporting future enhancements and scaling requirements.