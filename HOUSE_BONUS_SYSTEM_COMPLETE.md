# House Bonus System - Complete Implementation

## Overview
The house bonus system now affects **ALL profit calculations** across **ALL dashboards** by creating a bonus deduction game record.

## How It Works

### Bonus Application Method

When a user's daily profit reaches ≥1000 Birr and bonus is applied, the system creates a special "bonus deduction" game record:

```javascript
INSERT INTO games (
  id, game_number, user_id, 
  bet_money, win_money, house_cut_percentage, 
  status, created_at, updated_at
) VALUES (
  uuid, timestamp, userId,
  0,        // bet = 0
  200,      // win = 200
  0,        // house cut = 0%
  'finished',
  now, now
)
```

**Result:** This creates a game with profit = `bet_money - win_money` = `0 - 200` = **-200 Birr**

### Impact on All Calculations

Since all profit calculations use `SUM(bet_money - win_money)` from the games table, the -200 Birr automatically affects:

✅ **Daily Profit** - Reduced by 200
✅ **Weekly Profit** - Reduced by 200
✅ **15-Day Profit** - Reduced by 200
✅ **Admin Dashboard** - All users' profits reduced
✅ **User Dashboard** - All time periods affected
✅ **Charts** - All visualizations updated

## Example Scenario

### User: pretest (Prepaid)

**Before Bonus:**
- Games played today: 5 games
- Total bet: 5000 Birr
- Total win: 3800 Birr
- **Daily profit: 1200 Birr**
- Weekly profit: 3500 Birr
- 15-day profit: 8000 Birr

**Bonus Applied:**
- System creates bonus deduction game:
  - bet_money: 0
  - win_money: 200
  - profit: -200
- User balance: +200 Birr (prepaid)

**After Bonus:**
- Games in database: 6 games (5 regular + 1 bonus deduction)
- **Daily profit: 1000 Birr** (1200 - 200)
- **Weekly profit: 3300 Birr** (3500 - 200)
- **15-day profit: 7800 Birr** (8000 - 200)
- Balance: +200 Birr

## Database Structure

### games table
```sql
-- Regular game
id: uuid-1
bet_money: 1000
win_money: 750
profit: 250  (calculated: 1000 - 750)

-- Bonus deduction game
id: uuid-2
bet_money: 0
win_money: 200
profit: -200  (calculated: 0 - 200)
```

### daily_bonuses table
```sql
id: uuid
user_id: user-id
bonus_date: 2025-12-09
daily_profit: 1200  (stored for reference)
bonus_used: true
bonus_claimed: true
```

## Profit Calculations

### Daily Profit
```sql
SELECT SUM(bet_money - COALESCE(win_money, 0)) as daily_profit
FROM games
WHERE user_id = $1 
  AND DATE(created_at) = CURRENT_DATE
  AND status = 'finished'
```
**Result:** Includes the -200 from bonus deduction game

### Weekly Profit
```sql
SELECT SUM(bet_money - COALESCE(win_money, 0)) as weekly_profit
FROM games
WHERE user_id = $1 
  AND created_at >= (CURRENT_DATE - INTERVAL '7 days')
  AND status = 'finished'
```
**Result:** Includes the -200 from bonus deduction game

### 15-Day Profit
```sql
SELECT SUM(bet_money - COALESCE(win_money, 0)) as fifteen_day_profit
FROM games
WHERE user_id = $1 
  AND created_at >= (CURRENT_DATE - INTERVAL '15 days')
  AND status = 'finished'
```
**Result:** Includes the -200 from bonus deduction game

## User Types

### Prepaid Users
1. Bonus applied → Creates -200 profit game
2. Balance increased by 200 Birr
3. All profits reduced by 200 Birr
4. Net effect: User gets 200 Birr, profits show 200 less

### Postpaid Users
1. Bonus applied → Creates -200 profit game
2. Balance unchanged (unlimited credit)
3. All profits reduced by 200 Birr
4. Net effect: Debt reduced by 200 Birr

## Admin Dashboard

### User Statistics
All users show adjusted profits:
- Daily profit: Includes bonus deduction
- Weekly profit: Includes bonus deduction
- House bonus: 0 if used, 200 if eligible

### Aggregated Stats
When admin views all users:
- Total daily profit: Sum of all users (includes all bonus deductions)
- Total weekly profit: Sum of all users (includes all bonus deductions)

## Code Implementation

### Bonus Application (backend/routes/games.js)
```javascript
// Create bonus deduction game
await db.run(`
  INSERT INTO games (
    id, game_number, user_id, bet_money, win_money, 
    house_cut_percentage, status, created_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`, [
  bonusGameId, bonusGameNumber, userId,
  0, 200, 0, 'finished', now, now
]);

// For prepaid: Add to balance
if (user.user_type === 'prepaid') {
  await db.run('UPDATE users SET balance = $1 WHERE id = $2', 
    [newBalance, userId]);
}

// Mark bonus as used
await db.run(`
  UPDATE daily_bonuses 
  SET bonus_used = 1, bonus_claimed = 1
  WHERE user_id = $1 AND bonus_date = $2
`, [userId, today]);
```

### Dashboard Calculations (backend/routes/dashboard.js)
```javascript
// No special handling needed - game record handles it
const dailyProfit = parseFloat(dailyResults[0]?.dailyprofit || 0);
const weeklyProfit = parseFloat(weeklyResults[0]?.weeklyprofit || 0);
const fifteenDayProfit = parseFloat(fifteenDayResult?.profit || 0);
```

## Advantages of This Approach

✅ **Automatic:** All profit calculations automatically include the deduction
✅ **Consistent:** Same logic everywhere - no special cases
✅ **Historical:** Bonus deduction is permanent in game history
✅ **Auditable:** Clear record of when bonus was applied
✅ **Simple:** No complex adjustment logic needed

## Testing

### Test Bonus Application
```bash
cd backend
node scripts/trigger-bonus-manually.js
```

### Verify All Profits Affected
```bash
# Check user profits
node scripts/test-house-bonus.js

# Expected results:
# - Daily profit: Original - 200
# - Weekly profit: Original - 200
# - 15-day profit: Original - 200
```

### SQL Verification
```sql
-- Check bonus deduction games
SELECT * FROM games 
WHERE bet_money = 0 AND win_money = 200
ORDER BY created_at DESC;

-- Verify profit calculation
SELECT 
  user_id,
  SUM(bet_money - COALESCE(win_money, 0)) as total_profit
FROM games
WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'finished'
GROUP BY user_id;
```

## Important Notes

1. **One Bonus Per Day:** User can only get bonus once per day
2. **Permanent Record:** Bonus deduction game is permanent
3. **All Dashboards:** Affects user dashboard, admin dashboard, charts
4. **All Time Periods:** Affects daily, weekly, 15-day, and all-time profits
5. **Balance Separate:** Prepaid balance increase is separate from profit deduction

## Visual Example

### Dashboard Before Bonus
```
┌─────────────────────────────┐
│ Daily Profit:    1200 Birr  │
│ Weekly Profit:   3500 Birr  │
│ 15-Day Profit:   8000 Birr  │
│ House Bonus:     200 Birr   │
│ Balance:         1000 Birr  │
└─────────────────────────────┘
```

### Dashboard After Bonus
```
┌─────────────────────────────┐
│ Daily Profit:    1000 Birr  │ ← -200
│ Weekly Profit:   3300 Birr  │ ← -200
│ 15-Day Profit:   7800 Birr  │ ← -200
│ House Bonus:     0 Birr     │ ← Used
│ Balance:         1200 Birr  │ ← +200
└─────────────────────────────┘
```

## Summary

✅ **System-Wide Impact:** Bonus affects all profit calculations
✅ **Automatic Deduction:** No manual adjustments needed
✅ **Permanent Record:** Bonus deduction stored as game
✅ **Consistent Display:** All dashboards show same adjusted profits
✅ **User Benefit:** Prepaid users get 200 Birr added to balance
✅ **Postpaid Benefit:** Postpaid users get 200 Birr debt reduction

The house bonus system now correctly affects all profit displays across the entire system!
