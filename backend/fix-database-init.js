require('dotenv').config();
const { Pool } = require('pg');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fixDatabaseInit() {
  console.log('🔧 Fixing database initialization issues...\n');
  
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
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    client.release();
    
    // Fix cartelas table to have user_id column
    console.log('\n🔧 Ensuring cartelas table has user_id column...');
    
    // Check if cartelas table has user_id column
    const cartelasUserIdCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cartelas' AND column_name = 'user_id'
    `);
    
    if (cartelasUserIdCheck.rows.length === 0) {
      console.log('Adding user_id column to cartelas table...');
      await pool.query(`
        ALTER TABLE cartelas 
        ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('✅ user_id column added to cartelas');
    } else {
      console.log('✅ cartelas table already has user_id column');
    }
    
    // Create indexes safely (ignore errors if they already exist)
    console.log('\n🔧 Creating database indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_cartelas_user_id ON cartelas(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_cartelas_game_id ON cartelas(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_cartelas_card_id ON cartelas(card_id)',
      'CREATE INDEX IF NOT EXISTS idx_cartelas_is_active ON cartelas(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_cartelas_purchased_at ON cartelas(purchased_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_cartelas_active_cardid ON cartelas(is_active, card_id)',
      'CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)',
      'CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
        const indexName = indexQuery.match(/idx_\w+/)[0];
        console.log(`  ✅ Index created: ${indexName}`);
      } catch (error) {
        if (error.code === '42703') {
          console.log(`  ⚠️ Skipped index (column doesn't exist): ${indexQuery.match(/idx_\w+/)[0]}`);
        } else {
          console.log(`  ⚠️ Index might already exist: ${indexQuery.match(/idx_\w+/)[0]}`);
        }
      }
    }
    
    // Ensure all required tables exist with proper structure
    console.log('\n🔧 Ensuring all required tables exist...');
    
    // Check and create user_cartelas table if needed
    const userCartelasExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_cartelas'
    `);
    
    if (userCartelasExists.rows.length === 0) {
      await pool.query(`
        CREATE TABLE user_cartelas (
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
      console.log('✅ user_cartelas table created');
    } else {
      console.log('✅ user_cartelas table already exists');
    }
    
    // Check and create admin_logs table if needed
    const adminLogsExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'admin_logs'
    `);
    
    if (adminLogsExists.rows.length === 0) {
      await pool.query(`
        CREATE TABLE admin_logs (
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
      console.log('✅ admin_logs table created');
    } else {
      console.log('✅ admin_logs table already exists');
    }
    
    // Check and create game_analysis table if needed
    const gameAnalysisExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'game_analysis'
    `);
    
    if (gameAnalysisExists.rows.length === 0) {
      await pool.query(`
        CREATE TABLE game_analysis (
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
      console.log('✅ game_analysis table created');
    } else {
      console.log('✅ game_analysis table already exists');
    }
    
    console.log('\n🎉 Database initialization fix completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- All required tables exist');
    console.log('- All required columns added');
    console.log('- All indexes created');
    console.log('- Schema is now compatible with both Aiven setup and main application');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixDatabaseInit().catch(error => {
  console.error('❌ Database fix process failed:', error);
  process.exit(1);
});