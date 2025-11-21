# Netlify Backend Deployment Guide

## Prerequisites
- Netlify account (https://www.netlify.com/)
- PostgreSQL database (hosted externally, e.g., Supabase, Railway, or Neon)
- Git repository

## Deployment Steps

### 1. Install Netlify CLI (Optional)
```bash
npm install -g netlify-cli
```

### 2. Prepare Your Backend
The backend has been configured for Netlify Functions deployment with:
- `netlify.toml` - Netlify configuration
- `netlify/functions/api.js` - Serverless function wrapper
- Updated `package.json` with `serverless-http` dependency

### 3. Deploy via Netlify Dashboard

#### Option A: Connect Git Repository
1. Go to https://app.netlify.com/
2. Click "Add new site" → "Import an existing project"
3. Connect your Git provider (GitHub, GitLab, Bitbucket)
4. Select your repository
5. Configure build settings:
   - **Base directory**: `backend`
   - **Build command**: `npm install`
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`

#### Option B: Deploy via CLI
```bash
cd backend
netlify deploy --prod
```

### 4. Configure Environment Variables
In Netlify Dashboard → Site settings → Environment variables, add:

```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.netlify.app
PORT=3003
```

### 5. Database Configuration
Ensure your PostgreSQL database is accessible from Netlify:
- Use a hosted PostgreSQL service (Supabase, Railway, Neon, etc.)
- Update connection string in environment variables
- Ensure database allows connections from Netlify IPs

### 6. Test Your Deployment
After deployment, test the health endpoint:
```bash
curl https://your-backend-site.netlify.app/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-11-21T...",
  "platform": "Netlify Functions"
}
```

### 7. Update Frontend Configuration
Update your frontend to point to the new backend URL:
- Change API base URL to: `https://your-backend-site.netlify.app`

## Important Notes

### Limitations
- **Cold starts**: Serverless functions may have cold start delays (1-3 seconds)
- **Execution time**: Netlify Functions have a 10-second timeout on free tier, 26 seconds on Pro
- **Stateless**: Each function invocation is stateless
- **File system**: Read-only file system (except /tmp)

### Recommendations
1. **Use external database**: Don't rely on local file storage
2. **Optimize cold starts**: Keep dependencies minimal
3. **Connection pooling**: Use connection pooling for database
4. **Caching**: Implement caching strategies for frequently accessed data
5. **Monitor**: Use Netlify Analytics and logs to monitor performance

### Alternative Hosting Options
If Netlify Functions don't meet your needs, consider:
- **Railway**: Full Node.js hosting with persistent storage
- **Render**: Free tier with persistent services
- **Heroku**: Traditional PaaS hosting
- **DigitalOcean App Platform**: Container-based hosting
- **AWS Lambda + API Gateway**: More control over serverless

## Troubleshooting

### Function timeout errors
- Optimize database queries
- Reduce dependencies
- Consider upgrading to Pro plan

### Database connection issues
- Check DATABASE_URL environment variable
- Verify database allows external connections
- Use connection pooling

### CORS errors
- Update FRONTEND_URL environment variable
- Check CORS configuration in api.js

## Monitoring
- View function logs: Netlify Dashboard → Functions → Logs
- Check function analytics: Netlify Dashboard → Functions → Analytics
- Set up error notifications in Netlify settings

## Rollback
If deployment fails:
1. Go to Netlify Dashboard → Deploys
2. Find previous successful deploy
3. Click "Publish deploy" to rollback
