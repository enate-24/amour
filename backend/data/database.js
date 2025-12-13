const { Pool } = require('pg');
const types = require('pg').types;
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configure type parsers for PostgreSQL
types.setTypeParser(types.builtins.BOOL, (val) => {
  if (val === 't' || val === 'true' || val === true || val === 1) return true;
  if (val === 'f' || val === 'false' || val === false || val === 0) return false;
  return Boolean(val);
});
types.setTypeParser(types.builtins.INT2, parseInt);
types.setTypeParser(types.builtins.INT4, parseInt);
types.setTypeParser(types.builtins.INT8, parseInt);
types.setTypeParser(types.builtins.FLOAT4, parseFloat);
types.setTypeParser(types.builtins.FLOAT8, parseFloat);

// PostgreSQL connection configuration
// Support both DATABASE_URL (Render/production) and individual params (local development)
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // Reduced pool size to avoid overwhelming remote database
  min: 2, // Keep minimal connections alive
  idleTimeoutMillis: 60000, // 60 seconds - allow connections to stay idle longer
  connectionTimeoutMillis: 30000, // 30 seconds - increased for remote database
  acquireTimeoutMillis: 30000, // 30 seconds - increased for remote database
  createTimeoutMillis: 30000, // 30 seconds - increased for remote database
  destroyTimeoutMillis: 5000, // 5 seconds to destroy connection
  reapIntervalMillis: 10000, // Check for idle connections every 10 seconds
  createRetryIntervalMillis: 500, // Retry connection creation every 500ms
  statement_timeout: 60000, // 60 second query timeout - increased for remote database
  query_timeout: 60000 // 60 second query timeout - increased for remote database
} : {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'amour_bingo',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Increased pool size for better concurrency
  min: 5, // Keep more connections alive for faster response
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 10000, // 10 seconds
  acquireTimeoutMillis: 10000, // 10 seconds
  createTimeoutMillis: 10000, // 10 seconds
  destroyTimeoutMillis: 5000, // 5 seconds to destroy connection
  reapIntervalMillis: 1000, // Check for idle connections every second
  createRetryIntervalMillis: 200, // Retry connection creation every 200ms
  statement_timeout: 120000, // 120 second query timeout (increased for large queries)
  query_timeout: 120000 // 120 second query timeout (increased for large queries)
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test the connection
let connectionCount = 0;
pool.on('connect', (client) => {
  connectionCount++;
  console.log(`✅ Connected to PostgreSQL database (connection #${connectionCount})`);
  // Configure the client to handle boolean values correctly
  client.query('SET datestyle = ISO, MDY');
});

pool.on('acquire', () => {
  console.log('🔵 Client acquired from pool');
});

pool.on('remove', () => {
  connectionCount--;
  console.log(`🔴 Client removed from pool (remaining: ${connectionCount})`);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err.message);
  // Don't exit process on idle client errors - just log them
  console.error('Stack:', err.stack);
});

// Helper function to retry database operations
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isTimeout = error.message && error.message.includes('timeout');
      const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
      
      console.log(`⚠️ Database operation attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries} attempts failed. Last error:`, error.message);
        throw error;
      }
      
      // Use exponential backoff for retries, especially for timeouts
      const backoffDelay = isTimeout || isConnectionError ? delay * Math.pow(2, attempt - 1) : delay * attempt;
      console.log(`⏳ Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
};

// Promisify database operations for async/await support with retry logic
const run = async (sql, params = []) => {
  return retryOperation(async () => {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(sql, params);
      return {
        id: result.rows[0]?.id,
        changes: result.rowCount,
        rows: result.rows
      };
    } catch (error) {
      console.error('❌ Query error in run():', error.message);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  });
};

const get = async (sql, params = []) => {
  return retryOperation(async () => {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Query error in get():', error.message);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  });
};

const all = async (sql, params = []) => {
  return retryOperation(async () => {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Query error in all():', error.message);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  });
};

// Initialize database schema with better error handling
const createTables = async () => {
  const maxRetries = 5;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`Initializing database... (attempt ${attempt}/${maxRetries})`);

      // Test connection first
      await pool.query('SELECT 1');
      console.log('✅ Database connection established');

      // Users table
      await run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          shopname VARCHAR(255),
          password TEXT NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          user_type VARCHAR(20) NOT NULL DEFAULT 'prepaid',
          balance DECIMAL(10,2) DEFAULT 0,
          balance_limit DECIMAL(10,2),
          total_games_played INTEGER DEFAULT 0,
          total_winnings DECIMAL(10,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for faster queries
      await run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`);

      // Games table
      await run(`
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          game_number INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL,
          bet_money DECIMAL(10,2) NOT NULL,
          win_money DECIMAL(10,2) NOT NULL,
          cartelas_selected INTEGER NOT NULL,
          selected_cartelas TEXT, -- JSON string for selected cartela IDs
          called_numbers TEXT, -- JSON string
          number_sequence TEXT, -- JSON string for number sequence
          total_numbers INTEGER NOT NULL,
          winner_pattern TEXT,
          house_cut_percentage DECIMAL(5,2) DEFAULT 10.0,
          user_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        )
      `);

      // Create indexes for faster game queries
      await run(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_games_user_created ON games(user_id, created_at DESC)`);

      // Add missing columns to existing tables if missing
      try {
        await run(`ALTER TABLE games ADD COLUMN IF NOT EXISTS number_sequence TEXT`);
        await run(`ALTER TABLE games ADD COLUMN IF NOT EXISTS selected_cartelas TEXT`);
        await run(`ALTER TABLE games ADD COLUMN IF NOT EXISTS user_id TEXT`);
      } catch (alterError) {
        // Ignore errors if columns already exist
        console.log('Note: Some ALTER TABLE operations may have been skipped (columns might already exist)');
      }

      // Cartelas table
      await run(`
        CREATE TABLE IF NOT EXISTS cartelas (
          id TEXT PRIMARY KEY,
          card_id TEXT NOT NULL,
          game_id TEXT,
          user_id TEXT,
          numbers TEXT NOT NULL, -- JSON string
          pattern TEXT,
          is_active INTEGER DEFAULT 1,
          is_winner INTEGER DEFAULT 0,
          purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for faster cartela queries
      await run(`CREATE INDEX IF NOT EXISTS idx_cartelas_user_id ON cartelas(user_id)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_cartelas_game_id ON cartelas(game_id)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_cartelas_card_id ON cartelas(card_id)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_cartelas_is_active ON cartelas(is_active)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_cartelas_purchased_at ON cartelas(purchased_at DESC)`);
      // Composite index for optimized findAll query
      await run(`CREATE INDEX IF NOT EXISTS idx_cartelas_active_cardid ON cartelas(is_active, card_id)`);

      // Admin logs table
      await run(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL,
          action VARCHAR(255) NOT NULL,
          target_type VARCHAR(100) NOT NULL,
          target_id TEXT NOT NULL,
          details TEXT, -- JSON string
          ip_address INET,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Game analysis table
      await run(`
        CREATE TABLE IF NOT EXISTS game_analysis (
          id TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
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
          user_id TEXT NOT NULL,
          username VARCHAR(255) NOT NULL,
          final_win_amount DECIMAL(10,2) NOT NULL,
          called_numbers TEXT, -- JSON string
          selected_cartelas TEXT, -- JSON string
          winner_cartela_ids TEXT DEFAULT '[]', -- JSON array of winner cartela IDs
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sounds table
      await run(`
        CREATE TABLE IF NOT EXISTS sounds (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // User settings table
      await run(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          selected_pattern VARCHAR(50) DEFAULT 'Two Lines',
          bet_amount DECIMAL(10,2) DEFAULT 10.0,
          house_cut_percentage DECIMAL(5,2) DEFAULT 10.0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Daily bonuses table
      await run(`
        CREATE TABLE IF NOT EXISTS daily_bonuses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          bonus_date DATE NOT NULL,
          daily_profit DECIMAL(10,2) DEFAULT 0,
          bonus_amount DECIMAL(10,2) DEFAULT 200,
          bonus_type VARCHAR(50) DEFAULT 'house_bonus',
          requirements_met BOOLEAN DEFAULT false,
          bonus_claimed BOOLEAN DEFAULT false,
          bonus_used BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, bonus_date)
        )
      `);

      // Create indexes for faster bonus queries
      await run(`CREATE INDEX IF NOT EXISTS idx_daily_bonuses_user_date ON daily_bonuses(user_id, bonus_date DESC)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_daily_bonuses_date ON daily_bonuses(bonus_date DESC)`);

      console.log('✅ Database schema initialized successfully');
      return; // Success, exit the retry loop
      
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`, error.message);
      
      if (attempt >= maxRetries) {
        console.error('❌ Failed to initialize database after maximum retries');
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Database operations for users
const userOperations = {
  findById: async (id) => {
    const user = await get('SELECT * FROM users WHERE id = $1', [id]);
    if (user) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        shopname: user.shopname,
        password: user.password,
        role: user.role,
        userType: user.user_type,
        balance: parseFloat(user.balance || 0),
        balanceLimit: user.balance_limit ? parseFloat(user.balance_limit) : null,
        totalGamesPlayed: parseInt(user.total_games_played || 0),
        totalWinnings: parseFloat(user.total_winnings || 0),
        is_active: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    }
    return null;
  },

  findByEmail: async (email) => {
    const user = await get('SELECT * FROM users WHERE email = $1', [email]);
    if (user) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        shopname: user.shopname,
        password: user.password,
        role: user.role,
        userType: user.user_type,
        balance: parseFloat(user.balance || 0),
        balanceLimit: user.balance_limit ? parseFloat(user.balance_limit) : null,
        totalGamesPlayed: parseInt(user.total_games_played || 0),
        totalWinnings: parseFloat(user.total_winnings || 0),
        is_active: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    }
    return null;
  },

  findByUsername: async (username) => {
    const user = await get('SELECT * FROM users WHERE username = $1', [username]);
    if (user) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        shopname: user.shopname,
        password: user.password,
        role: user.role,
        userType: user.user_type,
        balance: parseFloat(user.balance || 0),
        balanceLimit: user.balance_limit ? parseFloat(user.balance_limit) : null,
        totalGamesPlayed: parseInt(user.total_games_played || 0),
        totalWinnings: parseFloat(user.total_winnings || 0),
        is_active: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    }
    return null;
  },

  findAll: async () => {
    const users = await all('SELECT * FROM users ORDER BY created_at DESC');
    return users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      shopname: user.shopname,
      password: user.password,
      role: user.role,
      userType: user.user_type,
      balance: parseFloat(user.balance || 0),
      balanceLimit: user.balance_limit ? parseFloat(user.balance_limit) : null,
      totalGamesPlayed: parseInt(user.total_games_played || 0),
      totalWinnings: parseFloat(user.total_winnings || 0),
      is_active: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
  },

  create: async (userData) => {
    // For admin users, exclude balance, total_games_played, and total_winnings fields
    const isAdmin = userData.role === 'admin';

    if (isAdmin) {
      // Admin users don't need these fields
      const result = await run(`
        INSERT INTO users (id, username, email, shopname, password, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        userData.id,
        userData.username,
        userData.email,
        userData.shopname || null,
        userData.password,
        userData.role || 'user',
        userData.is_active !== false,
        userData.createdAt || new Date().toISOString(),
        userData.updatedAt || new Date().toISOString()
      ]);
      return result;
    } else {
      // Regular users include all fields
      const result = await run(`
        INSERT INTO users (id, username, email, shopname, password, role, user_type, balance, balance_limit, total_games_played, total_winnings, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        userData.id,
        userData.username,
        userData.email,
        userData.shopname || null,
        userData.password,
        userData.role || 'user',
        userData.userType || 'prepaid',
        userData.balance || 0,
        userData.balanceLimit || null,
        userData.totalGamesPlayed || 0,
        userData.totalWinnings || 0,
        userData.is_active !== false,
        userData.createdAt || new Date().toISOString(),
        userData.updatedAt || new Date().toISOString()
      ]);
      return result;
    }
  },

  update: async (id, updateData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.username !== undefined) {
      fields.push(`username = $${paramCount}`);
      values.push(updateData.username);
      paramCount++;
    }
    if (updateData.email !== undefined) {
      fields.push(`email = $${paramCount}`);
      values.push(updateData.email);
      paramCount++;
    }
    if (updateData.shopname !== undefined) {
      fields.push(`shopname = $${paramCount}`);
      values.push(updateData.shopname);
      paramCount++;
    }
    if (updateData.password !== undefined) {
      fields.push(`password = $${paramCount}`);
      values.push(updateData.password);
      paramCount++;
    }
    if (updateData.role !== undefined) {
      fields.push(`role = $${paramCount}`);
      values.push(updateData.role);
      paramCount++;
    }
    if (updateData.userType !== undefined) {
      fields.push(`user_type = $${paramCount}`);
      values.push(updateData.userType);
      paramCount++;
    }

    if (updateData.balance !== undefined) {
      fields.push(`balance = $${paramCount}`);
      values.push(updateData.balance);
      paramCount++;
    }
    if (updateData.balanceLimit !== undefined) {
      fields.push(`balance_limit = $${paramCount}`);
      values.push(updateData.balanceLimit);
      paramCount++;
    }
    if (updateData.totalGamesPlayed !== undefined) {
      fields.push(`total_games_played = $${paramCount}`);
      values.push(updateData.totalGamesPlayed);
      paramCount++;
    }
    if (updateData.totalWinnings !== undefined) {
      fields.push(`total_winnings = $${paramCount}`);
      values.push(updateData.totalWinnings);
      paramCount++;
    }
    if (updateData.is_active !== undefined) {
      fields.push(`is_active = $${paramCount}`);
      values.push(updateData.is_active);
      paramCount++;
    }

    fields.push(`updated_at = NOW()`);


    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    const result = await run(sql, values);

    // If role is being updated to/from admin, ensure total_games_played and total_winnings are set correctly
    if (updateData.role !== undefined) {
      const isAdmin = updateData.role === 'admin';
      if (isAdmin) {
        await run('UPDATE users SET total_games_played = 0, total_winnings = 0 WHERE id = $1', [id]);
      }
    }

    return result;
  }
};

// Database operations for games
const gameOperations = {
  findAll: async () => {
    const games = await all('SELECT * FROM games ORDER BY created_at DESC');
    return games.map(game => ({
      id: game.id,
      gameNumber: game.game_number,
      status: game.status,
      betMoney: parseFloat(game.bet_money),
      winMoney: parseFloat(game.win_money),
      cartelasSelected: game.cartelas_selected,
      calledNumbers: JSON.parse(game.called_numbers || '[]'),
      totalNumbers: game.total_numbers,
      winnerPattern: game.winner_pattern,
      user_id: game.user_id,
      houseCutPercentage: parseFloat(game.house_cut_percentage || 10),
      createdAt: game.created_at,
      updatedAt: game.updated_at
    }));
  },

  findById: async (id) => {
    const game = await get('SELECT * FROM games WHERE id = $1', [id]);
    if (game) {
      return {
        id: game.id,
        gameNumber: game.game_number,
        status: game.status,
        betMoney: parseFloat(game.bet_money),
        winMoney: parseFloat(game.win_money),
        cartelasSelected: game.cartelas_selected,
        calledNumbers: JSON.parse(game.called_numbers || '[]'),
        totalNumbers: game.total_numbers,
        winnerPattern: game.winner_pattern,
        user_id: game.user_id,
        houseCutPercentage: parseFloat(game.house_cut_percentage || 10),
        createdAt: game.created_at,
        updatedAt: game.updated_at
      };
    }
    return null;
  },

  findByStatus: (status) => all('SELECT * FROM games WHERE status = $1', [status]),

  create: (gameData) => run(`
    INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, called_numbers, total_numbers, winner_pattern, house_cut_percentage, user_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, [
    gameData.id,
    gameData.gameNumber,
    gameData.status,
    gameData.betMoney,
    gameData.winMoney,
    gameData.cartelasSelected,
    JSON.stringify(gameData.calledNumbers || []),
    gameData.totalNumbers,
    gameData.winnerPattern,
    gameData.houseCutPercentage || 10.0,
    gameData.user_id,
    gameData.createdAt || new Date().toISOString(),
    gameData.updatedAt || new Date().toISOString()
  ]),

  update: (id, updateData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push(updateData.status);
      paramCount++;
    }
    if (updateData.called_numbers !== undefined) {
      fields.push(`called_numbers = $${paramCount}`);
      values.push(JSON.stringify(updateData.called_numbers));
      paramCount++;
    }
    if (updateData.winner_pattern !== undefined) {
      fields.push(`winner_pattern = $${paramCount}`);
      values.push(updateData.winner_pattern);
      paramCount++;
    }

    fields.push(`updated_at = NOW()`);


    values.push(id);

    const sql = `UPDATE games SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    return run(sql, values);
  },

  deleteById: (id) => run('DELETE FROM games WHERE id = $1', [id])
};

// Database operations for cartelas
const cartelaOperations = {
  // Optimized: Fetch first 2000 active cartelas (fastest query possible)
  // Using indexed column for WHERE, no complex ORDER BY for speed
  findAll: () => all('SELECT id, card_id, user_id, game_id, numbers, pattern, is_active, is_winner, purchased_at FROM cartelas WHERE is_active = 1 LIMIT 2000'),

  findByUserId: (userId) => all('SELECT * FROM cartelas WHERE user_id = $1', [userId]),

  findByCardId: (cardId) => get('SELECT * FROM cartelas WHERE card_id = $1', [cardId]),

  findById: (id) => get('SELECT * FROM cartelas WHERE id = $1', [id]),

  create: (cartelaData) => run(`
    INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    cartelaData.id,
    cartelaData.card_id || cartelaData.cardId,
    cartelaData.game_id,
    cartelaData.user_id,
    JSON.stringify(cartelaData.numbers),
    cartelaData.pattern,
    cartelaData.is_active !== false,
    !!cartelaData.is_winner,
    cartelaData.purchased_at || new Date().toISOString()
  ]),

  update: (id, updateData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.card_id !== undefined) {
      fields.push(`card_id = $${paramCount}`);
      values.push(updateData.card_id);
      paramCount++;
    }
    if (updateData.game_id !== undefined) {
      fields.push(`game_id = $${paramCount}`);
      values.push(updateData.game_id);
      paramCount++;
    }
    if (updateData.user_id !== undefined) {
      fields.push(`user_id = $${paramCount}`);
      values.push(updateData.user_id);
      paramCount++;
    }
    if (updateData.numbers !== undefined) {
      fields.push(`numbers = $${paramCount}`);
      values.push(JSON.stringify(updateData.numbers));
      paramCount++;
    }
    if (updateData.pattern !== undefined) {
      fields.push(`pattern = $${paramCount}`);
      values.push(updateData.pattern);
      paramCount++;
    }
    if (updateData.is_active !== undefined) {
      fields.push(`is_active = $${paramCount}`);
      values.push(updateData.is_active);
      paramCount++;
    }
    if (updateData.is_winner !== undefined) {
      fields.push(`is_winner = $${paramCount}`);
      values.push(updateData.is_winner);
      paramCount++;
    }

    // Note: cartelas table doesn't have updated_at column, so we don't update it

    values.push(id);

    const sql = `UPDATE cartelas SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    return run(sql, values);
  },

  deleteById: (id) => run('DELETE FROM cartelas WHERE id = $1', [id])
};

// Database operations for admin logs
const adminLogOperations = {
  findAll: () => all('SELECT * FROM admin_logs ORDER BY created_at DESC'),

  create: (logData) => run(`
    INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    logData.id,
    logData.adminId,
    logData.action,
    logData.targetType,
    logData.targetId,
    JSON.stringify(logData.details || {}),
    logData.ipAddress,
    logData.createdAt || new Date().toISOString()
  ])
};

// Database operations for sounds
const soundOperations = {
  findAll: () => all('SELECT * FROM sounds ORDER BY id'),

  findByType: (type) => all('SELECT * FROM sounds WHERE type = $1 ORDER BY name', [type]),

  findByName: (name) => get('SELECT * FROM sounds WHERE name = $1', [name]),

  create: (soundData) => run(`
    INSERT INTO sounds (name, file_path, type, created_at)
    VALUES ($1, $2, $3, $4)
  `, [
    soundData.name,
    soundData.file_path,
    soundData.type,
    soundData.created_at || new Date().toISOString()
  ])
};

// Database operations for user settings
const userSettingsOperations = {
  findByUserId: async (userId) => {
    const settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    if (settings) {
      return {
        id: settings.id,
        userId: settings.user_id,
        selectedPattern: settings.selected_pattern,
        betAmount: parseFloat(settings.bet_amount),
        houseCutPercentage: parseFloat(settings.house_cut_percentage),
        voiceCategory: settings.voice_category, // No default - can be null/undefined
        createdAt: settings.created_at,
        updatedAt: settings.updated_at
      };
    }
    return null;
  },

  create: async (userId, settingsData) => {
    // Build dynamic SQL based on provided data
    const fields = ['user_id', 'selected_pattern', 'bet_amount', 'house_cut_percentage', 'created_at', 'updated_at'];
    const values = [
      userId,
      settingsData.selectedPattern || 'Two Lines',
      settingsData.betAmount || 5.0,
      settingsData.houseCutPercentage || 10.0,
      new Date().toISOString(),
      new Date().toISOString()
    ];
    const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6'];
    const updateFields = [
      'selected_pattern = EXCLUDED.selected_pattern',
      'bet_amount = EXCLUDED.bet_amount',
      'house_cut_percentage = EXCLUDED.house_cut_percentage',
      'updated_at = EXCLUDED.updated_at'
    ];

    // Only include voice_category if explicitly provided
    if (settingsData.voiceCategory !== undefined) {
      fields.push('voice_category');
      values.push(settingsData.voiceCategory);
      placeholders.push('$7');
      updateFields.push('voice_category = EXCLUDED.voice_category');
    }

    const result = await run(`
      INSERT INTO user_settings (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (user_id) DO UPDATE SET
        ${updateFields.join(', ')}
      RETURNING *
    `, values);
    return result;
  },

  update: async (userId, updateData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.selectedPattern !== undefined) {
      fields.push(`selected_pattern = $${paramCount}`);
      values.push(updateData.selectedPattern);
      paramCount++;
    }
    if (updateData.betAmount !== undefined) {
      fields.push(`bet_amount = $${paramCount}`);
      values.push(updateData.betAmount);
      paramCount++;
    }
    if (updateData.houseCutPercentage !== undefined) {
      fields.push(`house_cut_percentage = $${paramCount}`);
      values.push(updateData.houseCutPercentage);
      paramCount++;
    }
    if (updateData.voiceCategory !== undefined) {
      fields.push(`voice_category = $${paramCount}`);
      values.push(updateData.voiceCategory);
      paramCount++;
    }

    fields.push(`updated_at = NOW()`);


    values.push(userId);

    const sql = `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $${paramCount}`;
    return run(sql, values);
  }
};

// Database operations for daily bonuses
const dailyBonusOperations = {
  findByUserAndDate: async (userId, date) => {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    return get('SELECT * FROM daily_bonuses WHERE user_id = $1 AND bonus_date = $2', [userId, dateStr]);
  },

  findByUser: async (userId, limit = 30) => {
    return all('SELECT * FROM daily_bonuses WHERE user_id = $1 ORDER BY bonus_date DESC LIMIT $2', [userId, limit]);
  },

  create: async (bonusData) => {
    return run(`
      INSERT INTO daily_bonuses (id, user_id, bonus_date, daily_profit, bonus_amount, bonus_type, requirements_met, bonus_claimed, bonus_used, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), COALESCE($11, NOW()))
    `, [
      bonusData.id || uuidv4(),
      bonusData.userId,
      bonusData.bonusDate,
      bonusData.dailyProfit || 0,
      bonusData.bonusAmount || 200,
      bonusData.bonusType || 'house_bonus',
      bonusData.requirementsMet || false,
      bonusData.bonusClaimed || false,
      bonusData.bonusUsed || false,
      bonusData.createdAt || null,
      bonusData.updatedAt || null
    ]);
  },

  update: async (userId, date, updateData) => {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.dailyProfit !== undefined) {
      fields.push(`daily_profit = $${paramCount}`);
      values.push(updateData.dailyProfit);
      paramCount++;
    }
    if (updateData.bonusAmount !== undefined) {
      fields.push(`bonus_amount = $${paramCount}`);
      values.push(updateData.bonusAmount);
      paramCount++;
    }
    if (updateData.requirementsMet !== undefined) {
      fields.push(`requirements_met = $${paramCount}`);
      values.push(updateData.requirementsMet);
      paramCount++;
    }
    if (updateData.bonusClaimed !== undefined) {
      fields.push(`bonus_claimed = $${paramCount}`);
      values.push(updateData.bonusClaimed);
      paramCount++;
    }
    if (updateData.bonusUsed !== undefined) {
      fields.push(`bonus_used = $${paramCount}`);
      values.push(updateData.bonusUsed);
      paramCount++;
    }

    fields.push(`updated_at = NOW()`);


    values.push(userId);
    values.push(dateStr);

    const sql = `UPDATE daily_bonuses SET ${fields.join(', ')} WHERE user_id = $${paramCount} AND bonus_date = $${paramCount+1}`;
    return run(sql, values);
  },

  getLeaderboard: async (date, limit = 10) => {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    return all(`
      SELECT db.*, u.username 
      FROM daily_bonuses db 
      JOIN users u ON db.user_id = u.id 
      WHERE db.bonus_date = $1 AND db.requirements_met = true 
      ORDER BY db.daily_profit DESC, db.bonus_amount DESC 
      LIMIT $2
    `, [dateStr, limit]);
  }
};

// Health check function
const checkConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database health check passed:', {
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]
    });
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Database pool closed gracefully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error.message);
  }
};

module.exports = {
  pool,
  run,
  get,
  all,
  createTables,
  checkConnection,
  closePool,
  users: userOperations,
  games: gameOperations,
  cartelas: cartelaOperations,
  adminLogs: adminLogOperations,
  sounds: soundOperations,
  userSettings: userSettingsOperations,
  dailyBonuses: dailyBonusOperations
};
