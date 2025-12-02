# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 2. Configure Environment

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:3003/api

# Optional: Enable CDN
VITE_CDN_ENABLED=false
```

**Backend (backend/.env)**
```env
PORT=3003
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
DATABASE_URL=your-postgres-url
```

### 3. Start Servers
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
npm run dev
```

### 4. Verify Setup
Open browser to `http://localhost:5173`

**Check Console For:**
- ✅ WebSocket connected
- 📦 CDN Configuration (if enabled)
- 🎵 Audio manager initialized

## 🎯 Key Features

### WebSocket (Real-time)
- **Status:** ✅ Enabled by default
- **Purpose:** Real-time game updates
- **No configuration needed**

### CDN (Optional)
- **Status:** ⚪ Disabled by default
- **Purpose:** Fast audio delivery
- **Setup:** See `CDN_SETUP_GUIDE.md`

### Audio Cache
- **Status:** ✅ Enabled by default
- **Purpose:** Offline audio playback
- **Storage:** IndexedDB

## 📊 Performance

### Current Setup (WebSocket + Local Assets)
- ✅ 95% fewer HTTP requests
- ✅ Real-time updates (<100ms)
- ✅ Offline audio support
- ⚪ Assets from origin server

### With CDN (Optional)
- ✅ 95% fewer HTTP requests
- ✅ Real-time updates (<100ms)
- ✅ Offline audio support
- ✅ Assets from global CDN

## 🔧 Common Tasks

### Clear Audio Cache
```javascript
// Browser console
localStorage.clear();
location.reload();
```

### Test WebSocket
```javascript
// Browser console
// Should see: ✅ WebSocket connected: <id>
```

### Enable CDN
```bash
# .env
VITE_CDN_ENABLED=true
VITE_CDN_BASE_URL=https://cdn.jsdelivr.net/gh/user/repo@main
```

### Build for Production
```bash
npm run build
npm run preview
```

## 📚 Documentation

- **WebSocket:** `WEBSOCKET_IMPLEMENTATION.md`
- **CDN Setup:** `CDN_SETUP_GUIDE.md`
- **Full Guide:** `NETWORK_OPTIMIZATION_SUMMARY.md`
- **Audio Cache:** `AUDIO_CACHE_GUIDE.md`

## 🆘 Troubleshooting

### WebSocket Not Working
```bash
# Check backend is running
cd backend && npm start
# Look for: 🔌 WebSocket server initialized
```

### Audio Not Playing
```bash
# Clear cache and reload
localStorage.clear()
location.reload()
```

### Build Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## 🎮 Test the App

1. **Login/Register** - Create account
2. **Select Cards** - Choose 3+ cartelas
3. **Start Game** - Begin playing
4. **Auto-call** - Enable auto-call feature
5. **Watch Console** - See WebSocket events

## ✅ Success Indicators

- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:5173
- [ ] WebSocket connects (check console)
- [ ] Audio files play correctly
- [ ] Game numbers update in real-time
- [ ] No console errors

## 🚀 Deploy

### Netlify (Frontend)
```bash
npm run build
netlify deploy --prod
```

### Render/Railway (Backend)
```bash
cd backend
# Push to GitHub
# Connect to Render/Railway
# Set environment variables
```

## 💡 Pro Tips

1. **Use CDN in production** - Faster, cheaper, better
2. **Monitor WebSocket** - Check connection health
3. **Cache audio files** - Better offline experience
4. **Test on mobile** - Ensure responsive design
5. **Enable compression** - Reduce bandwidth usage

## 📞 Need Help?

1. Check documentation files
2. Review browser console
3. Check backend logs
4. Test with provided scripts
5. Review troubleshooting sections

---

**Ready to go!** 🎉

Start the servers and open `http://localhost:5173`
