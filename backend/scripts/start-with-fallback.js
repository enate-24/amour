#!/usr/bin/env node

/**
 * Server Startup Script with Database Fallback
 * Tries PostgreSQL first, falls back to SQLite if connection fails
 */

const { spawn } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testPostgreSQLConnection() {
  console.log('🔍 Testing PostgreSQL connection...');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ No DATABASE_URL found');
    return false;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    console.log('✅ PostgreSQL connection successful');
    return true;
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:', error.message);
    await pool.end();
    return false;
  }
}

async function setupSQLiteFallback() {
  console.log('🏠 Setting up SQLite fallback...');
  
  const localDbPath = path.join(__dirname, '../data/local.db');
  const localEnvPath = path.join(__dirname, '../.env.local');
  
  // Check if local database exists
  if (!fs.existsSync(localDbPath)) {
    console.log('📦 Local database not found, creating...');
    
    // Run setup script
    return new Promise((resolve, reject) => {
      const setupProcess = spawn('node', ['scripts/setup-local-db.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      
      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Local database setup complete');
          resolve(true);
        } else {
          console.log('❌ Local database setup failed');
          reject(new Error('Setup failed'));
        }
      });
    });
  } else {
    console.log('✅ Local database already exists');
    return true;
  }
}

async function startServer(useSQLite = false) {
  console.log(`🚀 Starting server with ${useSQLite ? 'SQLite' : 'PostgreSQL'}...`);
  
  const env = { ...process.env };
  
  if (useSQLite) {
    env.USE_SQLITE = 'true';
    env.SQLITE_PATH = './data/local.db';
    console.log('🏠 Using local SQLite database');
  } else {
    console.log('🌐 Using PostgreSQL database');
  }

  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    serverProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    serverProcess.kill('SIGTERM');
  });
}

async function main() {
  console.log('🎯 Smart Database Startup');
  console.log('=========================\n');

  try {
    // Test PostgreSQL connection
    const pgWorking = await testPostgreSQLConnection();
    
    if (pgWorking) {
      // PostgreSQL is working, use it
      await startServer(false);
    } else {
      // PostgreSQL failed, setup and use SQLite
      console.log('\n🔄 PostgreSQL unavailable, switching to SQLite fallback...');
      await setupSQLiteFallback();
      await startServer(true);
    }
  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
}

// Run the smart startup
main().catch(console.error);