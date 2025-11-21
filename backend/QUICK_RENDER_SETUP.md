# 🚀 Quick Render Setup - 5 Minutes

## Step 1: Create Database (2 min)

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"PostgreSQL"**
3. Settings:
   ```
   Name: amour-bingo-db
   Database: amour_bingo
   Plan: Free
   ```
4. Click **"Create Database"**
5. ✅ Done! Copy the **Internal Database URL**

---

## Step 2: Deploy Backend (2 min)

1. Click **"New +"** → **"Web Service"**
2. Connect your Git repository
3. Settings:
   ```
   Name: amour-bingo-backend
   Root Directory: backend
   Build Command: npm install
   Start Command: npm start
   Plan: Free
   ```
4. Click **"Create Web Service"**

---

## Step 3: Add Environment Variables (1 min)

In your web service, go to **"Environment"** tab and add:

### Quick Copy-Paste:
```
DATABASE_URL
(Click "Add from Database" → Select amour-bingo-db)

JWT_SECRET
bingo_auth_secret_key_2024_supernova_corp_production_key_xyz

NODE_ENV
production

FRONTEND_URL
https://your-frontend.netlify.app

DEFAULT_HOUSE_CUT
25

MAX_BET_AMOUNT
1000

MIN_BET_AMOUNT
10
```

---

## Step 4: Deploy! ✅

Click **"Manual Deploy"** → **"Deploy latest commit"**

Wait 2-3 minutes for deployment...

---

## Step 5: Test Your Backend

Your backend URL will be: `https://amour-bingo-backend.onrender.com`

Test it:
```bash
curl https://amour-bingo-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-11-21T...",
  "uptime": 123.45
}
```

---

## ✅ You're Done!

Your backend is now live at:
```
https://amour-bingo-backend.onrender.com
```

Update your frontend to use this URL instead of `http://localhost:3003`

---

## 📝 Important Notes

1. **Free tier limitations:**
   - Backend spins down after 15 min inactivity
   - First request after sleep takes 30-60 seconds
   - Database expires after 90 days (upgrade to keep it)

2. **Keep it awake (optional):**
   - Use a service like UptimeRobot to ping your backend every 10 minutes
   - Or upgrade to paid plan ($7/month)

3. **Database backup:**
   - Export your database weekly
   - Command: `pg_dump [DATABASE_URL] > backup.sql`

---

## 🆘 Need Help?

Check the full guide: `RENDER_DATABASE_SETUP.md`
