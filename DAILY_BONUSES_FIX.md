# Daily Bonuses 500 Error Fix

## Problem
The `/api/bonuses/daily` endpoint is returning a 500 Internal Server Error on production (Render).

## Root Cause
The `daily_bonuses` table likely doesn't exist in the production database, causing the endpoint to fail when trying to query or create records.

## Solution

### 1. Created Migration Script
Created `backend/migrations/add-daily-bonuses-table.js` to ensure the `daily_bonuses` table exists in production.

### 2. Created Migration Runner
Created `backend/run-migrations.js` to run all migration scripts in order.

### 3. Added Migration Script to package.json
Added `npm run migrate` command to easily run migrations.

### 4. Enhanced Error Logging
Updated `backend/routes/bonuses.js` with better error handling and logging to help diagnose issues.

## How to Fix Production

### ✅ Local Migration Successful
The migration ran successfully locally and created the `daily_bonuses` table with 5 existing records.

### Deploy to Production
Now you need to run the same migration on your Render production database:

#### Option 1: Run Migration Manually on Render (Recommended)
1. Go to your Render dashboard
2. Open the Shell for your backend service
3. Run: `npm run migrate`

#### Option 2: Add Migration to Startup
Update your Render start command to run migrations before starting the server:
```bash
npm run migrate && npm start
```

#### Option 3: Run Migration Locally Against Production DB
If you have access to the production database credentials:
1. Update your local `.env` with production database credentials
2. Run: `cd backend && npm run migrate`
3. Restore your local `.env`

## Verification
After running the migration, test the endpoint:
```bash
curl https://amour-bingo-backend.onrender.com/api/bonuses/daily \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Files Modified
- `backend/routes/bonuses.js` - Enhanced error logging
- `backend/migrations/add-daily-bonuses-table.js` - New migration
- `backend/run-migrations.js` - New migration runner
- `backend/package.json` - Added migrate script

## Next Steps
1. Deploy the updated code to Render (it will auto-deploy from git)
2. Run the migration on production using one of the options above
3. Test the `/api/bonuses/daily` endpoint
4. Check Render logs for any remaining errors
