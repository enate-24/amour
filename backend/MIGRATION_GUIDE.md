# SQLite to PostgreSQL Migration Guide

## 🎯 Migration Overview

This guide will help you migrate your Bingo game database from SQLite to PostgreSQL while preserving all your existing data.

### 📊 Current Data Status
- ✅ 8 users
- ✅ 3 games
- ✅ 1,110 cartelas
- ✅ 93 admin logs

## 🚀 Migration Steps

### Step 1: Install PostgreSQL

**Windows:**
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Note down the password you set during installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

### Step 2: Configure Database Connection

1. Copy the environment template:
```bash
cd backend
cp .env.postgres .env
```

2. Edit the `.env` file with your PostgreSQL credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bingo_game
DB_USER=postgres
DB_PASSWORD=your_actual_password
```

### Step 3: Run Migration Scripts

1. **Export SQLite data** (already completed):
```bash
node migrate-data.js
```

2. **Setup PostgreSQL database**:
```bash
node setup-postgres.js
```

### Step 4: Test the Migration

1. **Test database connection**:
```bash
node test-postgres-connection.js
```

2. **Test game operations**:
```bash
node test-game-operations.js
```

## 🔧 Troubleshooting

### Common Issues

**"password authentication failed"**
- Ensure your password in `.env` is correct
- Check if PostgreSQL is running: `sudo systemctl status postgresql`

**"Connection refused"**
- Ensure PostgreSQL server is running
- Check if the host/port settings are correct

**"permission denied for database"**
- Grant privileges: `GRANT ALL PRIVILEGES ON DATABASE bingo_game TO your_user;`

### Manual Database Setup (if needed)

If the automated script fails, you can manually create the database:

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database and user
CREATE DATABASE bingo_game;
CREATE USER bingo_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE bingo_game TO bingo_user;

-- Exit psql
\q

-- Run schema
psql -U bingo_user -d bingo_game -f db/postgres-schema.sql

-- Import data (run each file)
psql -U bingo_user -d bingo_game -f migration-data/users-inserts.sql
psql -U bingo_user -d bingo_game -f migration-data/games-inserts.sql
psql -U bingo_user -d bingo_game -f migration-data/cartelas-inserts.sql
psql -U bingo_user -d bingo_game -f migration-data/admin_logs-inserts.sql
```

## ✅ Verification

After migration, verify:

1. **Data integrity**:
```bash
node verify-migration.js
```

2. **Application functionality**:
- Start your backend server
- Test game creation
- Test user authentication
- Test cartela operations

3. **Performance**:
- Monitor query performance
- Check connection pool usage

## 🔄 Rollback (if needed)

To rollback to SQLite:

1. Remove or rename `.env`
2. Restart your application
3. The system will automatically use SQLite again

## 📈 Benefits of PostgreSQL

- **Better Performance**: Handles concurrent connections better
- **Advanced Features**: JSONB support, arrays, full-text search
- **Scalability**: Better for growing applications
- **Reliability**: ACID compliance, better data integrity
- **Backup/Recovery**: More robust backup options

## 🎉 Next Steps

After successful migration:

1. Monitor application performance
2. Set up regular PostgreSQL backups
3. Consider PostgreSQL-specific optimizations
4. Update your deployment configuration

---

**Need help?** Check the troubleshooting section or create an issue with the error message you're seeing.
