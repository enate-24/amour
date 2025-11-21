# Weekly Report Calculations - Detailed Explanation

## Overview
The weekly and 15-day reports calculate user betting statistics based on finished games within the selected time period.

## Time Periods

### Weekly Report (Monday-Sunday)
```javascript
// Get Monday of current week
const monday = getMondayOfWeek(new Date());
monday.setHours(0, 0, 0, 0);  // Start: Monday 00:00:00

// Get Sunday (6 days after Monday)
const sunday = new Date(monday);
sunday.setDate(sunday.getDate() + 6);
sunday.setHours(23, 59, 59, 999);  // End: Sunday 23:59:59
```

**Example:**
- If today is Thursday, November 21, 2025
- Report shows: Monday Nov 18, 00:00:00 → Sunday Nov 24, 23:59:59

### 15-Day Report
```javascript
// Start: 15 days ago
const startDate = new Date();
startDate.setDate(startDate.getDate() - 15);
startDate.setHours(0, 0, 0, 0);  // 15 days ago at 00:00:00

// End: Today
const endDate = new Date();
endDate.setHours(23, 59, 59, 999);  // Today at 23:59:59
```

**Example:**
- If today is November 21, 2025
- Report shows: November 6, 00:00:00 → November 21, 23:59:59

## SQL Calculations

### 1. Total Bet (period_total_bet)
```sql
SUM(CASE 
  WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id 
  THEN g.bet_money * g.cartelas_selected 
  ELSE 0 
END)
```

**Formula:**
```
Total Bet = Σ (bet_money × cartelas_selected) for all finished games in period
```

**Example:**
- Game 1: 10 BIRR bet × 5 cartelas = 50 BIRR
- Game 2: 20 BIRR bet × 3 cartelas = 60 BIRR
- **Total Bet = 110 BIRR**

**Why multiply by cartelas_selected?**
- Each cartela costs the bet amount
- If a user plays 5 cartelas at 10 BIRR each, they bet 50 BIRR total

### 2. Player Win (period_player_win)
```sql
SUM(CASE 
  WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id 
  THEN g.win_money 
  ELSE 0 
END)
```

**Formula:**
```
Player Win = Σ win_money for all finished games in period
```

**Example:**
- Game 1: Won 35 BIRR
- Game 2: Won 0 BIRR (lost)
- Game 3: Won 70 BIRR
- **Total Player Win = 105 BIRR**

**Note:** `win_money` is the total payout for that game, not per cartela.

### 3. House Profit (calculated in JavaScript)
```javascript
houseProfit = totalBet - playerWin
```

**Formula:**
```
House Profit = Total Bet - Player Win
```

**Example:**
- Total Bet: 110 BIRR
- Player Win: 105 BIRR
- **House Profit = 5 BIRR**

**Interpretation:**
- **Positive value**: House made profit (good for business)
- **Negative value**: House paid out more than received (player won big)
- **Zero**: Break-even

### 4. Games Played (period_games_played)
```sql
COUNT(DISTINCT CASE 
  WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id 
  THEN g.id 
END)
```

**Formula:**
```
Games Played = COUNT of unique game IDs in period
```

**Example:**
- User played 3 different games
- **Games Played = 3**

### 5. Cartelas Played (period_cartelas_played)
```sql
SUM(CASE 
  WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id 
  THEN g.cartelas_selected 
  ELSE 0 
END)
```

**Formula:**
```
Cartelas Played = Σ cartelas_selected for all games in period
```

**Example:**
- Game 1: 5 cartelas
- Game 2: 3 cartelas
- Game 3: 8 cartelas
- **Total Cartelas = 16**

## Complete Example

### User: "asellagame"
**Period:** November 18-24, 2025 (Weekly)

**Games Played:**

| Game | Date | Bet/Cartela | Cartelas | Total Bet | Win | Status |
|------|------|-------------|----------|-----------|-----|--------|
| 1 | Nov 18 | 10 BIRR | 5 | 50 BIRR | 35 BIRR | Finished |
| 2 | Nov 19 | 20 BIRR | 3 | 60 BIRR | 0 BIRR | Finished |
| 3 | Nov 20 | 15 BIRR | 8 | 120 BIRR | 70 BIRR | Finished |
| 4 | Nov 21 | 25 BIRR | 4 | 100 BIRR | - | Started (not counted) |

**Calculations:**

```javascript
// Only finished games count
Total Bet = (10 × 5) + (20 × 3) + (15 × 8) = 50 + 60 + 120 = 230 BIRR

Player Win = 35 + 0 + 70 = 105 BIRR

House Profit = 230 - 105 = 125 BIRR

Games Played = 3 (only finished games)

Cartelas Played = 5 + 3 + 8 = 16
```

**Report Display:**
```
Username: asellagame
Games: 3
Cartelas: 16
Total Bet: 230 BIRR
Player Win: 105 BIRR
House Profit: 125 BIRR
```

## Summary Statistics

The report also shows totals across all users:

```javascript
// Accumulate from all users
totalBetPeriod = Σ all users' period_total_bet
totalPlayerWinPeriod = Σ all users' period_player_win
totalHouseProfitPeriod = Σ all users' period_house_profit
totalGamesPeriod = Σ all users' period_games_played
activeUsersPeriod = COUNT of users with games_played > 0
```

## Important Notes

### 1. Only Finished Games Count
```sql
LEFT JOIN games g ON u.id = g.user_id AND g.status = 'finished'
```
- Games with status 'started', 'waiting', or 'cancelled' are **NOT included**
- Only games with status 'finished' are counted

### 2. Date Range is Inclusive
```sql
g.created_at >= $1 AND g.created_at <= $2
```
- Both start and end dates are included
- Uses game creation timestamp (`created_at`)

### 3. User Assignment Required
```sql
g.user_id = u.id
```
- Games must have a `user_id` assigned
- After migration, all games are assigned to users
- New games should include `user_id` when created

### 4. Zero Values
If a user shows all zeros:
- ✅ User exists in database
- ❌ User has no finished games in the period
- ❌ OR games don't have user_id assigned

## Verification Query

To manually verify calculations for a user:

```sql
SELECT 
  u.username,
  COUNT(g.id) as games,
  SUM(g.bet_money * g.cartelas_selected) as total_bet,
  SUM(g.win_money) as player_win,
  SUM(g.bet_money * g.cartelas_selected) - SUM(g.win_money) as house_profit,
  SUM(g.cartelas_selected) as cartelas
FROM users u
LEFT JOIN games g ON u.id = g.user_id 
  AND g.status = 'finished'
  AND g.created_at >= '2025-11-18 00:00:00'
  AND g.created_at <= '2025-11-24 23:59:59'
WHERE u.username = 'asellagame'
GROUP BY u.username;
```

## Common Issues

### Issue: All zeros showing
**Causes:**
1. No games in the selected period
2. Games don't have `user_id` assigned
3. All games are 'started' or 'waiting' (not 'finished')

**Solution:**
```bash
# Run migration to assign user_id
node backend/migrations/add-user-id-to-games.js

# Restart backend server
cd backend && npm start
```

### Issue: Wrong amounts
**Causes:**
1. `bet_money` stored incorrectly in database
2. `cartelas_selected` is wrong
3. `win_money` calculation error

**Debug:**
```bash
node debug-weekly-report-data.cjs
```

### Issue: Missing recent games
**Causes:**
1. Games not marked as 'finished'
2. Game `created_at` timestamp is wrong
3. Server timezone mismatch

**Check:**
```sql
SELECT id, status, created_at, bet_money, cartelas_selected
FROM games
ORDER BY created_at DESC
LIMIT 10;
```

## Future Enhancements

Possible improvements to calculations:

1. **Net Profit Percentage**
   ```javascript
   profitPercentage = (houseProfit / totalBet) * 100
   ```

2. **Average Bet Per Game**
   ```javascript
   avgBet = totalBet / gamesPlayed
   ```

3. **Win Rate**
   ```javascript
   winRate = (gamesWon / gamesPlayed) * 100
   ```

4. **ROI (Return on Investment)**
   ```javascript
   roi = ((playerWin - totalBet) / totalBet) * 100
   ```

5. **Daily Breakdown**
   - Show bet/win/profit for each day in the period
   - Useful for trend analysis

---

**The calculations are designed to give accurate financial reporting for the bingo game system! 📊**
