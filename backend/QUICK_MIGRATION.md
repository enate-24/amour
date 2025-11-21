# ⚡ Quick Migration - 3 Commands

## Copy All Data from Local to Render Database

### Method 1: Automated (Easiest) ⭐

**One command does everything:**

```bash
cd backend
node migrate-to-render.js
```

When asked, paste your Render DATABASE_URL and press Enter. Done! ✅

---

### Method 2: Manual (Step by Step)

**Step 1: Export local database**
```bash
cd backend
node export-database.js
```
✅ Creates file: `database-export-1234567890.json`

**Step 2: Import to Render**

**Windows CMD:**
```cmd
set DATABASE_URL=your-render-database-url-here
node import-database.js database-export-1234567890.json
```

**Windows PowerShell:**
```powershell
$env:DATABASE_URL="your-render-database-url-here"
node import-database.js database-export-1234567890.json
```

✅ All data copied to Render!

---

## Where to Get DATABASE_URL?

1. Go to https://dashboard.render.com/
2. Click your PostgreSQL database
3. Copy **"External Database URL"**
4. Paste when asked

---

## What Gets Copied?

✅ All users
✅ All games
✅ **All cartelas** (your bingo cards!)
✅ All settings
✅ Everything!

---

## Verify It Worked

After migration, check your Render database:

```bash
# Connect to Render database
psql [your-database-url]

# Check cartelas count
SELECT COUNT(*) FROM cartelas;

# View some cartelas
SELECT card_id, numbers FROM cartelas LIMIT 5;
```

---

## That's It!

Your local database is now copied to Render. Your backend on Render will use this data automatically! 🎉
