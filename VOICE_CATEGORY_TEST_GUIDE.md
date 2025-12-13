# Voice Category Test Guide

## Quick Test Steps

### 1. Open Browser Console
- Open the application in browser
- Press F12 to open Developer Tools
- Go to Console tab

### 2. Check Current Voice Category
```javascript
// Check current voice category
checkVoiceCategory()
```

Expected output:
```
🎤 Audio Manager Debug Info: {
  currentVoiceCategory: "boy" or "girl",
  audioPoolSize: number,
  isInitialized: true,
  config: {...}
}
```

### 3. Test Voice Category Change
```javascript
// Change to boy voice
setVoiceCategory('boy')

// Test audio with boy voice
testAudio(25)

// Change to girl voice  
setVoiceCategory('girl')

// Test audio with girl voice
testAudio(30)
```

### 4. Check Settings Page
1. Go to Settings page
2. Select different voice category
3. Watch console for auto-save messages
4. Click sample buttons to test voices

### 5. Test Game Integration
1. Start a new game
2. Use Next button to call numbers
3. Verify correct voice is used
4. Check console for voice category logs

## Expected Console Messages

### On Page Load:
```
🎵 Initializing audio manager...
🔑 Loading voice settings from API...
🎤 Voice category loaded from settings: boy
🎤 Raw voice category from API: boy
🎵 Creating UnifiedAudioManager with voice category: boy
✅ Audio manager initialized with voice category: boy
```

### On Voice Category Change:
```
🔄 Voice category changed to: boy - Auto-saving...
🎤 Updating audio manager to voice category: boy
🎤 Switching voice category from girl to boy
🧹 Audio pool cleared for voice category switch
```

### On Audio Play:
```
🔊 Playing (boy): 25.wav
or
🔊 Playing (girl): 25.mp3
```

## Troubleshooting

### Issue: Always defaults to 'girl'
**Check:**
1. Database has correct voice_category value
2. API returns correct voiceCategory in response
3. Audio manager is initialized after settings load
4. No errors in console during initialization

### Issue: Voice doesn't change in game
**Check:**
1. Game page loads voice settings on initialization
2. Audio manager voice category is updated
3. Audio pool is cleared when voice changes
4. New audio files use correct voice directory

### Issue: Sample buttons don't work
**Check:**
1. Audio files exist in correct directories
2. Network tab shows successful audio file requests
3. No CORS or 404 errors for audio files
4. Browser allows audio playback (not muted)

## Debug Commands

```javascript
// Check current state
checkVoiceCategory()

// Force voice change
setVoiceCategory('boy')
setVoiceCategory('girl')

// Test specific number
testAudio(1)  // Should use current voice category

// Test multiple numbers
testAudioMultiple([1, 2, 3, 4, 5])

// Check if audio files exist
fetch('/sounds/boy sound/1.wav').then(r => console.log('Boy 1.wav:', r.status))
fetch('/sounds/girl sound/1.mp3').then(r => console.log('Girl 1.mp3:', r.status))
```

## File Paths to Verify

### Boy Voice Files:
- `/sounds/boy sound/1.wav` through `/sounds/boy sound/75.wav`
- `/sounds/boy sound/start.wav`
- `/sounds/boy sound/winner.wav`

### Girl Voice Files:
- `/sounds/girl sound/1.mp3` through `/sounds/girl sound/75.mp3`
- `/sounds/girl sound/winner.mp3`

## Success Criteria

✅ **Database Test**: Voice category saved and retrieved correctly  
✅ **API Test**: Settings endpoint returns correct voiceCategory  
✅ **Frontend Test**: Settings page shows and saves selection  
✅ **Audio Test**: Correct voice files are played  
✅ **Game Test**: Numbers announced with selected voice  
✅ **Persistence Test**: Selection maintained across page refreshes  

## Common Issues

1. **Caching**: Clear browser cache if old audio files are cached
2. **File Extensions**: Boy uses .wav, Girl uses .mp3
3. **Timing**: Audio manager must be initialized after settings load
4. **Singleton**: UnifiedAudioManager is singleton, changes affect all instances