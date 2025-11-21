const { Pool } = require('pg');
const types = require('pg').types;
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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
} : {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'amour_bingo',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

// Also configure the pool to handle boolean values correctly
pool.on('connect', (client) => {
  client.query('SET datestyle = ISO, MDY');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Promisify database operations for async/await support
const run = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return {
      id: result.rows[0]?.id,
      changes: result.rowCount,
      rows: result.rows
    };
  } finally {
    client.release();
  }
};

const get = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

const all = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
};

// Initialize database schema
const createTables = async () => {
  try {
    console.log('Initializing database...');

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to existing tables if missing
    await run(`ALTER TABLE games ADD COLUMN IF NOT EXISTS number_sequence TEXT`);
    await run(`ALTER TABLE games ADD COLUMN IF NOT EXISTS selected_cartelas TEXT`);

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
        FOREIGN KEY (game_id) REFERENCES games (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

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
        FOREIGN KEY (admin_id) REFERENCES users (id)
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

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
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

    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date().toISOString());
    paramCount++;

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
        createdAt: game.created_at,
        updatedAt: game.updated_at
      };
    }
    return null;
  },

  findByStatus: (status) => all('SELECT * FROM games WHERE status = $1', [status]),

  create: (gameData) => run(`
    INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, called_numbers, total_numbers, winner_pattern, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date().toISOString());
    paramCount++;

    values.push(id);

    const sql = `UPDATE games SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    return run(sql, values);
  },

  deleteById: (id) => run('DELETE FROM games WHERE id = $1', [id])
};

// Database operations for cartelas
const cartelaOperations = {
  findAll: () => all('SELECT * FROM cartelas ORDER BY purchased_at DESC'),

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
        createdAt: settings.created_at,
        updatedAt: settings.updated_at
      };
    }
    return null;
  },

  create: async (userId, settingsData) => {
    const result = await run(`
      INSERT INTO user_settings (user_id, selected_pattern, bet_amount, house_cut_percentage, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        selected_pattern = EXCLUDED.selected_pattern,
        bet_amount = EXCLUDED.bet_amount,
        house_cut_percentage = EXCLUDED.house_cut_percentage,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `, [
      userId,
      settingsData.selectedPattern || 'Two Lines',
      settingsData.betAmount || 10.0,
      settingsData.houseCutPercentage || 10.0,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
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

    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date().toISOString());
    paramCount++;

    values.push(userId);

    const sql = `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $${paramCount}`;
    return run(sql, values);
  }
};

module.exports = {
  pool,
  run,
  get,
  all,
  createTables,
  users: userOperations,
  games: gameOperations,
  cartelas: cartelaOperations,
  adminLogs: adminLogOperations,
  sounds: soundOperations,
  userSettings: userSettingsOperations
};
