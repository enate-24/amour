#!/usr/bin/env node

/**
 * New Database Migration Script
 * Sets up all tables and initial data for the new Render PostgreSQL database
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function migrateNewDatabase() {
  console.log('🚀 New Database Migration');
  console.log('========================\n');

  // Test connection first
  console.log('🔍 Step 1: Testing database connection...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    statement_timeout: 60000,
    query_timeout: 60000
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log(`🕐 Server time: ${result.rows[0].current_time}`);
    console.log(`📦 PostgreSQL: ${result.rows[0].version.split(' ')[0]}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }

  console.log('\n📋 Step 2: Creating database tables...');

  // Create all tables
  const tables = [
    // Users table
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          shopname TEXT,
          role TEXT DEFAULT 'user',
          user_type TEXT DEFAULT 'prepaid',
          balance DECIMAL(10,2) DEFAULT 0,
          balance_limit DECIMAL(10,2),
          total_games_played INTEGER DEFAULT 0,
          total_winnings DECIMAL(10,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    },

    // Cartelas table
    {
      name: 'cartelas',
      sql: `
        CREATE TABLE IF NOT EXISTS cartelas (
          id TEXT PRIMARY KEY,
          card_id TEXT UNIQUE NOT NULL,
          numbers JSONB NOT NULL,
          pattern TEXT,
          user_id TEXT,
          game_id TEXT,
          is_active BOOLEAN DEFAULT true,
          is_winner BOOLEAN DEFAULT false,
          purchased_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `
    },

    // User cartelas table
    {
      name: 'user_cartelas',
      sql: `
        CREATE TABLE IF NOT EXISTS user_cartelas (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          card_id TEXT NOT NULL,
          numbers JSONB NOT NULL,
          pattern TEXT,
          is_active BOOLEAN DEFAULT true,
          is_winner BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `
    },

    // User settings table
    {
      name: 'user_settings',
      sql: `
        CREATE TABLE IF NOT EXISTS user_settings (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE NOT NULL,
          selected_pattern TEXT DEFAULT 'Two Lines',
          bet_amount DECIMAL(10,2) DEFAULT 10.0,
          house_cut_percentage DECIMAL(5,2) DEFAULT 10.0,
          voice_category TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `
    },

    // Games table
    {
      name: 'games',
      sql: `
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          bet_money DECIMAL(10,2) NOT NULL,
          win_money DECIMAL(10,2) DEFAULT 0,
          cartelas_selected INTEGER DEFAULT 1,
          house_cut_percentage DECIMAL(5,2) DEFAULT 10.0,
          status TEXT DEFAULT 'waiting',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        )
      `
    },

    // Admin logs table
    {
      name: 'admin_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS admin_logs (
          id TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          details JSONB,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `
    },

    // Daily bonuses table
    {
      name: 'daily_bonuses',
      sql: `
        CREATE TABLE IF NOT EXISTS daily_bonuses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          bonus_date DATE NOT NULL,
          bonus_used BOOLEAN DEFAULT false,
          daily_profit DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, bonus_date)
        )
      `
    }
  ];

  // Create tables
  for (const table of tables) {
    try {
      await client.query(table.sql);
      console.log(`✅ Created table: ${table.name}`);
    } catch (error) {
      console.error(`❌ Failed to create table ${table.name}:`, error.message);
    }
  }

  console.log('\n👤 Step 3: Creating admin user...');
  
  // Create admin user
  try {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminId = uuidv4();
    
    await client.query(`
      INSERT INTO users (id, username, email, password, role, user_type, balance, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (username) DO NOTHING
    `, [adminId, 'admin', 'admin@bingo.com', adminPassword, 'admin', 'postpaid', 0, true]);
    
    console.log('✅ Admin user created (username: admin, password: admin123)');
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
  }

  console.log('\n🎯 Step 4: Creating sample cartelas...');
  
  // Create sample cartelas
  const sampleCartelas = [];
  for (let i = 1; i <= 2000; i++) {
    const numbers = {
      B: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 1),
      I: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 16),
      N: Array.from({length: 5}, (_, idx) => idx === 2 ? 'FREE' : Math.floor(Math.random() * 15) + 31),
      G: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 46),
      O: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 61)
    };
    
    sampleCartelas.push([
      uuidv4(),
      i.toString(),
      JSON.stringify(numbers),
      'Two Lines',
      true,
      false
    ]);
  }

  // Insert cartelas in batches
  const batchSize = 100;
  for (let i = 0; i < sampleCartelas.length; i += batchSize) {
    const batch = sampleCartelas.slice(i, i + batchSize);
    const values = batch.map((_, index) => {
      const baseIndex = i + index;
      return `($${baseIndex * 6 + 1}, $${baseIndex * 6 + 2}, $${baseIndex * 6 + 3}, $${baseIndex * 6 + 4}, $${baseIndex * 6 + 5}, $${baseIndex * 6 + 6})`;
    }).join(', ');
    
    const flatValues = batch.flat();
    
    try {
      await client.query(`
        INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
        VALUES ${values}
        ON CONFLICT (card_id) DO NOTHING
      `, flatValues);
      
      console.log(`✅ Created cartelas ${i + 1}-${Math.min(i + batchSize, sampleCartelas.length)}`);
    } catch (error) {
      console.error(`❌ Failed to create cartela batch ${i + 1}-${Math.min(i + batchSize, sampleCartelas.length)}:`, error.message);
    }
  }

  console.log('\n🔍 Step 5: Verifying migration...');
  
  // Verify tables and data
  const verificationQueries = [
    { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
    { name: 'cartelas', query: 'SELECT COUNT(*) as count FROM cartelas' },
    { name: 'user_settings', query: 'SELECT COUNT(*) as count FROM user_settings' },
    { name: 'admin_logs', query: 'SELECT COUNT(*) as count FROM admin_logs' }
  ];

  for (const { name, query } of verificationQueries) {
    try {
      const result = await client.query(query);
      console.log(`✅ ${name}: ${result.rows[0].count} records`);
    } catch (error) {
      console.error(`❌ Failed to verify ${name}:`, error.message);
    }
  }

  client.release();
  await pool.end();

  console.log('\n🎉 Database Migration Complete!');
  console.log('===============================');
  console.log('');
  console.log('📋 What was created:');
  console.log('  • All database tables with proper relationships');
  console.log('  • Admin user (username: admin, password: admin123)');
  console.log('  • 2000 sample cartelas for testing');
  console.log('  • Proper indexes and constraints');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('  1. Start your server: npm start');
  console.log('  2. Login with admin/admin123');
  console.log('  3. Test the new user creation workflow');
  console.log('  4. Create users and assign cartelas');
  console.log('');
  console.log('✅ Your new database is ready to use!');
}

// Run migration
migrateNewDatabase().catch(console.error);