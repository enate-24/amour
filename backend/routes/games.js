const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { users, adminLogs } = require('../data/database.js');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../db');
const { safeJSONParseArray, safeJSONStringify } = require('../utils/safeJSON');
const { emitNumberCalled, emitGameStatusChange } = require('../websocket');

const router = express.Router();

// Helper function to transform game data from database format to API format
const transformGameData = (gameRow) => {
  if (!gameRow) return null;

  // Parse JSON fields safely
  const parseJSON = (field, defaultValue = []) => {
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field || JSON.stringify(defaultValue));
        return Array.isArray(parsed) ? parsed : defaultValue;
      } catch (e) {
        console.warn('Error parsing JSON field:', e);
        return defaultValue;
      }
    }
    return defaultValue;
  };

  // Calculate bet_amount_per_cartela if not present
  let betAmountPerCartela = parseFloat(gameRow.bet_amount_per_cartela);
  if (!betAmountPerCartela && gameRow.cartelas_selected > 0) {
    betAmountPerCartela = parseFloat(gameRow.bet_money) / gameRow.cartelas_selected;
  } else if (!betAmountPerCartela) {
    betAmountPerCartela = 5.0; // Default fallback
  }

  // Return only camelCase fields (no duplication)
  return {
    id: gameRow.id,
    gameNumber: gameRow.game_number,
    status: gameRow.status,
    betMoney: parseFloat(gameRow.bet_money) || 0,
    betAmountPerCartela: betAmountPerCartela,
    winMoney: parseFloat(gameRow.win_money) || 0,
    cartelasSelected: gameRow.cartelas_selected,
    selectedCartelas: parseJSON(gameRow.selected_cartelas, []),
    calledNumbers: parseJSON(gameRow.called_numbers, []),
    numberSequence: parseJSON(gameRow.number_sequence, []),
    totalNumbers: parseInt(gameRow.total_numbers) || 75,
    winnerPattern: gameRow.winner_pattern,
    houseCutPercentage: parseFloat(gameRow.house_cut_percentage) || 25,
    userId: gameRow.user_id,
    createdAt: gameRow.created_at,
    updatedAt: gameRow.updated_at
  };
};

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

    // Transform game data to clean camelCase format (no duplication)
    const game = transformGameData(activeGame);
    
    // Override calledNumbers to always be empty (managed in localStorage only)
    game.calledNumbers = [];

    console.log(`[GET /active] Loaded game ${game.id} for user ${req.user?.id || 'unknown'}. Sequence exists: ${!!activeGame.number_sequence}`);
    console.log(`[GET /active] selectedCartelas:`, game.selectedCartelas);

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

    // Transform each game to clean camelCase format (no duplication)
    const games = gamesResult.map(game => transformGameData(game));

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

    const now = new Date().toISOString();

    // OPTIMIZATION: Single database update instead of two separate operations
    await db.run(`
      UPDATE games
      SET status = 'started', number_sequence = $1, updated_at = $2
      WHERE id = $3
    `, [JSON.stringify(numberSequence), now, gameId]);

    // Transform game data to clean camelCase format
    const game = transformGameData(gameResult);
    game.calledNumbers = [];
    game.status = 'started';
    game.updatedAt = now;
    game.numberSequence = numberSequence;

    // OPTIMIZATION: Log admin action asynchronously (non-blocking)
    setImmediate(() => {
      db.run(`
        INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        uuidv4(),
        req.user.id,
        'START_GAME',
        'GAME',
        gameId,
        JSON.stringify({ gameNumber: game.gameNumber }),
        req.ip,
        now
      ]).catch(err => console.error('Failed to log admin action:', err));
    });

    res.json({
      message: 'Game started successfully',
      game
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Update game winner pattern (authenticated users can update their own games)
router.patch('/:id/pattern', authenticateToken, [
  param('id').isUUID().withMessage('Invalid game ID'),
  body('winnerPattern').isString().isIn(['One Line', 'Two Lines', 'Three Lines', 'Full House']).withMessage('Invalid winner pattern')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { winnerPattern } = req.body;

    // Get the game
    const game = await db.get('SELECT * FROM games WHERE id = $1', [id]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify the user owns this game
    if (game.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only update your own games' });
    }

    // Update the winner pattern
    await db.run(
      'UPDATE games SET winner_pattern = $1, updated_at = $2 WHERE id = $3',
      [winnerPattern, new Date().toISOString(), id]
    );

    console.log(`✅ Updated game ${id} winner pattern to: ${winnerPattern}`);

    res.json({
      success: true,
      message: 'Game pattern updated successfully',
      gameId: id,
      winnerPattern: winnerPattern
    });
  } catch (error) {
    console.error('Error updating game pattern:', error);
    res.status(500).json({ error: 'Failed to update game pattern' });
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

      // Check if user owns this game or is admin
      if (game.user_id !== req.user.id && req.user.role !== 'admin') {
        await client.query('ROLLBACK');
        console.log(`❌ User ${req.user.id} attempted to call number for game ${gameId} owned by ${game.user_id}`);
        return res.status(403).json({ error: 'You do not have permission to call numbers for this game' });
      }

      console.log(`✅ User ${req.user.id} authorized to call numbers for game ${gameId}`);

      // Called numbers are managed in localStorage only, not in database
      console.log(`📊 Client calledNumbers: ${clientCalledNumbers.length}`);

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

      // Find next uncalled number from the sequence
      // Skip numbers that are already called to prevent duplicates
      const calledSet = new Set(clientCalledNumbers);
      let numberToCall = null;
      
      for (let i = 0; i < numberSequence.length; i++) {
        const candidateNumber = numberSequence[i];
        if (!calledSet.has(candidateNumber)) {
          numberToCall = candidateNumber;
          break;
        }
      }

      console.log(`🎲 Looking for next uncalled number. Called count: ${clientCalledNumbers.length}, Found: ${numberToCall}`);

      // Check if all numbers have been called
      if (numberToCall === null) {
        console.error('🎉 All numbers have been called for game', gameId);
        await client.query('COMMIT');
        return res.status(400).json({
          error: 'All numbers have been called.',
          gameCompleted: true
        });
      }

      const updatedCalledNumbers = [...clientCalledNumbers, numberToCall];

      // Note: Called numbers are NOT saved to database - they are managed in localStorage only
      // Just update the timestamp
      await client.query(`
        UPDATE games
        SET updated_at = $1
        WHERE id = $2
      `, [new Date().toISOString(), gameId]);

      await client.query('COMMIT');

      console.log(`✅ Number called successfully for game ${gameId}. Called number: ${numberToCall}`);

      // Emit WebSocket event to all clients in this game
      emitNumberCalled(gameId, {
        calledNumber: numberToCall,
        totalCalled: updatedCalledNumbers.length,
        remainingNumbers: numberSequence.filter(n => !calledSet.has(n)).length
      });

      // Transform game data to clean camelCase format
      const transformedGame = transformGameData(game);
      transformedGame.calledNumbers = updatedCalledNumbers;
      transformedGame.updatedAt = new Date().toISOString();

      res.json({
        message: 'Number called successfully',
        calledNumber: numberToCall,
        game: transformedGame,
        debug: {
          clientCalledNumbersLength: clientCalledNumbers.length,
          numberToCall: numberToCall,
          numberSequenceFirst5: numberSequence.slice(0, 5),
          remainingNumbers: numberSequence.filter(n => !calledSet.has(n)).length
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
  console.log('🏁 FINISH-SESSION endpoint called for game:', req.params.id);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;
    const { winMoney, winnerCartelaIds = [] } = req.body;
    console.log(`🏁 Finishing game ${gameId}, winMoney: ${winMoney}`);

    // Get game from database
    const gameQuery = 'SELECT * FROM games WHERE id = $1';
    const gameResult = await db.get(gameQuery, [gameId]);

    if (!gameResult) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user owns this game or is admin
    if (gameResult.user_id !== req.user.id && req.user.role !== 'admin') {
      console.log(`❌ User ${req.user.id} attempted to finish game ${gameId} owned by ${gameResult.user_id}`);
      return res.status(403).json({ error: 'You do not have permission to finish this game' });
    }

    console.log(`✅ User ${req.user.id} authorized to finish game ${gameId}`);
    console.log(`📊 Game status: ${gameResult.status}`);

    // If game is already finished, return success (idempotent operation)
    if (gameResult.status === 'finished') {
      console.log(`✅ Game ${gameId} is already finished`);
      return res.json({ 
        success: true,
        message: 'Game already finished',
        game: gameResult
      });
    }

    if (!['started', 'active', 'waiting'].includes(gameResult.status)) {
      console.log(`❌ Cannot finish game with status: ${gameResult.status}`);
      return res.status(400).json({ 
        error: 'Game is not active', 
        currentStatus: gameResult.status,
        allowedStatuses: ['started', 'active', 'waiting', 'finished']
      });
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

    // Transform game data to clean camelCase format
    const game = transformGameData(gameResult);
    game.winMoney = winMoney;
    game.status = 'finished';
    game.updatedAt = new Date().toISOString();

    // Check and auto-apply house bonus after finishing game
    let bonusMessage = null;
    try {
      console.log('🔍 Starting bonus check...');
      const today = new Date().toISOString().split('T')[0];
      const userId = gameResult.user_id;
      console.log(`📅 Today: ${today}, User ID: ${userId}`);

      // Get user info to check payment type
      const user = await db.get('SELECT user_type, balance FROM users WHERE id = $1', [userId]);
      console.log(`👤 User found: ${user ? 'Yes' : 'No'}, Type: ${user?.user_type}, Balance: ${user?.balance}`);
      
      if (user) {
        // Calculate today's profit for this user
        const todayGamesQuery = `
          SELECT COALESCE(SUM(bet_money - COALESCE(win_money, 0)), 0) as daily_profit
          FROM games
          WHERE user_id = $1 AND DATE(created_at) = $2 AND status = 'finished'
        `;
        const profitResult = await db.get(todayGamesQuery, [userId, today]);
        const dailyProfit = parseFloat(profitResult?.daily_profit || 0);

        console.log(`💰 Daily profit for user ${userId}: ${dailyProfit} Birr`);
        console.log(`✅ Profit check: ${dailyProfit >= 1000 ? 'ELIGIBLE' : 'NOT ELIGIBLE'} (need ≥1000)`);

        // Check if bonus already used today
        const bonusCheckQuery = 'SELECT bonus_used, daily_profit FROM daily_bonuses WHERE user_id = $1 AND bonus_date = $2';
        let bonusRecord = await db.get(bonusCheckQuery, [userId, today]);
        console.log(`📋 Bonus record: ${bonusRecord ? 'Found' : 'Not found'}, Used: ${bonusRecord?.bonus_used ? 'Yes' : 'No'}`);

        // Create bonus record if it doesn't exist
        if (!bonusRecord) {
          const { v4: uuidv4 } = require('uuid');
          await db.run(`
            INSERT INTO daily_bonuses (id, user_id, bonus_date, daily_profit, bonus_amount, requirements_met, bonus_claimed, bonus_used)
            VALUES ($1, $2, $3, $4, 200, 0, 0, 0)
          `, [uuidv4(), userId, today, dailyProfit]);
          bonusRecord = await db.get(bonusCheckQuery, [userId, today]);
        } else {
          // Update daily profit if bonus not used yet
          if (!bonusRecord.bonus_used) {
            await db.run('UPDATE daily_bonuses SET daily_profit = $1 WHERE user_id = $2 AND bonus_date = $3', 
              [dailyProfit, userId, today]);
            bonusRecord.daily_profit = dailyProfit; // Update local copy
          }
        }

        // Auto-apply bonus if eligible and not already used
        console.log(`🔍 Final check: bonus_used=${bonusRecord.bonus_used} (type: ${typeof bonusRecord.bonus_used}), dailyProfit=${dailyProfit}`);
        console.log(`🔍 Bonus check conditions: !bonus_used=${!bonusRecord.bonus_used}, profit>=1000=${dailyProfit >= 1000}`);
        
        // ADDITIONAL CHECK: Ensure no bonus deduction game already exists for today
        const existingBonusGameQuery = `
          SELECT COUNT(*) as bonus_game_count
          FROM games
          WHERE user_id = $1 AND game_number = 999999 AND DATE(created_at) = $2
        `;
        const existingBonusGameResult = await db.get(existingBonusGameQuery, [userId, today]);
        const existingBonusGames = parseInt(existingBonusGameResult?.bonus_game_count || 0);
        
        console.log(`🔍 Existing bonus games today: ${existingBonusGames}`);
        
        if (!bonusRecord.bonus_used && dailyProfit >= 1000 && existingBonusGames === 0) {
          console.log(`🎁 ✅ APPLYING HOUSE BONUS for user ${userId} (${user.user_type})`);

          // Use database transaction to prevent race conditions
          const client = await db.pool.connect();
          try {
            await client.query('BEGIN');

            // Double-check bonus hasn't been used in another transaction
            const doubleCheckQuery = `
              SELECT bonus_used FROM daily_bonuses 
              WHERE user_id = $1 AND bonus_date = $2 FOR UPDATE
            `;
            const doubleCheckResult = await client.query(doubleCheckQuery, [userId, today]);
            
            if (doubleCheckResult.rows[0]?.bonus_used) {
              console.log(`❌ Bonus already used in concurrent transaction`);
              await client.query('ROLLBACK');
              return;
            }

            // Double-check no bonus games exist
            const doubleCheckGamesQuery = `
              SELECT COUNT(*) as count FROM games 
              WHERE user_id = $1 AND game_number = 999999 AND DATE(created_at) = $2
            `;
            const doubleCheckGamesResult = await client.query(doubleCheckGamesQuery, [userId, today]);
            
            if (parseInt(doubleCheckGamesResult.rows[0]?.count || 0) > 0) {
              console.log(`❌ Bonus game already exists in concurrent transaction`);
              await client.query('ROLLBACK');
              return;
            }

            // Create a bonus deduction game record to affect all profit calculations
            const { v4: uuidv4 } = require('uuid');
            const bonusGameId = uuidv4();
            const bonusGameNumber = 999999; // Special number for bonus deduction games
            
            console.log(`📝 Creating bonus deduction game #${bonusGameNumber}...`);
            
            // Insert a "bonus deduction" game with negative profit
            await client.query(`
              INSERT INTO games (
                id, game_number, user_id, bet_money, win_money, 
                cartelas_selected, total_numbers, house_cut_percentage, 
                status, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
              bonusGameId,
              bonusGameNumber,
              userId,
              0,        // bet_money = 0
              200,      // win_money = 200 (creates -200 profit)
              0,        // cartelas_selected = 0
              75,       // total_numbers = 75
              0,        // house_cut_percentage = 0
              'finished',
              new Date().toISOString(),
              new Date().toISOString()
            ]);

            console.log(`✅ Created bonus deduction game record (profit: -200 Birr)`);

            if (user.user_type === 'postpaid') {
              // Postpaid: Mark bonus as used
              await client.query(`
                UPDATE daily_bonuses 
                SET bonus_used = true, bonus_claimed = true
                WHERE user_id = $1 AND bonus_date = $2
              `, [userId, today]);
              
              bonusMessage = `🎉 House Bonus Applied! 200 Birr deducted from all profits`;
              console.log(`✅ Postpaid bonus applied: 200 Birr deducted from all profit calculations`);
            } else {
              // Prepaid: Add 200 to balance and mark bonus as used
              const newBalance = parseFloat(user.balance) + 200;
              await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
              
              await client.query(`
                UPDATE daily_bonuses 
                SET bonus_used = true, bonus_claimed = true
                WHERE user_id = $1 AND bonus_date = $2
              `, [userId, today]);
              
              bonusMessage = `🎉 House Bonus Applied! 200 Birr added to your balance (New balance: ${newBalance.toFixed(2)} Birr)`;
              console.log(`✅ Prepaid bonus applied: Balance increased to ${newBalance}, 200 Birr deducted from all profit calculations`);
            }

            await client.query('COMMIT');
          } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error(`❌ FAILED to apply bonus in transaction:`, transactionError);
            throw transactionError;
          } finally {
            client.release();
          }
        }
      } else {
        let reason = 'Unknown';
        if (bonusRecord.bonus_used) {
          reason = 'Already used (bonus_used = true)';
        } else if (existingBonusGames > 0) {
          reason = `Bonus game already exists (${existingBonusGames} games found)`;
        } else if (dailyProfit < 1000) {
          reason = `Profit too low (${dailyProfit} < 1000)`;
        }
        console.log(`❌ Bonus NOT applied. Reason: ${reason}`);
      }
    } catch (bonusError) {
      console.error('⚠️ Error checking/applying bonus:', bonusError);
      console.error('Error stack:', bonusError.stack);
      // Don't fail the game finish if bonus check fails
    }

    const response = {
      message: 'Game finished successfully',
      game
    };

    // Add bonus message if bonus was applied
    if (bonusMessage) {
      response.bonusMessage = bonusMessage;
    }

    res.json(response);
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

    // Transform game data to clean camelCase format
    const game = transformGameData(gameResult);
    game.winMoney = winMoney;
    game.status = 'end';
    game.updatedAt = new Date().toISOString();

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

    // Transform game data to clean camelCase format
    const game = transformGameData(gameResult);
    game.status = 'cancelled';
    game.updatedAt = new Date().toISOString();

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
    const { page = 1, limit = 50, username } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    const offset = (page - 1) * limit;

    const queryParams = [];

    let gamesQuery;
    if (isAdmin) {
      // Admin sees all games, optionally filtered by username
      if (username) {
        gamesQuery = `
          SELECT DISTINCT
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
          INNER JOIN cartelas c ON g.id = c.game_id
          INNER JOIN users u ON c.user_id = u.id
          WHERE u.username = $1
          ORDER BY g.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams.push(username, limit, offset);
      } else {
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
      }
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
      // Admin sees count of all games, optionally filtered by username
      if (username) {
        countQuery = `
          SELECT COUNT(DISTINCT g.id) as total 
          FROM games g
          INNER JOIN cartelas c ON g.id = c.game_id
          INNER JOIN users u ON c.user_id = u.id
          WHERE u.username = $1
        `;
        countParams.push(username);
      } else {
        countQuery = 'SELECT COUNT(*) as total FROM games';
      }
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

    // Check if user is admin
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    // Get game statistics from database - filter by user_id for regular users
    const statsQuery = isAdmin ? `
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
    ` : `
      SELECT
        COUNT(*) as totalGames,
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finishedGames,
        SUM(CASE WHEN status = 'started' THEN 1 ELSE 0 END) as activeGames,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waitingGames,
        COALESCE(SUM(CASE WHEN status = 'finished' THEN bet_money ELSE 0 END), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN status = 'finished' THEN win_money ELSE 0 END), 0) as totalPayout,
        COALESCE(SUM(CASE WHEN status = 'finished' THEN (bet_money - win_money) ELSE 0 END), 0) as totalProfit
      FROM games
      WHERE user_id = $2 AND created_at >= $1
    `;

    const statsParams = isAdmin ? [formattedDate] : [formattedDate, userId];
    const statsResult = await db.get(statsQuery, statsParams);

    // Get average players per game - filter by user_id for regular users
    const avgPlayersQuery = isAdmin ? `
      SELECT COALESCE(AVG(cartelas_count), 0) as averagePlayersPerGame
      FROM (
        SELECT COUNT(c.id) as cartelas_count
        FROM games g
        LEFT JOIN cartelas c ON g.id = c.game_id
        WHERE g.status = 'finished' AND g.created_at >= $1
        GROUP BY g.id
      ) game_cartelas
    ` : `
      SELECT COALESCE(AVG(cartelas_count), 0) as averagePlayersPerGame
      FROM (
        SELECT COUNT(c.id) as cartelas_count
        FROM games g
        LEFT JOIN cartelas c ON g.id = c.game_id
        WHERE g.user_id = $2 AND g.status = 'finished' AND g.created_at >= $1
        GROUP BY g.id
      ) game_cartelas
    `;

    const avgPlayersParams = isAdmin ? [formattedDate] : [formattedDate, userId];
    const avgPlayersResult = await db.get(avgPlayersQuery, avgPlayersParams);

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

    // Check if user owns this game or is admin
    if (gameResult.user_id !== req.user.id && req.user.role !== 'admin') {
      console.log(`❌ User ${req.user.id} attempted to shuffle game ${gameId} owned by ${gameResult.user_id}`);
      return res.status(403).json({ error: 'You do not have permission to shuffle this game' });
    }

    console.log(`✅ User ${req.user.id} authorized to shuffle game ${gameId}`);

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

    // Transform game data to clean camelCase format
    const game = transformGameData(gameResult);
    game.calledNumbers = [];
    game.updatedAt = new Date().toISOString();

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
  body('selectedCartelas').isArray({ min: 3 }).withMessage('Selected cartelas must be an array with at least 3 items'),
  body('betAmount').isFloat({ min: 0.01 }).withMessage('Bet amount must be positive'),
  body('housePercentage').isFloat({ min: 0, max: 50 }).withMessage('House percentage must be between 0-50'),
  body('totalBet').isFloat({ min: 0 }).withMessage('Total bet must be non-negative'),
  body('houseCut').isFloat({ min: 0 }).withMessage('House cut must be non-negative'),
  body('playerWin').isFloat({ min: 0 }).withMessage('Player win must be non-negative')
], async (req, res) => {
  const startTime = Date.now();
  console.log('🚀 POST /games/session endpoint called');
  console.log('Request body type:', typeof req.body);
  console.log('Request body keys:', Object.keys(req.body));
  console.log(`📊 Cartelas selected: ${req.body.selectedCartelas?.length || 0}`);

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

    // Get user's selected pattern from settings
    let selectedPattern = 'Two Lines'; // Default
    try {
      const userSettings = await db.userSettings.findByUserId(req.user.id);
      if (userSettings && userSettings.selectedPattern) {
        selectedPattern = userSettings.selectedPattern;
        console.log(`✅ Using user's selected pattern from settings: ${selectedPattern}`);
      } else {
        console.log(`⚠️ No user settings found, using default pattern: ${selectedPattern}`);
      }
    } catch (settingsError) {
      console.warn('Error fetching user settings, using default pattern:', settingsError);
    }

    // Validate required fields
    if (!Array.isArray(selectedCartelas) || selectedCartelas.length === 0) {
      return res.status(400).json({ error: 'Selected cartelas must be a non-empty array' });
    }

    // Validate minimum 3 cartelas requirement
    if (selectedCartelas.length < 3) {
      return res.status(400).json({ 
        error: `Minimum 3 cartelas required to start a game. You selected ${selectedCartelas.length} cartela(s).` 
      });
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

    // Debug: Log user type and balance information
    console.log('🔍 User Balance Check:', {
      userId: user.id,
      username: user.username,
      userType: user.userType,
      balance: user.balance,
      totalBet: req.body.totalBet,
      houseCut: req.body.houseCut
    });

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

      // Validate that betAmount * selectedCartelas.length equals totalBet
      const calculatedTotalBet = betAmount * selectedCartelas.length;
      if (Math.abs(calculatedTotalBet - totalBet) > 0.01) {
        console.error(`❌ Bet amount validation failed: ${betAmount} × ${selectedCartelas.length} = ${calculatedTotalBet}, but totalBet = ${totalBet}`);
        return res.status(400).json({ 
          error: 'Invalid bet calculation',
          details: `Expected total bet: ${calculatedTotalBet}, received: ${totalBet}`
        });
      }

      // Save to database using the games table (reusing existing structure)
      try {
        await db.run(`
          INSERT INTO games (id, game_number, status, bet_money, bet_amount_per_cartela, win_money, cartelas_selected, selected_cartelas, called_numbers, number_sequence, total_numbers, winner_pattern, house_cut_percentage, user_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          gameId,
          gameNumber,
          'started',
          totalBet,
          betAmount, // NEW: Store bet amount per cartela
          playerWin,
          selectedCartelas.length, // This is the count
          JSON.stringify(selectedCartelas), // Store the actual selected cartela IDs
          JSON.stringify([]), // No called numbers for user sessions
          JSON.stringify(numbers), // Generated shuffled sequence for user session
          75, // Default total numbers
          selectedPattern, // Use the user's selected pattern from settings
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
    // OPTIMIZED: Validate all cartelas in a single query instead of loop
    try {
      const placeholders = selectedCartelas.map((_, i) => `$${i + 1}`).join(',');
      const existingCartelasQuery = `SELECT card_id FROM cartelas WHERE card_id IN (${placeholders}) AND is_active = 1`;
      const existingCartelas = await db.all(existingCartelasQuery, selectedCartelas);

      if (existingCartelas.length !== selectedCartelas.length) {
        const foundIds = existingCartelas.map(c => c.card_id);
        const missingIds = selectedCartelas.filter(id => !foundIds.includes(id));
        console.warn(`⚠️ Selected cartelas not found: ${missingIds.join(', ')}`);
        return res.status(400).json({ 
          error: `Cartelas not found in database: ${missingIds.join(', ')}` 
        });
      }

      console.log(`✅ All ${selectedCartelas.length} cartelas validated successfully in single query`);
    } catch (dbError) {
      console.error('Error validating cartelas:', dbError);
      throw new Error(`Database error validating cartelas: ${dbError.message}`);
    }

    // OPTIMIZATION: Deduct balance and update user statistics in a single transaction
    const { deductBalance } = require('../middleware/auth');
    let balanceWarning = null;
    
    try {
      // Deduct the house cut from user's balance
      const balanceResult = await deductBalance(user, houseCut);
      
      if (!balanceResult.success) {
        return res.status(400).json({ error: balanceResult.message });
      }
      
      // Store warning if present
      if (balanceResult.warning) {
        balanceWarning = balanceResult.warning;
      }
      
      // OPTIMIZATION: Update user winnings asynchronously (non-blocking)
      setImmediate(() => {
        db.run(`
          UPDATE users
          SET total_winnings = total_winnings + $1,
              updated_at = $2
          WHERE id = $3
        `, [playerWin, createdAt, req.user.id]).catch(err => 
          console.error('Failed to update user winnings:', err)
        );
      });

      console.log('✅ User balance deducted, winnings update queued');
    } catch (dbError) {
      console.error('Error updating user balance:', dbError);
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

    const response = {
      gameId: gameId, // Return UUID instead of game number for API calls
      gameNumber: gameNumber, // Also return game number for display
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
    };
    
    // Add warning if present
    if (balanceWarning) {
      response.warning = balanceWarning;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`⏱️ Game session created in ${duration}ms`);

    res.status(201).json(response);
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`❌ Game session failed after ${duration}ms`);
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

    // Transform game data to clean camelCase format
    const game = transformGameData(gameResult);

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

    // If winners are found, save them to the database
    if (winners.length > 0) {
      try {
        const winnerCartelaIds = winners.map(w => w.cartelaId);
        
        console.log('💾 Saving winner cartela IDs to database:', winnerCartelaIds);

        // Update the game_analysis table with winner cartela IDs
        const updateAnalysisQuery = `
          INSERT INTO game_analysis (
            id, game_id, winner_cartela_ids, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (game_id) 
          DO UPDATE SET 
            winner_cartela_ids = $3,
            updated_at = $5
        `;

        await db.run(updateAnalysisQuery, [
          require('crypto').randomUUID(),
          gameId,
          JSON.stringify(winnerCartelaIds),
          new Date().toISOString(),
          new Date().toISOString()
        ]);

        // Also mark the cartelas as winners in the cartelas table
        for (const winner of winners) {
          await db.run(`
            UPDATE cartelas 
            SET is_winner = 1, pattern = $1, updated_at = $2
            WHERE card_id = $3
          `, [
            winner.winningPatterns[0] || selectedPattern,
            new Date().toISOString(),
            winner.cartelaId
          ]);
        }

        console.log('✅ Successfully saved winner information to database');

      } catch (saveError) {
        console.error('❌ Error saving winner information:', saveError);
        // Don't fail the response, just log the error
      }
    }

    // Return winner information
    const response = {
      hasWinner: winners.length > 0,
      winners: winners,
      winningCartela: winningCartela,
      winningPatterns: winningPatterns,
      checkedCartelas: selectedCartelas.length,
      calledNumbersCount: calledNumbers.length,
      winnerCartelaIds: winners.map(w => w.cartelaId)
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

// Get number sequence for a game (for offline caching)
router.get('/:id/number-sequence', [
  param('id').isUUID().withMessage('Invalid game ID')
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;

    // Get game from database
    const gameQuery = 'SELECT id, number_sequence, status, user_id FROM games WHERE id = $1';
    const game = await db.get(gameQuery, [gameId]);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify user owns this game (unless admin)
    if (!req.user.isAdmin && game.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse number sequence
    let numberSequence = [];
    try {
      if (Array.isArray(game.number_sequence)) {
        numberSequence = game.number_sequence;
      } else if (typeof game.number_sequence === 'string') {
        const parsed = JSON.parse(game.number_sequence || '[]');
        numberSequence = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Error parsing number_sequence for game', game.id, e);
      numberSequence = [];
    }

    console.log(`📥 Fetched number sequence for game ${gameId}: ${numberSequence.length} numbers`);

    res.json({
      gameId: game.id,
      numberSequence,
      sequenceLength: numberSequence.length,
      status: game.status
    });
  } catch (error) {
    console.error('Error fetching number sequence:', error);
    res.status(500).json({ error: 'Failed to fetch number sequence' });
  }
});

module.exports = router;
