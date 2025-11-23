# Frontend Deployment Instructions

## Your frontend is built and ready to deploy! ✅

The build was successful and your production files are in the `dist` folder.

## Option 1: Deploy via Netlify Web Interface (Recommended)

1. Go to https://app.netlify.com/
2. Log in with your account (abebezewde21@gmail.com)
3. Click "Add new site" → "Deploy manually"
4. **Drag and drop the `dist` folder** from your project
5. Your site will be deployed in seconds!

## Option 2: Deploy via Netlify CLI (Command Line)

Run these commands in your terminal:

```bash
# Link to existing site or create new one
netlify link

# When prompted, choose one of these options:
# - "Search by full or partial project name" (if you have an existing site)
# - "Create & configure a new site" (for a new site)

# Deploy to production
netlify deploy --dir=dist --prod
```

## Option 3: Connect to GitHub for Auto-Deploy

1. Push your code to GitHub (if not already done)
2. Go to https://app.netlify.com/
3. Click "Add new site" → "Import an existing project"
4. Connect to your GitHub repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Environment variables:** Add `VITE_API_URL=https://amour-bingo-backend.onrender.com/api`
6. Click "Deploy site"

Every time you push to GitHub, Netlify will automatically rebuild and deploy!

## Current Configuration

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Backend API:** https://amour-bingo-backend.onrender.com/api
- **Node version:** 18

## After Deployment

Once deployed, you'll get a URL like: `https://your-site-name.netlify.app`

Update your backend CORS settings to include this URL if needed.

## Verify Deployment

After deployment, test these pages:
- Login page
- Dashboard
- Game page
- Admin panel (if admin user)
