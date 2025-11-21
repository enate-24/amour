# 📦 Migrate Database from Local to Render - Complete Guide

This guide shows you how to copy all your data from your local `amour_bingo` database to your new Render database.

---

## 🎯 What You'll Do

1. **Export** all data from local database → Save to JSON file
2. **Import** JSON file → Upload to Render database

---

## 📋 Step-by-Step Instructions

### Step 1: Export Local Database (2 minutes)

This creates a backup file with all your data.

**Run this command in your terminal:**

```bash
cd backend
node export-database.js
```

**What happens:**
```
🔄 Starting database export...

✅ Exported 5 users
✅ Exported 23 games
✅ Exported 150 cartelas
✅ Exported 12 admin logs
✅ Exported 23 game analysis records
✅ Exported 8 sounds
✅ Exported 5 user settings

✅ Database exported successfully to: database-export-1732234567890.json
📦 Total records: 226
```

**Result:** You now have a file like `database-export-1732234567890.json` with all your data! ✅

---

### Step 2: Get Render Database URL (1 minute)

You need the connection URL for your Render database.

**Option A: From Render Dashboard**
1. Go to https://dashboard.render.com/
2. Click on your PostgreSQL database (`amour-bingo-db`)
3. Look for **"External Database URL"** (not Internal!)
4. Copy the entire URL (starts with `postgresql://`)

**Option B: From Your Web Service**
1. Go to your web service (`amour-bingo-backend`)
2. Click **"Environment"** tab
3. Find `DATABASE_URL` variable
4. Copy the value

**Example URL:**
```
postgresql://amour_bingo_user:abc123xyz@dpg-xxxxx-oregon-postgres.render.com:5432/amour_bingo
```

---

### Step 3: Import to Render Database (2 minutes)

Now upload your data to Render.

**Method A: Using Environment Variable (Recommended)**

1. Create a temporary `.env.render` file in the `backend` folder:

```bash
DATABASE_URL=postgresql://your-render-database-url-here
```

2. Run the import:

```bash
node import-database.js database-export-1732234567890.json
```

**Method B: Using Command Line**

Set the DATABASE_URL temporarily and run import:

**Windows (CMD):**
```cmd
set DATABASE_URL=postgresql://your-render-database-url-here
node import-database.js database-export-1732234567890.json
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://your-render-database-url-here"
node import-database.js database-export-1732234567890.json
```

**What happens:**
```
🔄 Starting database import...
📂 Reading export from: 2024-11-21T...

✅ Imported 5 users
✅ Imported 23 games
✅ Imported 150 cartelas
✅ Imported 12 admin logs
✅ Imported 23 game analysis records
✅ Imported 8 sounds
✅ Imported 5 user settings

✅ Database import completed successfully!
```

---

## ✅ Step 4: Verify Migration

Check if your data is in Render database:

### Option A: Using Render Shell
1. Go to your PostgreSQL database in Render
2. Click **"Connect"** → **"PSQL Command"**
3. Copy and run the command in your terminal
4. Run these queries:

```sql
-- Check users
SELECT COUNT(*) FROM users;

-- Check cartelas
SELECT COUNT(*) FROM cartelas;

-- Check games
SELECT COUNT(*) FROM games;

-- View some data
SELECT username, email, role FROM users LIMIT 5;
```

### Option B: Using pgAdmin or DBeaver
1. Install pgAdmin or DBeaver (free database tools)
2. Connect using the **External Database URL** from Render
3. Browse tables and verify data

---

## 🔄 Quick Migration Script

I'll create an automated script for you:

**File: `backend/migrate-to-render.js`**

```javascript
const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Database Migration Tool\n');
console.log('This will migrate your local database to Render.\n');

rl.question('Enter your Render DATABASE_URL: ', (databaseUrl) => {
  if (!databaseUrl.startsWith('postgresql://')) {
    console.error('❌ Invalid DATABASE_URL. Must start with postgresql://');
    rl.close();
    return;
  }

  console.log('\n📤 Step 1: Exporting local database...');
  
  exec('node export-database.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Export failed:', error);
      rl.close();
      return;
    }

    console.log(stdout);

    // Find the exported filename
    const match = stdout.match(/database-export-\d+\.json/);
    if (!match) {
      console.error('❌ Could not find export file');
      rl.close();
      return;
    }

    const filename = match[0];
    console.log(`\n📥 Step 2: Importing to Render database...`);

    // Set DATABASE_URL and import
    const importCmd = process.platform === 'win32'
      ? `set DATABASE_URL=${databaseUrl} && node import-database.js ${filename}`
      : `DATABASE_URL=${databaseUrl} node import-database.js ${filename}`;

    exec(importCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Import failed:', error);
        rl.close();
        return;
      }

      console.log(stdout);
      console.log('\n✅ Migration completed successfully!');
      console.log('\n🎉 Your data is now on Render!');
      rl.close();
    });
  });
});
```

---

## 🚀 Using the Automated Script

**Run this single command:**

```bash
cd backend
node migrate-to-render.js
```

**It will ask for your Render DATABASE_URL:**
```
🚀 Database Migration Tool

This will migrate your local database to Render.

Enter your Render DATABASE_URL: postgresql://...
```

**Paste your DATABASE_URL and press Enter. Done!** ✅

---

## 🆘 Troubleshooting

### Error: "Connection refused"
- Check DATABASE_URL is correct
- Make sure you're using **External Database URL** (not Internal)
- Verify database is running in Render

### Error: "Database does not exist"
- The database should be created automatically
- Or manually create: `CREATE DATABASE amour_bingo;`

### Error: "Permission denied"
- Check database user has write permissions
- Render databases should have full permissions by default

### Error: "Duplicate key"
- Data already exists in Render database
- Scripts use `ON CONFLICT DO NOTHING` to skip duplicates
- Safe to run multiple times

### Some data is missing
- Check export file has all data
- Verify import completed without errors
- Run verification queries to count records

---

## 📊 What Gets Migrated

✅ **Users** - All user accounts and profiles
✅ **Games** - All game history and data
✅ **Cartelas** - All bingo cards (this is what you need!)
✅ **Admin Logs** - Admin activity history
✅ **Game Analysis** - Game statistics and reports
✅ **Sounds** - Sound file references
✅ **User Settings** - User preferences

---

## 💡 Pro Tips

1. **Backup first**: Keep the export JSON file safe
2. **Test import**: Try importing to a test database first
3. **Schedule exports**: Export weekly for backups
4. **Clean old data**: Delete test data before exporting
5. **Verify counts**: Check record counts match before and after

---

## 🎯 Summary

**3 Simple Steps:**
1. `node export-database.js` → Creates backup file
2. Get DATABASE_URL from Render
3. `node import-database.js [filename]` → Uploads to Render

**Or use the automated script:**
```bash
node migrate-to-render.js
```

That's it! Your cartelas and all other data are now on Render! 🎉
