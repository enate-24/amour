# Voice Settings Debug Guide

## Issue
User reports that voice selection is not being saved in the Settings page.

## Database Status ✅
- Database operations are working correctly
- Voice category column exists and is functional
- Update operations include voice_category field
- Test shows voice category is saved and retrieved properly

## Debugging Steps

### 1. Check Frontend Console
Open browser dev tools and check for:
- Network errors when saving settings
- JavaScript errors in console
- Failed API requests

### 2. Check Network Tab
When changing voice category in Settings:
- Look for POST request to `/api/settings`
- Check if `voiceCategory` is included in request body
- Verify response status is 200
- Check response body for success message

### 3. Check Local Storage
- Open Application/Storage > Local Storage
- Verify `auth_token` exists and is valid
- Check if `bingo-settings` contains voice category

### 4. Manual API Test
1. Get auth token from localStorage
2. Test API manually:
```bash
# Get current settings
curl -X GET "http://localhost:3001/api/settings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Update voice category
curl -X POST "http://localhost:3001/api/settings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"voiceCategory": "boy"}'
```

### 5. Check Backend Logs
Look for:
- Settings save requests
- Any error messages
- Database operation logs

## Common Issues & Solutions

### Issue: Settings not auto-saving
**Symptoms**: Voice selection changes but doesn't persist
**Solution**: Check if `isInitialLoad` is preventing auto-save

### Issue: API authentication errors
**Symptoms**: 401 errors in network tab
**Solution**: Check if auth token is valid and not expired

### Issue: Database connection errors
**Symptoms**: 500 errors from API
**Solution**: Verify database is running and accessible

### Issue: Frontend state not updating
**Symptoms**: UI shows old value after refresh
**Solution**: Check if `loadSettings()` is called on component mount

## Test Procedure

1. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Open Frontend Application**
   - Navigate to Settings page
   - Open browser dev tools (F12)
   - Go to Console tab

3. **Test Voice Selection**
   - Click on different voice options
   - Watch console for auto-save messages
   - Check Network tab for API calls

4. **Verify Persistence**
   - Refresh the page
   - Check if selected voice is maintained
   - Navigate away and back to Settings

5. **Check Database Directly**
   ```bash
   node backend/test-voice-settings.js
   ```

## Expected Behavior

1. **On Voice Selection Change**:
   - Console shows: "🔄 Voice category changed to: [boy/girl] - Auto-saving..."
   - Network request to POST /api/settings
   - Success message appears briefly
   - Audio manager updates immediately

2. **On Page Refresh**:
   - Settings load from backend
   - Voice selection shows correct value
   - Audio manager uses correct voice category

3. **During Gameplay**:
   - Numbers announced with selected voice
   - Voice persists throughout game session

## Files to Check

### Frontend
- `src/components/Settings.tsx` - Main settings component
- `src/utils/UnifiedAudioManager.ts` - Audio management
- `src/components/GamePageOptimized.tsx` - Game integration

### Backend
- `backend/routes/settings.js` - API endpoints
- `backend/data/database.js` - Database operations
- `backend/server.js` - Main server file

## Quick Fix Checklist

- [ ] Backend server is running
- [ ] Database migration completed
- [ ] Frontend shows voice options
- [ ] Console shows auto-save messages
- [ ] Network requests succeed
- [ ] Database contains voice_category
- [ ] Page refresh maintains selection
- [ ] Game uses correct voice

## Contact Developer

If issue persists after following this guide:
1. Provide browser console logs
2. Include network request/response details
3. Share any error messages
4. Specify browser and version used