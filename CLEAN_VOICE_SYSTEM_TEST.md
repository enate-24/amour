# Clean Voice System Test Guide

## What Changed ✅

### 1. Removed All Default Fallbacks
- ❌ No more automatic "girl" voice selection
- ❌ No more fallback defaults in database
- ❌ No more hardcoded voice categories
- ✅ Users MUST explicitly choose their voice

### 2. Database Cleaned
- All existing voice categories set to NULL
- New users get no default voice category
- Voice category is optional in database

### 3. Frontend Updated
- Settings page shows warning when no voice selected
- Audio manager warns when no voice category set
- Game page only initializes audio if voice category exists

## Testing Steps

### Step 1: Check Database Status
```bash
node backend/debug-voice-category.js
```
**Expected**: All users should have `voice_category: null`

### Step 2: Test Settings Page
1. Open application → Settings
2. **Expected**: Yellow warning box saying "Please select a voice category"
3. **Expected**: No radio button selected initially
4. Select "Boy Voice" → Click "Sample" button
5. **Expected**: Plays boy voice sample
6. **Expected**: Auto-save message in console
7. Refresh page
8. **Expected**: "Boy Voice" remains selected
9. **Expected**: No warning box

### Step 3: Test Game Integration
1. Go to Settings → Select "Girl Voice"
2. Start a new game
3. Use "Next" button to call numbers
4. **Expected**: Numbers announced with girl voice
5. **Expected**: Console shows voice category loaded from settings

### Step 4: Test No Selection Scenario
1. Clear voice category from database:
   ```bash
   node backend/clear-voice-defaults.js
   ```
2. Refresh application
3. Go to Settings
4. **Expected**: Warning box appears
5. **Expected**: No voice selected
6. Start a game without selecting voice
7. Use "Next" button
8. **Expected**: Warning in console about no voice category

## Browser Console Commands

Open Developer Tools (F12) → Console:

```javascript
// Check current voice status
checkVoiceCategory()

// Expected when no voice set:
// {
//   currentVoiceCategory: "girl",
//   voiceCategoryExplicitlySet: false,
//   audioPoolSize: 0
// }

// Expected when voice is set:
// {
//   currentVoiceCategory: "boy",
//   voiceCategoryExplicitlySet: true,
//   audioPoolSize: 0
// }

// Test voice change
setVoiceCategory('boy')
checkVoiceCategory()

// Test audio with warning
testAudio(25)
// Expected: Warning if voice not explicitly set
```

## Expected Console Messages

### When No Voice Category Set:
```
⚠️ Voice category not set - must call setVoiceCategory() before playing audio
⚠️ No voice category found in user settings
⚠️ No voice category available - user must select one in Settings
⚠️ Playing audio with default voice category - user should select a voice in Settings
```

### When Voice Category Selected:
```
🎤 Voice category loaded from settings: boy
✅ Audio manager initialized with user voice category: boy
🎤 Switching voice category from girl to boy
🧹 Audio pool cleared for voice category switch
🔊 Playing (boy): 25.wav
```

## Success Criteria

✅ **No Defaults**: System never automatically selects a voice  
✅ **User Choice**: Users must explicitly select boy or girl  
✅ **Persistence**: Selection saves and loads correctly  
✅ **Warnings**: Clear warnings when no voice selected  
✅ **Audio Quality**: Correct voice files play based on selection  
✅ **Game Integration**: Selected voice used during gameplay  

## Verification Checklist

- [ ] Database shows `voice_category: null` for all users initially
- [ ] Settings page shows warning when no voice selected
- [ ] Selecting voice removes warning and saves choice
- [ ] Page refresh maintains selected voice
- [ ] Game uses selected voice for number announcements
- [ ] Console shows appropriate warnings/confirmations
- [ ] Sample buttons work for both voices
- [ ] No automatic fallback to "girl" voice occurs

## File Changes Summary

### Backend Files:
- `backend/data/database.js` - Dynamic voice category creation
- `backend/routes/settings.js` - No default voice in API
- `backend/clear-voice-defaults.js` - Script to clear existing defaults

### Frontend Files:
- `src/utils/UnifiedAudioManager.ts` - No default voice, explicit setting required
- `src/components/Settings.tsx` - Warning UI, null state handling
- `src/components/GamePageOptimized.tsx` - Only set voice if user selected

## Troubleshooting

### Issue: Still defaults to girl voice
**Solution**: Clear browser cache and localStorage

### Issue: Warning doesn't appear
**Solution**: Check if voice_category is null in database

### Issue: Audio doesn't play
**Solution**: Verify audio files exist in correct directories

### Issue: Selection doesn't save
**Solution**: Check network tab for API errors

## Reset Instructions

To reset all users to no voice selection:
```bash
node backend/clear-voice-defaults.js
```

This forces all users to make an explicit choice.