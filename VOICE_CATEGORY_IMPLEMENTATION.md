# Voice Category Implementation

## Overview
Added voice category selection functionality that allows users to choose between boy and girl voices for number announcements during bingo gameplay. The selection is saved to the user's settings and persists across sessions.

## Features Implemented

### 1. Backend Changes

#### Database Schema
- Added `voice_category` column to `user_settings` table
- Default value: `'girl'`
- Allowed values: `'boy'` or `'girl'`

#### Migration
- Created `backend/migrations/add-voice-category-column.js`
- Adds the new column with default value
- Updates existing users with default voice category

#### API Updates
- Updated `backend/routes/settings.js` to handle voice category
- GET `/api/settings` now returns `voiceCategory` field
- POST `/api/settings` accepts and validates `voiceCategory` parameter
- Validation ensures only 'boy' or 'girl' values are accepted

#### Database Operations
- Updated `backend/data/database.js` userSettings operations
- `findByUserId()` returns voice category
- `create()` and `update()` handle voice category field

### 2. Frontend Changes

#### UnifiedAudioManager Updates
- Added `VoiceCategory` type: `'boy' | 'girl'`
- Added `setVoiceCategory()` and `getVoiceCategory()` methods
- Updated audio URL generation to use voice-specific directories:
  - Boy voices: `/sounds/boy sound/` (uses .wav files)
  - Girl voices: `/sounds/girl sound/` (uses .mp3 files)
- Updated caching to use voice-prefixed keys (e.g., `boy_1.wav`, `girl_1.mp3`)
- All audio methods now support optional voice category parameter

#### Settings Component
- Added voice category selection UI with radio buttons
- Visual indicators: 👦 for boy, 👧 for girl
- Sample playback buttons to test each voice
- Auto-save functionality when voice category changes
- Integrates with existing settings auto-save system

#### Game Integration
- GamePageOptimized loads voice category from settings on initialization
- Audio manager automatically uses the selected voice category
- Voice preference persists throughout gameplay session

### 3. Audio File Structure

The implementation expects the following directory structure:
```
public/sounds/
├── boy sound/
│   ├── 1.wav
│   ├── 2.wav
│   ├── ...
│   ├── 75.wav
│   ├── start.wav
│   ├── winner.wav
│   └── shuffle-audio-TfqyAnvz.mp3
└── girl sound/
    ├── 1.mp3
    ├── 2.mp3
    ├── ...
    ├── 75.mp3
    ├── winner.mp3
    └── shuffle-audio-TfqyAnvz.mp3
```

## Usage

### For Users
1. Go to Settings page
2. Find "Voice Category" section
3. Select either "Boy Voice" or "Girl Voice"
4. Use "Sample" buttons to preview each voice
5. Selection is automatically saved and applied immediately

### For Developers

#### Setting Voice Category Programmatically
```typescript
import { UnifiedAudioManager } from '../utils/UnifiedAudioManager';

const audioManager = UnifiedAudioManager.getInstance();
audioManager.setVoiceCategory('boy'); // or 'girl'
```

#### Playing Audio with Specific Voice
```typescript
// Use current voice category
await audioManager.playSound(25);

// Override voice category for specific call
await audioManager.playSound(25, 'boy');
```

#### Preloading Voice Categories
```typescript
// Preload all voices for both categories
await audioManager.preloadAllVoiceCategories((current, total) => {
  console.log(`Progress: ${current}/${total}`);
});

// Preload specific voice category
await audioManager.prewarmAudioPool([1, 2, 3, 4, 5], 'boy');
```

## Technical Details

### Caching Strategy
- Each voice category uses separate cache keys
- Format: `{category}_{filename}` (e.g., `boy_1.wav`, `girl_25.mp3`)
- Audio pool maintains separate entries for each voice
- Switching voices clears the audio pool to force reload

### File Extensions
- Boy voices use `.wav` format
- Girl voices use `.mp3` format
- Special sounds (start, winner, shuffle) maintain their original extensions

### Backward Compatibility
- Existing users get default 'girl' voice category
- Settings without voice category default to 'girl'
- Audio system gracefully handles missing voice files

## Testing

### Manual Testing
1. Run the backend server
2. Open the frontend application
3. Navigate to Settings
4. Test voice category switching
5. Start a game and verify correct voice is used

### Automated Testing
- Use `test-voice-category.js` to test API endpoints
- Update the TEST_TOKEN with a valid authentication token
- Verify database operations work correctly

## Migration Instructions

### To Deploy
1. Run the database migration:
   ```bash
   node backend/migrations/add-voice-category-column.js
   ```

2. Restart the backend server to load updated routes

3. Deploy frontend with updated components

### Rollback Plan
If needed to rollback:
1. Remove `voice_category` column from database
2. Revert UnifiedAudioManager changes
3. Remove voice category UI from Settings

## Performance Considerations

- Voice switching clears audio pool (intentional for immediate effect)
- Separate caching prevents conflicts between voice categories
- Sample playback uses temporary audio elements (not cached)
- File size differences between .wav and .mp3 formats

## Future Enhancements

Potential improvements:
1. Add more voice categories (different languages, accents)
2. Voice speed/pitch adjustment
3. Custom voice uploads
4. Voice category per game type
5. Accessibility features (visual indicators for audio)

## Files Modified

### Backend
- `backend/migrations/add-voice-category-column.js` (new)
- `backend/data/database.js` (updated)
- `backend/routes/settings.js` (updated)

### Frontend
- `src/utils/UnifiedAudioManager.ts` (updated)
- `src/components/Settings.tsx` (updated)
- `src/components/GamePageOptimized.tsx` (updated)
- `src/components/VoiceSelector.tsx` (new, standalone component)

### Documentation
- `VOICE_CATEGORY_IMPLEMENTATION.md` (new)
- `test-voice-category.js` (new, testing script)

## Conclusion

The voice category implementation provides a seamless way for users to personalize their bingo experience with their preferred voice type. The system is designed to be extensible, performant, and user-friendly while maintaining backward compatibility with existing functionality.