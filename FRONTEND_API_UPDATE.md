# 🔄 Frontend API Configuration Update

## ✅ Changes Made

I've updated your frontend to use environment variables instead of hardcoded localhost URLs.

### Files Updated:
- ✅ `.env` - Added VITE_API_URL configuration
- ✅ `.env.example` - Added example configuration
- ✅ `src/components/AdminUserManagement.tsx` - Replaced all localhost references

### All Other Files Already Configured:
- ✅ `src/lib/api.ts` - Already using environment variables
- ✅ `src/hooks/useAuth.ts` - Already using environment variables
- ✅ `src/hooks/useCartela.ts` - Already using environment variables
- ✅ All other components - Already using environment variables

---

## 🔧 How to Configure Your Backend URL

### Step 1: Update .env File

Edit your `.env` file in the root directory:

```bash
VITE_API_URL=https://your-backend-name.onrender.com/api
```

**Replace `your-backend-name` with your actual Render backend URL!**

### Step 2: Example URLs

**If your Render backend is deployed as:**
- `amour-bingo-backend.onrender.com`

**Then your .env should be:**
```bash
VITE_API_URL=https://amour-bingo-backend.onrender.com/api
```

---

## 🚀 How It Works

### Development (localhost):
```bash
# .env
VITE_API_URL=http://localhost:3003/api
```

### Production (Render):
```bash
# .env
VITE_API_URL=https://your-backend-name.onrender.com/api
```

### Fallback:
If `VITE_API_URL` is not set, it defaults to `/api` (relative path).

---

## 📋 Quick Setup Steps

### 1. Get Your Backend URL
1. Go to https://dashboard.render.com/
2. Click on your backend web service
3. Copy the URL (e.g., `https://amour-bingo-backend.onrender.com`)

### 2. Update .env File
```bash
VITE_API_URL=https://your-backend-url.onrender.com/api
```

### 3. Restart Development Server
```bash
npm run dev
```

### 4. Test API Connection
Open browser console and check for API calls. They should now go to your Render backend!

---

## 🔍 Verify It's Working

### Check Network Tab:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Use your app (login, view cartelas, etc.)
4. API calls should show your Render URL, not localhost

### Example API Calls:
```
✅ https://your-backend.onrender.com/api/auth/login
✅ https://your-backend.onrender.com/api/cartelas
✅ https://your-backend.onrender.com/api/dashboard
```

**Not:**
```
❌ http://localhost:3003/api/auth/login
```

---

## 🆘 Troubleshooting

### CORS Errors
If you get CORS errors, make sure your backend's `FRONTEND_URL` environment variable matches your frontend URL:

**Backend .env (on Render):**
```bash
FRONTEND_URL=https://your-frontend.netlify.app
```

### API Not Found (404)
- Check your backend is deployed and running
- Verify the URL in `.env` is correct
- Make sure URL ends with `/api`

### Connection Refused
- Backend might be sleeping (Render free tier)
- Wait 30-60 seconds for backend to wake up
- Check backend logs in Render dashboard

---

## 📝 Environment Variables Summary

### Frontend (.env):
```bash
VITE_API_URL=https://your-backend.onrender.com/api
```

### Backend (Render Environment Variables):
```bash
DATABASE_URL=postgresql://... (auto-generated)
JWT_SECRET=your-jwt-secret
NODE_ENV=production
FRONTEND_URL=https://your-frontend.netlify.app
```

---

## 🎯 Next Steps

1. ✅ Update `.env` with your Render backend URL
2. ✅ Restart development server: `npm run dev`
3. ✅ Test login and cartela loading
4. ✅ Deploy frontend to Netlify
5. ✅ Update backend `FRONTEND_URL` to match Netlify URL

Your frontend will now connect to your Render backend instead of localhost! 🎉