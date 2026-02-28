# Bonus System - Complete Documentation

## Overview
The bonus system rewards users with 200 Birr when their daily house profit reaches 1000 Birr or more. The bonus is **automatically applied** and deducted from the daily profit.

---

## How It Works

### 1. Daily Profit Calculation

**Formula**: `Daily Profit = Total Bet Amount - Total Win Amount`

For each finished game today:
- **Bet Amount**: What the player paid (number of cartelas × bet per cartela)
- **Win Amount**: What the player won (if they won)
- **House Profit**: Bet Amount - Win Amount

**Example**:
```
Game 1: Bet 500 Birr, Won 0 Birr → Profit = 500
Game 2: Bet 300 Birr, Won 100 Birr → Profit = 200
Game 3: Bet 600 Birr, Won 0 Birr → Profit = 600
---
Total Daily Profit = 500 + 200 + 600 = 1300 Birr
```

### 2. Bonus Requirements

**Requirement**: Daily profit must be **>= 1000 Birr**

**Bonus Amount**: **200 Birr** (fixed)

### 3. Automatic Bonus Application

When daily profit reaches >= 1000 Birr, the system **automatically**:

1. ✅ **Deducts 200 Birr** from the displayed daily profit
2. ✅ **Adds 200 Birr** to the user's balance
3. ✅ **Marks bonus as used** for today
4. ✅ **Shows notification** "Today's Bonus Claimed!"

**Example**:
```
Before Bonus:
- Daily Profit: 1440 Birr
- User Balance: 500 Birr

After Automatic Bonus:
- Daily Profit: 1240 Birr (1440 - 200)
- User Balance: 700 Birr (500 + 200)
- Bonus Status: Used ✅
```

### 4. When Bonus is Applied

The bonus is checked and applied when:
- User loads the NewGame page
- User views the Dashboard
- User checks the HouseBonus component
- Any API call to `/api/bonuses/daily`

**Timing**: The bonus is applied **once per day** when profit first reaches >= 1000 Birr.

---

## Technical Implementation

### Backend Endpoint: `/api/bonuses/daily`

**Method**: GET

**Authentication**: Required (Bearer token)

**Process**:
1. Calculate today's profit from all finished games
2. Check if bonus record exists for today
3. If profit >= 1000 and bonus not yet used:
   - Deduct 200 from daily_profit
   - Add 200 to user balance
   - Mark bonus as used
4. Return bonus status

**Response**:
```json
{
  "success": true,
  "dailyBonus": {
    "user_id": 123,
    "bonus_date": "2026-02-28",
    "daily_profit": 1240,
    "bonus_amount": 200,
    "bonus_used": true,
    "bonus_claimed": true,
    "requirements_met": true,
    "bonusAvailable": 200,
    "requirementsMet": true,
    "profitNeeded": 0,
    "bonusUsed": true,
    "requirements": {
      "MIN_DAILY_PROFIT": 1000,
      "HOUSE_BONUS_AMOUNT": 200
    }
  }
}
```

### Database Table: `daily_bonuses`

**Schema**:
```sql
CREATE TABLE daily_bonuses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  bonus_date DATE NOT NULL,
  daily_profit DECIMAL(10,2) NOT NULL,
  bonus_amount DECIMAL(10,2) NOT NULL,
  requirements_met BOOLEAN DEFAULT FALSE,
  bonus_claimed BOOLEAN DEFAULT FALSE,
  bonus_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, bonus_date)
);
```

**Key Fields**:
- `daily_profit`: Adjusted profit (after bonus deduction if applied)
- `bonus_used`: Whether bonus was applied today
- `bonus_claimed`: Same as bonus_used (for compatibility)
- `requirements_met`: Whether profit >= 1000

---

## User Flow

### Scenario 1: User Reaches 1000 Birr Profit

**Step 1**: User plays games throughout the day
```
Game 1: +400 Birr profit
Game 2: +300 Birr profit
Game 3: +350 Birr profit
Total: 1050 Birr
```

**Step 2**: User opens NewGame page or Dashboard

**Step 3**: System automatically:
- Detects profit >= 1000
- Deducts 200 from profit → Shows 850 Birr
- Adds 200 to balance
- Shows "Today's Bonus Claimed!" notification

**Step 4**: User continues playing
```
Game 4: +200 Birr profit
New Total: 1050 Birr (850 + 200)
```
Bonus already used, no additional deduction.

### Scenario 2: User Below 1000 Birr

**Current Profit**: 750 Birr

**Status**:
- Bonus Available: 0 Birr
- Requirements Met: ❌
- Profit Needed: 250 Birr

**Display**: "Earn 250 more Birr profit to unlock bonus"

### Scenario 3: Next Day Reset

**New Day**: 2026-03-01

**Status**:
- Previous day's bonus: Used ✅
- Today's bonus: Available (new record created)
- Daily profit: Starts at 0
- User can earn another 200 Birr bonus today

---

## UI Components

### 1. NewGame Page

**Location**: Top of page, below header

**Display**:
- If bonus used: "🎁 Today's Bonus Claimed!" (green badge)
- If bonus not used: No display

### 2. HouseBonus Component

**Location**: Dashboard page

**Display States**:

**A. Bonus Available (Profit >= 1000, Not Used)**:
```
┌─────────────────────────────┐
│ 🎁 House Bonus              │
│ Ready to Claim!             │
│                             │
│ 200 Birr                    │
│ ████████████████ 100%       │
│                             │
│ [Use Bonus Now] (button)    │
└─────────────────────────────┘
```

**B. Bonus Used**:
```
┌─────────────────────────────┐
│ 🎁 House Bonus              │
│ Used Today                  │
│                             │
│ ✅ House bonus used today!  │
│ Come back tomorrow          │
└─────────────────────────────┘
```

**C. Requirements Not Met**:
```
┌─────────────────────────────┐
│ 🎁 House Bonus              │
│ Earn More to Unlock         │
│                             │
│ ████░░░░░░░░░░░░ 75%        │
│ Earn 250 more Birr profit   │
│                             │
│ Requirement:                │
│ • Daily Profit: 1000 Birr   │
└─────────────────────────────┘
```

### 3. Dashboard Stats

**Daily Profit Display**:
- Shows adjusted profit (after bonus deduction)
- Example: "Daily Profit: 1240 Birr" (not 1440)

---

## Configuration

**File**: `backend/routes/bonuses.js`

```javascript
const DAILY_REQUIREMENTS = {
  MIN_DAILY_PROFIT: 1000,  // Minimum profit to unlock bonus
  HOUSE_BONUS_AMOUNT: 200  // Fixed bonus amount
};
```

**To Change Bonus Settings**:
1. Edit `MIN_DAILY_PROFIT` to change requirement
2. Edit `HOUSE_BONUS_AMOUNT` to change bonus amount
3. Restart backend server

---

## API Endpoints

### GET `/api/bonuses/daily`
Get today's bonus status and auto-apply if eligible

**Headers**:
```
Authorization: Bearer <token>
```

**Response**: See "Backend Endpoint" section above

### POST `/api/bonuses/use` (Deprecated)
Manually claim bonus (not needed with auto-apply)

**Note**: With automatic bonus application, this endpoint is no longer necessary but kept for compatibility.

---

## Database Queries

### Check User's Bonus Status
```sql
SELECT * FROM daily_bonuses 
WHERE user_id = 123 
AND bonus_date = '2026-02-28';
```

### Calculate Today's Profit
```sql
SELECT 
  SUM(bet_money - COALESCE(win_money, 0)) as daily_profit
FROM games
WHERE user_id = 123
AND DATE(created_at) = '2026-02-28'
AND status = 'finished';
```

### Reset Bonus for Testing
```sql
UPDATE daily_bonuses 
SET bonus_used = false, 
    bonus_claimed = false,
    daily_profit = 1440
WHERE user_id = 123 
AND bonus_date = '2026-02-28';
```

---

## Troubleshooting

### Issue: Bonus Not Applied

**Check**:
1. Is daily profit >= 1000?
2. Is bonus_used = false in database?
3. Are games marked as 'finished'?
4. Check backend console logs for errors

**Solution**:
```sql
-- Check bonus record
SELECT * FROM daily_bonuses WHERE user_id = 123 AND bonus_date = CURRENT_DATE;

-- Check today's games
SELECT * FROM games WHERE user_id = 123 AND DATE(created_at) = CURRENT_DATE;

-- Manually trigger bonus (if needed)
UPDATE daily_bonuses 
SET bonus_used = false 
WHERE user_id = 123 AND bonus_date = CURRENT_DATE;
```

### Issue: Profit Shows Wrong Amount

**Cause**: Bonus deduction not applied

**Check Backend Logs**:
```
🔍 Bonus check for user: 123
💰 Profit meets requirement! Applying bonus:
✅ Auto-applied bonus for user 123: +200 Birr
```

**If logs missing**: Backend not applying bonus automatically

**Solution**: Restart backend server and reload page

### Issue: 500 Error on `/bonuses/daily`

**Cause**: Database connection or user not found

**Check**:
1. Backend console for error details
2. User exists in database
3. Database connection is active

---

## Testing Checklist

- [ ] User with 0 profit → No bonus
- [ ] User with 500 profit → No bonus, shows "Earn 500 more"
- [ ] User with 1000 profit → Bonus applied, shows 800 profit
- [ ] User with 1440 profit → Bonus applied, shows 1240 profit
- [ ] User plays more after bonus → Profit increases correctly
- [ ] Next day → New bonus available
- [ ] Bonus notification shows on NewGame page
- [ ] HouseBonus component shows correct status
- [ ] User balance increases by 200 when bonus applied

---

## Summary

✅ **Automatic**: No manual claiming needed
✅ **Daily**: Resets every day at midnight
✅ **Fixed Amount**: Always 200 Birr
✅ **Requirement**: 1000 Birr daily profit
✅ **Deduction**: Shows adjusted profit (profit - 200)
✅ **Balance**: Adds 200 to user balance
✅ **One-Time**: Only once per day

**Example Flow**:
```
Day 1:
- Play games → Earn 1440 profit
- System auto-applies bonus
- Shows 1240 profit, balance +200
- Bonus used ✅

Day 2:
- New day, new bonus available
- Play games → Earn profit
- Process repeats
```
