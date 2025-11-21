# Weekly Report Zero Balance Issue - Root Cause & Solution

## Problem
The weekly report shows 0 balance for all users even though there are games with bet money in the database.

## Root Cause Analysis

### Database Investigation Results:
```
👥 Users: 2 total, 1 non-admin
🎮 Games: 99 total, 97 finished, 11,037 BIRR in bets
🎴 Cartelas: 2000 total, only 7 have user_id, 17 have game_id
```

### The Issue:
The data model has a **broken relationship chain**:
- `users` table has user information
- `games` table has bet_money but **NO user_id column**
- `cartelas` table links to both, but **only 7 out of 2000 have user_id**

Current query tries: `users -> cartelas (user_id) -> games (game_id)`
But this fails because most cartelas don't have a user_id!

## Two Possible Solutions

### Solution 1: Fix the Data Model (Recommended)
Add a `user_id` column to the `games` table so we can directly link users to games.

### Solution 2: Work with Current Model
Show all users but only display data for those with cartelas assigned.

## Implementing Solution 1: Add user_id to Games Table

### Step 1: Create Migration Script

Create `backend/migrations/add-user-id-to-games.js`:

```javascript
const db = require('../db');

async function addUserIdToGames() {
  try {
    console.log('Adding user_id column to games table...');
    
    // Add user_id column
    await db.pool.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL
    `);
    
    // Create index for better performance
    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)
    `);
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addUserIdToGames();
```

### Step 2: Run the Migration

```bash
cd backend
node migrations/add-user-id-to-games.js
```

### Step 3: Update the Weekly Report Query

Replace the query in `backend/routes/admin.js`:

```javascript
// NEW QUERY - Direct user to games relationship
const usersQuery = `
  SELECT
    u.id,
    u.username,
    u.email,
    u.created_at,
    COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.bet_money * g.cartelas_selected ELSE 0 END), 0) as period_total_bet,
    COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.win_money ELSE 0 END), 0) as period_player_win,
    COUNT(DISTINCT CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.id END) as period_games_played,
    COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.cartelas_selected ELSE 0 END), 0) as period_cartelas_played
  FROM users u
  LEFT JOIN games g ON u.id = g.user_id AND g.status = 'finished'
  WHERE u.role != 'admin'
  GROUP BY u.id, u.username, u.email, u.created_at
  ORDER BY period_total_bet DESC, u.username ASC
`;
```

### Step 4: Update Game Creation Code

When creating games, make sure to include the user_id:

```javascript
// In your game creation endpoint
const newGame = {
  id: uuidv4(),
  user_id: req.user.id,  // ✅ Add this!
  game_number: gameNumber,
  status: 'waiting',
  bet_money: betAmount,
  // ... rest of game data
};
```

## Implementing Solution 2: Work with Current Model

If you can't modify the database structure, update the query to better handle the current model:

```javascript
const usersQuery = `
  SELECT
    u.id,
    u.username,
    u.email,
    u.created_at,
    -- Calculate based on cartelas that have user_id
    COALESCE(SUM(
      CASE 
        WHEN g.created_at >= $1 
        AND g.created_at <= $2 
        AND c.user_id = u.id 
        THEN g.bet_money 
        ELSE 0 
      END
    ), 0) as period_total_bet,
    COALESCE(SUM(
      CASE 
        WHEN g.created_at >= $1 
        AND g.created_at <= $2 
        AND c.user_id = u.id 
        AND c.is_winner = true 
        THEN g.win_money 
        ELSE 0 
      END
    ), 0) as period_player_win,
    COUNT(DISTINCT 
      CASE 
        WHEN g.created_at >= $1 
        AND g.created_at <= $2 
        AND c.user_id = u.id 
        THEN g.id 
      END
    ) as period_games_played,
    COUNT(DISTINCT 
      CASE 
        WHEN g.created_at >= $1 
        AND g.created_at <= $2 
        AND c.user_id = u.id 
        THEN c.id 
      END
    ) as period_cartelas_played
  FROM users u
  LEFT JOIN cartelas c ON u.id = c.user_id
  LEFT JOIN games g ON c.game_id = g.id AND g.status = 'finished'
  WHERE u.role != 'admin'
  GROUP BY u.id, u.username, u.email, u.created_at
  ORDER BY period_total_bet DESC, u.username ASC
`;
```

## Quick Fix: Assign Existing Games to Users

If you have existing games that need to be assigned to users:

```javascript
// backend/scripts/assign-games-to-users.js
const db = require('../db');

async function assignGamesToUsers() {
  try {
    // Get all users
    const users = await db.users.findAll();
    const regularUsers = users.filter(u => u.role !== 'admin');
    
    if (regularUsers.length === 0) {
      console.log('No regular users found');
      return;
    }
    
    // Assign all games to the first regular user (or distribute evenly)
    const userId = regularUsers[0].id;
    
    await db.pool.query(`
      UPDATE games 
      SET user_id = $1 
      WHERE user_id IS NULL
    `, [userId]);
    
    console.log(`✅ Assigned all games to user: ${regularUsers[0].username}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.pool.end();
  }
}

assignGamesToUsers();
```

## Testing After Fix

Run the debug script again:

```bash
node debug-weekly-report-data.cjs
```

You should see:
- User-Cartela-Game relationships showing data
- Weekly report results showing non-zero values

## Summary

**Current State:**
- ❌ Games table has no user_id
- ❌ Only 7 cartelas have user_id
- ❌ No way to link most games to users
- ❌ Report shows 0 for everyone

**After Fix:**
- ✅ Games table has user_id column
- ✅ All games linked to users
- ✅ Report shows actual bet amounts
- ✅ Proper user statistics

## Recommendation

**Use Solution 1** (add user_id to games table) because:
1. It's the correct data model
2. Better performance (direct join)
3. Easier to maintain
4. More accurate reporting

The current model with cartelas as the only link is fragile and doesn't scale well.
