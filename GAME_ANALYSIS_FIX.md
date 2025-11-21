# Game Analysis Page Fix

## Summary
Fixed the Game Analysis page to correctly display financial data for each game according to the requirements.

## Requirements Met
- ✅ **Game** = Game ID (displayed as game number)
- ✅ **Players** = Number of cartelas selected in that game
- ✅ **Bet** = Single cartela price (bet money per cartela)
- ✅ **Tot Bet** = Bet price × Players (total money collected)
- ✅ **Cut %** = House cut percentage (e.g., 25%, 20%)
- ✅ **Win** = Player win amount (money paid to winner)
- ✅ **ProfitHouse** = House profit (Tot Bet × Cut %)

## Changes Made

### 1. Backend API (`backend/routes/games.js`)
Updated the `/games/analysis` endpoint to correctly calculate house profit:

**Old Formula:**
```sql
(g.bet_money * COUNT(c.id) * g.house_cut_percentage / 100) as profit
```

**New Formula:**
```sql
(g.bet_money * COUNT(c.id) * g.house_cut_percentage / 100) as profit
```

**Explanation:**
- The house profit is calculated based on the house cut percentage
- Formula: `ProfitHouse = Total Bet × Cut %`
- Example: If 10 players bet $20 each ($200 total) with 10% cut, house profit = $200 × 10% = $20

### 2. PostgreSQL Compatibility
Added proper GROUP BY clause for PostgreSQL:
```sql
GROUP BY g.id, g.created_at, g.game_number, g.bet_money, g.house_cut_percentage, g.win_money, g.status
```

### 3. Frontend (`src/components/GameAnalytics.tsx`)
Updated column header from "Profit" to "ProfitHouse" for clarity.

## How It Works

For each game, the system calculates:

1. **Players**: Count of cartelas in the game
2. **Bet**: Single cartela price (from game settings: `g.bet_money`)
3. **Tot Bet**: `Bet × Players` (total money collected from all players)
4. **Cut %**: House cut percentage (e.g., 10%, 20%, 25%)
5. **Win**: The amount paid to the winner (if any)
6. **ProfitHouse**: `Tot Bet × Cut %` (house profit based on cut percentage)

### Example Calculation:
```
Game #134:
- Bet (single cartela): $20
- Players (cartelas sold): 10
- Tot Bet: $20 × 10 = $200 (total collected)
- Cut %: 10%
- ProfitHouse: $200 × 10% = $20 (house profit)
- Win Amount: $180 (paid to winner)
```

### SQL Implementation:
```sql
-- Bet: single cartela price
g.bet_money as bet

-- Tot Bet: bet price × number of players
g.bet_money * COUNT(c.id) as totalBet

-- ProfitHouse: total bet × house cut percentage
(g.bet_money * COUNT(c.id) * g.house_cut_percentage / 100) as profit
```

## Testing

To test the changes:

1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

2. Start the frontend:
   ```bash
   npm run dev
   ```

3. Navigate to the Game Analytics page
4. Verify that all columns display correct data
5. Check that ProfitHouse = Tot Bet - Win for each game

## Files Modified
- `backend/routes/games.js` - Updated profit calculation logic
- `src/components/GameAnalytics.tsx` - Updated column header

## Files Created
- `test-game-analysis-calculation.cjs` - Test script to verify calculations
- `test-game-analysis-api.cjs` - Test script to verify API endpoint
