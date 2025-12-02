# Migration Guide: Using UnifiedAudioManager

## Quick Start

Replace old audio code with the new `useAudioManager` hook:

```tsx
import { useAudioManager } from '../hooks/useAudioManager';

function MyComponent() {
  const { playSound, isReady } = useAudioManager();
  
  const handlePlayNumber = async (num: number) => {
    if (isReady) {
      await playSound(num); // Automatically uses cache or downloads on-demand
    }
  };
  
  return <button onClick={() => handlePlayNumber(42)}>Play 42</button>;
}
```

## Migration Examples

### Example 1: GamePageOptimized.tsx

**OLD CODE:**
```tsx
// Old AudioManager class
class AudioManager {
  playSound(number: number): void {
    const audio = new Audio(`/sounds/${number}.wav`);
    audio.play();
  }
}

const audioManagerRef = useRef(new AudioManager());

// Usage
audioManagerRef.current?.playSound(calledNumber);
```

**NEW CODE:**
```tsx
import { useAudioManager } from '../hooks/useAudioManager';

// In component
const { playSound, isReady } = useAudioManager();

// Usage
if (isReady) {
  await playSound(calledNumber);
}
```

### Example 2: NewGame.tsx

**OLD CODE:**
```tsx
const soundUrl = '/sounds/start.wav';
const audio = new Audio(soundUrl);
audio.volume = 0.5;
audio.play();
```

**NEW CODE:**
```tsx
import { useAudioManager } from '../hooks/useAudioManager';

const { playSound } = useAudioManager();

// Play start sound
await playSound('start.wav');
```

### Example 3: Playing Winner/Not Winner Sounds

**OLD CODE:**
```tsx
const soundUrl = result.win ? '/sounds/winner.mp3' : '/sounds/notwinner.wav';
const audio = new Audio(soundUrl);
audio.volume = 0.7;
audio.play().catch((error) => {
  console.warn('Could not play sound:', error);
});
```

**NEW CODE:**
```tsx
const { playSound } = useAudioManager();

const soundFile = result.win ? 'winner.mp3' : 'notwinner.wav';
try {
  await playSound(soundFile);
} catch (error) {
  console.warn('Could not play sound:', error);
}
```

## Benefits of Migration

1. **Automatic caching** - No need to manually manage cache
2. **On-demand downloads** - Files download only when needed
3. **Error handling** - Built-in retry logic with exponential backoff
4. **Consistent API** - Same interface across all components
5. **Better performance** - Concurrent download limiting prevents browser overload

## Common Patterns

### Playing Number Sounds (1-75)
```tsx
await playSound(42); // Plays 42.mp3
```

### Playing Special Sounds
```tsx
await playSound('start.wav');
await playSound('winner.mp3');
await playSound('notwinner.wav');
```

### Preloading Sounds
```tsx
// Preload without playing
await preloadSound(1);
await preloadSound(2);
await preloadSound('start.wav');
```

### Checking Cache Status
```tsx
const { cacheStatus } = useAudioManager();

if (cacheStatus?.isComplete) {
  console.log('All sounds cached - offline ready!');
} else {
  console.log(`${cacheStatus?.missingFiles.length} sounds not cached`);
}
```

### Downloading All Sounds
```tsx
const { downloadAll, downloadProgress, isDownloading } = useAudioManager();

const handleDownload = async () => {
  await downloadAll();
  console.log('All sounds downloaded!');
};

// Show progress
{isDownloading && <div>Downloading: {downloadProgress}%</div>}
```

## Files to Update

1. ✅ `src/App.tsx` - Already updated
2. ✅ `src/components/Settings.tsx` - Already updated
3. ⏳ `src/components/GamePageOptimized.tsx` - Replace AudioManager class
4. ⏳ `src/components/NewGame.tsx` - Replace Audio() calls
5. ⏳ Remove `src/components/SoundPreloader.tsx` - No longer needed

## Testing Checklist

After migration, test:

- [ ] App loads without downloading sounds
- [ ] First number played downloads and plays correctly
- [ ] Subsequent numbers use cached files (check Network tab)
- [ ] Start sound plays in NewGame
- [ ] Winner/not winner sounds play correctly
- [ ] Settings page shows cache status
- [ ] Manual download in Settings works
- [ ] Clear cache in Settings works
- [ ] Offline playback works (after caching)

## Troubleshooting

### Sound doesn't play
- Check `isReady` is true before calling `playSound()`
- Check browser console for errors
- Verify sound file exists in `/public/sounds/`

### Downloads not working
- Check IndexedDB is enabled in browser
- Check storage quota not exceeded
- Check network connectivity

### Cache not persisting
- Check browser not in private/incognito mode
- Check IndexedDB not being cleared by browser settings
- Check storage quota available
