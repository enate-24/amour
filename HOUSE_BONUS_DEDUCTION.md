# House Bonus Deduction Implementation

## Overview
When users use their house bonus (200 Birr), it is now properly deducted from their daily profit display across all admin dashboards.

## Changes Made

### 1. Admin User Statistics (`backend/routes/admin.js`)
**Location:** `/api/admin/user-stats` endpoint

**What Changed:**
- Added query to check `daily_bonuses` table for bonus usage
- If a user has used their bonus today:
  - Daily profit shows the adjusted amount (original - 200)
  - House bonus shows 0 (since it's already used)
- If bonus not used:
  - Daily profit shows the raw amount from games
  - House bonus shows 200 if profit >= 1000, otherwise 0

**Code Logic:**
```javascript
// Check bonus usage for all users
const bonusRecords = await db.all(bonusCheckQuery, [todayStr]);
const bonusMap = new Map(bonusRecords.map(b => [b.user_id, b]));

// For each user:
const bonusUsed = bonusRecord?.bonus_used || false;
if (bonusUsed && bonusRecord) {
  dailyHouseProfit = Math.round(parseFloat(bonusRecord.daily_profit || 0));
}
const houseBonus = bonusUsed ? 0 : (dailyHouseProfit >= 1000 ? 200 : 0);
```

### 2. Dashboard Profit Summary (`backend/routes/dashboard.js`)
**Location:** `/api/dashboard` endpoint

**What Changed:**
- For regular users: Checks their bonus usage and shows adjusted daily profit
- For admin users: Sums all users' adjusted daily profits (accounting for bonus usage)

**Code Logic:**
```javascript
// For regular users
if (bonusRecord?.bonus_used) {
  adjustedDailyProfit = parseFloat(bonusRecord.daily_profit || 0);
}

// For admin - sum all users with bonus adjustments
SELECT COALESCE(SUM(CASE 
  WHEN db.bonus_used = 1 THEN db.daily_profit 
  ELSE (raw game profit calculation)
END), 0) as adjusted_daily_profit
```

### 3. Bonus Usage Endpoint (Already Implemented)
**Location:** `/api/bonuses/use` endpoint

**Existing Logic:**
- When user uses bonus:
  - Adds 200 to user balance
  - Subtracts 200 from daily_profit in daily_bonuses table
  - Marks bonus_used = true

## How It Works

### Scenario 1: User Earns 1500 Profit
1. User plays games, earns 1500 profit
2. Dashboard shows: Daily Profit = 1500, House Bonus = 200
3. User clicks "Use Bonus"
4. System:
   - Adds 200 to user balance
   - Updates daily_bonuses: daily_profit = 1300, bonus_used = true
5. Dashboard now shows: Daily Profit = 1300, House Bonus = 0

### Scenario 2: Admin View
1. User A: 1500 profit, used bonus → shows 1300
2. User B: 800 profit, no bonus → shows 800
3. User C: 2000 profit, not used → shows 2000
4. Admin dashboard total: 1300 + 800 + 2000 = 4100

## Database Tables Involved

### `daily_bonuses` table
- `user_id`: User identifier
- `date`: Date of the bonus record
- `daily_profit`: Current daily profit (adjusted if bonus used)
- `bonus_used`: Boolean flag indicating if bonus was used
- `bonus_amount`: Amount of bonus (always 200)

### `games` table
- Used to calculate raw profit: `bet_money - win_money`

## Testing

To verify the implementation:

1. **Test User Bonus Usage:**
   - Create games with profit >= 1000
   - Check `/api/bonuses/status` - should show bonus available
   - Use bonus via `/api/bonuses/use`
   - Check `/api/dashboard` - daily profit should be reduced by 200
   - Check `/api/admin/user-stats` - user's daily profit should show reduced amount

2. **Test Admin Dashboard:**
   - Have multiple users with different bonus states
   - Check `/api/dashboard` as admin
   - Verify total daily profit accounts for all bonus deductions

## Notes

- Bonus deduction only affects the **display** of daily profit
- The actual game records remain unchanged
- Weekly and 15-day profits are calculated from raw game data (not affected by daily bonus usage)
- Bonus resets daily at midnight
