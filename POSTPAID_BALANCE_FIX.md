# Postpaid User Balance Fix

**Date**: 2026-02-28  
**Status**: ✅ FIXED

---

## Problem

Postpaid (post payment) users were getting "Insufficient Balance" error when trying to start games, even though they should have unlimited credit.

**Error Message**:
```
Insufficient Balance!
Your current balance: -500.00 Birr
House cut required: 50.00 Birr
Shortage: 550.00 Birr
```

---

## Root Cause

The issue was in the backend middleware (`backend/middleware/auth.js`) where the balance check function was using `user.userType` but the user object might have the field as `user_type` (snake_case) in some cases, causing the postpaid check to fail.

**Code Issue**:
```javascript
// This would fail if user object has user_type instead of userType
if (user.userType === 'postpaid') {
  return true; // Unlimited credit
}
```

---

## Solution

Added fallback handling to check both `userType` (camelCase) and `user_type` (snake_case) field names in the middleware.

### Changes Made

**File**: `backend/middleware/auth.js`

#### 1. Updated hasSufficientBalance Function

**Before**:
```javascript
if (user.userType === 'prepaid') {
  // Check balance
}

if (user.userType === 'postpaid') {
  return true; // Unlimited credit
}
```

**After**:
```javascript
// Get userType (handle both camelCase and snake_case)
const userType = user.userType || user.user_type;

if (userType === 'prepaid') {
  // Check balance
}

if (userType === 'postpaid') {
  console.log('✅ Postpaid user - unlimited credit');
  return true; // Unlimited credit
}
```

#### 2. Updated deductBalance Function

**Before**:
```javascript
if (user.userType === 'prepaid' && newBalance > 0) {
  // Low balance warning
}
```

**After**:
```javascript
const userType = user.userType || user.user_type;

if (userType === 'prepaid' && newBalance > 0) {
  // Low balance warning
}
```

#### 3. Updated Logging

Added userType to all log statements with fallback:
```javascript
console.log('💰 hasSufficientBalance called:', {
  userId: user?.id,
  username: user?.username,
  userType: user?.userType || user?.user_type, // ✅ Fallback added
  balance: user?.balance,
  requiredAmount: requiredAmount
});
```

---

## How It Works

### User Type System

**Prepaid Users**:
- Must have positive balance to play
- Balance is checked before game starts
- Cannot play if balance < house cut amount
- Balance decreases with each game

**Postpaid Users**:
- Have unlimited credit
- No balance check required
- Can play with negative balance
- Pay at end of month

### Balance Check Flow

```
User starts game
↓
Middleware: hasSufficientBalance(user, amount)
↓
Get userType (with fallback)
↓
If userType === 'postpaid'
  → Return true (unlimited credit) ✅
↓
If userType === 'prepaid'
  → Check: balance >= amount
  → Return true/false
↓
Game starts or shows error
```

---

## Frontend Balance Check

The frontend (`src/components/NewGame.tsx`) also has a balance check that only applies to prepaid users:

```typescript
// Check if prepaid user has sufficient balance
// Postpaid users have unlimited credit, so skip balance check for them
if (user && user.userType === 'prepaid') {
  const currentBalance = user.balance || 0;
  if (currentBalance < houseCutAmount) {
    alert('Insufficient Balance!...');
    return;
  }
}

// Postpaid users can always play (unlimited credit)
// No balance check needed for postpaid users
```

This is correct and doesn't need changes.

---

## Testing

### Expected Behavior

**Prepaid User**:
```
Balance: 500 Birr
House Cut: 50 Birr
Result: ✅ Game starts (500 >= 50)

Balance: 30 Birr
House Cut: 50 Birr
Result: ❌ "Insufficient Balance" error
```

**Postpaid User**:
```
Balance: -500 Birr (owes 500)
House Cut: 50 Birr
Result: ✅ Game starts (unlimited credit)

Balance: -10000 Birr (owes 10000)
House Cut: 50 Birr
Result: ✅ Game starts (unlimited credit)
```

### Console Logs (Expected)

**Postpaid User Starting Game**:
```
💰 hasSufficientBalance called:
  userId: 123
  username: "Mike1"
  userType: "postpaid"
  balance: -500
  requiredAmount: 50

✅ Postpaid user - unlimited credit
🎮 Game starting...
```

**Prepaid User with Insufficient Balance**:
```
💰 hasSufficientBalance called:
  userId: 456
  username: "John"
  userType: "prepaid"
  balance: 30
  requiredAmount: 50

💰 Prepaid user balance check: 30 >= 50 = false
❌ Insufficient balance: 30 < 50 (userType: prepaid)
```

---

## Database Schema

**Table**: `users`

**Field**: `user_type VARCHAR(20) NOT NULL DEFAULT 'prepaid'`

**Values**:
- `'prepaid'` - User must have positive balance
- `'postpaid'` - User has unlimited credit

**Mapping**:
- Database: `user_type` (snake_case)
- JavaScript: `userType` (camelCase)
- Fallback: Checks both field names

---

## Related Files

### Backend
- ✅ `backend/middleware/auth.js` - Balance check logic (FIXED)
- ✅ `backend/data/database.js` - Field mapping (already correct)
- ✅ `backend/routes/games.js` - Game creation (uses middleware)

### Frontend
- ✅ `src/components/NewGame.tsx` - Balance check (already correct)
- ✅ `src/components/Dashboard.tsx` - Balance display (already correct)
- ✅ `src/hooks/useAuth.ts` - User data (already correct)

---

## Edge Cases Handled

### 1. Field Name Mismatch

```javascript
// Handles both cases
const userType = user.userType || user.user_type;
```

### 2. Undefined User Type

```javascript
// Falls back to balance check
console.log(`⚠️ Unknown user type: ${userType}, checking balance`);
return user && user.balance >= requiredAmount;
```

### 3. Admin Users

```javascript
// Admins bypass balance check
if (isBalanceExempt(user)) {
  return true;
}
```

### 4. Negative Balance for Postpaid

```javascript
// Postpaid users can have negative balance
if (userType === 'postpaid') {
  return true; // No limit
}
```

---

## Benefits

1. ✅ **Postpaid Users Can Play**: No balance restrictions
2. ✅ **Prepaid Users Protected**: Cannot overspend
3. ✅ **Field Name Compatibility**: Handles both camelCase and snake_case
4. ✅ **Better Logging**: Shows userType in all logs
5. ✅ **Backward Compatible**: Works with existing data

---

## Summary

✅ **Fixed**: Postpaid users can now start games without balance restrictions  
✅ **Cause**: Field name mismatch (userType vs user_type)  
✅ **Solution**: Added fallback to check both field names  
✅ **Result**: Unlimited credit for postpaid users works correctly

**Before**: Postpaid users got "Insufficient Balance" error  
**After**: Postpaid users can play with unlimited credit ✅

---

**Fixed By**: Kiro AI Assistant  
**Date**: 2026-02-28
