# Girl Voice Not Winner Sound Fix

## Issue Description
The girl voice was incorrectly playing the winner sound for non-winner cartelas instead of the proper "not winner" sound.

## Root Cause
In `src/utils/UnifiedAudioManager.ts`, the code had incorrect logic that assumed girl voice didn't have a `notwinner.wav` file and was falling back to `winner.mp3`:

```typescript
// BEFORE (Incorrect)
} else if (fileId === 'notwinner') {
  if (category === 'boy') {
    actualFileId = 'notwinner.wav';
  } else {
    // Girl voice doesn't have notwinner sound, use winner sound instead
    console.warn('⚠️ Girl voice does not have notwinner sound, using winner sound');
    actualFileId = 'winner.mp3';
  }
}
```

## The Fix
Updated the logic to correctly use `notwinner.wav` for both boy and girl voices:

```typescript
// AFTER (Correct)
} else if (fileId === 'notwinner') {
  // Notwinner sound files - both boy and girl have this
  actualFileId = category === 'boy' ? 'notwinner.wav' : 'notwinner.wav';
}
```

## Additional Fixes

### 1. Added Missing File to Preload List
The `notwinner.wav` file was missing from the `specialSounds` array:

```typescript
// BEFORE
const specialSounds = ['start.wav', 'winner.wav', 'shuffle-audio-TfqyAnvz.mp3'];

// AFTER
const specialSounds = ['start.wav', 'winner.wav', 'notwinner.wav', 'shuffle-audio-TfqyAnvz.mp3'];
```

### 2. Updated Cache Expected Files
Updated the audio cache to properly track both boy and girl voice files:

```typescript
// BEFORE (Only tracking one voice category)
const expectedFiles = [
  ...Array.from({ length: 75 }, (_, i) => `${i + 1}.mp3`),
  'start.wav',
  'winner.mp3',
  'notwinner.wav'
];

// AFTER (Tracking both voice categories)
const expectedFiles = [
  // Boy voice files (75 numbers + 4 special sounds)
  ...Array.from({ length: 75 }, (_, i) => `boy_${i + 1}.wav`),
  'boy_start.wav',
  'boy_winner.wav',
  'boy_notwinner.wav',
  'boy_shuffle-audio-TfqyAnvz.mp3',
  
  // Girl voice files (75 numbers + 4 special sounds)
  ...Array.from({ length: 75 }, (_, i) => `girl_${i + 1}.mp3`),
  'girl_start.mp3',
  'girl_winner.mp3',
  'girl_notwinner.wav',
  'girl_shuffle-audio-TfqyAnvz.mp3'
];
```

## File Verification
Confirmed that the `notwinner.wav` file exists in both voice folders:
- ✅ `public/sounds/boy sound/notwinner.wav`
- ✅ `public/sounds/girl sound/notwinner.wav`

## Testing
Created `test-girl-notwinner-sound.html` to verify the fix works correctly:
- Tests direct audio file playback
- Tests voice category switching
- Tests winner/not winner sound logic
- Provides visual feedback for verification

## Expected Behavior After Fix
- ✅ **Girl Voice Winner**: Plays `girl sound/winner.mp3`
- ✅ **Girl Voice Not Winner**: Plays `girl sound/notwinner.wav` (NOT winner.mp3)
- ✅ **Boy Voice Winner**: Plays `boy sound/winner.wav`
- ✅ **Boy Voice Not Winner**: Plays `boy sound/notwinner.wav`

## Game Logic Flow
1. User checks a cartela
2. Server determines if cartela is winner or not
3. `GamePageOptimized.tsx` receives result
4. Code determines sound: `const soundName = result.win ? 'winner' : 'notwinner';`
5. `UnifiedAudioManager.playSound(soundName)` is called
6. **Now correctly plays the right sound for both voice categories**

## Impact
- ✅ Fixed incorrect audio feedback for non-winner cartelas in girl voice
- ✅ Improved user experience with proper audio cues
- ✅ Consistent behavior between boy and girl voice categories
- ✅ Proper cache management for all audio files

## Files Modified
- `src/utils/UnifiedAudioManager.ts` - Fixed notwinner sound logic
- `src/utils/audioCache.ts` - Updated expected files for both voice categories
- `test-girl-notwinner-sound.html` - Added test file for verification

The fix ensures that users get the correct audio feedback when checking cartelas, regardless of which voice category they have selected.