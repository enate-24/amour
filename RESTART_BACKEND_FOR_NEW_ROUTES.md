# 🔄 Backend Server Restart Required

## Why?

The backend server was running **before** the new user management endpoints were added. Node.js doesn't automatically reload code changes, so the server needs to be restarted to load the new routes.

## Current Status

✅ **Server is running** on port 3003  
❌ **New endpoints are NOT loaded** (returning 404)

### Affected Endpoints:
- `PATCH /api/admin/users/:userId/password` - Update user password
- `PATCH /api/admin/users/:userId/ban` - Ban/unban user
- `DELETE /api/admin/users/:userId?hardDelete=true` - Enhanced delete with hard delete option

## How to Restart

### Step 1: Find the Backend Server Terminal
Look for a terminal window showing:
```
🚀 Bingo Backend Server running on port 3003
📊 Environment: development
🗄️ Using PostgreSQL database
```

### Step 2: Stop the Server
Press `Ctrl+C` in that terminal

### Step 3: Start the Server Again
```bash
cd backend
npm start
```

You should see:
```
🚀 Bingo Backend Server running on port 3003
📊 Environment: development
🗄️ Using PostgreSQL database
✅ Database initialized successfully
```

## Verify the Fix

### Option 1: Run the Test Script
```bash
node test-user-management-endpoints.cjs
```

**Expected output:**
```
✅ Server is running on port 3003
✅ Password endpoint exists (401 - auth required)
✅ Ban endpoint exists (401 - auth required)
✅ Delete endpoint exists (401 - auth required)
```

**If you see 404 errors**, the server still needs to be restarted.

### Option 2: Test from the UI
1. Open the admin dashboard
2. Go to User Management
3. Try clicking the Lock icon (update password)
4. Try clicking the Ban icon
5. Try clicking the Delete icon

If you get errors, check the browser console for 404 errors.

## Alternative: Use Nodemon for Auto-Restart

To avoid manual restarts in the future:

### Install nodemon
```bash
cd backend
npm install --save-dev nodemon
```

### Update package.json
Add to the "scripts" section:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### Run with nodemon
```bash
npm run dev
```

Now the server will automatically restart when you make code changes!

## Troubleshooting

### "Cannot find terminal with backend server"
The server might have crashed or been closed. Just start it fresh:
```bash
cd backend
npm start
```

### "Port 3003 is already in use"
Another process is using the port. Find and kill it:

**Windows:**
```bash
netstat -ano | findstr :3003
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
lsof -ti:3003 | xargs kill -9
```

Then start the server again.

### Still getting 404 after restart?
1. Make sure you're in the correct directory
2. Check that `backend/routes/admin.js` has the new endpoints
3. Verify the file was saved (check the timestamp)
4. Try clearing Node's cache:
   ```bash
   cd backend
   rm -rf node_modules/.cache
   npm start
   ```

## What Changed?

The following routes were added to `backend/routes/admin.js`:

1. **Enhanced Delete User** (line ~620)
   - Supports `?hardDelete=true` query parameter
   - Permanently deletes user and all associated data

2. **Update Password** (line ~680)
   - `PATCH /api/admin/users/:userId/password`
   - Requires `{ "newPassword": "string" }` in body

3. **Ban/Unban User** (line ~720)
   - `PATCH /api/admin/users/:userId/ban`
   - Requires `{ "banned": boolean }` in body

These routes are registered in the Express router but won't be available until the server restarts.

## Quick Reference

| Action | Command |
|--------|---------|
| Stop server | `Ctrl+C` in backend terminal |
| Start server | `cd backend && npm start` |
| Test endpoints | `node test-user-management-endpoints.cjs` |
| Use auto-restart | `cd backend && npm run dev` (after installing nodemon) |

---

**Once restarted, all user management features will work correctly! 🎉**
