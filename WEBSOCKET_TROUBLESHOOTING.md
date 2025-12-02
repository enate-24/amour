# WebSocket Troubleshooting Guide

## Common Issues and Solutions

### Issue: WebSocket connection failed

**Error Message:**
```
WebSocket connection to 'ws://localhost:3003/socket.io/?EIO=4&transport=websocket' failed
```

**Causes:**
1. Backend server not running
2. Wrong port configuration
3. Missing authentication token
4. CORS configuration issue

---

## Solution 1: Check Backend Server

### Verify Backend is Running
```bash
cd backend
npm start
```

**Expected Output:**
```
🔌 WebSocket server initialized
🚀 Bingo Backend Server running on port 10000
✅ Database initialized successfully
```

### Check Port
Your backend runs on port **10000** (configured in `backend/.env`)

---

## Solution 2: Configure Frontend for Local Development

### Option A: Use .env.local (Recommended)
Create `.env.local` file in project root:
```env
VITE_API_URL=http://localhost:10000/api
VITE_WS_URL=http://localhost:10000
VITE_CDN_ENABLED=false
```

### Option B: Update .env
Temporarily change `.env`:
```env
VITE_API_URL=http://localhost:10000/api
VITE_WS_URL=http://localhost:10000
```

**Note:** `.env.local` takes precedence over `.env` and is gitignored

---

## Solution 3: Restart Frontend

After updating environment variables:
```bash
# Stop frontend (Ctrl+C)
# Start again
npm run dev
```

**Vite requires restart to pick up .env changes**

---

## Solution 4: Check Authentication

WebSocket requires authentication token:

1. Open browser DevTools → Application → Local Storage
2. Check for `auth_token` key
3. If missing, login again

---

## Solution 5: Verify WebSocket Connection

### Browser Console
Look for these messages:
```
✅ WebSocket connected: <socket-id>
🔌 Connecting to WebSocket: http://localhost:10000
```

### Backend Logs
Look for:
```
✅ User connected: <username> (<socket-id>)
```

---

## Quick Fix Checklist

- [ ] Backend server is running (`cd backend && npm start`)
- [ ] Backend shows "WebSocket server initialized"
- [ ] Frontend .env.local has correct URLs
- [ ] Frontend restarted after .env changes
- [ ] Auth token exists in localStorage
- [ ] Browser console shows WebSocket connected

---

## Development vs Production

### Development (Local)
```env
# .env.local
VITE_API_URL=http://localhost:10000/api
VITE_WS_URL=http://localhost:10000
```

### Production (Deployed)
```env
# .env
VITE_API_URL=https://your-backend.com/api
VITE_WS_URL=wss://your-backend.com
```

**Note:** WebSocket uses `ws://` for HTTP and `wss://` for HTTPS

---

## Testing WebSocket

### 1. Start Backend
```bash
cd backend
npm start
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Open Browser
Navigate to `http://localhost:5173`

### 4. Check Console
Should see:
```
🔌 Connecting to WebSocket: http://localhost:10000
✅ WebSocket connected: abc123
```

### 5. Test Real-time Updates
1. Login to the app
2. Start a game
3. Call a number
4. Check console for: `🔔 WebSocket: Number called: X`

---

## Advanced Debugging

### Check Network Tab
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for socket.io connection
4. Check status (should be 101 Switching Protocols)

### Check Backend Logs
```bash
cd backend
npm start
# Watch for connection messages
```

### Test Backend Directly
```bash
curl http://localhost:10000/api/health
# Should return: {"status":"OK",...}
```

---

## Port Configuration

### Backend Port
Configured in `backend/.env`:
```env
PORT=10000
```

### Frontend WebSocket URL
Configured in `.env.local`:
```env
VITE_WS_URL=http://localhost:10000
```

**Important:** Ports must match!

---

## CORS Issues

If you see CORS errors:

### Backend Configuration
Check `backend/.env`:
```env
FRONTEND_URL=http://localhost:5173
```

### Multiple Frontend Ports
If using different ports:
```env
FRONTEND_URLS=http://localhost:5173,http://localhost:5174
```

---

## Firewall Issues

If WebSocket still fails:

### Windows Firewall
```powershell
# Allow Node.js through firewall
netsh advfirewall firewall add rule name="Node.js" dir=in action=allow program="C:\Program Files\nodejs\node.exe"
```

### Check Port Availability
```bash
netstat -ano | findstr :10000
```

---

## Environment Variables Priority

Vite loads environment variables in this order:
1. `.env.local` (highest priority, gitignored)
2. `.env.development` (development mode)
3. `.env.production` (production mode)
4. `.env` (lowest priority)

**Recommendation:** Use `.env.local` for local development

---

## Still Not Working?

### 1. Clean Restart
```bash
# Stop all servers
# Clear browser cache
# Delete node_modules
rm -rf node_modules
npm install

# Start backend
cd backend
npm start

# Start frontend (new terminal)
npm run dev
```

### 2. Check Logs
- Backend console output
- Browser console (F12)
- Network tab (WebSocket section)

### 3. Verify Configuration
```bash
# Backend
cat backend/.env | grep PORT

# Frontend
cat .env.local | grep VITE_WS_URL
```

---

## Production Deployment

### Backend
Ensure WebSocket is enabled:
```javascript
// backend/server.js
const { initializeWebSocket } = require('./websocket');
initializeWebSocket(server);
```

### Frontend
Set production WebSocket URL:
```env
VITE_WS_URL=wss://your-backend.com
```

### Netlify/Vercel
WebSocket works automatically with proper backend URL

---

## Summary

**Most Common Fix:**
1. Create `.env.local` with correct URLs
2. Restart frontend
3. Ensure backend is running

**Quick Test:**
```bash
# Terminal 1
cd backend && npm start

# Terminal 2
npm run dev

# Browser
Open http://localhost:5173
Check console for "✅ WebSocket connected"
```

---

## Need More Help?

1. Check `WEBSOCKET_IMPLEMENTATION.md` for setup details
2. Check `QUICK_START.md` for getting started
3. Review backend logs for error messages
4. Check browser console for connection errors
