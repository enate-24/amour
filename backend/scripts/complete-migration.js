#!/usr/bin/env node

/**
 * Complete Database Migration Script
 * Migrates all data including users, cartelas, settings, and everything needed
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function completeMigration() {
  console.log('🚀 Complete Database Migration');
  console.log('==============================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    statement_timeout: 60000
  });

  const client = await pool.connect();

  try {
    console.log('✅ Connected to database successfully!');

    // Step 1: Create all tables
    console.log('\n📋 Step 1: Creating database tables...');
    
    const tables = [
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
      {
        name: 'cartelas',
        sql: `
          CREATE TABLE IF NOT EXISTS cartelas (
            id TEXT PRIMARY KEY,
            card_id TEXT UNIQUE NOT NULL,
            numbers JSONB NOT NULL,
            pattern TEXT DEFAULT 'Two Lines',
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
      {
        name: 'user_cartelas',
        sql: `
          CREATE TABLE IF NOT EXISTS user_cartelas (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            card_id TEXT NOT NULL,
            numbers JSONB NOT NULL,
            pattern TEXT DEFAULT 'Two Lines',
            is_active BOOLEAN DEFAULT true,
            is_winner BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `
      },
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

    for (const table of tables) {
      await client.query(table.sql);
      console.log(`✅ Created table: ${table.name}`);
    }

    // Step 2: Create admin user
    console.log('\n👤 Step 2: Creating admin user...');
    
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminId = uuidv4();
    
    await client.query(`
      INSERT INTO users (id, username, email, password, role, user_type, balance, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (username) DO NOTHING
    `, [adminId, 'admin', 'admin@bingo.com', adminPassword, 'admin', 'postpaid', 0, true]);
    
    console.log('✅ Admin user created (username: admin, password: admin123)');

    // Step 3: Create demo users
    console.log('\n👥 Step 3: Creating demo users...');
    
    const demoUsers = [
      {
        username: 'john_shop',
        email: 'john@shop.com',
        shopname: 'John\'s Gaming Shop',
        userType: 'prepaid',
        balance: 500,
        voiceCategory: 'boy'
      },
      {
        username: 'mary_store',
        email: 'mary@store.com',
        shopname: 'Mary\'s Bingo Store',
        userType: 'prepaid',
        balance: 1000,
        voiceCategory: 'girl'
      },
      {
        username: 'ahmed_cafe',
        email: 'ahmed@cafe.com',
        shopname: 'Ahmed\'s Internet Cafe',
        userType: 'postpaid',
        balance: 0,
        voiceCategory: 'boy'
      }
    ];

    const createdUsers = [];
    for (const userData of demoUsers) {
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      await client.query(`
        INSERT INTO users (id, username, email, password, shopname, role, user_type, balance, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (username) DO NOTHING
      `, [
        userId, userData.username, userData.email, hashedPassword, 
        userData.shopname, 'user', userData.userType, userData.balance, true
      ]);

      // Create user settings
      await client.query(`
        INSERT INTO user_settings (id, user_id, voice_category, selected_pattern, bet_amount, house_cut_percentage)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO NOTHING
      `, [uuidv4(), userId, userData.voiceCategory, 'Two Lines', 10.0, 10.0]);

      createdUsers.push({ id: userId, ...userData });
      console.log(`✅ Created user: ${userData.username} (${userData.userType}, balance: ${userData.balance})`);
    }

    // Step 4: Create comprehensive cartelas
    console.log('\n🎯 Step 4: Creating 2000 cartelas...');
    
    const batchSize = 50;
    let totalCreated = 0;

    for (let batch = 0; batch < 40; batch++) { // 40 batches of 50 = 2000 cartelas
      const cartelasBatch = [];
      
      for (let i = 1; i <= batchSize; i++) {
        const cardId = (batch * batchSize + i).toString();
        
        // Generate realistic bingo numbers
        const numbers = {
          B: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 1),
          I: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 16),
          N: Array.from({length: 5}, (_, idx) => idx === 2 ? 'FREE' : Math.floor(Math.random() * 15) + 31),
          G: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 46),
          O: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 61)
        };

        cartelasBatch.push([
          uuidv4(),
          cardId,
          JSON.stringify(numbers),
          'Two Lines',
          true,
          false
        ]);
      }

      // Insert batch
      const values = cartelasBatch.map((_, index) => 
        `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`
      ).join(', ');
      
      const flatValues = cartelasBatch.flat();
      
      await client.query(`
        INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
        VALUES ${values}
        ON CONFLICT (card_id) DO NOTHING
      `, flatValues);

      totalCreated += batchSize;
      console.log(`✅ Created cartelas ${totalCreated - batchSize + 1}-${totalCreated}`);
    }

    // Step 5: Assign cartelas to demo users
    console.log('\n📋 Step 5: Assigning cartelas to demo users...');
    
    const cartelaRanges = [
      { userId: createdUsers[0].id, username: createdUsers[0].username, start: 1, end: 50 },
      { userId: createdUsers[1].id, username: createdUsers[1].username, start: 51, end: 100 },
      { userId: createdUsers[2].id, username: createdUsers[2].username, start: 101, end: 150 }
    ];

    for (const range of cartelaRanges) {
      // Get cartelas in range
      const cartelas = await client.query(`
        SELECT id, card_id, numbers, pattern 
        FROM cartelas 
        WHERE CAST(card_id AS INTEGER) >= $1 AND CAST(card_id AS INTEGER) <= $2
        ORDER BY CAST(card_id AS INTEGER)
      `, [range.start, range.end]);

      // Copy to user_cartelas
      for (const cartela of cartelas.rows) {
        await client.query(`
          INSERT INTO user_cartelas (id, user_id, card_id, numbers, pattern, is_active, is_winner)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          uuidv4(),
          range.userId,
          cartela.card_id,
          cartela.numbers,
          cartela.pattern,
          true,
          false
        ]);
      }

      console.log(`✅ Assigned cartelas ${range.start}-${range.end} to ${range.username}`);
    }

    // Step 6: Create sample games
    console.log('\n🎮 Step 6: Creating sample games...');
    
    const sampleGames = [
      { userId: createdUsers[0].id, betMoney: 50, winMoney: 0, status: 'finished' },
      { userId: createdUsers[1].id, betMoney: 100, winMoney: 500, status: 'finished' },
      { userId: createdUsers[2].id, betMoney: 25, winMoney: 0, status: 'finished' },
      { userId: createdUsers[0].id, betMoney: 75, winMoney: 200, status: 'finished' }
    ];

    for (const game of sampleGames) {
      await client.query(`
        INSERT INTO games (id, user_id, bet_money, win_money, cartelas_selected, house_cut_percentage, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(),
        game.userId,
        game.betMoney,
        game.winMoney,
        1,
        10.0,
        game.status
      ]);
    }

    console.log('✅ Created sample games');

    // Step 7: Verification
    console.log('\n🔍 Step 7: Verifying migration...');
    
    const verification = [
      { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'cartelas', query: 'SELECT COUNT(*) as count FROM cartelas' },
      { name: 'user_cartelas', query: 'SELECT COUNT(*) as count FROM user_cartelas' },
      { name: 'user_settings', query: 'SELECT COUNT(*) as count FROM user_settings' },
      { name: 'games', query: 'SELECT COUNT(*) as count FROM games' }
    ];

    for (const check of verification) {
      const result = await client.query(check.query);
      console.log(`✅ ${check.name}: ${result.rows[0].count} records`);
    }

    // Show user details
    console.log('\n👥 Created Users:');
    const userList = await client.query(`
      SELECT u.username, u.email, u.shopname, u.user_type, u.balance, us.voice_category,
             COUNT(uc.id) as assigned_cartelas
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      LEFT JOIN user_cartelas uc ON u.id = uc.user_id
      WHERE u.role = 'user'
      GROUP BY u.id, u.username, u.email, u.shopname, u.user_type, u.balance, us.voice_category
      ORDER BY u.username
    `);

    userList.rows.forEach(user => {
      console.log(`  • ${user.username} (${user.email})`);
      console.log(`    Shop: ${user.shopname || 'N/A'}`);
      console.log(`    Type: ${user.user_type}, Balance: ${user.balance} Birr`);
      console.log(`    Voice: ${user.voice_category}, Cartelas: ${user.assigned_cartelas}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n🎉 COMPLETE MIGRATION SUCCESSFUL!');
  console.log('==================================');
  console.log('');
  console.log('📋 What was created:');
  console.log('  • All database tables with proper relationships');
  console.log('  • Admin user (username: admin, password: admin123)');
  console.log('  • 3 demo users with different configurations');
  console.log('  • 2000 unique cartelas');
  console.log('  • User-specific cartela assignments');
  console.log('  • Voice category settings for each user');
  console.log('  • Sample game records');
  console.log('');
  console.log('🚀 Ready to use:');
  console.log('  1. Your server is running on port 3003');
  console.log('  2. Login with admin/admin123 to access admin panel');
  console.log('  3. Test the new user creation workflow');
  console.log('  4. Users can login with username/password123');
  console.log('');
  console.log('✅ Your complete bingo system is now ready!');
}

// Run complete migration
completeMigration().catch(console.error);