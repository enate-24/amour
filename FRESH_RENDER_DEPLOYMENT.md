# Fresh Render Deployment Guide

## Overview
This guide will help you deploy the Amour Bingo application to Render from scratch with a clean database.

## Prerequisites
- GitHub repository with latest code (✅ Done)
- Render account
- Clean slate approach

## Step 1: Create New PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `amour-bingo-db-fresh`
   - **Database**: `amour_bingo`
   - **User**: `amour_bingo_user`
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 15 (recommended)
   - **Plan**: Free (for testing) or Starter ($7/month for production)

4. Click "Create Database"
5. **IMPORTANT**: Save the connection details:
   - Internal Database URL
   - External Database URL
   - PSQL Command

## Step 2: Create New Web Service on Render

1. In Render Dashboard, click "New +" → "Web Service"
2. Connect your GitHub repository: `enate-24/amour`
3. Configure:
   - **Name**: `amour-bingo-backend-fresh`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

## Step 3: Configure Environment Variables

In the web service settings, add these environment variables:

```
NODE_ENV=production
PORT=10000
JWT_SECRET=bingo_auth_secret_key_2024_supernova_corp_production_key_xyz
JWT_EXPIRES_IN=604800
DATABASE_URL=[Your PostgreSQL External Database URL from Step 1]
FRONTEND_URL=https://your-frontend-domain.netlify.app
DEFAULT_HOUSE_CUT=25
MAX_BET_AMOUNT=1000
MIN_BET_AMOUNT=10
```

## Step 4: Deploy Backend

1. Click "Create Web Service"
2. Wait for deployment to complete
3. Check logs for successful database connection
4. Test health endpoint: `https://amour-bingo-backend.onrender.com/api/health`

## Step 5: Create Admin User

Once backend is deployed, create the admin user:

```bash
curl -X POST "https://amour-bingo-backend.onrender.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "your-secure-password",
    "role": "admin"
  }'
```

## Step 6: Create Regular User (Tare.a2)

```bash
curl -X POST "https://amour-bingo-backend.onrender.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Tare.a2",
    "email": "tare.a2@example.com",
    "password": "0934942672"
  }'
```

## Step 7: Update Frontend Configuration

Update your `.env` file:

```
VITE_API_URL=https://amour-bingo-backend.onrender.com/api
```

## Step 8: Deploy Frontend to Netlify

1. Build the frontend: `npm run build`
2. Deploy to Netlify
3. Update FRONTEND_URL in Render environment variables

## Step 9: Test Complete System

1. Test backend health: `GET /api/health`
2. Test user login: `POST /api/auth/login`
3. Test frontend connection
4. Create a test game
5. Verify all functionality

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check database is running
- Ensure IP whitelist includes Render IPs

### Authentication Issues
- Verify JWT_SECRET is set
- Check user exists in database
- Verify password is correct

### CORS Issues
- Update FRONTEND_URL in backend environment
- Check CORS configuration in server.js

## Next Steps

After successful deployment:
1. Set up monitoring
2. Configure custom domain
3. Set up SSL certificates
4. Configure backup strategy
5. Set up logging and analytics

## Support

If you encounter issues:
1. Check Render logs
2. Verify environment variables
3. Test API endpoints individually
4. Check database connectivity