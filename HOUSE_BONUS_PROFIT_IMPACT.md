# House Bonus Impact on Profit Calculations

## Overview
The house bonus (200 Birr) **DOES affect** all profit displays when applied. This document explains how the bonus impacts daily, weekly, and 15-day profit calculations.

## How It Works

### When Bonus is Applied

When a user's daily profit reaches ≥1000 Birr and the bonus is applied:

1. **For Prepaid Users:**
   - 200 Birr is added to their balance
   - 200 Birr is deducted from their daily profit display
   - Daily profit shown: Original - 200

2. **For Postpaid Users:**
   - 200 Birr is deducted from their daily profit display
   - This represents debt reduction
   - Daily profit shown: Original - 200

### Profit Calculations

#### Daily Profit
- **Before Bonus:** Calculated from games: `SUM(bet_money - win_money)`
- **After Bonus:** Uses adjusted value from `daily_bonuses.daily_profit`
- **Impact:** Reduced by 200 Birr

#### Weekly Profit
- Calculated from games for the last 7 days
- **NOT directly affected** by today's bonus
- Only affected if bonus was used on previous days within the week

#### 15-Day Profit
- Calculated from games for the last 15 days
- **NOT directly affected** by today's bonus
- Only affected if bonus was used on previous days within the 15-day period

## Example Scenario

### User: pretest (Prepaid)

**Day 1:**
- Plays games, earns 1200 Birr profit
- Bonus applied automatically
- Balance: +200 Birr
- Daily profit display: 1000 Birr (1200 - 200)
- Weekly profit: 1200 Birr (raw from games)
- 15-day profit: 1200 Birr (raw from games)

**Day 2:**
- Plays games, earns 800 Birr profit
- No bonus (< 1000)
- Daily profit display: 800 Birr
- Weekly profit: 2000 Birr (1200 + 800 from games)
- 15-day profit: 2000 Birr (1200 + 800 from games)

**Dashboard Display on Day 2:**
- Today's profit: 800 Birr
- Weekly profit: 2000 Birr (includes Day 1's raw 1200)
- 15-day profit: 2000 Birr (includes Day 1's raw 1200)

## Database Storage

### games table
- Stores raw profit: `bet_money - win_money`
- Never modified by bonus application
- Used for weekly and 15-day calculations

### daily_bonuses table
- Stores adjusted daily profit after bonus deduction
- `daily_profit` = original profit - 200 (if bonus used)
- `bonus_used` = true/false flag
- Used for daily profit display

## Code Implementation

### Bonus Application (backend/routes/games.js)

```javascript
// When bonus is applied
const newDailyProfit = dailyProfit - 200;
await db.run(`
  UPDATE daily_bonuses 
  SET daily_profit = $1, bonus_used = 1, bonus_claimed = 1
  WHERE user_id = $2 AND bonus_date = $3
`, [newDailyProfit, userId, today]);
```

### Daily Profit Display (backend/routes/dashboard.js)

```javascript
// Check if bonus was used
const bonusRecord = await db.get(
  'SELECT bonus_used, daily_profit FROM daily_bonuses WHERE user_id = $1 AND bonus_date = $2',
  [userId, today]
);

if (bonusRecord?.bonus_used) {
  // Use adjusted profit (with 200 deducted)
  adjustedDailyProfit = parseFloat(bonusRecord.daily_profit || 0);
} else {
  // Use raw profit from games
  adjustedDailyProfit = parseFloat(dailyResults[0]?.dailyprofit || 0);
}
```

### Weekly/15-Day Profit

```javascript
// Always calculated from raw game data
const weeklyProfit = `
  SELECT SUM(bet_money - COALESCE(win_money, 0)) as profit
  FROM games
  WHERE created_at >= $1 AND status = 'finished'
`;
```

## Admin Dashboard

### User Statistics Display

For each user, the admin sees:
- **Daily Profit:** Adjusted if bonus used today (shows reduced amount)
- **Weekly Profit:** Raw total from games (not affected by bonus)
- **House Bonus:** 200 if eligible and not used, 0 if used

### Calculation Logic

```javascript
let dailyHouseProfit = Math.round(parseFloat(row.daily_house_profit || 0));

// If bonus was used, show adjusted profit
if (bonusUsed && bonusRecord) {
  dailyHouseProfit = Math.round(parseFloat(bonusRecord.daily_profit || 0));
}

// Bonus availability
const houseBonus = bonusUsed ? 0 : (dailyHouseProfit >= 1000 ? 200 : 0);
```

## Visual Example

### Before Bonus Applied
```
Daily Profit:   1200 Birr
Weekly Profit:  3500 Birr
15-Day Profit:  8000 Birr
House Bonus:    200 Birr (Available)
```

### After Bonus Applied
```
Daily Profit:   1000 Birr  ← Reduced by 200
Weekly Profit:  3500 Birr  ← Unchanged (raw from games)
15-Day Profit:  8000 Birr  ← Unchanged (raw from games)
House Bonus:    0 Birr     ← Used
Balance:        +200 Birr  ← Added (prepaid only)
```

## Important Notes

1. **Daily Profit Only:** The bonus deduction only affects TODAY's profit display
2. **Historical Data:** Weekly and 15-day profits use raw game data
3. **One-Time Deduction:** Bonus can only be used once per day
4. **Resets Daily:** Bonus eligibility resets at midnight
5. **Permanent Record:** The deduction is stored in daily_bonuses table

## Testing

To verify the bonus impact:

```bash
# Check current status
cd backend
node scripts/test-house-bonus.js

# Manually trigger bonus
node scripts/trigger-bonus-manually.js

# Verify profit displays
# - Daily profit should be reduced by 200
# - Weekly/15-day profits should remain unchanged
```

## Summary

✅ **Daily Profit:** Affected by bonus (reduced by 200)
✅ **Weekly Profit:** NOT affected by today's bonus (uses raw game data)
✅ **15-Day Profit:** NOT affected by today's bonus (uses raw game data)
✅ **Balance (Prepaid):** Increased by 200
✅ **Bonus Status:** Marked as used, cannot claim again today

The house bonus system correctly reduces the daily profit display while keeping historical profit calculations (weekly, 15-day) based on raw game data.
