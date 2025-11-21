# PostgreSQL Setup Guide

## Option 1: Install PostgreSQL Locally (Windows)

1. **Download PostgreSQL Installer**
   - Go to https://www.postgresql.org/download/windows/
   - Download the latest version for Windows

2. **Install PostgreSQL**
   - Run the installer
   - Choose default settings or customize as needed
   - Remember the password you set for the postgres user

3. **Verify Installation**
   ```bash
   # In Command Prompt or PowerShell
   psql --version
   ```

4. **Start PostgreSQL Service**
   - Open Services (services.msc)
   - Find "postgresql-x64-X.X" service
   - Start the service

5. **Create Database**
   ```bash
   createdb bingo_game
   ```

## Option 2: Use Docker (Recommended)

1. **Install Docker Desktop**
   - Download from https://www.docker.com/products/docker-desktop/
   - Install and start Docker Desktop

2. **Run PostgreSQL Container**
   ```bash
   docker run --name bingo-postgres -e POSTGRES_DB=bingo_game -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
   ```

3. **Verify Connection**
   ```bash
   docker exec -it bingo-postgres psql -U postgres -d bingo_game
   ```

## Option 3: Use Cloud PostgreSQL

- **Supabase** (Recommended for development)
  - Go to https://supabase.com
  - Create a free account and project
  - Get connection details from Settings > Database

- **Other options**: AWS RDS, Google Cloud SQL, Azure Database, etc.

## Environment Configuration

Update your `.env` file with the correct PostgreSQL connection details:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bingo_game
DB_USER=postgres
DB_PASSWORD=enate@2456
```

## Testing the Connection

Run the following command to test if the database connection works:

```bash
cd backend && node -e "
const { initializeDatabase } = require('./data/database-postgres');
initializeDatabase()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection failed:', err.message));
"
```

## Troubleshooting

1. **Connection Refused**
   - Make sure PostgreSQL service is running
   - Check if the port 5432 is available
   - Verify host and port settings

2. **Authentication Failed**
   - Check username and password
   - Ensure the user exists and has access to the database

3. **Database Does Not Exist**
   - Create the database: `createdb bingo_game`
   - Or update DB_NAME in .env file

## Fallback Option

If you prefer to continue with SQLite for now, you can revert the changes:

1. Update `backend/data/store.js` to use `./database-sqlite` instead of `./database-postgres`
2. The application will work with the existing SQLite setup

## Next Steps

Once PostgreSQL is set up and running:

1. Run `npm start` in the backend directory
2. The application will automatically create tables and insert demo data
3. Test the API endpoints to ensure everything works correctly
