# Fix 404 Error - Settings Endpoint

## Problem
```
POST http://localhost:3003/api/settings 404 (Not Found)
```

## Root Cause
The backend server was started **before** the settings route was added. The server needs to be restarted to load the new route.

## Quick Fix

### Step 1: Stop the Backend Server
Find the terminal running the backend and press **Ctrl + C**

### Step 2: Restart the Backend Server
```bash
cd backend
npm start
```

### Step 3: Verify
You should see:
```
🚀 Bingo Backend Server running on port 3003
✅ Database initialized successfully
```

### Step 4: Test
Open your Settings page and try saving settings. The 404 error should be gone!

## Why This Happened
1. The settings route (`backend/routes/settings.js`) was created
2. The route was registered in `backend/server.js`
3. But the server was already running with the old code
4. Node.js doesn't automatically reload code changes
5. A restart is needed to load the new route

## Prevention
Use **nodemon** for automatic restarts during development:

```bash
cd backend
npm install --save-dev nodemon
npm run dev  # Instead of npm start
```

With nodemon, the server will automatically restart when you make code changes!

## Verification
After restarting, the settings endpoint should work:
- ✅ `GET /api/settings` - Returns user settings
- ✅ `POST /api/settings` - Saves user settings
- ✅ No more 404 errors!
