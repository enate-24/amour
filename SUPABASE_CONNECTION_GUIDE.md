# Supabase PostgreSQL Connection Setup Guide

## Issue: DNS Resolution Error

The current connection is failing because the database host `db.qvtherxzfgtgemrbdysw.supabase.co` cannot be resolved. This typically means:

1. **Supabase project is paused or doesn't exist**
2. **Incorrect connection string format**
3. **Missing or invalid credentials**

## Solution Steps

### Step 1: Verify Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Check if your project `qvtherxzfgtgemrbdysw` exists and is active
3. If the project is paused, click **Restore project** to reactivate it

### Step 2: Get Correct Connection Details

1. In your Supabase dashboard, go to **Settings** → **Database**
2. Copy the **Connection string** (not the API URL)
3. The connection string should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres
   postgresql://postgres:[YOUR_PASSWORD]@db.qvtherxzfgtgemrbdysw.supabase.co:5432/postgres
   ```

### Step 3: Update Environment Variables

Update your `.env` file with the correct values:

```env
# Replace these with your actual Supabase credentials
SUPABASE_DATABASE_URL=postgresql://postgres:your-actual-password@db.your-project-id.supabase.co:5432/postgres
SUPABASE_DB_HOST=db.your-project-id.supabase.co
SUPABASE_DB_PASSWORD=your-actual-password
```

### Step 4: Alternative Connection Methods

If direct connection still fails, you can use:

#### Option A: Use Supabase REST API
- Use the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Connect through Supabase client instead of direct PostgreSQL

#### Option B: Use Supabase Connection Pooling
- Go to **Settings** → **Database** → **Connection pooling**
- Enable connection pooling and use the pooled connection string

### Step 5: Test Connection

Once you've updated the credentials, run:
```bash
cd backend
node test-supabase-connection.js
```

## Common Issues and Solutions

### "Project Not Found"
- Verify the project ID in your Supabase dashboard
- Make sure you're logged into the correct account

### "Password Authentication Failed"
- Double-check your database password in Supabase dashboard
- Ensure you're using the service role key, not the anon key

### "SSL Connection Error"
- Make sure SSL is enabled in your connection config
- Supabase requires SSL for all connections

### "Connection Timeout"
- Check if your Supabase project is paused (free tier auto-pauses)
- Restore the project if it's paused

## Next Steps After Connection

Once the connection works, the system will:
1. ✅ Create all required tables (users, games, cartelas, admin_logs)
2. ✅ Set up proper indexes for performance
3. ✅ Configure foreign key relationships
4. ✅ Enable UUID extension

## Need Help?

If you're still having issues:
1. Check the Supabase status page for any outages
2. Verify your project settings in the Supabase dashboard
3. Ensure your IP is allowed (if you have RLS policies enabled)
4. Contact Supabase support if the project seems corrupted
