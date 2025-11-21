# 🔗 How to Link Database to Backend on Render - Visual Guide

## What "Link Database" Means

When you create a database and a backend separately on Render, you need to **connect them together**. This means telling your backend "use this database".

---

## 📸 Step-by-Step with Visual Description

### Step 1: You Have Created Two Things

After following the setup, you should have:

1. ✅ **PostgreSQL Database** named `amour-bingo-db`
2. ✅ **Web Service** (your backend) named `amour-bingo-backend`

They exist separately and don't know about each other yet!

---

### Step 2: Go to Your Backend (Web Service)

1. In Render Dashboard, click on your **Web Service** (`amour-bingo-backend`)
2. You'll see tabs at the top:
   ```
   [Overview] [Events] [Logs] [Shell] [Environment] [Settings]
   ```
3. Click the **"Environment"** tab

---

### Step 3: You'll See Environment Variables Section

You'll see a page that looks like this:

```
┌─────────────────────────────────────────────────┐
│  Environment Variables                          │
│                                                 │
│  Add environment variables to configure your    │
│  service. Learn more →                          │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ [+ Add Environment Variable]              │  │
│  │ [+ Add from .env]                         │  │
│  │ [+ Add from Database]  ← CLICK THIS!      │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Key                    Value                   │
│  ─────────────────────────────────────────────  │
│  (empty - no variables yet)                     │
└─────────────────────────────────────────────────┘
```

---

### Step 4: Click "Add from Database"

When you click **"Add from Database"**, a popup appears:

```
┌─────────────────────────────────────────────────┐
│  Link Database                            [X]   │
│                                                 │
│  Select a database to link:                     │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ○ amour-bingo-db                         │  │
│  │   PostgreSQL · Free                      │  │
│  │   Created 2 minutes ago                  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  [Cancel]                    [Link Database]    │
└─────────────────────────────────────────────────┘
```

1. Select your database (`amour-bingo-db`)
2. Click **"Link Database"** button

---

### Step 5: DATABASE_URL is Automatically Added!

After clicking "Link Database", you'll see:

```
┌─────────────────────────────────────────────────┐
│  Environment Variables                          │
│                                                 │
│  Key                    Value                   │
│  ─────────────────────────────────────────────  │
│  DATABASE_URL          postgresql://user:pass@  │
│                        dpg-xxxxx.oregon-post... │
│                        [Hidden] [Edit] [Delete] │
│  ─────────────────────────────────────────────  │
│                                                 │
│  [+ Add Environment Variable]                   │
└─────────────────────────────────────────────────┘
```

✅ **Done!** The `DATABASE_URL` is now automatically set!

---

## 🎯 What Just Happened?

Render automatically:
1. Got the connection URL from your database
2. Added it as an environment variable called `DATABASE_URL`
3. Your backend can now connect to the database!

The `DATABASE_URL` looks like this:
```
postgresql://user:password@host.oregon-postgres.render.com:5432/amour_bingo
```

Your backend code reads this and connects to the database automatically!

---

## 🔄 Alternative: Manual Method

If you don't see "Add from Database" button, you can do it manually:

### Step 1: Get Database URL
1. Go to your **PostgreSQL Database** (`amour-bingo-db`)
2. Look for **"Internal Database URL"**
3. Copy the entire URL (starts with `postgresql://`)

### Step 2: Add Manually
1. Go back to your **Web Service** → **Environment** tab
2. Click **"+ Add Environment Variable"**
3. Enter:
   ```
   Key: DATABASE_URL
   Value: [paste the URL you copied]
   ```
4. Click **"Save Changes"**

---

## ✅ How to Verify It Worked

After linking, your backend will automatically redeploy. Check the logs:

1. Go to your Web Service → **"Logs"** tab
2. Look for these messages:
   ```
   ✅ Connected to PostgreSQL database
   ✅ Database initialized successfully
   🚀 Bingo Backend Server running on port 10000
   ```

If you see these, your database is connected! 🎉

---

## 🆘 Troubleshooting

### "Add from Database" button is missing
- Make sure you created a PostgreSQL database first
- Refresh the page
- Use the manual method instead

### Connection errors in logs
- Check DATABASE_URL is correct
- Verify database is running (green status)
- Check database allows connections (should be automatic)

### "Database does not exist" error
- Don't worry! The backend creates tables automatically
- Just wait for the initialization to complete

---

## 📝 Summary

**"Link Database"** = Tell your backend where to find the database

**How?** 
- Render adds `DATABASE_URL` environment variable
- Your code reads it and connects automatically

**That's it!** No complex configuration needed.
