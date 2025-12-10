# House Bonus System - Troubleshooting Guide

## System Status: ✅ WORKING

The house bonus system is now fully functional and tested.

## How It Works

### Automatic Application
When a game finishes and the user's daily profit reaches ≥1000 Birr:
1. System checks if bonus already used today
2. If not used and profit ≥1000:
   - **Prepaid users**: 200 Birr added to balance
   - **Postpaid users**: 200 Birr deducted from daily profit (reduces debt)
3. Bonus marked as used (once per day)
4. User sees alert message

### Test Results

**User: pretest (Prepaid)**
- Daily Profit: 1200 Birr
- Bonus Applied: ✅ Yes
- Balance Before: 10,115 Birr
- Balance After: 10,315 Birr (+200)
- Daily Profit Display: 1,000 Birr (1200 - 200)

## Common Issues & Solutions

### Issue 1: Bonus Not Applying Automatically

**Symptoms:**
- Daily profit ≥1000 but no bonus message
- Bonus button still shows on NewGame page

**Causes:**
1. Bonus record not created/updated
2. Game not finishing properly
3. Database connection issue

**Solution:**
```bash
# Run manual trigger script
cd backend
node scripts/trigger-bonus-manually.js
```

### Issue 2: Bonus Record Missing ID

**Symptoms:**
- Error: "null value in column 'id' violates not-null constraint"

**Solution:**
The code has been fixed to include UUID when creating bonus records:
```javascript
const { v4: uuidv4 } = require('uuid');
await db.run(`
  INSERT INTO daily_bonuses (id, user_id, bonus_date, daily_profit, ...)
  VALUES ($1, $2, $3, $4, ...)
`, [uuidv4(), userId, today, dailyProfit]);
```

### Issue 3: Daily Profit Not Updating

**Symptoms:**
- Bonus record shows old profit value
- Calculated profit different from stored profit

**Solution:**
The system now updates daily profit before checking eligibility:
```javascript
if (!bonusRecord.bonus_used) {
  await db.run('UPDATE daily_bonuses SET daily_profit = $1 WHERE user_id = $2 AND bonus_date = $3', 
    [dailyProfit, userId, today]);
  bonusRecord.daily_profit = dailyProfit; // Update local copy
}
```

### Issue 4: Bonus Applied Multiple Times

**Symptoms:**
- User receives bonus more than once per day

**Solution:**
System checks `bonus_used` flag before applying:
```javascript
if (!bonusRecord.bonus_used && dailyProfit >= 1000) {
  // Apply bonus
}
```

## Testing Scripts

### 1. Check House Bonus Status
```bash
cd backend
node scripts/test-house-bonus.js
```

Shows:
- All users and their daily profits
- Bonus eligibility
- Bonus usage status
- Today's games

### 2. Manually Trigger Bonus
```bash
cd backend
node scripts/trigger-bonus-manually.js
```

Manually applies bonus for testing (user: pretest)

### 3. Check User Schema
```bash
cd backend
node scripts/check-user-schema.js
```

Verifies user_type field is set correctly

## Database Queries

### Check Bonus Status
```sql
SELECT 
  u.username,
  u.user_type,
  u.balance,
  db.daily_profit,
  db.bonus_used,
  db.bonus_date
FROM users u
LEFT JOIN daily_bonuses db ON u.id = db.user_id
WHERE db.bonus_date = CURRENT_DATE;
```

### Calculate Daily Profit
```sql
SELECT 
  user_id,
  SUM(bet_money - COALESCE(win_money, 0)) as daily_profit
FROM games
WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'finished'
GROUP BY user_id;
```

### Reset Bonus for Testing
```sql
-- Reset bonus for a specific user
UPDATE daily_bonuses 
SET bonus_used = false, 
    bonus_claimed = false,
    daily_profit = (
      SELECT SUM(bet_money - COALESCE(win_money, 0))
      FROM games
      WHERE user_id = daily_bonuses.user_id
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'finished'
    )
WHERE user_id = 'USER_ID_HERE'
  AND bonus_date = CURRENT_DATE;
```

## Verification Checklist

- [ ] User has played games today
- [ ] Daily profit ≥1000 Birr
- [ ] Bonus not already used today
- [ ] User type is set (prepaid/postpaid)
- [ ] Game finished successfully
- [ ] Bonus record exists in daily_bonuses table
- [ ] Backend server is running
- [ ] No database connection errors

## Expected Behavior

### Prepaid User (e.g., pretest)
1. Plays games, earns 1200 Birr profit
2. Finishes game
3. Alert: "🎉 House Bonus Applied! 200 Birr added to your balance (New balance: 10315.00 Birr)"
4. Balance increases by 200
5. Daily profit display shows 1000 (1200 - 200)
6. Cannot claim bonus again today

### Postpaid User (e.g., Yabtest)
1. Plays games, earns 1200 Birr profit
2. Finishes game
3. Alert: "🎉 House Bonus Applied! 200 Birr deducted from your daily profit (1200 → 1000 Birr)"
4. Balance unchanged (unlimited credit)
5. Daily profit display shows 1000 (1200 - 200)
6. Debt reduced by 200
7. Cannot claim bonus again today

## Monitoring

### Backend Logs
Look for these messages:
```
💰 Daily profit for user [ID]: [amount] Birr
🎁 Auto-applying house bonus for user [ID] (prepaid/postpaid)
✅ Prepaid bonus applied: Balance increased to [amount]
✅ Postpaid bonus applied: Daily profit reduced from [old] to [new]
```

### Frontend
- Alert message appears after game finish
- Green banner on NewGame page (if recently applied)
- HouseBonusButton disappears after use

## Support

If issues persist:
1. Check backend logs for errors
2. Run test scripts to verify database state
3. Verify user_type is set correctly
4. Check daily_bonuses table for records
5. Ensure games are finishing with status='finished'

## Files Modified

- `backend/routes/games.js` - Auto-bonus logic in finish-session endpoint
- `src/components/GamePageOptimized.tsx` - Shows bonus alert
- `src/components/NewGame.tsx` - Shows bonus notification banner
- `backend/scripts/test-house-bonus.js` - Testing script
- `backend/scripts/trigger-bonus-manually.js` - Manual trigger script

## Last Updated
December 9, 2025

## Status
✅ System is working correctly
✅ Tested with prepaid user
✅ Balance updated successfully
✅ Bonus marked as used
✅ Cannot be claimed twice
