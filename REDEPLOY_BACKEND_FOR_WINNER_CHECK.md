# Redeploy Backend for Winner Check Fix

## Issue
The winner-check endpoint is returning 400 error because the deployed backend on Render is running an old version that doesn't properly handle client-provided called numbers.

## Changes Made
Updated `backend/routes/winner-check.js` to:
1. Accept `calledNumbers` in the request body
2. Use client-provided called numbers when database has none
3. Allow checking cartelas even with 0 called numbers (just shows the card)

## Deployment Steps

### Option 1: Automatic Deployment (if connected to Git)
1. Commit the changes:
   ```bash
   git add backend/routes/winner-check.js
   git commit -m "Fix winner-check to accept client-provided called numbers"
   git push origin main
   ```

2. Render will automatically detect the changes and redeploy

### Option 2: Manual Deployment
1. Go to https://dashboard.render.com
2. Find your backend service (amour-bingo-backend)
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait for deployment to complete (usually 2-5 minutes)

### Option 3: Trigger Redeploy via Render Dashboard
1. Go to your service on Render
2. Click "Settings"
3. Scroll to "Build & Deploy"
4. Click "Clear build cache & deploy"

## Verification
After deployment, test the winner-check endpoint:
1. Go to game page
2. Enter a cartela ID
3. Click "Check"
4. Should now display the cartela card with called numbers highlighted

## What Was Fixed
- Backend now accepts `calledNumbers` array in request body
- Falls back to client-provided numbers when database has none
- Removes the "No numbers have been called" error
- Always returns cartela data with numbers for display

## Files Changed
- `backend/routes/winner-check.js` - Updated to handle client-provided called numbers
