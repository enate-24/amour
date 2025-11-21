# Netlify Frontend Deployment Guide

## Quick Deploy Steps

### Option 1: Deploy via Netlify CLI (Recommended)

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize and Deploy**
   ```bash
   netlify init
   ```
   - Choose "Create & configure a new site"
   - Select your team
   - Enter a site name (or leave blank for random)
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Set Environment Variables**
   ```bash
   netlify env:set VITE_SUPABASE_URL "your-supabase-url"
   netlify env:set VITE_SUPABASE_ANON_KEY "your-supabase-anon-key"
   ```

5. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Option 2: Deploy via Netlify Dashboard

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com/
   - Click "Add new site" → "Import an existing project"

2. **Connect Your Repository**
   - Choose your Git provider (GitHub, GitLab, Bitbucket)
   - Select your repository
   - Authorize Netlify access

3. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click "Show advanced" → "New variable"

4. **Add Environment Variables**
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

5. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete

### Option 3: Drag & Drop Deploy

1. **Build Locally**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to https://app.netlify.com/drop
   - Drag and drop your `dist` folder
   - Note: You'll need to manually add environment variables in site settings

## Important Configuration

### Environment Variables Required
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Backend API Configuration
If your backend is deployed on Render, you'll need to update the API endpoint:

1. Create a `.env.production` file (or set in Netlify):
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```

2. Update your API calls to use this environment variable instead of localhost

## Post-Deployment Steps

1. **Test Your Deployment**
   - Visit your Netlify URL
   - Test login/signup functionality
   - Verify Supabase connection

2. **Configure Custom Domain (Optional)**
   - Go to Site settings → Domain management
   - Add your custom domain
   - Update DNS records as instructed

3. **Enable HTTPS**
   - Netlify automatically provisions SSL certificates
   - Ensure "Force HTTPS" is enabled in Site settings

## Continuous Deployment

Once connected to Git, Netlify will automatically:
- Deploy on every push to main branch
- Create preview deployments for pull requests
- Run build checks before deploying

## Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Verify all dependencies are in `package.json`
- Ensure environment variables are set correctly

### Environment Variables Not Working
- Make sure they start with `VITE_` prefix
- Redeploy after adding/changing variables
- Check they're set in Netlify dashboard under Site settings → Environment variables

### 404 Errors on Refresh
- The `netlify.toml` file handles this with redirects
- Ensure it's committed to your repository

## Useful Commands

```bash
# Check deployment status
netlify status

# Open site in browser
netlify open:site

# View build logs
netlify logs

# List environment variables
netlify env:list
```

## Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#netlify)
- [Environment Variables in Netlify](https://docs.netlify.com/environment-variables/overview/)
