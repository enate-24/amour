# Deployment Checklist - Fresh Start

## ✅ Pre-Deployment (Completed)
- [x] Code pushed to GitHub
- [x] Environment files updated
- [x] Backend configured for production

## 🚀 Render Deployment Steps

### Step 1: Create Fresh PostgreSQL Database
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Settings:
   - **Name**: `amour-bingo-fresh-db`
   - **Database**: `amour_bingo`
   - **User**: `amour_bingo_user`
   - **Plan**: Free or Starter
4. **Save the DATABASE_URL** (you'll need it for Step 2)

### Step 2: Create Backend Web Service
1. Click "New +" → "Web Service"
2. Connect GitHub: `enate-24/amour`
3. Settings:
   - **Name**: `amour-bingo-backend-fresh`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

### Step 3: Configure Environment Variables
Add these in the web service environment section:

```
NODE_ENV=production
PORT=10000
JWT_SECRET=bingo_auth_secret_key_2024_supernova_corp_production_key_xyz
JWT_EXPIRES_IN=604800
DATABASE_URL=[Paste your PostgreSQL URL from Step 1]
FRONTEND_URL=http://localhost:5173
DEFAULT_HOUSE_CUT=25
MAX_BET_AMOUNT=1000
MIN_BET_AMOUNT=10
DEMO_EMAIL=demo@bingo.com
DEMO_PASSWORD=demo123
```

### Step 4: Deploy and Test
1. Click "Create Web Service"
2. Wait for deployment
3. Test: `https://amour-bingo-backend.onrender.com/api/health`

### Step 5: Create Users
Once backend is live, create users:

**Admin User:**
```bash
curl -X POST "https://amour-bingo-backend.onrender.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@amour-bingo.com",
    "password": "admin123",
    "role": "admin"
  }'
```

**Tare.a2 User:**
```bash
curl -X POST "https://amour-bingo-backend.onrender.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Tare.a2",
    "email": "tare.a2@example.com",
    "password": "0934942672"
  }'
```

### Step 6: Update Frontend (Local)
Update `.env` with new backend URL:
```
VITE_API_URL=https://amour-bingo-backend.onrender.com/api
```

### Step 7: Test Local Frontend
1. Run frontend locally: `npm run dev`
2. Test login with Tare.a2 / 0934942672
3. Verify all functionality works

## 🎯 Current Status
- ✅ Environment files configured for local frontend
- ✅ Code ready for deployment
- ⏳ Waiting for Render backend deployment

## Next Action
**Go to Render Dashboard and start Step 1!**
Your frontend will run locally and connect to the fresh Render backend.