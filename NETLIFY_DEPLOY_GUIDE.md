# Deploy to Netlify from GitHub - Step by Step Guide

## Prerequisites ✅
- Your code is already pushed to GitHub: https://github.com/enate-24/amour.git
- You have a Netlify account (abebezewde21@gmail.com)

## Step-by-Step Deployment Instructions

### Option 1: Connect GitHub Repository (Recommended - Auto-Deploy)

#### Step 1: Go to Netlify
1. Open your browser and go to: **https://app.netlify.com/**
2. Log in with your account (abebezewde21@gmail.com)

#### Step 2: Add New Site
1. Click the **"Add new site"** button (top right)
2. Select **"Import an existing project"**

#### Step 3: Connect to GitHub
1. Click **"Deploy with GitHub"**
2. If prompted, authorize Netlify to access your GitHub account
3. You may need to click **"Configure the Netlify app on GitHub"** to grant access

#### Step 4: Select Your Repository
1. Search for **"amour"** or **"enate-24/amour"**
2. Click on your repository to select it

#### Step 5: Configure Build Settings
Enter these settings:

**Branch to deploy:**
```
main
```

**Build command:**
```
npm run build
```

**Publish directory:**
```
dist
```

**Environment variables:** (Click "Add environment variables")
- Variable: `VITE_API_URL`
- Value: `https://amour-bingo-backend.onrender.com/api`

#### Step 6: Deploy!
1. Click **"Deploy site"**
2. Wait 2-3 minutes for the build to complete
3. Your site will be live at a URL like: `https://random-name-123.netlify.app`

#### Step 7: (Optional) Change Site Name
1. Go to **Site settings** → **General** → **Site details**
2. Click **"Change site name"**
3. Enter a custom name like: `amour-bingo`
4. Your site will be at: `https://amour-bingo.netlify.app`

---

### Option 2: Manual Deploy (Quick but No Auto-Updates)

#### Step 1: Build Locally
Your build is already done! The `dist` folder contains your production files.

If you need to rebuild:
```bash
npm run build
```

#### Step 2: Go to Netlify
1. Open: **https://app.netlify.com/**
2. Log in with your account

#### Step 3: Manual Deploy
1. Click **"Add new site"** → **"Deploy manually"**
2. **Drag and drop** the entire `dist` folder from your project
3. Wait 30 seconds - Done! Your site is live!

**Note:** With manual deploy, you need to rebuild and re-upload every time you make changes.

---

## After Deployment

### Test Your Site
Once deployed, test these pages:
- ✅ Login page: `https://your-site.netlify.app/`
- ✅ Dashboard: `https://your-site.netlify.app/dashboard`
- ✅ Game page: `https://your-site.netlify.app/game`
- ✅ Admin panel: `https://your-site.netlify.app/backoffice/dashboard`

### Update Backend CORS (Important!)
After getting your Netlify URL, update your backend to allow requests from it:

1. Go to your Render backend dashboard
2. Add your Netlify URL to the CORS allowed origins
3. Example: `https://amour-bingo.netlify.app`

---

## Automatic Deployments (Option 1 Only)

If you chose **Option 1 (GitHub connection)**:
- Every time you push to GitHub, Netlify automatically rebuilds and deploys
- You'll get email notifications when deployments succeed or fail
- You can see build logs in the Netlify dashboard

**To trigger a new deployment:**
```bash
git add .
git commit -m "Your changes"
git push origin main
```

Netlify will automatically detect the push and deploy!

---

## Troubleshooting

### Build Fails
- Check the build logs in Netlify dashboard
- Make sure `package.json` has all dependencies
- Verify Node version is 18 (set in netlify.toml)

### Site Shows Blank Page
- Check browser console for errors
- Verify `VITE_API_URL` environment variable is set correctly
- Make sure backend CORS allows your Netlify domain

### API Calls Fail
- Verify backend is running: https://amour-bingo-backend.onrender.com/api/health
- Check CORS settings on backend
- Verify `VITE_API_URL` in Netlify environment variables

---

## Your Current Setup

**Frontend (Netlify):**
- Repository: https://github.com/enate-24/amour.git
- Branch: main
- Build command: `npm run build`
- Publish directory: `dist`

**Backend (Render):**
- URL: https://amour-bingo-backend.onrender.com
- API: https://amour-bingo-backend.onrender.com/api

**Latest Changes Pushed:**
- ✅ User dashboard filtering (users only see their own data)
- ✅ Sound optimization (no more lag)

---

## Quick Reference

**Netlify Dashboard:** https://app.netlify.com/
**Your GitHub Repo:** https://github.com/enate-24/amour
**Backend API:** https://amour-bingo-backend.onrender.com/api

Need help? Check the Netlify docs: https://docs.netlify.com/
