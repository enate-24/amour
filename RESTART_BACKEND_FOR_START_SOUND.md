# Restart Backend for Start Sound

## Issue
The start sound is not playing because the backend server needs to be restarted to load the new `/api/sound/start` route.

## Solution

### Step 1: Stop the current backend server
If the backend is running, stop it by pressing `Ctrl+C` in the terminal where it's running.

### Step 2: Restart the backend server
```bash
cd backend
node server.js
```

Or if you want auto-restart on changes:
```bash
cd backend
npm run dev
```

### Step 3: Test the sound endpoint
After restarting, run this test:
```bash
node test-start-sound.cjs
```

You should see:
```
✅ Start sound endpoint is working!
```

### Step 4: Test in the app
1. Go to the New Game page
2. Select some cartelas
3. Click "Start Game"
4. You should hear the start sound play

## What was added
- New backend route: `GET /api/sound/start` in `backend/routes/sound.js`
- Frontend function: `playStartSound()` in `src/components/NewGame.tsx`
- The sound plays from: `backend/data/sound/men sound/start.wav`

## Debugging
If the sound still doesn't play, check the browser console for error messages. The logs will show:
- 🔊 Playing start sound from: [URL]
- ✅ Start sound loaded successfully
- ✅ Start sound playing

Or error messages if something went wrong.
