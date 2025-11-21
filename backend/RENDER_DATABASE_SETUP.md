# 🗄️ Connect Database to Render - Complete Guide

Your backend is already configured to work with Render! Here's how to set it up.

## 📋 Current Database Configuration

Your `backend/data/database.js` supports two connection methods:

### Method 1: Individual Parameters (Current Setup)
```javascript
DB_HOST=localhost
DB_PORT=5432
DB_NAME=amour_bingo
DB_USER=postgres
DB_PASSWORD=enate@2456
```

### Method 2: Single Connection URL (Render's Default)
```javascript
DATABASE_URL=postgresql://user:password@host:port/database
```

---

## 🚀 Option A: Use Render's PostgreSQL (Recommended - FREE)

### Step 1: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in:
   - **Name**: `amour-bingo-db`
   - **Database**: `amour_bingo`
   - **User**: (auto-generated)
   - **Region**: Choose closest to you
   - **PostgreSQL Version**: 16 (latest)
   - **Plan**: **Free** (1GB storage, expires after 90 days)
4. Click **"Create Database"**

### Step 2: Get Database Connection Details

After creation, Render shows:
- **Internal Database URL**: `postgresql://...` (use this!)
- **External Database URL**: For external tools
- **PSQL Command**: For command-line access

### Step 3: Update Backend Database Configuration

You need to modify `backend/data/database.js` to support `DATABASE_URL`:

**Add this at the top of the dbConfig section (line 19):**

```javascript
// PostgreSQL connection configuration
// Support both DATABASE_URL (Render) and individual params (local)
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
} : {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'amour_bingo',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

### Step 4: Deploy Backend to Render

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect your Git repository
4. Configure:
   - **Name**: `amour-bingo-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**

### Step 5: Add Environment Variables

In the Render dashboard for your web service, add these environment variables:

```
DATABASE_URL = [Copy from your PostgreSQL database "Internal Database URL"]
JWT_SECRET = bingo_auth_secret_key_2024_supernova_corp_production_key_xyz
JWT_EXPIRES_IN = 604800
NODE_ENV = production
FRONTEND_URL = https://your-frontend.netlify.app
DEFAULT_HOUSE_CUT = 25
MAX_BET_AMOUNT = 1000
MIN_BET_AMOUNT = 10
DEMO_EMAIL = demo@bingo.com
DEMO_PASSWORD = demo123
```

**Important:** The `DATABASE_URL` is automatically available if you link the database to your web service!

### Step 6: Link Database to Web Service (Easier Method)

Instead of copying DATABASE_URL manually:

1. In your web service settings, go to **"Environment"**
2. Scroll to **"Environment Variables"**
3. Click **"Add from Database"**
4. Select your `amour-bingo-db` database
5. Render automatically adds `DATABASE_URL`!

### Step 7: Migrate Your Local Data (Optional)

If you want to copy your local database to Render:

#### Export Local Database:
```bash
pg_dump -U postgres -d amour_bingo -f backup.sql
```

#### Import to Render:
```bash
psql [RENDER_EXTERNAL_DATABASE_URL] < backup.sql
```

Or use the PSQL command from Render dashboard:
```bash
psql -h [host] -U [user] -d amour_bingo -f backup.sql
```

---

## 🔧 Option B: Use External Database (Supabase, Neon, etc.)

If you prefer another PostgreSQL provider:

### Supabase (Free Tier)
1. Go to https://supabase.com/
2. Create new project
3. Get connection string from Settings → Database
4. Add to Render as `DATABASE_URL`

### Neon (Free Tier)
1. Go to https://neon.tech/
2. Create new project
3. Copy connection string
4. Add to Render as `DATABASE_URL`

---

## ✅ Verify Connection

After deployment, test your backend:

```bash
curl https://your-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-11-21T...",
  "uptime": 123.45
}
```

Check logs in Render dashboard:
```
✅ Connected to PostgreSQL database
✅ Database initialized successfully
🚀 Bingo Backend Server running on port 10000
```

---

## 🐛 Troubleshooting

### Error: "Connection refused"
- Check DATABASE_URL is correct
- Verify database is running
- Check SSL settings

### Error: "Database does not exist"
- Database will be created automatically by `createTables()`
- Or manually create: `CREATE DATABASE amour_bingo;`

### Error: "SSL required"
- Render requires SSL for PostgreSQL
- Already configured in the code above

### Error: "Too many connections"
- Reduce `max: 20` to `max: 5` in dbConfig
- Free tier has connection limits

---

## 📊 Database Management

### View Database in Render Dashboard:
1. Go to your PostgreSQL database
2. Click **"Connect"** → **"External Connection"**
3. Use any PostgreSQL client (pgAdmin, DBeaver, etc.)

### Run SQL Queries:
```bash
# From Render dashboard, click "Shell" or use:
psql [RENDER_EXTERNAL_DATABASE_URL]
```

### Backup Database:
```bash
pg_dump [RENDER_EXTERNAL_DATABASE_URL] > backup.sql
```

---

## 💰 Cost Comparison

| Provider | Free Tier | Storage | Limitations |
|----------|-----------|---------|-------------|
| **Render** | ✅ Yes | 1GB | Expires after 90 days |
| **Supabase** | ✅ Yes | 500MB | 2 projects max |
| **Neon** | ✅ Yes | 3GB | 1 project |
| **Railway** | ⚠️ $5 credit | Unlimited | Credit-based |

---

## 🎯 Recommended Setup

1. **Development**: Use local PostgreSQL (`amour_bingo` database)
2. **Production**: Use Render PostgreSQL (free tier)
3. **Backup**: Export weekly to local file

This gives you the best of both worlds: fast local development and free cloud hosting!
