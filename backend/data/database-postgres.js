const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});



// Create database tables
const createTables = async () => {
  try {
    const client = await pool.connect();

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        balance DECIMAL(10,2) DEFAULT 0.00,
        total_games_played INTEGER DEFAULT 0,
        total_winnings DECIMAL(10,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Games table
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        game_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        bet_money DECIMAL(10,2) NOT NULL,
        win_money DECIMAL(10,2) NOT NULL,
        cartelas_selected INTEGER NOT NULL,
        called_numbers JSONB,
        total_numbers INTEGER NOT NULL,
        winner_pattern TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cartelas table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cartelas (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        game_id TEXT,
        user_id UUID,
        numbers JSONB NOT NULL,
        pattern TEXT,
        is_active BOOLEAN DEFAULT true,
        is_winner BOOLEAN DEFAULT false,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Admin logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id TEXT PRIMARY KEY,
        admin_id UUID NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        details JSONB,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
      CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
      CREATE INDEX IF NOT EXISTS idx_cartelas_user_id ON cartelas(user_id);
      CREATE INDEX IF NOT EXISTS idx_cartelas_game_id ON cartelas(game_id);
      CREATE INDEX IF NOT EXISTS idx_cartelas_card_id ON cartelas(card_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
    `);

    client.release();
    console.log('✅ Database tables and indexes created');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to execute queries without returning results
const run = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a single row
const get = async (text, params) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

// Helper function to get all rows
const all = async (text, params) => {
  const result = await query(text, params);
  return result.rows;
};

// Database operations for users
const userOperations = {
  findById: async (id) => {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        password: user.password,
        role: user.role,
        balance: parseFloat(user.balance),
        totalGamesPlayed: parseInt(user.total_games_played),
        totalWinnings: parseFloat(user.total_winnings),
        is_active: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    }
    return null;
  },

  findByEmail: async (email) => {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        password: user.password,
        role: user.role,
        balance: parseFloat(user.balance),
        totalGamesPlayed: parseInt(user.total_games_played),
        totalWinnings: parseFloat(user.total_winnings),
        is_active: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    }
    return null;
  },

  findByUsername: async (username) => {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        password: user.password,
        role: user.role,
        balance: parseFloat(user.balance),
        totalGamesPlayed: parseInt(user.total_games_played),
        totalWinnings: parseFloat(user.total_winnings),
        is_active: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    }
    return null;
  },

  findAll: async () => {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role,
      balance: parseFloat(user.balance),
      totalGamesPlayed: parseInt(user.total_games_played),
      totalWinnings: parseFloat(user.total_winnings),
      is_active: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
  },

  create: async (userData) => {
    const result = await query(`
      INSERT INTO users (id, username, email, password, role, balance, total_games_played, total_winnings, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userData.id,
      userData.username,
      userData.email,
      userData.password,
      userData.role || 'user',
      userData.balance || 0,
      userData.totalGamesPlayed || 0,
      userData.totalWinnings || 0,
      userData.is_active !== false,
      userData.createdAt || new Date(),
      userData.updatedAt || new Date()
    ]);

    const user = result.rows[0];
    console.log(`✅ User created: ${user.username}`);
    return user;
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
    if (updateData.balance !== undefined) {
      fields.push(`balance = $${paramCount}`);
      values.push(updateData.balance);
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
    values.push(new Date());
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount + 1}`;
    const result = await query(sql, values);
    return result.rows[0];
  },

  deleteById: async (id) => {
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount > 0;
  },

  deleteByEmail: async (email) => {
    const result = await query('DELETE FROM users WHERE email = $1', [email]);
    return result.rowCount > 0;
  }
};

// Database operations for games
const gameOperations = {
  findAll: async () => {
    const result = await query('SELECT * FROM games ORDER BY created_at DESC');
    return result.rows.map(game => ({
      id: game.id,
      gameNumber: game.game_number,
      status: game.status,
      betMoney: parseFloat(game.bet_money),
      winMoney: parseFloat(game.win_money),
      cartelasSelected: game.cartelas_selected,
      calledNumbers: game.called_numbers || [],
      totalNumbers: game.total_numbers,
      winnerPattern: game.winner_pattern,
      createdAt: game.created_at,
      updatedAt: game.updated_at
    }));
  },

  findById: async (id) => {
    const result = await query('SELECT * FROM games WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const game = result.rows[0];
      return {
        id: game.id,
        gameNumber: game.game_number,
        status: game.status,
        betMoney: parseFloat(game.bet_money),
        winMoney: parseFloat(game.win_money),
        cartelasSelected: game.cartelas_selected,
        calledNumbers: game.called_numbers || [],
        totalNumbers: game.total_numbers,
        winnerPattern: game.winner_pattern,
        createdAt: game.created_at,
        updatedAt: game.updated_at
      };
    }
    return null;
  },

  findByStatus: async (status) => {
    const result = await query('SELECT * FROM games WHERE status = $1', [status]);
    return result.rows;
  },

  create: async (gameData) => {
    const result = await query(`
      INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, called_numbers, total_numbers, winner_pattern, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
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
      gameData.createdAt || new Date(),
      gameData.updatedAt || new Date()
    ]);
    return result.rows[0];
  },

  update: async (id, updateData) => {
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
    values.push(new Date());
    values.push(id);

    const sql = `UPDATE games SET ${fields.join(', ')} WHERE id = $${paramCount + 1}`;
    const result = await query(sql, values);
    return result.rows[0];
  },

  deleteById: async (id) => {
    const result = await query('DELETE FROM games WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

// Database operations for cartelas
const cartelaOperations = {
  findAll: async () => {
    const result = await query('SELECT * FROM cartelas ORDER BY purchased_at DESC');
    return result.rows;
  },

  findByUserId: async (userId) => {
    const result = await query('SELECT * FROM cartelas WHERE user_id = $1', [userId]);
    return result.rows;
  },

  findByCardId: async (cardId) => {
    const result = await query('SELECT * FROM cartelas WHERE card_id = $1', [cardId]);
    return result.rows[0] || null;
  },

  findById: async (id) => {
    const result = await query('SELECT * FROM cartelas WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  create: async (cartelaData) => {
    const result = await query(`
      INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      cartelaData.id,
      cartelaData.card_id || cartelaData.cardId,
      cartelaData.game_id,
      cartelaData.user_id,
      JSON.stringify(cartelaData.numbers),
      cartelaData.pattern,
      cartelaData.is_active !== false,
      cartelaData.is_winner || false,
      cartelaData.purchased_at || new Date()
    ]);
    return result.rows[0];
  },

  update: async (id, updateData) => {
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

    values.push(id);

    const sql = `UPDATE cartelas SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    const result = await query(sql, values);
    return result.rows[0];
  },

  deleteById: async (id) => {
    const result = await query('DELETE FROM cartelas WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

// Database operations for admin logs
const adminLogOperations = {
  findAll: async () => {
    const result = await query('SELECT * FROM admin_logs ORDER BY created_at DESC');
    return result.rows;
  },

  create: async (logData) => {
    const result = await query(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      logData.id,
      logData.adminId,
      logData.action,
      logData.targetType,
      logData.targetId,
      JSON.stringify(logData.details || {}),
      logData.ipAddress,
      logData.createdAt || new Date()
    ]);
    return result.rows[0];
  }
};

// Close database connection pool
const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    console.log('Database connection pool closed');
  }
};

module.exports = {
  createTables,
  closeDatabase,
  run,
  get,
  all,
  users: userOperations,
  games: gameOperations,
  cartelas: cartelaOperations,
  adminLogs: adminLogOperations
};
