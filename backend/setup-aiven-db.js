require('dotenv').config();
const { Pool } = require('pg');

async function setupAivenDatabase() {
  console.log('🚀 Setting up Aiven PostgreSQL database...\n');
  
  // Validate environment variables
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('Please update your .env file with your Aiven connection string');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false,
      ca: null,
      key: null,
      cert: null
    } : false,
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
    const result = await client.query('SELECT version()');
    console.log('✅ Connected to PostgreSQL:', result.rows[0].version);
    client.release();
    
    // Create initial tables
    console.log('\n📝 Creating database schema...');
    
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0.00,
        user_type VARCHAR(20) DEFAULT 'prepaid' CHECK (user_type IN ('prepaid', 'postpaid')),
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');
    
    // Games table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'started', 'finished', 'cancelled')),
        bet_amount DECIMAL(10,2) NOT NULL,
        bet_amount_per_cartela DECIMAL(10,2),
        house_cut_percentage DECIMAL(5,2) DEFAULT 25.00,
        total_prize DECIMAL(10,2) DEFAULT 0.00,
        numbers_called INTEGER[] DEFAULT '{}',
        current_number INTEGER,
        winner_user_id INTEGER REFERENCES users(id),
        winner_pattern VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP
      )
    `);
    console.log('✅ Games table created');
    
    // Cartelas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cartelas (
        id SERIAL PRIMARY KEY,
        numbers INTEGER[] NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Cartelas table created');
    
    // User cartelas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_cartelas (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        cartela_id INTEGER REFERENCES cartelas(id) ON DELETE CASCADE,
        marked_numbers INTEGER[] DEFAULT '{}',
        is_winner BOOLEAN DEFAULT false,
        winning_pattern VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, game_id, cartela_id)
      )
    `);
    console.log('✅ User cartelas table created');
    
    // Admin logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        target_user_id INTEGER REFERENCES users(id),
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Admin logs table created');
    
    // Game analysis table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_analysis (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        total_cartelas INTEGER DEFAULT 0,
        total_participants INTEGER DEFAULT 0,
        winner_cartela_ids INTEGER[] DEFAULT '{}',
        house_profit DECIMAL(10,2) DEFAULT 0.00,
        total_payout DECIMAL(10,2) DEFAULT 0.00,
        game_duration_seconds INTEGER,
        numbers_called_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Game analysis table created');
    
    // User settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        voice_category VARCHAR(20) DEFAULT 'men' CHECK (voice_category IN ('men', 'boy', 'girl')),
        sound_enabled BOOLEAN DEFAULT true,
        auto_mark BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);
    console.log('✅ User settings table created');
    
    // Daily bonuses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_bonuses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bonus_date DATE NOT NULL,
        bonus_amount DECIMAL(10,2) NOT NULL,
        bonus_type VARCHAR(50) DEFAULT 'daily_login',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, bonus_date, bonus_type)
      )
    `);
    console.log('✅ Daily bonuses table created');
    
    // Create indexes for better performance
    console.log('\n🔍 Creating database indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)',
      'CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_user_cartelas_user_id ON user_cartelas(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_cartelas_game_id ON user_cartelas(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_cartelas_cartela_id ON user_cartelas(cartela_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_game_analysis_game_id ON game_analysis(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_daily_bonuses_user_id ON daily_bonuses(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_daily_bonuses_date ON daily_bonuses(bonus_date)'
    ];
    
    for (const indexQuery of indexes) {
      await pool.query(indexQuery);
    }
    console.log('✅ Database indexes created');
    
    // Create demo admin user
    console.log('\n👤 Creating demo admin user...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(process.env.DEMO_PASSWORD || 'demo123', 10);
    
    await pool.query(`
      INSERT INTO users (username, email, password, balance, user_type, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'demo_admin',
      process.env.DEMO_EMAIL || 'demo@bingo.com',
      hashedPassword,
      10000.00,
      'postpaid',
      'admin',
      true
    ]);
    console.log('✅ Demo admin user created');
    
    console.log('\n🎉 Aiven database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your .env file with the actual Aiven connection string');
    console.log('2. Run: npm run migrate (if you have additional migrations)');
    console.log('3. Start your application: npm start');
    console.log('\n🔐 Demo admin credentials:');
    console.log(`Email: ${process.env.DEMO_EMAIL || 'demo@bingo.com'}`);
    console.log(`Password: ${process.env.DEMO_PASSWORD || 'demo123'}`);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Verify your DATABASE_URL is correct');
    console.log('2. Check that your Aiven service is running');
    console.log('3. Ensure your IP is whitelisted (if applicable)');
    console.log('4. Verify SSL settings in your connection string');
  } finally {
    await pool.end();
  }
}

setupAivenDatabase();