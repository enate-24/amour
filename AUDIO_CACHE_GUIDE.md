# Audio Cache with IndexedDB

## Overview

The audio caching system uses IndexedDB to store called number audio files locally in the browser. This provides:

- **Faster playback**: Audio loads instantly from cache
- **Offline support**: Works without internet connection once cached
- **Reduced bandwidth**: Audio files downloaded only once
- **Better performance**: No network delays during gameplay

## Files Created

### 1. `src/utils/audioCache.ts`
Core IndexedDB utility for managing audio files:
- `audioCacheDB` - Singleton database instance
- `downloadAndCacheAudio()` - Download and cache audio file
- `getAudioUrl()` - Get audio URL from cache or download
- `preloadAudioFiles()` - Preload multiple audio files

### 2. `src/hooks/useAudioCache.ts`
React hook for audio caching:
- `isReady` - IndexedDB initialization status
- `playAudio()` - Play audio from cache
- `preloadNumbers()` - Preload number sounds
- `clearCache()` - Clear all cached audio
- `getCacheInfo()` - Get cache statistics

### 3. `src/hooks/useSoundManagerWithCache.ts`
Enhanced sound manager with IndexedDB caching:
- `playNumber()` - Play number sound from cache
- `playGameSound()` - Play game sound from cache
- `preloadSounds()` - Preload all sounds (1-75 + game sounds)
- `preloadProgress` - Download progress (0-100%)

### 4. `src/components/AudioCacheManager.tsx`
UI component for managing audio cache:
- Shows cache statistics (file count, size)
- Download all sounds button
- Clear cache button
- Progress indicator

## Components Using IndexedDB Cache

### AudioManager (Called Numbers)
**Location**: `src/utils/AudioManager.ts`

The AudioManager is now integrated with IndexedDB cache for called number audio (1-75):

**Features:**
- Preloads all number sounds from IndexedDB cache on initialization
- Creates object URLs from cached blobs for instant playback
- Falls back to on-demand loading from cache if not preloaded
- Batch loading (10 files at a time) for optimal performance
- Automatic object URL management and cleanup

**How it works:**
1. On initialization, loads all 75 number sounds from IndexedDB in batches
2. Creates Audio elements with object URLs from cached blobs
3. Stores preloaded audio in memory pool for instant access
4. Falls back to on-demand cache loading if a number wasn't preloaded

**Note**: The AudioManager requires that audio files are already cached in IndexedDB. Use the AudioCacheManager component to download and cache all sounds first.

## Usage

### Basic Usage in Components

```typescript
import { useSoundManagerWithCache } from '../hooks/useSoundManagerWithCache';

function MyComponent() {
  const { playNumber, playGameSound, isReady } = useSoundManagerWithCache();

  const handleCallNumber = async (number: number) => {
    await playNumber(number);
  };

  const handleGameStart = async () => {
    await playGameSound('start');
  };

  return (
    <div>
      {isReady ? 'Audio ready' : 'Loading...'}
      <button onClick={() => handleCallNumber(42)}>Call B-42</button>
      <button onClick={handleGameStart}>Start Game</button>
    </div>
  );
}
```

### Add Cache Manager to Settings

```typescript
import AudioCacheManager from './components/AudioCacheManager';

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <AudioCacheManager />
    </div>
  );
}
```

### Preload on App Start

```typescript
import { useSoundManagerWithCache } from './hooks/useSoundManagerWithCache';

function App() {
  const { preloadProgress } = useSoundManagerWithCache({
    preloadOnMount: true, // Auto-preload on mount
    volume: 0.7
  });

  return (
    <div>
      {preloadProgress < 100 && (
        <div>Loading sounds: {preloadProgress}%</div>
      )}
      {/* Rest of app */}
    </div>
  );
}
```

## How It Works

1. **First Time**: Audio files are downloaded from server and stored in IndexedDB
2. **Subsequent Plays**: Audio loaded instantly from IndexedDB cache
3. **Automatic Caching**: Files cached automatically when played
4. **Persistent Storage**: Cache survives browser restarts
5. **Smart Updates**: Only downloads if not in cache

## Cache Storage

- **Database Name**: `BingoAudioCache`
- **Store Name**: `audioFiles`
- **Storage Format**: Blob (binary audio data)
- **Typical Size**: ~5-10 MB for all sounds (1-75 + game sounds)

## API Reference

### audioCacheDB

```typescript
// Initialize database
await audioCacheDB.init();

// Save audio
await audioCacheDB.saveAudio('number-42', audioBlob);

// Get audio
const blob = await audioCacheDB.getAudio('number-42');

// Check if cached
const exists = await audioCacheDB.hasAudio('number-42');

// Delete audio
await audioCacheDB.deleteAudio('number-42');

// Clear all
await audioCacheDB.clearAll();

// Get all IDs
const ids = await audioCacheDB.getAllAudioIds();

// Get cache size
const sizeInBytes = await audioCacheDB.getCacheSize();
```

### Helper Functions

```typescript
// Download and cache
const blob = await downloadAndCacheAudio('/sounds/42.mp3', 'number-42');

// Get object URL (from cache or download)
const url = await getAudioUrl('/sounds/42.mp3', 'number-42');

// Preload multiple files
await preloadAudioFiles([
  { url: '/sounds/1.mp3', id: 'number-1' },
  { url: '/sounds/2.mp3', id: 'number-2' }
]);
```

## Benefits

✅ **Performance**: Instant audio playback, no network delays
✅ **Offline**: Works without internet after initial download
✅ **Bandwidth**: Saves bandwidth by caching files
✅ **User Experience**: Smooth, responsive audio playback
✅ **Reliability**: No failed downloads during gameplay

## Browser Support

IndexedDB is supported in all modern browsers:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Mobile browsers: ✅

## Migration from Old System

To migrate from the old sound manager:

1. Replace `useSoundManager` with `useSoundManagerWithCache`
2. Add `AudioCacheManager` component to settings page
3. Test audio playback
4. Optional: Preload sounds on app start

```typescript
// Old
import { useSoundManager } from './hooks/useSoundManager';
const { playSound } = useSoundManager();

// New
import { useSoundManagerWithCache } from './hooks/useSoundManagerWithCache';
const { playNumber } = useSoundManagerWithCache();
```

## Troubleshooting

### Audio not playing
- Check browser console for errors
- Verify IndexedDB is enabled in browser
- Try clearing cache and re-downloading

### Cache not working
- Check if IndexedDB quota exceeded
- Verify network connection for initial download
- Check browser storage settings

### Slow initial load
- Normal for first time (downloading all sounds)
- Use preload progress indicator
- Consider preloading in background

## Future Enhancements

- [ ] Selective caching (cache only frequently used numbers)
- [ ] Cache expiration/versioning
- [ ] Compression for smaller cache size
- [ ] Service Worker integration for true offline support
- [ ] Cache warming strategies
