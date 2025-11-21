# 🚀 Complete Render Deployment Guide

## Step-by-Step Deployment Process

### Phase 1: Export Your Local Database (5 minutes)

1. **Export your current database:**
   ```bash
   cd backend
   node export-database.js
   ```
   This creates a file like `database-export-1234567890.json` with all your data.

2. **Keep this file safe** - you'll upload it to Render later.

---

### Phase 2: Create Render Account & PostgreSQL Database (10 minutes)

1. **Sign up for Render:**
   - Go to https://render.com
   - Click "Get Started" and sign up (free)
   - Verify your email

2. **Create PostgreSQL Database:**
   - Click "New +" → "PostgreSQL"
   - Fill in:
     - **Name**: `bingo-database` (or any name)
     - **Database**: `bingogame`
     - **User**: `bingo_user` (auto-generated)
     - **Region**: Choose closest to you
     - **Plan**: **Free** (select this!)
   - Click "Create Database"

3. **Wait 2-3 minutes** for database to be ready

4. **Copy Database Connection Info:**
   - On your database page, find "Connections"
   - Copy the **Internal Database URL** (starts with `postgresql://`)
   - Save this - you'll need it!

---

### Phase 3: Deploy Backend to Render (10 minutes)

1. **Push your code to GitHub:**
   ```bash
   # In your project root
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Create Web Service on Render:**
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select your repository
   - Fill in:
     - **Name**: `bingo-backend` (or any name)
     - **Region**: Same as your database
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: **Free**

3. **Add Environment Variables:**
   Click "Advanced" → "Add Environment Variable" and add these:

   ```
   Key: DATABASE_URL
   Value: [paste the Internal Database URL from step 2.4]

   Key: JWT_SECRET
   Value: bingo_auth_secret_key_2024_supernova_corp_production_key_xyz

   Key: JWT_EXPIRES_IN
   Value: 604800

   Key: NODE_ENV
   Value: production

   Key: FRONTEND_URL
   Value: http://localhost:5173
   (You'll update this later with your actual frontend URL)

   Key: DEFAULT_HOUSE_CUT
   Value: 25

   Key: MAX_BET_AMOUNT
   Value: 1000

   Key: MIN_BET_AMOUNT
   Value: 10

   Key: DEMO_EMAIL
   Value: demo@bingo.com

   Key: DEMO_PASSWORD
   Value: demo123
   ```

4. **Click "Create Web Service"**

5. **Wait 5-10 minutes** for deployment to complete

6. **Your backend URL will be:** `https://bingo-backend.onrender.com` (or similar)

---

### Phase 4: Import Your Database (5 minutes)

1. **Connect to Render Shell:**
   - Go to your web service dashboard
   - Click "Shell" tab (top right)
   - Wait for shell to connect

2. **Upload your export file:**
   - In Render Shell, run:
   ```bash
   # First, you need to upload the file via the Render dashboard
   # Or use this method:
   ```

   **Alternative Method (Easier):**
   - Use Render's "Environment" tab
   - Add a temporary environment variable with your export data
   - Or use the import script directly with your local database

3. **Run import script:**
   ```bash
   node import-database.js database-export-1234567890.json
   ```

   **OR if you prefer, import directly from your local machine:**
   ```bash
   # On your local machine, set DATABASE_URL temporarily
   # Windows:
   set DATABASE_URL=postgresql://[your-render-database-url]
   node import-database.js database-export-1234567890.json

   # Mac/Linux:
   DATABASE_URL=postgresql://[your-render-database-url] node import-database.js database-export-1234567890.json
   ```

---

### Phase 5: Test Your Deployment (5 minutes)

1. **Test health endpoint:**
   ```bash
   curl https://your-backend-url.onrender.com/api/health
   ```

   Expected response:
   ```json
   {
     "status": "OK",
     "timestamp": "2024-11-21T...",
     "uptime": 123.45
   }
   ```

2. **Test login:**
   ```bash
   curl -X POST https://your-backend-url.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@bingo.com","password":"demo123"}'
   ```

3. **If tests pass:** ✅ Your backend is live!

---

### Phase 6: Update Frontend (2 minutes)

1. **Update your frontend API URL:**
   - Find where you define your API base URL (usually in a config file)
   - Change from `http://localhost:3003` to `https://your-backend-url.onrender.com`

2. **Update FRONTEND_URL on Render:**
   - Go to Render dashboard → Your web service → Environment
   - Update `FRONTEND_URL` to your actual frontend URL
   - Click "Save Changes" (this will redeploy)

---

## 🎯 Quick Reference

### Your Render URLs:
- **Backend**: `https://bingo-backend.onrender.com`
- **Database**: Internal URL (only accessible by your backend)

### Important Notes:

1. **Free Tier Limitations:**
   - Backend spins down after 15 minutes of inactivity
   - First request after spin-down takes 30-60 seconds
   - 750 hours/month free (enough for 24/7 if only one service)

2. **Database Backup:**
   - Run `node export-database.js` regularly to backup
   - Free tier: 1GB storage, 90-day retention

3. **Monitoring:**
   - View logs: Render Dashboard → Logs tab
   - Check metrics: Render Dashboard → Metrics tab

4. **Updating Code:**
   - Just push to GitHub
   - Render auto-deploys on every push

---

## 🔧 Troubleshooting

### Backend won't start:
- Check logs in Render dashboard
- Verify DATABASE_URL is correct
- Ensure all environment variables are set

### Database connection fails:
- Use **Internal Database URL** (not External)
- Check database is in same region as web service
- Verify DATABASE_URL format: `postgresql://user:pass@host:port/dbname`

### Import fails:
- Check export file exists and is valid JSON
- Verify DATABASE_URL is set correctly
- Run import from local machine if Render shell has issues

### 404 errors:
- Check your routes match the API calls
- Verify CORS settings allow your frontend domain

---

## 📞 Need Help?

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Check logs first - they usually show the issue!

---

## 🎉 Success Checklist

- [ ] Database created on Render
- [ ] Backend deployed to Render
- [ ] Environment variables configured
- [ ] Database imported successfully
- [ ] Health check passes
- [ ] Login test works
- [ ] Frontend updated with new backend URL
- [ ] FRONTEND_URL updated on Render

**Congratulations! Your backend is now live on Render! 🚀**
