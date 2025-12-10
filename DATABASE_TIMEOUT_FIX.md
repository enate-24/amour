# Database Query Timeout Fix

## Problem
You're experiencing "Query read timeout" errors when connecting to your Render PostgreSQL database from your local development environment.

## Root Cause
1. **Remote Database Connection**: You're connecting to a Render PostgreSQL database in Oregon from your local machine, which adds significant network latency
2. **Aggressive Timeouts**: Query timeouts were set to 10 seconds, which is too short for remote database connections
3. **Missing Indexes**: Several tables lacked proper indexes, causing slow queries
4. **DNS Resolution Issues**: The database hostname `dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com` may not be resolving properly

## Fixes Applied

### 1. Increased Query Timeouts
- Remote database timeout: 10s → 60s
- Local database timeout: 10s → 30s
- Connection timeout: 10s → 30s
- Acquire timeout: 10s → 30s

### 2. Optimized Connection Pool
- Reduced max connections for remote: 20 → 10 (avoid overwhelming remote DB)
- Reduced min connections: 5 → 2
- Increased idle timeout: 30s → 60s
- Added connection monitoring and logging

### 3. Added Database Indexes
Created indexes on frequently queried columns:

**Users table:**
- `idx_users_username`
- `idx_users_email`
- `idx_users_is_active`

**Games table:**
- `idx_games_status`
- `idx_games_user_id`
- `idx_games_created_at`
- `idx_games_user_created` (composite)

**Cartelas table:**
- `idx_cartelas_user_id`
- `idx_cartelas_game_id`
- `idx_cartelas_card_id`
- `idx_cartelas_is_active`
- `idx_cartelas_purchased_at`

**Daily Bonuses table:**
- `idx_daily_bonuses_user_date` (composite)
- `idx_daily_bonuses_date`

### 4. Improved Error Handling
- Added exponential backoff for retries
- Better error logging with connection details
- Connection pool monitoring
- Graceful shutdown handling

### 5. Added Health Check
- Database health check endpoint: `GET /api/health`
- Connection test script: `node backend/test-db-connection.js`

## Recommended Solutions

### Option 1: Use Local PostgreSQL (Recommended for Development)
Install PostgreSQL locally and update your `.env`:

```env
# Comment out remote database
# DATABASE_URL=postgresql://...

# Use local database
DB_USER=postgres
DB_HOST=localhost
DB_NAME=amour_bingo
DB_PASSWORD=your_password
DB_PORT=5432
```

**Advantages:**
- No network latency
- Faster development
- Works offline
- No timeout issues

### Option 2: Continue with Remote Database
If you must use the remote database:

1. **Check Network Connection:**
   ```cmd
   ping dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com
   ```

2. **Test DNS Resolution:**
   ```cmd
   nslookup dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com
   ```

3. **Check Firewall/VPN:**
   - Ensure your firewall allows outbound PostgreSQL connections (port 5432)
   - If using VPN, try disconnecting/reconnecting

4. **Verify Database Status:**
   - Log into Render dashboard
   - Check if database is running
   - Check for any maintenance windows

### Option 3: Use Connection Pooling Service
Consider using a connection pooling service like:
- PgBouncer
- Supabase (includes connection pooling)
- Neon (serverless Postgres with connection pooling)

## Testing the Fix

### 1. Test Database Connection
```cmd
cd backend
node test-db-connection.js
```

### 2. Start the Server
```cmd
cd backend
npm start
```

### 3. Check Health Endpoint
```cmd
curl http://localhost:3003/api/health
```

## Monitoring

The server now logs connection pool activity:
- 🔵 Client acquired from pool
- 🔴 Client removed from pool
- ✅ Connected to PostgreSQL database
- ❌ Query errors with details

## Next Steps

1. **Immediate**: Try Option 1 (local PostgreSQL) for development
2. **Short-term**: Run the migration script to create indexes
3. **Long-term**: Consider using a connection pooling service for production

## Files Modified

- `backend/data/database.js` - Connection config, timeouts, indexes, health check
- `backend/db.js` - Export health check functions
- `backend/server.js` - Add health check endpoint and graceful shutdown
- `backend/test-db-connection.js` - New test script

## Commands

```cmd
# Test database connection
cd backend
node test-db-connection.js

# Start server with new configuration
npm start

# Check server health
curl http://localhost:3003/api/health
```

## Current Status

✅ Configuration updated
✅ Indexes added
✅ Health check implemented
⚠️ DNS resolution failing for Render database

**Action Required**: Choose Option 1 (local database) or troubleshoot network connectivity to Render.
