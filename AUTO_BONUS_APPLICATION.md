# Automatic House Bonus Application

## Overview
The house bonus is now automatically applied when a user's daily profit reaches 1000 Birr or more. The bonus is applied differently based on the user's payment type.

## How It Works

### Automatic Application
When a game is finished and the user's daily profit reaches ≥1000 Birr:
- **Postpaid users**: 200 Birr is automatically deducted from their daily profit (reduces what they owe)
- **Prepaid users**: 200 Birr is automatically added to their balance

### User Experience

#### 1. During Game Finish
When a game ends and the bonus is applied, the user sees an alert message:
- **Postpaid**: "🎉 House Bonus Applied! 200 Birr deducted from your daily profit (1200 → 1000 Birr)"
- **Prepaid**: "🎉 House Bonus Applied! 200 Birr added to your balance (New balance: 1500.00 Birr)"

#### 2. On New Game Page
When returning to the New Game page after a bonus was applied, a green banner appears at the top:
- Shows the bonus application message
- Auto-dismisses after 10 seconds
- Can be manually closed with the × button

### Technical Implementation

#### Backend Changes (`backend/routes/games.js`)

The finish game endpoint now includes automatic bonus checking:

```javascript
// After finishing game, check for bonus eligibility
const today = new Date().toISOString().split('T')[0];
const user = await db.get('SELECT user_type, balance FROM users WHERE id = $1', [userId]);

// Calculate today's profit
const dailyProfit = await calculateDailyProfit(userId, today);

// Check if bonus already used
const bonusRecord = await getBonusRecord(userId, today);

// Auto-apply if eligible (profit >= 1000 and not already used)
if (!bonusRecord.bonus_used && dailyProfit >= 1000) {
  if (user.user_type === 'postpaid') {
    // Deduct from daily profit
    await updateDailyProfit(userId, today, dailyProfit - 200);
  } else {
    // Add to balance
    await updateUserBalance(userId, user.balance + 200);
    await updateDailyProfit(userId, today, dailyProfit - 200);
  }
  
  // Mark bonus as used
  await markBonusAsUsed(userId, today);
}
```

#### Frontend Changes

**GamePageOptimized.tsx:**
- Shows alert when bonus is applied during game finish
- Displays the bonus message from the API response

**NewGame.tsx:**
- Checks bonus status on component mount
- Shows notification banner if bonus was recently applied
- Auto-hides banner after 10 seconds

### Bonus Rules

1. **Eligibility**: Daily profit must be ≥1000 Birr
2. **Frequency**: Once per day (resets at midnight)
3. **Amount**: Fixed 200 Birr
4. **Automatic**: No manual action required
5. **One-time**: Cannot be claimed again after use

### Database Updates

**daily_bonuses table:**
- `bonus_used`: Set to 1 when bonus is applied
- `bonus_claimed`: Set to 1 when bonus is applied
- `daily_profit`: Reduced by 200 after bonus application

**users table (prepaid only):**
- `balance`: Increased by 200 when bonus is applied

### User Type Differences

| Feature | Postpaid | Prepaid |
|---------|----------|---------|
| Bonus Effect | Reduces daily profit | Adds to balance |
| Balance Impact | None (debt reduced) | +200 Birr |
| Daily Profit Display | Reduced by 200 | Reduced by 200 |
| Notification | "deducted from daily profit" | "added to balance" |

### Example Scenarios

#### Scenario 1: Postpaid User
1. User plays games, earns 1200 Birr daily profit
2. Game finishes, bonus auto-applies
3. Alert: "🎉 House Bonus Applied! 200 Birr deducted from your daily profit (1200 → 1000 Birr)"
4. Dashboard shows: Daily Profit = 1000 Birr
5. User's debt is reduced by 200 Birr

#### Scenario 2: Prepaid User
1. User plays games, earns 1500 Birr daily profit
2. Game finishes, bonus auto-applies
3. Alert: "🎉 House Bonus Applied! 200 Birr added to your balance (New balance: 1700.00 Birr)"
4. Dashboard shows: Daily Profit = 1300 Birr, Balance = 1700 Birr
5. User can use the 200 Birr to play more games

#### Scenario 3: Below Threshold
1. User plays games, earns 800 Birr daily profit
2. Game finishes, no bonus applied
3. No notification shown
4. User needs 200 more Birr to reach 1000 threshold

### Testing

To test the automatic bonus application:

1. **Setup**: Create a test user (prepaid or postpaid)
2. **Play games**: Play enough games to reach 1000+ Birr daily profit
3. **Finish game**: Complete the game
4. **Verify**: Check for bonus alert message
5. **Check dashboard**: Verify daily profit is reduced by 200
6. **Check balance** (prepaid only): Verify balance increased by 200
7. **Return to New Game**: Verify notification banner appears

### Notes

- Bonus is applied only once per day
- Bonus calculation happens after each game finish
- If multiple games finish on the same day, only the first one that crosses 1000 Birr triggers the bonus
- The bonus system gracefully handles errors without blocking game completion
- Weekly and 15-day profit calculations are not affected by bonus deductions
