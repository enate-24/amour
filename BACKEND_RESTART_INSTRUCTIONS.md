# Backend Server Restart Instructions

## Problem
The settings endpoint is returning 404 because the backend server was started before the settings route was added. The server needs to be restarted to load the new route.

## Solution
Restart the backend server to load the new settings route.

### Steps to Restart Backend Server

#### Option 1: Using Terminal
1. **Find the backend server process**:
   - Look for the terminal window running the backend
   - It should show logs like "Bingo Backend Server running on port 3003"

2. **Stop the server**:
   - Press `Ctrl + C` in the terminal

3. **Start the server again**:
   ```bash
   cd backend
   npm start
   ```

#### Option 2: Using Task Manager (Windows)
1. **Open Task Manager** (Ctrl + Shift + Esc)
2. **Find Node.js processes**
3. **End the backend server process** (look for one using ~50-100MB memory)
4. **Start the server again**:
   ```bash
   cd backend
   npm start
   ```

### Verify the Server is Running

After restarting, you should see:
```
🚀 Bingo Backend Server running on port 3003
📊 Environment: development
🗄️ Using PostgreSQL database
✅ Database initialized successfully
```

### Test the Settings Endpoint

Run this test script to verify:
```bash
node test-backend-connection.cjs
```

You should see:
```
✅ Port 3003: Server is running!
🧪 Testing settings endpoint on port 3003...
   ✅ Settings endpoint: 401 (or 200 if authenticated)
```

**Note**: 401 is expected if not authenticated. 404 means the route is not loaded.

### Alternative: Use nodemon for Auto-Restart

To avoid manual restarts in the future, use nodemon:

1. **Install nodemon** (if not already installed):
   ```bash
   cd backend
   npm install --save-dev nodemon
   ```

2. **Update package.json** scripts:
   ```json
   {
     "scripts": {
       "start": "node server.js",
       "dev": "nodemon server.js"
     }
   }
   ```

3. **Run with nodemon**:
   ```bash
   npm run dev
   ```

Now the server will automatically restart when you make changes!

## What Was Added

The following route was added to the backend:
- `GET /api/settings` - Get all user settings
- `POST /api/settings` - Save user settings (bet amount, house cut %)
- `GET /api/settings/pattern` - Get pattern setting
- `POST /api/settings/pattern` - Save pattern setting

These routes are registered in `backend/server.js` on line 127:
```javascript
app.use('/api/settings', settingsRoutes);
```

## Troubleshooting

### Still getting 404?
1. Check if the server restarted successfully
2. Look for errors in the server logs
3. Verify the route is registered in `backend/server.js`
4. Check if `backend/routes/settings.js` exists

### Getting 401 Unauthorized?
This is normal! The settings endpoint requires authentication.
- Make sure you're logged in
- Check that the auth token is being sent in the request headers

### Getting 500 Internal Server Error?
1. Check the server logs for the error message
2. Verify the database migration ran successfully:
   ```bash
   node backend/migrations/add-user-settings-table.js
   ```
3. Check if the `user_settings` table exists in the database

## Quick Test

Once the server is restarted, test the settings endpoint:

```bash
# Test without auth (should get 401)
curl http://localhost:3003/api/settings

# Test with auth (replace TOKEN with your actual token)
curl -H "Authorization: Bearer TOKEN" http://localhost:3003/api/settings
```

Expected responses:
- **Without auth**: `{"error":"No token provided"}` or `{"error":"Invalid token"}`
- **With auth**: `{"selectedPattern":"Two Lines","betAmount":10,"houseCutPercentage":10,...}`
