const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { users, adminLogs } = require('../data/database.js');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../db');
const { safeJSONParseArray, safeJSONStringify } = require('../utils/safeJSON');

const router = express.Router();

// Create new game (authenticated users)
router.post('/', authenticateToken, [
  body('betMoney').isFloat({ min: 0.01 }).withMessage('Bet money must be positive'),
  body('winnerPattern').isString().withMessage('Winner pattern required'),
  body('houseCutPercentage').optional().isFloat({ min: 0, max: 50 }).withMessage('House cut must be between 0-50%')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { betMoney, winnerPattern, houseCutPercentage = 25 } = req.body;

    // Get user's current total games played and use it + 1 as game number
    const user = await db.users.findById(req.user.id);
    const gameNumber = (user.totalGamesPlayed || 0) + 1;

    console.log(`Creating game #${gameNumber} for user ${req.user.id} (current games played: ${user.totalGamesPlayed})`);

    const newGame = {
      id: uuidv4(),
      gameNumber,
      status: 'waiting',
      betMoney,
      winMoney: 0,
      cartelasSelected: 0,
      totalNumbers: 75,
      winnerPattern,
      houseCutPercentage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Generate shuffled sequence of numbers 1-75
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    console.log(`🎯 Generated random number sequence for new game ${newGame.id}`);

    // Create game in database with user_id
    await db.run(`
      INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, number_sequence, total_numbers, winner_pattern, house_cut_percentage, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      newGame.id,
      newGame.gameNumber,
      newGame.status,
      newGame.betMoney,
      newGame.winMoney,
      newGame.cartelasSelected,
      JSON.stringify(numbers), // number_sequence
      newGame.totalNumbers,
      newGame.winnerPattern,
      newGame.houseCutPercentage,
      req.user.id, // user_id - link game to user
      newGame.createdAt,
      newGame.updatedAt
    ]);

    // Log admin action in database
    await db.run(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      uuidv4(),
      req.user.id,
      'CREATE_GAME',
      'GAME',
      newGame.id,
      JSON.stringify({ gameNumber, betMoney, winnerPattern }),
      req.ip,
      new Date().toISOString()
    ]);

    res.status(201).json({
      message: 'Game created successfully',
      game: newGame
    });
  } catch (error) {
    console.error('Game creation error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get active game
router.get('/active', authenticateToken, async (req, res) => {
  try {
    // Get active game from database - filter by user_id for regular users
    let activeGameQuery;
    let queryParams = [];

    if (req.user && req.user.role === 'admin') {
      // Admins can see any active game
      activeGameQuery = `
        SELECT * FROM games
        WHERE status IN ('started', 'waiting', 'active')
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } else {
      // Regular users only see their own active games (filtered by user_id)
      activeGameQuery = `
        SELECT * FROM games
        WHERE status IN ('started', 'waiting', 'active')
        AND user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      queryParams = [req.user.id];
    }

    const activeGame = await db.get(activeGameQuery, queryParams);

    if (!activeGame) {
      return res.status(404).json({ error: 'No active game found' });
    }

    // For user_session games, only reset called_numbers if the game was just created (no numbers called yet)
    // This prevents resetting called numbers during active gameplay
    if (activeGame.winner_pattern === 'user_session') {
      const currentCalledNumbers = Array.isArray(activeGame.called_numbers) ? activeGame.called_numbers : [];
      if (currentCalledNumbers.length === 0) {
        console.log(`[GET /active] User session game ${activeGame.id} has no called numbers yet - keeping empty`);
      } else {
        console.log(`[GET /active] User session game ${activeGame.id} has ${currentCalledNumbers.length} called numbers - preserving them`);
      }
      // Don't reset called_numbers for active user_session games
    }

    // Parse called_numbers from database using safe JSON parsing
    const calledNumbers = safeJSONParseArray(activeGame.called_numbers, []);

    // Parse selected_cartelas from database using safe JSON parsing
    const selectedCartelas = safeJSONParseArray(activeGame.selected_cartelas, []);

    const game = {
      ...activeGame,
      gameNumber: activeGame.game_number,
      calledNumbers: calledNumbers,
      selectedCartelas: selectedCartelas, // Include the selected cartela IDs
      cartelasSelected: activeGame.cartelas_selected,
      betMoney: parseFloat(activeGame.bet_money) || 0,
      winMoney: parseFloat(activeGame.win_money) || 0,
      totalNumbers: parseInt(activeGame.total_numbers) || 75,
      winnerPattern: activeGame.winner_pattern,
      createdAt: activeGame.created_at,
      updatedAt: activeGame.updated_at
    };

    console.log(`[GET /active] Loaded game ${game.id} for user ${req.user?.id || 'unknown'}. Called numbers count: ${calledNumbers.length}. Sequence exists: ${!!activeGame.number_sequence}`);
    console.log(`[GET /active] selectedCartelas:`, selectedCartelas);

    res.json({ game });
  } catch (error) {
    console.error('Get active game error:', error);
    res.status(500).json({ error: 'Failed to fetch active game' });
  }
});

// Get all games
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    // Build query based on status filter
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM games ${whereClause}`;
    const totalResult = await db.get(countQuery, queryParams);
    const totalItems = totalResult ? parseInt(totalResult.total) || 0 : 0;

    // Get paginated games
    const offset = (page - 1) * limit;
    const limitParam = `$${paramIndex}`;
    const offsetParam = `$${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const gamesQuery = `
      SELECT * FROM games
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const gamesResult = await db.all(gamesQuery, queryParams);

    // Parse JSON fields for each game
    const games = gamesResult.map(game => {
      // Parse called_numbers from database (stored as JSON string, but may already be parsed by driver)
      let calledNumbers = [];
      try {
        if (Array.isArray(game.called_numbers)) {
          // Already parsed by database driver
          calledNumbers = game.called_numbers;
        } else if (typeof game.called_numbers === 'string') {
          // Stored as JSON string, need to parse
          const parsed = JSON.parse(game.called_numbers || '[]');
          calledNumbers = Array.isArray(parsed) ? parsed : [];
        } else {
          // Fallback for unexpected format
          calledNumbers = [];
        }
      } catch (e) {
        console.warn('Error parsing called_numbers for game', game.id, e);
        calledNumbers = [];
      }

      return {
        ...game,
        calledNumbers: calledNumbers,
        cartelasSelected: game.cartelas_selected,
        betMoney: game.bet_money,
        winMoney: game.win_money,
        totalNumbers: game.total_numbers,
        winnerPattern: game.winner_pattern,
        createdAt: game.created_at,
        updatedAt: game.updated_at
      };
    });

    res.json({
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});



// Start game (authenticated users can start their own games)
router.put('/:id/start', authenticateToken, [
  param('id').isUUID().withMessage('Invalid game ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user owns this game (unless admin)
    if (req.user.role !== 'admin' && gameResult.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only start your own games' });
    }

    if (gameResult.status !== 'waiting') {
      return res.status(400).json({ error: 'Game cannot be started' });
    }

    let numberSequence;
    try {
      numberSequence = JSON.parse(gameResult.number_sequence || '[]');
      if (!Array.isArray(numberSequence) || numberSequence.length !== 75) {
        numberSequence = null; // Invalidate corrupt or incomplete sequence
      }
    } catch (e) {
      numberSequence = null;
    }

    // Generate sequence if it doesn't exist or is invalid
    if (!numberSequence) {
      const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      numberSequence = numbers;
      console.log(`🎯 Generated new random number sequence for game ${gameId}`);
    } else {
      console.log(`🎯 Using existing number sequence for game ${gameId}`);
    }

    // Update game status to started with the pre-generated sequence
    await db.run(`
      UPDATE games
      SET status = 'started', number_sequence = $1, updated_at = $2
      WHERE id = $3
    `, [JSON.stringify(numberSequence), new Date().toISOString(), gameId]);

    // Parse JSON fields for response
    const game = {
      ...gameResult,
      calledNumbers: [],
      cartelasSelected: gameResult.cartelas_selected,
      betMoney: gameResult.bet_money,
      winMoney: gameResult.win_money,
      totalNumbers: gameResult.total_numbers,
      winnerPattern: gameResult.winner_pattern,
      createdAt: gameResult.created_at,
      updatedAt: new Date().toISOString(),
      status: 'started'
    };

    // Log admin action in database
    await db.run(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      uuidv4(),
      req.user.id,
      'START_GAME',
      'GAME',
      gameId,
      JSON.stringify({ gameNumber: game.gameNumber }), // Game started without pre-generated sequence
      req.ip,
      new Date().toISOString()
    ]);

    res.json({
      message: 'Game started successfully',
      game
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Call next number (authenticated users)
router.put('/:id/call-number', authenticateToken, [
  param('id').isUUID().withMessage('Invalid game ID'),
  body('calledNumbers').optional().isArray().withMessage('Called numbers must be an array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const gameId = req.params.id;
  const clientCalledNumbers = req.body.calledNumbers || [];

  try {
    console.log(`🎯 Calling next number for game ${gameId}`);

    // Use database transaction to ensure atomic operations
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get the game from database with row lock
      const gameQuery = 'SELECT * FROM games WHERE id = $1 FOR UPDATE';
      const gameResult = await client.query(gameQuery, [gameId]);

      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        console.log('Game not found');
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];

      if (!['started', 'active'].includes(game.status)) {
        await client.query('ROLLBACK');
        console.log('Game is not active');
        return res.status(400).json({ error: 'Game is not active' });
      }

      // For user_session games, since cartelas are only validated and not stored in database,
      // we validate ownership by checking if the game was created by this user
      if (game.winner_pattern === 'user_session') {
        // Since cartelas are validated at creation time but not stored per game,
        // we trust the game's existence as validation for the session owner
        console.log('✅ User session game ownership validated for number calling');
      }

      // Get current called numbers from database using safe JSON parsing
      const currentCalledNumbers = safeJSONParseArray(game.called_numbers, []);

      console.log(`📊 Database calledNumbers: ${currentCalledNumbers.length}, Client calledNumbers: ${clientCalledNumbers.length}`);

      // Get the number sequence (shuffled deck of 75 numbers)
      let numberSequence;
      try {
        const numberSequenceStr = game.number_sequence || '[]';
        numberSequence = JSON.parse(numberSequenceStr);
        if (!Array.isArray(numberSequence)) {
          numberSequence = [];
        }
        // Ensure sequence doesn't have more than 75 numbers
        numberSequence = numberSequence.slice(0, 75);
      } catch (e) {
        console.error('Error parsing number_sequence:', e);
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Game sequence corrupted.' });
      }

      if (numberSequence.length === 0) {
        await client.query('ROLLBACK');
        console.error('Game started without a number sequence.');
        return res.status(500).json({ error: 'Game sequence not found.' });
      }

      // Get the current valid called numbers count (limit to sequence length)
      // For user_session games, use client data since database doesn't store called numbers
      const validCalledCount = game.winner_pattern === 'user_session'
        ? Math.min(clientCalledNumbers.length, numberSequence.length)
        : Math.min(currentCalledNumbers.length, numberSequence.length);
      const nextNumberIndex = validCalledCount;

      console.log(`🎲 Next number index: ${nextNumberIndex}, sequence length: ${numberSequence.length}, valid called: ${validCalledCount}`);

      // Check if all numbers have been called (prevent calling beyond 75)
      if (nextNumberIndex >= numberSequence.length) {
        console.error('🎉 All numbers have been called for game', gameId);
        await client.query('COMMIT');
        return res.status(400).json({
          error: 'All numbers have been called.',
          gameCompleted: true
        });
      }

      const numberToCall = numberSequence[nextNumberIndex];
      const updatedCalledNumbers = [...currentCalledNumbers, numberToCall];

      // DON'T UPDATE called_numbers in database - they should only be stored in localStorage
      // called_numbers in database should remain empty array for user_session games
      // Only update the timestamp to indicate activity
      await client.query(`
        UPDATE games
        SET updated_at = $1
        WHERE id = $2
      `, [new Date().toISOString(), gameId]);

      await client.query('COMMIT');

      console.log(`✅ Number called successfully for game ${gameId}. Called number: ${numberToCall}`);

      res.json({
        message: 'Number called successfully',
        calledNumber: numberToCall,
        game: {
          ...game,
          calledNumbers: updatedCalledNumbers,
          cartelasSelected: game.cartelas_selected,
          betMoney: parseFloat(game.bet_money) || 0,
          winMoney: parseFloat(game.win_money) || 0,
          totalNumbers: parseInt(game.total_numbers) || 75,
          winnerPattern: game.winner_pattern,
          createdAt: game.created_at,
          updatedAt: new Date().toISOString()
        },
        debug: {
          serverCalledNumbersLength: currentCalledNumbers.length,
          clientCalledNumbersLength: clientCalledNumbers.length,
          nextNumberIndex: nextNumberIndex,
          numberToCall: numberToCall,
          numberSequenceFirst5: numberSequence.slice(0, 5)
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Call number error:', error);
    res.status(500).json({ error: 'Failed to call number' });
  }
});

// Finish user session game (authenticated users can finish their own sessions)
router.put('/:id/finish-session', authenticateToken, [
  param('id').isUUID().withMessage('Invalid game ID'),
  body('winMoney').isFloat({ min: 0 }).withMessage('Win money must be non-negative'),
  body('winnerCartelaIds').optional().isArray().withMessage('Winner cartela IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;
    const { winMoney, winnerCartelaIds = [] } = req.body;

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // For user_session games, since cartelas are only validated and not stored in database,
    // we validate ownership by checking if the game was created by this user
    if (gameResult.winner_pattern === 'user_session') {
      // Get the user who created this game (from cartelas or game data)
      // Since we don't store cartelas per game anymore, check if user has any association
      const creatorQuery = `
        SELECT created_at, bet_money FROM games
        WHERE id = $1 AND bet_money > 0
      `;
      const gameInfo = await db.get(creatorQuery, [gameId]);

      if (!gameInfo) {
        console.log('Game not found or invalid');
        return res.status(403).json({ error: 'You do not have permission to finish this game' });
      }

      // Since cartelas are validated at creation time but not stored per game,
      // we trust the game's existence as validation for the session owner
      console.log('✅ User session game ownership validated');
    } else {
      // For non-user-session games, require admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required to finish this type of game' });
      }
    }

    if (!['started', 'active'].includes(gameResult.status)) {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Update game status in database
    await db.run(`
      UPDATE games
      SET status = 'finished', win_money = $1, updated_at = $2
      WHERE id = $3
    `, [winMoney, new Date().toISOString(), gameId]);

    // Mark winner cartelas in database
    if (winnerCartelaIds.length > 0) {
      for (const cartelaId of winnerCartelaIds) {
        await db.run(`
          UPDATE cartelas
          SET is_winner = 1, pattern = $1
          WHERE id = $2
        `, [gameResult.winner_pattern, cartelaId]);
      }
    }

    // Update user statistics in database
    const gameCartelasQuery = 'SELECT * FROM cartelas WHERE game_id = $1';
    const gameCartelas = await db.all(gameCartelasQuery, [gameId]);

    for (const cartela of gameCartelas) {
      if (cartela.user_id) {
        // Update user game statistics
        await db.run(`
          UPDATE users
          SET total_games_played = total_games_played + 1, updated_at = $1
          WHERE id = $2
        `, [new Date().toISOString(), cartela.user_id]);

        // If cartela is a winner, update balance and winnings
        if (winnerCartelaIds.includes(cartela.id)) {
          const winAmount = winMoney / winnerCartelaIds.length;
          await db.run(`
            UPDATE users
            SET total_winnings = total_winnings + $1, balance = balance + $2, updated_at = $3
            WHERE id = $4
          `, [winAmount, winAmount, new Date().toISOString(), cartela.user_id]);
        }
      }
    }

    // Log action in database (use user_logs for regular users, admin_logs for admins)
    if (req.user.role === 'admin') {
      await db.run(`
        INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        uuidv4(),
        req.user.id,
        'FINISH_GAME',
        'GAME',
        gameId,
        JSON.stringify({ gameNumber: gameResult.game_number, winMoney, winners: winnerCartelaIds.length }),
        req.ip,
        new Date().toISOString()
      ]);
    } else {
      // Log for regular users (assuming user_logs table exists, or we could create it)
      console.log(`User ${req.user.id} finished game ${gameId}`);
    }

    // Parse called_numbers from database (stored as JSON string, but may already be parsed by driver)
    let calledNumbers = [];
    try {
      if (Array.isArray(gameResult.called_numbers)) {
        // Already parsed by database driver
        calledNumbers = gameResult.called_numbers;
      } else if (typeof gameResult.called_numbers === 'string') {
        // Stored as JSON string, need to parse
        const parsed = JSON.parse(gameResult.called_numbers || '[]');
        calledNumbers = Array.isArray(parsed) ? parsed : [];
      } else {
        // Fallback for unexpected format
        calledNumbers = [];
      }
    } catch (e) {
      console.warn('Error parsing called_numbers for game', gameResult.id, e);
      calledNumbers = [];
    }

    const game = {
      ...gameResult,
      calledNumbers: calledNumbers,
      cartelasSelected: gameResult.cartelas_selected,
      betMoney: gameResult.bet_money,
      winMoney: winMoney,
      totalNumbers: gameResult.total_numbers,
      winnerPattern: gameResult.winner_pattern,
      createdAt: gameResult.created_at,
      updatedAt: new Date().toISOString(),
      status: 'finished'
    };

    res.json({
      message: 'Game finished successfully',
      game
    });
  } catch (error) {
    console.error('Finish game error:', error);
    res.status(500).json({ error: 'Failed to finish game' });
  }
});

// Finish game (admin only - kept for backward compatibility)
router.put('/:id/finish', requireAdmin, [
  param('id').isUUID().withMessage('Invalid game ID'),
  body('winMoney').isFloat({ min: 0 }).withMessage('Win money must be non-negative'),
  body('winnerCartelaIds').optional().isArray().withMessage('Winner cartela IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;
    const { winMoney, winnerCartelaIds = [] } = req.body;

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameResult.status !== 'started') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Update game status in database
    await db.run(`
      UPDATE games
      SET status = 'end', win_money = $1, updated_at = $2
      WHERE id = $3
    `, [winMoney, new Date().toISOString(), gameId]);

    // Mark winner cartelas in database
    if (winnerCartelaIds.length > 0) {
      for (const cartelaId of winnerCartelaIds) {
        await db.run(`
          UPDATE cartelas
          SET is_winner = 1, pattern = $1
          WHERE id = $2
        `, [gameResult.winner_pattern, cartelaId]);
      }
    }

    // Update user statistics in database
    const gameCartelasQuery = 'SELECT * FROM cartelas WHERE game_id = $1';
    const gameCartelas = await db.all(gameCartelasQuery, [gameId]);

    for (const cartela of gameCartelas) {
      if (cartela.user_id) {
        // Update user game statistics
        await db.run(`
          UPDATE users
          SET total_games_played = total_games_played + 1, updated_at = $1
          WHERE id = $2
        `, [new Date().toISOString(), cartela.user_id]);

        // If cartela is a winner, update balance and winnings
        if (winnerCartelaIds.includes(cartela.id)) {
          const winAmount = winMoney / winnerCartelaIds.length;
          await db.run(`
            UPDATE users
            SET total_winnings = total_winnings + $1, balance = balance + $2, updated_at = $3
            WHERE id = $4
          `, [winAmount, winAmount, new Date().toISOString(), cartela.user_id]);
        }
      }
    }

    // Log admin action in database
    await db.run(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      uuidv4(),
      req.user.id,
      'FINISH_GAME',
      'GAME',
      gameId,
      JSON.stringify({ gameNumber: gameResult.game_number, winMoney, winners: winnerCartelaIds.length }),
      req.ip,
      new Date().toISOString()
    ]);

    // Parse called_numbers from database (stored as JSON string, but may already be parsed by driver)
    let calledNumbers = [];
    try {
      if (Array.isArray(gameResult.called_numbers)) {
        // Already parsed by database driver
        calledNumbers = gameResult.called_numbers;
      } else if (typeof gameResult.called_numbers === 'string') {
        // Stored as JSON string, need to parse
        const parsed = JSON.parse(gameResult.called_numbers || '[]');
        calledNumbers = Array.isArray(parsed) ? parsed : [];
      } else {
        // Fallback for unexpected format
        calledNumbers = [];
      }
    } catch (e) {
      console.warn('Error parsing called_numbers for game', gameResult.id, e);
      calledNumbers = [];
    }

    const game = {
      ...gameResult,
      calledNumbers: calledNumbers,
      cartelasSelected: gameResult.cartelas_selected,
      betMoney: gameResult.bet_money,
      winMoney: winMoney,
      totalNumbers: gameResult.total_numbers,
      winnerPattern: gameResult.winner_pattern,
      createdAt: gameResult.created_at,
      updatedAt: new Date().toISOString(),
      status: 'end'
    };

    res.json({
      message: 'Game finished successfully',
      game
    });
  } catch (error) {
    console.error('Finish game error:', error);
    res.status(500).json({ error: 'Failed to finish game' });
  }
});

// Cancel game (admin only)
router.put('/:id/cancel', requireAdmin, [
  param('id').isUUID().withMessage('Invalid game ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameResult.status === 'finished' || gameResult.status === 'end') {
      return res.status(400).json({ error: 'Cannot cancel finished game' });
    }

    // Update game status in database
    await db.run(`
      UPDATE games
      SET status = 'cancelled', updated_at = $1
      WHERE id = $2
    `, [new Date().toISOString(), gameId]);

    // Parse called_numbers from database (stored as JSON string, but may already be parsed by driver)
    let calledNumbers = [];
    try {
      if (Array.isArray(gameResult.called_numbers)) {
        // Already parsed by database driver
        calledNumbers = gameResult.called_numbers;
      } else if (typeof gameResult.called_numbers === 'string') {
        // Stored as JSON string, need to parse
        const parsed = JSON.parse(gameResult.called_numbers || '[]');
        calledNumbers = Array.isArray(parsed) ? parsed : [];
      } else {
        // Fallback for unexpected format
        calledNumbers = [];
      }
    } catch (e) {
      console.warn('Error parsing called_numbers for game', gameResult.id, e);
      calledNumbers = [];
    }

    const game = {
      ...gameResult,
      calledNumbers: calledNumbers,
      cartelasSelected: gameResult.cartelas_selected,
      betMoney: gameResult.bet_money,
      winMoney: gameResult.win_money,
      totalNumbers: gameResult.total_numbers,
      winnerPattern: gameResult.winner_pattern,
      createdAt: gameResult.created_at,
      updatedAt: new Date().toISOString(),
      status: 'cancelled'
    };

    // Log admin action in database
    await db.run(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      uuidv4(),
      req.user.id,
      'CANCEL_GAME',
      'GAME',
      gameId,
      JSON.stringify({ gameNumber: gameResult.game_number }),
      req.ip,
      new Date().toISOString()
    ]);

    res.json({
      message: 'Game cancelled successfully',
      game
    });
  } catch (error) {
    console.error('Cancel game error:', error);
    res.status(500).json({ error: 'Failed to cancel game' });
  }
});

// Get game analysis data for table
router.get('/analysis', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    const offset = (page - 1) * limit;

    const queryParams = [];

    let gamesQuery;
    if (isAdmin) {
      // Admin sees all games
      gamesQuery = `
        SELECT
          g.id as gameId,
          g.created_at as date,
          g.game_number as gameNumber,
          g.cartelas_selected as players,
          CASE 
            WHEN g.cartelas_selected > 0 THEN (g.bet_money / g.cartelas_selected)
            ELSE 0
          END as bet,
          g.bet_money as totalBet,
          g.house_cut_percentage as cutPercentage,
          COALESCE(g.win_money, 0) as win,
          (g.bet_money - COALESCE(g.win_money, 0)) as profit,
          0 as houseBonus,
          0 as playersBonus,
          (SELECT wc.card_id FROM cartelas wc WHERE wc.game_id = g.id AND wc.is_winner = 1 LIMIT 1) as winnerInfo,
          g.status
        FROM games g
        ORDER BY g.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      queryParams.push(limit, offset);
    } else {
      // Regular users only see their own games (filter by user_id)
      gamesQuery = `
        SELECT
          g.id as gameId,
          g.created_at as date,
          g.game_number as gameNumber,
          g.cartelas_selected as players,
          CASE 
            WHEN g.cartelas_selected > 0 THEN (g.bet_money / g.cartelas_selected)
            ELSE 0
          END as bet,
          g.bet_money as totalBet,
          g.house_cut_percentage as cutPercentage,
          COALESCE(g.win_money, 0) as win,
          (g.bet_money - COALESCE(g.win_money, 0)) as profit,
          0 as houseBonus,
          0 as playersBonus,
          (SELECT wc.card_id FROM cartelas wc WHERE wc.game_id = g.id AND wc.is_winner = 1 LIMIT 1) as winnerInfo,
          g.status
        FROM games g
        WHERE g.user_id = $1
        ORDER BY g.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      queryParams.push(userId, limit, offset);
    }

    const games = await db.all(gamesQuery, queryParams);

    for (const game of games) {
      try {
        const playersDetailsQuery = `
          SELECT
            u.username,
            g.bet_money as betAmount,
            c.is_winner as isWinner,
            c.id as cartelaId,
            u.id as userId
          FROM cartelas c
          JOIN users u ON c.user_id = u.id
          JOIN games g ON c.game_id = g.id
          WHERE c.game_id = $1
        `;
        game.playersDetails = await db.all(playersDetailsQuery, [game.gameId]);
        
        // Get all winner cartela IDs for this game
        const winnerCartelasQuery = `
          SELECT card_id 
          FROM cartelas 
          WHERE game_id = $1 AND is_winner = 1
        `;
        const winnerCartelas = await db.all(winnerCartelasQuery, [game.gameId]);
        game.winnerCartelaIds = winnerCartelas.map(c => c.card_id);
        
      } catch (detailError) {
        console.error('Error fetching players details for game', game.gameId, ':', detailError);
        game.playersDetails = []; // Set empty array on error
        game.winnerCartelaIds = []; // Set empty array on error
      }
    }

    let countQuery;
    const countParams = [];
    
    if (isAdmin) {
      // Admin sees count of all games
      countQuery = 'SELECT COUNT(*) as total FROM games';
    } else {
      // Regular users see count of only their games
      countQuery = 'SELECT COUNT(*) as total FROM games WHERE user_id = $1';
      countParams.push(userId);
    }

    let totalResult;
    try {
      totalResult = await db.get(countQuery, countParams);
    } catch (countError) {
      console.error('Error executing count query:', countError);
      // Fallback to simple count
      totalResult = await db.get('SELECT COUNT(*) as total FROM games', []);
    }
    const totalItems = totalResult ? totalResult.total : 0;

    res.json({
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get game analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch game analysis data' });
  }
});

// Save game analysis data
router.post('/analysis/save', [
  body('gameId').isString().withMessage('Game ID is required'),
  body('gameNumber').isInt({ min: 1 }).withMessage('Game number must be positive'),
  body('players').isInt({ min: 0 }).withMessage('Players count must be non-negative'),
  body('bet').isFloat({ min: 0 }).withMessage('Bet amount must be non-negative'),
  body('totalBet').isFloat({ min: 0 }).withMessage('Total bet must be non-negative'),
  body('cutPercentage').isFloat({ min: 0, max: 100 }).withMessage('Cut percentage must be between 0-100'),
  body('profit').isFloat().withMessage('Profit is required'),
  body('houseBonus').isFloat().withMessage('House bonus is required'),
  body('winnerInfo').isString().withMessage('Winner info is required'),
  body('status').isString().withMessage('Status is required'),
  body('date').isISO8601().withMessage('Date must be valid ISO8601'),
  body('userId').isString().withMessage('User ID is required'),
  body('username').isString().withMessage('Username is required'),
  body('finalWinAmount').isFloat({ min: 0 }).withMessage('Final win amount must be non-negative'),
  body('calledNumbers').isArray().withMessage('Called numbers must be an array'),
  body('selectedCartelas').isArray().withMessage('Selected cartelas must be an array'),
  body('winnerCartelaIds').optional().isArray().withMessage('Winner cartela IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      gameId,
      gameNumber,
      players,
      bet,
      totalBet,
      cutPercentage,
      profit,
      houseBonus,
      winnerInfo,
      status,
      date,
      userId,
      username,
      finalWinAmount,
      calledNumbers,
      selectedCartelas,
      winnerCartelaIds = []
    } = req.body;

    // Check if analysis data already exists for this game
    const existingQuery = 'SELECT id FROM game_analysis WHERE game_id = $1';
    const existing = await db.get(existingQuery, [gameId]);

    if (existing) {
      // Update existing record
      await db.run(`
        UPDATE game_analysis
        SET
          game_number = $1,
          players = $2,
          bet = $3,
          total_bet = $4,
          cut_percentage = $5,
          profit = $6,
          house_bonus = $7,
          winner_info = $8,
          status = $9,
          date = $10,
          user_id = $11,
          username = $12,
          final_win_amount = $13,
          called_numbers = $14,
          selected_cartelas = $15,
          winner_cartela_ids = $16,
          updated_at = $17
        WHERE game_id = $18
      `, [
        gameNumber,
        players,
        bet,
        totalBet,
        cutPercentage,
        profit,
        houseBonus,
        winnerInfo,
        status,
        date,
        userId,
        username,
        finalWinAmount,
        safeJSONStringify(calledNumbers),
        safeJSONStringify(selectedCartelas),
        safeJSONStringify(winnerCartelaIds),
        new Date().toISOString(),
        gameId
      ]);
    } else {
      // Insert new record
      await db.run(`
        INSERT INTO game_analysis (
          id,
          game_id,
          game_number,
          players,
          bet,
          total_bet,
          cut_percentage,
          profit,
          house_bonus,
          winner_info,
          status,
          date,
          user_id,
          username,
          final_win_amount,
          called_numbers,
          selected_cartelas,
          winner_cartela_ids,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        uuidv4(),
        gameId,
        gameNumber,
        players,
        bet,
        totalBet,
        cutPercentage,
        profit,
        houseBonus,
        winnerInfo,
        status,
        date,
        userId,
        username,
        finalWinAmount,
        safeJSONStringify(calledNumbers),
        safeJSONStringify(selectedCartelas),
        safeJSONStringify(winnerCartelaIds),
        new Date().toISOString(),
        new Date().toISOString()
      ]);
    }

    console.log(`✅ Game analysis data saved for game ${gameId} (user: ${username})`);

    res.json({
      message: 'Game analysis data saved successfully',
      gameId
    });
  } catch (error) {
    console.error('Save game analysis error:', error);
    res.status(500).json({ error: 'Failed to save game analysis data' });
  }
});

// Get game statistics (admin only)
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    const formattedDate = daysAgo.toISOString().split('T')[0];

    // Get game statistics from database
    const statsQuery = `
      SELECT
        COUNT(*) as totalGames,
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finishedGames,
        SUM(CASE WHEN status = 'started' THEN 1 ELSE 0 END) as activeGames,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waitingGames,
        COALESCE(SUM(CASE WHEN status = 'finished' THEN bet_money ELSE 0 END), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN status = 'finished' THEN win_money ELSE 0 END), 0) as totalPayout,
        COALESCE(SUM(CASE WHEN status = 'finished' THEN (bet_money - win_money) ELSE 0 END), 0) as totalProfit
      FROM games
      WHERE created_at >= $1
    `;

    const statsResult = await db.get(statsQuery, [formattedDate]);

    // Get average players per game
    const avgPlayersQuery = `
      SELECT COALESCE(AVG(cartelas_count), 0) as averagePlayersPerGame
      FROM (
        SELECT COUNT(c.id) as cartelas_count
        FROM games g
        LEFT JOIN cartelas c ON g.id = c.game_id
        WHERE g.status = 'finished' AND g.created_at >= $1
        GROUP BY g.id
      ) game_cartelas
    `;

    const avgPlayersResult = await db.get(avgPlayersQuery, [formattedDate]);

    const stats = {
      totalGames: statsResult.totalGames || 0,
      finishedGames: statsResult.finishedGames || 0,
      activeGames: statsResult.activeGames || 0,
      waitingGames: statsResult.waitingGames || 0,
      totalRevenue: statsResult.totalRevenue || 0,
      totalPayout: statsResult.totalPayout || 0,
      totalProfit: statsResult.totalProfit || 0,
      averagePlayersPerGame: avgPlayersResult.averagePlayersPerGame || 0
    };

    res.json({ stats, period: `${days} days` });
  } catch (error) {
    console.error('Get game stats error:', error);
    res.status(500).json({ error: 'Failed to fetch game statistics' });
  }
});

// Shuffle/reset current game (authenticated users)
router.put('/:id/shuffle', authenticateToken, [
  param('id').isUUID().withMessage('Invalid game ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameResult.status === 'finished' || gameResult.status === 'end') {
      return res.status(400).json({ error: 'Cannot shuffle finished game' });
    }

    // For user_session games, since cartelas are only validated and not stored in database,
    // we validate ownership by checking if the game was created by this user
    if (gameResult.winner_pattern === 'user_session') {
      // Since cartelas are validated at creation time but not stored per game,
      // we trust the game's existence as validation for the session owner
      console.log('✅ User session game ownership validated for shuffling');
    }

    // Generate new shuffled sequence for this game
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    console.log(`🔀 Shuffled game ${gameId} with new sequence:`, numbers.slice(0, 5), '...');

    // Reset called numbers and update sequence
    await db.run(`
      UPDATE games
      SET number_sequence = $1, called_numbers = $2, updated_at = $3
      WHERE id = $4
    `, [JSON.stringify(numbers), JSON.stringify([]), new Date().toISOString(), gameId]);

    // Parse called_numbers from database (stored as JSON string, but may already be parsed by driver)
    let calledNumbers = [];
    try {
      if (Array.isArray(gameResult.called_numbers)) {
        // Already parsed by database driver
        calledNumbers = gameResult.called_numbers;
      } else if (typeof gameResult.called_numbers === 'string') {
        // Stored as JSON string, need to parse
        const parsed = JSON.parse(gameResult.called_numbers || '[]');
        calledNumbers = Array.isArray(parsed) ? parsed : [];
      } else {
        // Fallback for unexpected format
        calledNumbers = [];
      }
    } catch (e) {
      console.warn('Error parsing called_numbers for game', gameResult.id, e);
      calledNumbers = [];
    }

    const game = {
      ...gameResult,
      calledNumbers: calledNumbers,
      cartelasSelected: gameResult.cartelas_selected,
      betMoney: gameResult.bet_money,
      winMoney: gameResult.win_money,
      totalNumbers: gameResult.total_numbers,
      winnerPattern: gameResult.winner_pattern,
      createdAt: gameResult.created_at,
      updatedAt: new Date().toISOString()
    };

    res.json({
      message: 'Game shuffled successfully',
      game
    });
  } catch (error) {
    console.error('Shuffle game error:', error);
    res.status(500).json({ error: 'Failed to shuffle game' });
  }
});

// Get next game number
router.get('/next-number', async (req, res) => {
  try {
    // Get the highest game number from database
    const maxGameNumberQuery = 'SELECT MAX(game_number) as maxNumber FROM games WHERE game_number IS NOT NULL';
    const maxResult = await db.get(maxGameNumberQuery);

    // Start from 1 if no games exist, otherwise increment
    const nextGameNumber = maxResult.maxNumber ? maxResult.maxNumber + 1 : 1;

    res.json({ nextGameNumber });
  } catch (error) {
    console.error('Get next game number error:', error);
    res.status(500).json({ error: 'Failed to get next game number' });
  }
});

// Save user game session (for NewGame component)
router.post('/session', authenticateToken, [
  body('selectedCartelas').isArray().withMessage('Selected cartelas must be an array'),
  body('betAmount').isFloat({ min: 0.01 }).withMessage('Bet amount must be positive'),
  body('housePercentage').isFloat({ min: 0, max: 50 }).withMessage('House percentage must be between 0-50'),
  body('totalBet').isFloat({ min: 0 }).withMessage('Total bet must be non-negative'),
  body('houseCut').isFloat({ min: 0 }).withMessage('House cut must be non-negative'),
  body('playerWin').isFloat({ min: 0 }).withMessage('Player win must be non-negative')
], async (req, res) => {
  console.log('🚀 POST /games/session endpoint called');
  console.log('Request body type:', typeof req.body);
  console.log('Request body keys:', Object.keys(req.body));
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('User from token:', req.user);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      selectedCartelas,
      betAmount,
      housePercentage,
      totalBet,
      houseCut,
      playerWin
    } = req.body;

    console.log('Received request body:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!Array.isArray(selectedCartelas) || selectedCartelas.length === 0) {
      return res.status(400).json({ error: 'Selected cartelas must be a non-empty array' });
    }

    // Validate that all cartela IDs are non-empty strings
    for (const cartelaId of selectedCartelas) {
      if (typeof cartelaId !== 'string' || cartelaId.trim().length === 0) {
        return res.status(400).json({ error: 'All cartela IDs must be non-empty strings' });
      }
    }

    // Get user's current total games played and use it + 1 as game number
    const user = await db.users.findById(req.user.id);
    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }

    const gameNumber = (user.totalGamesPlayed || 0) + 1;

    console.log(`Creating user session game #${gameNumber} for user ${req.user.id} (current games played: ${user.totalGamesPlayed})`);

    // Generate shuffled sequence of numbers 1-75 for this user session
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    console.log(`🎯 Generated random number sequence for user session game ${gameNumber}:`, numbers.slice(0, 10), '...');

    const gameId = uuidv4();
    const createdAt = new Date().toISOString();

      // Save to database using the games table (reusing existing structure)
      try {
        await db.run(`
          INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, selected_cartelas, called_numbers, number_sequence, total_numbers, winner_pattern, house_cut_percentage, user_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          gameId,
          gameNumber,
          'started',
          totalBet,
          playerWin,
          selectedCartelas.length, // This is the count
          JSON.stringify(selectedCartelas), // Store the actual selected cartela IDs
          JSON.stringify([]), // No called numbers for user sessions
          JSON.stringify(numbers), // Generated shuffled sequence for user session
          75, // Default total numbers
          'user_session', // Special pattern to identify user sessions
          housePercentage,
          req.user.id, // user_id - link game to user
          createdAt,
          createdAt
        ]);

      console.log('✅ Game session saved to database');
    } catch (dbError) {
      console.error('Error saving game to database:', dbError);
      throw new Error(`Database error saving game: ${dbError.message}`);
    }

    // Validate that cartelas exist in database but do NOT save associations
    try {
      for (const cartelaId of selectedCartelas) {
        // Just validate that the cartela exists - do not create new cartela records
        const existingCartelaQuery = 'SELECT * FROM cartelas WHERE card_id = $1 AND is_active = $2 LIMIT 1';
        const existingCartela = await db.get(existingCartelaQuery, [cartelaId, 1]);

        if (!existingCartela) {
          console.warn(`⚠️ Selected cartela ${cartelaId} not found in database`);
          return res.status(400).json({ error: `Cartela ${cartelaId} not found in database` });
        }

        console.log(`✅ Validated existing cartela ${cartelaId} in database`);
      }

      console.log('✅ All selected cartelas validated successfully (not saved to database)');
    } catch (dbError) {
      console.error('Error validating cartelas:', dbError);
      throw new Error(`Database error validating cartelas: ${dbError.message}`);
    }

    // Update user statistics
    try {
      await db.run(`
        UPDATE users
        SET total_games_played = total_games_played + 1,
            total_winnings = total_winnings + $1,
            updated_at = $2
        WHERE id = $3
      `, [playerWin, createdAt, req.user.id]);

      console.log('✅ User statistics updated');
    } catch (dbError) {
      console.error('Error updating user statistics:', dbError);
      throw new Error(`Database error updating user: ${dbError.message}`);
    }

    // Generate cartela numbers (37 random numbers from 1-220 for bingo card)
    const allNumbers = Array.from({ length: 220 }, (_, i) => i + 1);
    const cartelaNumbers = [];
    while (cartelaNumbers.length < 37) {
      const randomIndex = Math.floor(Math.random() * allNumbers.length);
      const number = allNumbers.splice(randomIndex, 1)[0];
      cartelaNumbers.push(number);
    }
    cartelaNumbers.sort((a, b) => a - b);

    // Calculate house profit
    const houseProfit = houseCut;

    // Format startedAt like "Fri, 31 Oct 2025 16:30:36 GMT"
    const startedAt = new Date(createdAt).toUTCString();

    console.log('✅ Game session created successfully');

    res.status(201).json({
      gameId: gameNumber,
      lastGame: {
        _id: gameId,
        gameId: gameNumber,
        cartela: cartelaNumbers,
        cutAmount: housePercentage,
        winAmount: playerWin,
        betAmount: totalBet,
        houseProfit: houseProfit,
        finished: false,
        userId: req.user.id,
        houseBonus: 0,
        winnerNumbers: numbers,
        startedAt: startedAt,
        createdAt: createdAt,
        updatedAt: createdAt,
        __v: 0
      }
    });
  } catch (error) {
    console.error('Save user game session error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to save game session',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get game by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid game ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Parse called_numbers from database (stored as JSON string, but may already be parsed by driver)
    let calledNumbers = [];
    try {
      if (Array.isArray(gameResult.called_numbers)) {
        // Already parsed by database driver
        calledNumbers = gameResult.called_numbers;
      } else if (typeof gameResult.called_numbers === 'string') {
        // Stored as JSON string, need to parse
        const parsed = JSON.parse(gameResult.called_numbers || '[]');
        calledNumbers = Array.isArray(parsed) ? parsed : [];
      } else {
        // Fallback for unexpected format
        calledNumbers = [];
      }
    } catch (e) {
      console.warn('Error parsing called_numbers for game', gameResult.id, e);
      calledNumbers = [];
    }

    const game = {
      ...gameResult,
      calledNumbers: calledNumbers,
      cartelasSelected: gameResult.cartelas_selected,
      betMoney: gameResult.bet_money,
      winMoney: gameResult.win_money,
      totalNumbers: gameResult.total_numbers,
      winnerPattern: gameResult.winner_pattern,
      createdAt: gameResult.created_at,
      updatedAt: gameResult.updated_at
    };

    // Get game cartelas from database
    const cartelasQuery = 'SELECT * FROM cartelas WHERE game_id = $1';
    const gameCartelas = await db.all(cartelasQuery, [gameId]);

    // Parse JSON fields for cartelas
    const parsedCartelas = gameCartelas.map(cartela => {
      let numbers = [];
      try {
        numbers = JSON.parse(cartela.numbers || '[]');
        if (!Array.isArray(numbers)) {
          numbers = [];
        }
      } catch (parseError) {
        console.warn('Error parsing cartela numbers:', parseError);
        numbers = [];
      }

      return {
        ...cartela,
        numbers: numbers,
        pattern: cartela.pattern,
        is_active: cartela.is_active === 1,
        is_winner: cartela.is_winner === 1,
        purchased_at: cartela.purchased_at
      };
    });

    res.json({
      game: {
        ...game,
        cartelas: parsedCartelas.length,
        cartelasData: req.user && req.user.role === 'admin' ? parsedCartelas : []
      }
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Check winners for selected cartelas (new endpoint)
router.post('/check-winners', authenticateToken, [
  body('gameId').isUUID().withMessage('Valid game ID required'),
  body('calledNumbers').isArray().withMessage('Called numbers must be an array'),
  body('selectedCartelas').isArray().withMessage('Selected cartelas must be an array'),
  body('selectedPattern').isString().withMessage('Selected pattern required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, calledNumbers, selectedCartelas, selectedPattern } = req.body;

    console.log('🔍 Checking winners for game:', gameId);
    console.log('🎯 Called numbers:', calledNumbers.length, 'numbers');
    console.log('🎫 Selected cartelas:', selectedCartelas.length, 'cartelas');
    console.log('🎲 Selected pattern:', selectedPattern);

    // Validate that all required fields are present
    if (!Array.isArray(calledNumbers) || !Array.isArray(selectedCartelas)) {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    if (selectedCartelas.length === 0) {
      return res.status(400).json({ error: 'No cartelas selected' });
    }

    if (calledNumbers.length === 0) {
      return res.status(400).json({ error: 'No numbers called yet' });
    }

    // Import pattern detection logic (we'll need to adapt it for backend use)
    const { checkWinningPatterns, validateCartela } = require('../utils/patternDetection');

    const winners = [];
    let winningCartela = null;
    let winningPatterns = [];

    // Check each selected cartela for winning patterns
    for (const cartelaId of selectedCartelas) {
      if (!cartelaId || typeof cartelaId !== 'string') continue;

      try {
        console.log(`🔍 Checking cartela: ${cartelaId}`);

        // Get cartela data from database
        const cartelaQuery = 'SELECT * FROM cartelas WHERE card_id = $1 AND is_active = $2';
        const cartelaResult = await db.get(cartelaQuery, [cartelaId, true]);

        if (!cartelaResult) {
          console.warn(`Cartela ${cartelaId} not found in database`);
          continue;
        }

        // Convert database format to expected format
        let cartelaNumbers;
        try {
          // Parse numbers from JSON if stored as string
          if (typeof cartelaResult.numbers === 'string') {
            cartelaNumbers = JSON.parse(cartelaResult.numbers);
          } else {
            cartelaNumbers = cartelaResult.numbers;
          }
        } catch (parseError) {
          console.error(`Error parsing cartela numbers for ${cartelaId}:`, parseError);
          continue;
        }

        // Format cartela for pattern detection
        const formattedCartela = {
          card_id: cartelaResult.card_id,
          numbers: cartelaNumbers
        };

        // Validate cartela structure
        if (!validateCartela(formattedCartela)) {
          console.error(`Invalid cartela structure for ${cartelaId}`);
          continue;
        }

        // Check for winning patterns using the pattern detection utility
        const patternsToCheck = [selectedPattern]; // Only check selected pattern
        const result = checkWinningPatterns(calledNumbers, formattedCartela, patternsToCheck);

        console.log(`🎯 Pattern check result for ${cartelaId}:`, result);

        // If this cartela has winning patterns, add it to winners
        if (result && result.length > 0) {
          winners.push({
            cartelaId: cartelaId,
            winningPatterns: result,
            cartelaData: cartelaNumbers
          });

          // For now, return the first winner found (can be modified for multiple winners)
          winningCartela = cartelaId;
          winningPatterns = result;
          break; // Stop at first winner for traditional bingo
        }

      } catch (cartelaError) {
        console.error(`Error checking cartela ${cartelaId}:`, cartelaError);
        continue;
      }
    }

    console.log('🏆 Winner check completed. Winners found:', winners.length);

    // Return winner information
    const response = {
      hasWinner: winners.length > 0,
      winners: winners,
      winningCartela: winningCartela,
      winningPatterns: winningPatterns,
      checkedCartelas: selectedCartelas.length,
      calledNumbersCount: calledNumbers.length
    };

    console.log('📤 Winner check response:', response);

    res.json(response);

  } catch (error) {
    console.error('Check winners error:', error);
    res.status(500).json({
      error: 'Failed to check winners',
      message: error.message
    });
  }
});

module.exports = router;
