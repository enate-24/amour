# Players Won Display Fix Summary

## Problem
The "Players Won" column in the Games Summary table on the Dashboard was showing 0 for all dates, even though games had winners and winnings data.

## Root Cause
The dashboard route was using an incorrect SQL query to calculate "Players Won" amounts. The query was:

```sql
SELECT
  DATE(g.created_at) as created_date,
  COALESCE(SUM(g.win_money), 0) as playersWon
FROM cartelas c
JOIN games g ON c.game_id = g.id
WHERE g.created_at >= $1 AND g.created_at <= $2 
  AND g.status IN ('started', 'finished') 
  AND c.is_winner = true  -- ❌ This was the problem
GROUP BY DATE(g.created_at)
```

**The Issue**: The query filtered by `c.is_winner = true`, but most games don't have their cartelas explicitly marked with `is_winner = true` in the database. The `win_money` field in the games table already contains the total winnings paid out, so there's no need to join with cartelas and filter by winner status.

## Solution
Changed the query to directly sum `win_money` from the games table without joining cartelas:

```sql
SELECT
  DATE(g.created_at) as created_date,
  COALESCE(SUM(g.win_money), 0) as playersWon
FROM games g
WHERE g.created_at >= $1 AND g.created_at <= $2 
  AND g.status IN ('started', 'finished')
GROUP BY DATE(g.created_at)
```

## Impact
**Before Fix**:
- Only 1 day showed winnings data (105 Birr)
- Most days showed 0 Birr even though games had winners

**After Fix**:
- All 10 days in the range show correct winnings data
- Total winnings displayed: 4,618.5 Birr (vs 105 Birr before)
- Accurate representation of actual payouts to players

## Files Modified
1. **backend/routes/dashboard.js**
   - Updated the `winnersQuery` to remove the cartelas join
   - Removed the `c.is_winner = true` filter
   - Query now directly sums `win_money` from games table

## Testing
Tested with actual database data:
- Games with winnings: ✅ Correctly displayed
- Date grouping: ✅ Working correctly
- Total calculations: ✅ Accurate
- Dashboard display: ✅ Shows proper amounts

## Notes
- The `win_money` field in the games table is set when a game is finished via the `/finish` or `/finish-session` endpoints
- This field represents the total amount paid out to winners for that game
- No need to track individual cartela winner status for dashboard reporting
- The fix makes the query simpler and more reliable
