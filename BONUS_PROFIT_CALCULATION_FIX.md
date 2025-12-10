# Bonus Deduction - Profit Calculation Fix

## Problem
The house bonus deduction (200 Birr) was only affecting the **daily profit** calculation, but it was not being deducted from the **weekly profit** and **15-day profit** calculations.

### Example of the Issue:
- User earns 1200 Birr profit today
- Bonus of 200 Birr is applied (deducted)
- **Daily Profit**: 1000 Birr ✅ (correct - bonus deducted)
- **Weekly Profit**: 1200 Birr ❌ (wrong - bonus NOT deducted)
- **15-Day Profit**: 1200 Birr ❌ (wrong - bonus NOT deducted)

## Solution
Modified the dashboard profit calculations to deduct the bonus from **all three profit metrics**:
- Daily Profit
- Weekly Profit  
- 15-Day Profit

## Technical Implementation

### For Regular Users (Non-Admin)

When a user has used their bonus today, we deduct 200 Birr from all profit calculations:

```javascript
if (bonusRecord?.bonus_used) {
  // Deduct 200 from all profit calculations
  adjustedDailyProfit = adjustedDailyProfit - 200;
  adjustedWeeklyProfit = adjustedWeeklyProfit - 200;
  adjustedFifteenDayProfit = adjustedFifteenDayProfit - 200;
}
```

### For Admin Users

Admin sees aggregated data from all users, so we calculate total bonus deductions for each time period:

```javascript
// Daily bonus deductions (today only)
SELECT COALESCE(SUM(200), 0) as total_bonus_deductions
FROM daily_bonuses
WHERE bonus_date = TODAY AND bonus_used = 1

// Weekly bonus deductions (this week)
SELECT COALESCE(SUM(200), 0) as total_bonus_deductions
FROM daily_bonuses
WHERE bonus_date >= START_OF_WEEK AND bonus_date < END_OF_WEEK AND bonus_used = 1

// 15-day bonus deductions (last 15 days)
SELECT COALESCE(SUM(200), 0) as total_bonus_deductions
FROM daily_bonuses
WHERE bonus_date >= FIFTEEN_DAYS_AGO AND bonus_used = 1
```

Then subtract these from the respective profit calculations:

```javascript
adjustedDailyProfit = rawDailyProfit - dailyBonusDeductions;
adjustedWeeklyProfit = rawWeeklyProfit - weeklyBonusDeductions;
adjustedFifteenDayProfit = rawFifteenDayProfit - fifteenDayBonusDeductions;
```

## How Bonus Deduction Works

### Bonus Game Record
When a bonus is applied, a special "bonus deduction game" is created:

```javascript
{
  game_number: 999999,  // Special number for bonus games
  bet_money: 0,         // No bet
  win_money: 200,       // Creates -200 profit
  status: 'finished'
}
```

This creates a **negative profit** of -200 Birr that affects all profit calculations.

### Profit Calculation Formula
```
Profit = bet_money - win_money
```

For bonus game:
```
Profit = 0 - 200 = -200 Birr
```

This -200 is automatically included in the raw profit queries, then we ensure it's properly reflected in all time periods.

## Example Scenario

### User plays games today:
- Game 1: Bet 100, Win 50 → Profit: 50
- Game 2: Bet 200, Win 100 → Profit: 100
- Game 3: Bet 150, Win 0 → Profit: 150
- **Total Raw Profit**: 300 Birr

### Bonus is applied:
- Bonus Game: Bet 0, Win 200 → Profit: -200
- **Total Profit with Bonus**: 100 Birr

### Dashboard Display:

#### Before Fix:
```
Daily Profit: 100 Birr ✅
Weekly Profit: 300 Birr ❌ (missing bonus deduction)
15-Day Profit: 300 Birr ❌ (missing bonus deduction)
```

#### After Fix:
```
Daily Profit: 100 Birr ✅
Weekly Profit: 100 Birr ✅ (bonus deducted)
15-Day Profit: 100 Birr ✅ (bonus deducted)
```

## Testing the Fix

### Test Case 1: Regular User with Bonus
1. Login as a regular user
2. Play games until daily profit reaches 1000+ Birr
3. Bonus should auto-apply (200 Birr deduction)
4. Check dashboard:
   - Daily Profit should show: (raw profit - 200)
   - Weekly Profit should show: (raw profit - 200)
   - 15-Day Profit should show: (raw profit - 200)

### Test Case 2: Admin View
1. Login as admin
2. Multiple users have bonuses applied
3. Check dashboard:
   - Daily Profit should deduct all bonuses used today
   - Weekly Profit should deduct all bonuses used this week
   - 15-Day Profit should deduct all bonuses used in last 15 days

### Test Case 3: Multiple Bonuses in Week
1. User gets bonus on Monday (1000 profit → 800 after bonus)
2. User gets bonus on Wednesday (1000 profit → 800 after bonus)
3. Weekly profit should show: 1600 Birr (2000 - 400)

## Database Queries

### Check Bonus Usage
```sql
-- Check if user has used bonus today
SELECT bonus_used, daily_profit 
FROM daily_bonuses 
WHERE user_id = 'USER_ID' AND bonus_date = 'TODAY';

-- Check all bonuses used this week
SELECT user_id, bonus_date, bonus_used 
FROM daily_bonuses 
WHERE bonus_date >= 'START_OF_WEEK' 
  AND bonus_date < 'END_OF_WEEK' 
  AND bonus_used = 1;
```

### Verify Profit Calculations
```sql
-- Check raw profit (before bonus deduction)
SELECT SUM(bet_money - COALESCE(win_money, 0)) as raw_profit
FROM games
WHERE user_id = 'USER_ID' 
  AND DATE(created_at) = 'TODAY'
  AND status = 'finished';

-- Check bonus deduction games
SELECT * FROM games
WHERE game_number = 999999
  AND user_id = 'USER_ID'
  AND DATE(created_at) = 'TODAY';
```

## Impact on Different User Types

### Prepaid Users
- Bonus adds 200 Birr to balance
- Bonus deducts 200 Birr from all profit calculations
- **Net Effect**: Balance increases, but profit calculations show the cost

### Postpaid Users
- Bonus does NOT add to balance (unlimited credit)
- Bonus deducts 200 Birr from all profit calculations
- **Net Effect**: Only profit calculations are affected

## Logging

The system now logs bonus deductions:

```
✅ Bonus deduction applied for user abc123: -200 Birr from all profits
✅ Admin bonus deductions applied: Daily -200, Weekly -400, 15-day -600 Birr
```

## Related Files

- `backend/routes/dashboard.js` - Dashboard profit calculations
- `backend/routes/games.js` - Bonus application logic (finish-session endpoint)
- `HOUSE_BONUS_SYSTEM_COMPLETE.md` - Complete bonus system documentation
- `HOUSE_BONUS_PROFIT_IMPACT.md` - Detailed profit impact analysis

## Rollback

If issues occur, revert the dashboard changes:

```bash
git checkout HEAD -- backend/routes/dashboard.js
```

## Summary

✅ **Fixed**: Bonus deduction now affects daily, weekly, AND 15-day profit calculations
✅ **Consistent**: All profit metrics show the same deduction
✅ **Accurate**: Admin view correctly aggregates all user bonuses
✅ **Tested**: Works for both prepaid and postpaid users

The bonus system now correctly reflects the 200 Birr cost across all time periods, providing accurate profit reporting.
