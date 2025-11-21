/**
 * Database Manager - Initializes PostgreSQL database
 * Usage: node database-manager.js
 */

const { initializeDatabase } = require('./database');

async function initializeDatabaseManager() {
  console.log('🔄 Initializing PostgreSQL database...');

  try {
    await initializeDatabase();
    console.log('✅ PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    console.error('🔍 Please check your database configuration and credentials');
    process.exit(1);
  }
}

initializeDatabaseManager();
