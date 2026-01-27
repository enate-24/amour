# 🚀 Aiven PostgreSQL Database Setup Guide

This guide will help you set up your bingo game application with Aiven PostgreSQL database.

## Prerequisites

- Aiven account (sign up at [aiven.io](https://aiven.io) for $300 free credits)
- Node.js installed locally
- Your bingo game application code

## Step 1: Create Aiven PostgreSQL Service

1. **Login to Aiven Console**
   - Go to [console.aiven.io](https://console.aiven.io)
   - Login with your credentials

2. **Create New Service**
   - Click "Create Service"
   - Select "PostgreSQL"
   - Choose your preferred cloud provider (AWS/GCP/Azure)
   - Select region closest to your users
   - Choose plan:
     - **Development**: Startup-4 (1 CPU, 1GB RAM) - $19/month
     - **Production**: Business-4 (2 CPU, 4GB RAM) - $69/month

3. **Configure Service**
   - Service name: `bingo-game-db` (or your preferred name)
   - Leave other settings as default
   - Click "Create Service"

4. **Wait for Service to Start** (5-10 minutes)

## Step 2: Get Connection Details

Once your service is running:

1. **Go to Service Overview**
2. **Copy Connection Information**:
   - Host: `your-service-name.aivencloud.com`
   - Port: `12345` (custom port assigned by Aiven)
   - Database: `defaultdb`
   - Username: `avnadmin`
   - Password: `[generated-password]`

3. **Get Connection URI**:
   ```
   postgresql://avnadmin:[password]@[host]:[port]/defaultdb?sslmode=require
   ```

## Step 3: Configure Your Application

1. **Update Environment Variables**
   
   Edit `backend/.env` file:
   ```bash
   # Replace with your actual Aiven connection details
   DATABASE_URL=postgresql://avnadmin:YOUR_PASSWORD@YOUR_SERVICE_NAME.aivencloud.com:YOUR_PORT/defaultdb?sslmode=require
   
   # Other required variables
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=10000
   NODE_ENV=production
   ```

2. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

## Step 4: Setup Database Schema

Run the automated setup script:

```bash
cd backend
npm run setup-aiven
```

This script will:
- ✅ Test database connection
- ✅ Create all required tables
- ✅ Add performance indexes
- ✅ Create demo admin user
- ✅ Verify setup completion

## Step 5: Verify Setup

1. **Check Database Connection**
   ```bash
   npm run health
   ```

2. **Start Your Application**
   ```bash
   npm start
   ```

3. **Test Admin Login**
   - Email: `demo@bingo.com`
   - Password: `demo123`

## Step 6: Production Configuration

### Security Settings

1. **Enable IP Whitelisting** (Optional but recommended)
   - Go to Aiven Console → Your Service → Security
   - Add your server's IP addresses

2. **Update JWT Secret**
   ```bash
   # Generate a strong JWT secret
   JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Configure SSL**
   - Aiven enforces SSL by default
   - Your connection string should include `?sslmode=require`

### Performance Optimization

1. **Connection Pooling** (Already configured)
   - Max connections: 3 (for Startup plan)
   - Connection timeout: 30 seconds
   - SSL enabled

2. **Database Indexes** (Already created)
   - User lookups optimized
   - Game queries optimized
   - Admin logs indexed

## Troubleshooting

### Connection Issues

1. **"Connection refused" error**
   - Verify service is running in Aiven console
   - Check connection string format
   - Ensure SSL is enabled (`?sslmode=require`)

2. **"Authentication failed" error**
   - Double-check username/password
   - Verify connection string encoding

3. **"Timeout" errors**
   - Check your internet connection
   - Verify Aiven service region
   - Consider IP whitelisting

### Database Issues

1. **"Table does not exist" error**
   - Run setup script: `npm run setup-aiven`
   - Check migration logs

2. **"Permission denied" error**
   - Verify user has correct permissions
   - Check database name in connection string

### Performance Issues

1. **Slow queries**
   - Check Aiven console for query performance
   - Consider upgrading to higher plan
   - Review database indexes

2. **Connection pool exhausted**
   - Reduce max connections in config
   - Implement connection retry logic
   - Monitor connection usage

## Monitoring & Maintenance

### Aiven Console Features

1. **Metrics Dashboard**
   - CPU, Memory, Disk usage
   - Connection count
   - Query performance

2. **Logs**
   - PostgreSQL logs
   - Connection logs
   - Error logs

3. **Backups**
   - Automatic daily backups
   - Point-in-time recovery
   - Manual backup creation

### Recommended Monitoring

1. **Set up Alerts**
   - High CPU usage (>80%)
   - High connection count (>80% of limit)
   - Disk space usage (>80%)

2. **Regular Maintenance**
   - Monitor slow queries
   - Review connection patterns
   - Update passwords regularly

## Migration from Other Databases

If migrating from another PostgreSQL database:

1. **Export Data**
   ```bash
   pg_dump $OLD_DATABASE_URL > backup.sql
   ```

2. **Import to Aiven**
   ```bash
   psql $AIVEN_DATABASE_URL < backup.sql
   ```

3. **Verify Migration**
   ```bash
   npm run setup-aiven
   ```

## Cost Optimization

1. **Choose Right Plan**
   - Startup-4: Development/small production
   - Business-4: Medium production
   - Premium: High-traffic production

2. **Monitor Usage**
   - Check connection count
   - Monitor storage usage
   - Review backup retention

3. **Scaling Strategy**
   - Start small, scale up as needed
   - Use read replicas for read-heavy workloads
   - Consider connection pooling optimization

## Support

- **Aiven Support**: Available through console
- **Documentation**: [docs.aiven.io](https://docs.aiven.io)
- **Community**: [community.aiven.io](https://community.aiven.io)

---

## Quick Reference

### Connection String Format
```
postgresql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require
```

### Essential Commands
```bash
# Setup database
npm run setup-aiven

# Run migrations
npm run migrate

# Start application
npm start

# Health check
npm run health
```

### Default Credentials
- **Admin Email**: demo@bingo.com
- **Admin Password**: demo123
- **Database**: defaultdb
- **Username**: avnadmin

---

**🎉 Your Aiven PostgreSQL database is now ready for your bingo game application!**