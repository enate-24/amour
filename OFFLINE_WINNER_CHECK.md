# Offline Winner Check Handling

## Overview

The winner check functionality now gracefully handles offline mode by preventing API calls and showing clear feedback to users when the network is unavailable.

## Implementation

### Visual Feedback

**Check Button States:**
- **Online**: Orange button, enabled, shows "Check"
- **Offline**: Gray button, disabled, shows "Check (Offline)"
- **Checking**: Gray button, disabled, shows "..."

### User Experience

When offline:
1. Check button is visually disabled (grayed out)
2. Button shows "Check (Offline)" text
3. Tooltip explains: "Winner check requires internet connection"
4. Clicking does nothing (button is disabled)

If user somehow triggers check while offline:
1. Modal appears with clear message
2. Message: "Cannot check cartela while offline. Please reconnect to verify winners."
3. No failed API call or console errors

### Error Handling

```typescript
// Pre-check before API call
if (!isOnline) {
  console.warn('📡 Cannot check cartela while offline');
  setCartelaCheckResult({
    success: false,
    cardType: 'offline',
    message: 'Cannot check cartela while offline. Please reconnect to verify winners.'
  });
  setShowCartelaCheckModal(true);
  return;
}

// Network error during API call
catch (error) {
  const isNetworkError = error instanceof TypeError && 
    error.message.includes('Failed to fetch');
  
  setCartelaCheckResult({
    cardType: isNetworkError ? 'offline' : 'error',
    message: isNetworkError 
      ? 'Cannot check cartela while offline. Please reconnect to verify winners.'
      : 'Failed to check cartela. Please try again.'
  });
}
```

## Why Winner Check Requires Online

Winner checking requires server validation because:

1. **Security**: Prevents client-side manipulation
2. **Consistency**: Ensures all players see same results
3. **Database**: Updates winner records in backend
4. **Prize Distribution**: Triggers payout calculations
5. **Audit Trail**: Logs winner verification for compliance

## User Workflow

### Online Mode
```
User enters cartela ID
    ↓
Clicks "Check" button
    ↓
API validates cartela
    ↓
Modal shows result (winner/not winner)
    ↓
Backend updates records
```

### Offline Mode
```
User enters cartela ID
    ↓
Sees "Check (Offline)" button (disabled)
    ↓
Hovers to see tooltip
    ↓
Waits for network to return
    ↓
Button becomes "Check" (enabled)
    ↓
Can now verify cartela
```

## Future Enhancements

Possible improvements for offline winner checking:

1. **Queue Checks**: Store cartela IDs to check when online
2. **Local Validation**: Basic pattern matching (non-authoritative)
3. **Batch Checking**: Check multiple queued cartelas at once
4. **Notification**: Alert user when queued checks complete
5. **Offline Indicator**: Show count of pending checks

## Testing

### Test Offline Behavior
1. Start a game and call some numbers
2. Open DevTools → Network → Set to "Offline"
3. Try to check a cartela
4. Verify button is disabled and shows "Check (Offline)"
5. Verify no console errors
6. Set back to "Online"
7. Verify button becomes enabled

### Test Network Error
1. Start a game online
2. Enter cartela ID
3. Disconnect network mid-check
4. Verify appropriate error message
5. Verify no crash or hanging state

## Benefits

✅ **No Console Errors**: Clean error handling prevents fetch failures  
✅ **Clear Feedback**: Users know why they can't check  
✅ **Graceful Degradation**: Feature disabled, not broken  
✅ **Better UX**: No confusing error messages  
✅ **Consistent State**: Button state matches network state  

## Conclusion

The offline winner check handling ensures users understand that winner verification requires an internet connection, while preventing confusing errors and maintaining a clean user experience.
