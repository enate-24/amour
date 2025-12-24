#!/usr/bin/env node

/**
 * Local Database Setup Script
 * Creates a local SQLite database for development when PostgreSQL is unavailable
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function setupLocalDatabase() {
  console.log('🏠 Setting up Local Development Database');
  console.log('========================================\n');

  const dbPath = path.join(__dirname, '../data/local.db');
  
  // Remove existing database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️ Removed existing local database');
  }

  // Create new SQLite database
  const db = new sqlite3.Database(dbPath);
  
  console.log('📦 Creating SQLite database tables...');

  // Create tables with SQLite syntax
  const tables = [
    // Users table
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      shopname TEXT,
      role TEXT DEFAULT 'user',
      user_type TEXT DEFAULT 'prepaid',
      balance REAL DEFAULT 0,
      balance_limit REAL,
      total_games_played INTEGER DEFAULT 0,
      total_winnings REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Cartelas table
    `CREATE TABLE cartelas (
      id TEXT PRIMARY KEY,
      card_id TEXT UNIQUE NOT NULL,
      numbers TEXT NOT NULL,
      pattern TEXT,
      user_id TEXT,
      game_id TEXT,
      is_active BOOLEAN DEFAULT 1,
      is_winner BOOLEAN DEFAULT 0,
      purchased_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // User cartelas table
    `CREATE TABLE user_cartelas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      numbers TEXT NOT NULL,
      pattern TEXT,
      is_active BOOLEAN DEFAULT 1,
      is_winner BOOLEAN DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // User settings table
    `CREATE TABLE user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      selected_pattern TEXT DEFAULT 'Two Lines',
      bet_amount REAL DEFAULT 10.0,
      house_cut_percentage REAL DEFAULT 10.0,
      voice_category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // Games table
    `CREATE TABLE games (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      bet_money REAL NOT NULL,
      win_money REAL DEFAULT 0,
      cartelas_selected INTEGER DEFAULT 1,
      house_cut_percentage REAL DEFAULT 10.0,
      status TEXT DEFAULT 'waiting',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`,

    // Admin logs table
    `CREATE TABLE admin_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
    )`
  ];

  // Execute table creation
  for (const [index, tableSQL] of tables.entries()) {
    await new Promise((resolve, reject) => {
      db.run(tableSQL, (err) => {
        if (err) {
          console.error(`❌ Failed to create table ${index + 1}:`, err.message);
          reject(err);
        } else {
          console.log(`✅ Created table ${index + 1}/6`);
          resolve();
        }
      });
    });
  }

  // Create admin user
  console.log('\n👤 Creating admin user...');
  const bcrypt = require('bcryptjs');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminId = 'admin-' + Date.now();

  await new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO users (id, username, email, password, role, user_type, balance, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [adminId, 'admin', 'admin@bingo.com', adminPassword, 'admin', 'postpaid', 0, 1], (err) => {
      if (err) {
        console.error('❌ Failed to create admin user:', err.message);
        reject(err);
      } else {
        console.log('✅ Admin user created (username: admin, password: admin123)');
        resolve();
      }
    });
  });

  // Create sample cartelas
  console.log('\n🎯 Creating sample cartelas...');
  const sampleCartelas = [];
  
  for (let i = 1; i <= 100; i++) {
    const numbers = {
      B: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 1),
      I: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 16),
      N: Array.from({length: 5}, (_, idx) => idx === 2 ? 'FREE' : Math.floor(Math.random() * 15) + 31),
      G: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 46),
      O: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 61)
    };
    
    sampleCartelas.push([
      `cartela-${i}`,
      i.toString(),
      JSON.stringify(numbers),
      'Two Lines',
      1,
      0
    ]);
  }

  for (const [index, cartela] of sampleCartelas.entries()) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
        VALUES (?, ?, ?, ?, ?, ?)
      `, cartela, (err) => {
        if (err) {
          console.error(`❌ Failed to create cartela ${index + 1}:`, err.message);
          reject(err);
        } else {
          if ((index + 1) % 20 === 0) {
            console.log(`✅ Created ${index + 1}/100 cartelas`);
          }
          resolve();
        }
      });
    });
  }

  db.close();

  // Create local environment file
  console.log('\n⚙️ Creating local environment configuration...');
  const localEnvContent = `# Local Development Configuration
PORT=3003
NODE_ENV=development

# Frontend URLs
FRONTEND_URLS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173

# JWT Configuration
JWT_SECRET=local-development-secret-key
JWT_EXPIRES_IN=30d

# Local SQLite Database
USE_SQLITE=true
SQLITE_PATH=./data/local.db

# Admin Configuration
DEMO_EMAIL=admin@bingo.com
DEMO_PASSWORD=admin123

# Game Configuration
DEFAULT_HOUSE_CUT=25
MAX_BET_AMOUNT=1000
MIN_BET_AMOUNT=1
`;

  fs.writeFileSync(path.join(__dirname, '../.env.local'), localEnvContent);
  console.log('✅ Created .env.local file');

  console.log('\n🎉 Local Database Setup Complete!');
  console.log('==================================');
  console.log('');
  console.log('📋 What was created:');
  console.log('  • SQLite database with all tables');
  console.log('  • Admin user (username: admin, password: admin123)');
  console.log('  • 100 sample cartelas');
  console.log('  • Local environment configuration');
  console.log('');
  console.log('🚀 To use local database:');
  console.log('  1. Copy .env.local to .env');
  console.log('  2. Restart your server');
  console.log('  3. Login with admin/admin123');
  console.log('');
  console.log('💡 To switch back to PostgreSQL:');
  console.log('  1. Restore original .env file');
  console.log('  2. Fix Render database connection');
  console.log('  3. Restart server');
}

// Run setup
setupLocalDatabase().catch(console.error);