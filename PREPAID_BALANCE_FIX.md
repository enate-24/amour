# Prepaid Balance Update Fix

## Issue
When trying to update balance for prepaid users, the system was returning:
```
"Balance can only be updated for prepaid users"
```

Even though the user was actually a prepaid user.

## Root Cause
The balance update endpoint was checking `user.user_type` (snake_case) but the database transformation layer returns `user.userType` (camelCase).

```javascript
// ❌ BEFORE - Only checked snake_case
if (user.user_type !== 'prepaid') {
  return res.status(400).json({ error: 'Balance can only be updated for prepaid users' });
}
```

## Solution
Updated the endpoint to check both camelCase and snake_case for compatibility:

```javascript
// ✅ AFTER - Checks both formats
const userType = user.userType || user.user_type;
if (userType !== 'prepaid') {
  return res.status(400).json({ 
    error: 'Balance can only be updated for prepaid users',
    currentUserType: userType
  });
}
```

## Changes Made

### File: `backend/routes/admin.js`

**Line ~664-667:**
```javascript
// Added debug logging
console.log('🔍 User data for balance update:', {
  userId: user.id,
  username: user.username,
  userType: user.userType,
  user_type: user.user_type,
  balance: user.balance
});

// Check both camelCase and snake_case
const userType = user.userType || user.user_type;
if (userType !== 'prepaid') {
  return res.status(400).json({ 
    error: 'Balance can only be updated for prepaid users',
    currentUserType: userType
  });
}
```

## How Database Transformation Works

The database layer (`backend/data/database.js`) transforms database columns to camelCase:

```javascript
// Database column: user_type
// Transformed to: userType

return {
  id: user.id,
  username: user.username,
  userType: user.user_type,  // ← Transformation happens here
  balance: parseFloat(user.balance || 0),
  // ...
};
```

## Testing

To verify the fix works:

1. **Login as admin**
2. **Go to Package Management**
3. **Select a prepaid user**
4. **Try to add balance** (e.g., 500 Birr)
5. **Should succeed** with message: "Successfully added 500 Birr to [username]'s balance"

### Expected Console Output
```
🔍 User data for balance update: {
  userId: 'uuid-here',
  username: 'testuser',
  userType: 'prepaid',
  user_type: undefined,
  balance: 1000
}
```

## Why This Happened

The codebase uses both naming conventions:
- **Database columns**: snake_case (`user_type`, `balance_limit`)
- **JavaScript objects**: camelCase (`userType`, `balanceLimit`)

The transformation layer converts between them, but some endpoints were checking the wrong format.

## Related Code

Other parts of the codebase that correctly use `userType`:
- `backend/middleware/auth.js` - Uses `user.userType`
- `backend/routes/games.js` - Uses `user.user_type` (direct DB query)
- Frontend components - Use `userType`

## Prevention

To prevent similar issues:
1. Always use the transformed property names (`userType`, not `user_type`)
2. When in doubt, check both formats for compatibility
3. Add debug logging to see actual property names
4. Use TypeScript for better type safety (future improvement)

## Status

✅ **FIXED** - Balance updates now work correctly for prepaid users
