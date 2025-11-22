# Backend Redeployment Guide - Connection Timeout Fix

## Problem Fixed
- Database connection timeout (was 2 seconds, now 30 seconds)
- Added retry logic for database operations
- Improved error handling and connection pooling
- Added deployment and health check scripts

## Quick Redeployment Steps

### Option 1: Update Existing Render Service (Recommended)

1. **Push Changes to GitHub**
   ```bash
   git add .
   git commit -m "Fix database connection timeout and improve deployment"
   git push origin main
   ```

2. **Trigger Render Redeploy**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Find your backend service
   - Click "Manual Deploy" → "Deploy latest commit"
   - Wait for deployment to complete

3. **Verify Deployment**
   - Check logs for "✅ Database initialized successfully"
   - Test health endpoint: `https://your-backend.onrender.com/api/health`

### Option 2: Fresh Deployment (If needed)

If you want to start completely fresh:

1. **Create New PostgreSQL Database**
   - Name: `amour-bingo-db-v2`
   - Save the DATABASE_URL

2. **Create New Web Service**
   - Repository: Your GitHub repo
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Environment Variables**
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=postgresql://user:pass@host:port/db
   JWT_SECRET=bingo_auth_secret_key_2024_supernova_corp_production_key_xyz
   JWT_EXPIRES_IN=604800
   FRONTEND_URL=https://your-frontend.netlify.app
   DEMO_EMAIL=admin@bingo.com
   DEMO_PASSWORD=admin123
   DEFAULT_HOUSE_CUT=25
   MAX_BET_AMOUNT=1000
   MIN_BET_AMOUNT=10
   ```

## What Was Fixed

### 1. Database Connection Configuration
- **Before**: 2-second timeout (too short for Render)
- **After**: 30-second timeout with proper connection pooling
- Added retry logic for failed connections
- Better error handling and logging

### 2. Connection Pool Settings
```javascript
// New optimized settings
max: 10,                    // Reduced from 20
min: 2,                     // Minimum connections
connectionTimeoutMillis: 30000,  // 30 seconds (was 2)
acquireTimeoutMillis: 60000,     // 60 seconds to get connection
createTimeoutMillis: 30000,      // 30 seconds to create connection
```

### 3. Retry Logic
- Database operations now retry up to 3 times
- Exponential backoff between retries
- Better error messages for troubleshooting

### 4. Deployment Scripts
- `npm run health` - Check system health
- `npm run deploy` - Initialize database and create users
- `npm run postinstall` - Runs automatically after npm install

## Testing the Fix

### 1. Health Check
```bash
# Test locally
cd backend
npm run health

# Test deployed version
curl https://your-backend.onrender.com/api/health
```

### 2. Database Connection Test
```bash
# Should see these logs:
✅ Database connection established
✅ Database schema initialized successfully
✅ Database initialized successfully
```

### 3. User Creation Test
```bash
# Test admin login
curl -X POST "https://your-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@bingo.com", "password": "admin123"}'

# Test demo user login
curl -X POST "https://your-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "tare.a2@example.com", "password": "0934942672"}'
```

## Troubleshooting

### If Connection Still Times Out
1. Check Render logs for specific error messages
2. Verify DATABASE_URL is correct
3. Ensure PostgreSQL service is running
4. Try manual deploy to refresh the service

### If Database Initialization Fails
1. Check if database exists and is accessible
2. Verify user permissions
3. Look for specific SQL errors in logs
4. Try running `npm run deploy` manually

### If Users Can't Login
1. Check if users were created successfully
2. Verify JWT_SECRET is set
3. Test password hashing
4. Check CORS settings for frontend

## Expected Log Output

When deployment is successful, you should see:
```
🚀 Bingo Backend Server running on port 10000
📊 Environment: production
🗄️ Using PostgreSQL database
Initializing database... (attempt 1/5)
✅ Database connection established
✅ Database schema initialized successfully
✅ Database initialized successfully
```

## Next Steps After Successful Deployment

1. **Update Frontend**
   - Update `.env` with new backend URL
   - Test login functionality
   - Verify all API calls work

2. **Test Game Functionality**
   - Create a test game
   - Purchase cartelas
   - Test game flow

3. **Monitor Performance**
   - Watch Render logs
   - Monitor database connections
   - Check response times

## Support

If you still encounter issues:
1. Check the Render service logs
2. Run `npm run health` to diagnose
3. Verify all environment variables
4. Test database connectivity directly
5. Check if the PostgreSQL service is active

The connection timeout fix should resolve the intermittent database connection issues you were experiencing.