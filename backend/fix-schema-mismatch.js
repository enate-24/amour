require('dotenv').config();
const { Pool } = require('pg');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fixSchemaMismatch() {
  console.log('🔧 Fixing schema mismatch between Aiven setup and main application...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: null,
      key: null,
      cert: null
    },
    max: 3,
    connectionTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 10000,
    createRetryIntervalMillis: 5000
  });
  
  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    client.release();
    
    // Check current schema
    console.log('\n📋 Checking current table schemas...');
    
    // Check games table structure
    const gamesColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'games'
      ORDER BY ordinal_position
    `);
    
    console.log('Games table columns:');
    gamesColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check cartelas table structure
    const cartelasColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'cartelas'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCartelas table columns:');
    cartelasColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Fix missing columns in games table
    console.log('\n🔧 Adding missing columns to games table...');
    
    const gamesToAdd = [
      'game_number INTEGER',
      'bet_money DECIMAL(10,2)',
      'win_money DECIMAL(10,2)',
      'cartelas_selected INTEGER',
      'selected_cartelas TEXT',
      'called_numbers TEXT',
      'number_sequence TEXT',
      'total_numbers INTEGER',
      'winner_pattern TEXT'
    ];
    
    for (const column of gamesToAdd) {
      try {
        await pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS ${column}`);
        console.log(`  ✅ Added column: ${column.split(' ')[0]}`);
      } catch (error) {
        console.log(`  ⚠️ Column ${column.split(' ')[0]} might already exist or have different type`);
      }
    }
    
    // Fix missing columns in cartelas table
    console.log('\n🔧 Adding missing columns to cartelas table...');
    
    const cartelasToAdd = [
      'card_id TEXT',
      'game_id INTEGER',
      'numbers TEXT',
      'pattern TEXT',
      'is_active INTEGER DEFAULT 1',
      'is_winner INTEGER DEFAULT 0',
      'purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];
    
    for (const column of cartelasToAdd) {
      try {
        await pool.query(`ALTER TABLE cartelas ADD COLUMN IF NOT EXISTS ${column}`);
        console.log(`  ✅ Added column: ${column.split(' ')[0]}`);
      } catch (error) {
        console.log(`  ⚠️ Column ${column.split(' ')[0]} might already exist or have different type`);
      }
    }
    
    // Update games table to have default values for required columns
    console.log('\n🔧 Setting default values for required columns...');
    
    await pool.query(`
      UPDATE games 
      SET 
        game_number = COALESCE(game_number, id),
        bet_money = COALESCE(bet_money, bet_amount),
        win_money = COALESCE(win_money, 0),
        cartelas_selected = COALESCE(cartelas_selected, 1),
        total_numbers = COALESCE(total_numbers, 75),
        called_numbers = COALESCE(called_numbers, '[]'),
        selected_cartelas = COALESCE(selected_cartelas, '[]'),
        number_sequence = COALESCE(number_sequence, '[]')
      WHERE 
        game_number IS NULL OR 
        bet_money IS NULL OR 
        win_money IS NULL OR 
        cartelas_selected IS NULL OR 
        total_numbers IS NULL
    `);
    
    console.log('✅ Updated games with default values');
    
    // Create missing tables that the main app expects
    console.log('\n🔧 Creating missing tables...');
    
    // User cartelas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_cartelas (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        card_id TEXT NOT NULL,
        numbers TEXT NOT NULL,
        pattern TEXT,
        is_active INTEGER DEFAULT 1,
        is_winner INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, card_id)
      )
    `);
    console.log('✅ user_cartelas table ready');
    
    // Game analysis table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_analysis (
        id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL,
        game_number INTEGER NOT NULL,
        players INTEGER NOT NULL,
        bet DECIMAL(10,2) NOT NULL,
        total_bet DECIMAL(10,2) NOT NULL,
        cut_percentage DECIMAL(5,2) NOT NULL,
        profit DECIMAL(10,2) NOT NULL,
        house_bonus DECIMAL(10,2) NOT NULL,
        winner_info TEXT,
        status VARCHAR(50) NOT NULL,
        date TIMESTAMP NOT NULL,
        user_id INTEGER NOT NULL,
        username VARCHAR(255) NOT NULL,
        final_win_amount DECIMAL(10,2) NOT NULL,
        called_numbers TEXT,
        selected_cartelas TEXT,
        winner_cartela_ids TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ game_analysis table ready');
    
    // Admin logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        action VARCHAR(255) NOT NULL,
        target_type VARCHAR(100) NOT NULL,
        target_id TEXT NOT NULL,
        details TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    console.log('✅ admin_logs table ready');
    
    // Sounds table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sounds (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ sounds table ready');
    
    console.log('\n🎉 Schema mismatch fixed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Test the application');
    console.log('3. The user_id column errors should be resolved');
    
  } catch (error) {
    console.error('❌ Schema fix failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixSchemaMismatch().catch(error => {
  console.error('❌ Schema fix process failed:', error);
  process.exit(1);
});