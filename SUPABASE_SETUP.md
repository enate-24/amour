# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details and wait for it to be created

## 2. Get Your Project Credentials

1. Go to your project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (looks like `https://your-project-id.supabase.co`)
   - **anon/public key**

## 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values:
   ```env
   VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   ```

## 4. Verify Database Tables

Make sure your Supabase database has the required tables. Based on your migrations, you should have:

- `cartelas` table with columns: `id`, `card_id`, `numbers`, `is_winner`, `winning_pattern`, `created_at`
- `user_profiles` table
- `games` table
- `game_sessions` table
- `game_settings` table
- `admin_logs` table

## 5. Run the Application

```bash
npm run dev
```

## Troubleshooting

### Common Issues:

1. **"Missing Supabase environment variables"**
   - Make sure you've created the `.env` file with correct values
   - Check that the file is not in `.gitignore`

2. **"Error connecting to database"**
   - Verify your Supabase URL and anon key are correct
   - Make sure your Supabase project is active (not paused)

3. **"No cartelas found"**
   - Run the database migrations to populate the cartelas table
   - Check if the data was inserted correctly

4. **CORS errors**
   - Make sure your Supabase project allows your development URL
   - Go to Settings → API → CORS and add your development URL

### Database Migrations

If you need to run migrations:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run your migration files in order:
   - `20250827055551_jolly_prism.sql`
   - `20250929233400_add_bingo_cards_to_cartelas.sql`

## Support

If you continue to have issues:
1. Check the browser console for detailed error messages
2. Verify your Supabase project settings
3. Make sure all environment variables are correctly set
