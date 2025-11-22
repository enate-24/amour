const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { users, games, cartelas } = require('../data/database.js');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Bulk copy cartelas to multiple users (admin only)
router.post('/:id/bulk-copy', requireAdmin, [
  param('id').isUUID().withMessage('Invalid cartela ID'),
  body('targetUserIds').isArray().withMessage('Target user IDs must be an array'),
  body('targetUserIds.*').isUUID().withMessage('Each target user ID must be a valid UUID'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID'),
  body('cardIdPrefix').optional().isString().withMessage('Card ID prefix must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const cartelaId = req.params.id;
    const { targetUserIds, gameId, cardIdPrefix = 'BULK' } = req.body;

    // Find source cartela
    const allCartelas = await cartelas.findAll();
    const sourceCartela = allCartelas.find(c => c.id === cartelaId);
    if (!sourceCartela) {
      return res.status(404).json({ error: 'Source cartela not found' });
    }

    // Validate all target users exist
    const allUsers = await users.findAll();
    const targetUsers = allUsers.filter(u => targetUserIds.includes(u.id));
    if (targetUsers.length !== targetUserIds.length) {
      return res.status(404).json({ error: 'One or more target users not found' });
    }

    // Validate game if provided
    if (gameId) {
      const game = await games.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      if (game.status === 'finished') {
        return res.status(400).json({ error: 'Cannot assign cartelas to finished game' });
      }
    }

    const copiedCartelas = [];
    const timestamp = Date.now();

    // Create copies for each target user
    for (let index = 0; index < targetUserIds.length; index++) {
      const userId = targetUserIds[index];
      const cardId = `${cardIdPrefix}-${timestamp}-${index + 1}`;
      
      const copiedCartela = {
        id: uuidv4(),
        card_id: cardId,
        user_id: userId,
        game_id: gameId || null,
        numbers: { ...sourceCartela.numbers }, // Deep copy numbers
        pattern: null,
        is_active: true,
        purchased_at: new Date().toISOString()
      };

      await cartelas.create(copiedCartela);
      copiedCartelas.push(copiedCartela);
    }

    res.status(201).json({
      message: `Successfully copied cartela to ${copiedCartelas.length} users`,
      copiedCartelas,
      sourceCartela: {
        id: sourceCartela.id,
        card_id: sourceCartela.card_id,
        user_id: sourceCartela.user_id
      }
    });
  } catch (error) {
    console.error('Bulk copy cartela error:', error);
    res.status(500).json({ error: 'Failed to bulk copy cartela' });
  }
});



// Assign existing cartelas to user (admin only)
router.post('/assign-existing', requireAdmin, [
  body('targetUserId').isUUID().withMessage('Target user ID must be a valid UUID'),
  body('sourceCartelaIds').isArray().withMessage('Source cartela IDs must be an array'),
  body('sourceCartelaIds.*').isUUID().withMessage('Each source cartela ID must be a valid UUID'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { targetUserId, sourceCartelaIds, gameId } = req.body;

    if (sourceCartelaIds.length === 0) {
      return res.status(400).json({ error: 'No source cartela IDs provided' });
    }

    // Validate target user
    const targetUser = await users.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Validate game if provided
    if (gameId) {
      const game = await games.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      if (game.status === 'finished') {
        return res.status(400).json({ error: 'Cannot assign cartelas to finished game' });
      }
    }

    const assignedCartelas = [];
    const invalidCartelaIds = [];

    // Get all cartelas once outside the loop
    const allCartelas = await cartelas.findAll();
    // Process each source cartela ID
    for (const sourceCartelaId of sourceCartelaIds) {
      const sourceCartela = allCartelas.find(c => c.id === sourceCartelaId && c.is_active);
      if (!sourceCartela) {
        invalidCartelaIds.push(sourceCartelaId);
        continue;
      }

      // Check if this specific card is already assigned to the target user
      const existingCard = allCartelas.find(c => c.card_id === sourceCartela.card_id && c.user_id === targetUserId);
      if (existingCard) {
        invalidCartelaIds.push(`${sourceCartelaId} (card already assigned to user)`);
        continue;
      }

      // Create new cartela for target user
      const newCartela = {
        id: uuidv4(),
        card_id: sourceCartela.card_id,
        user_id: targetUserId,
        game_id: gameId || null,
        numbers: { ...sourceCartela.numbers },
        pattern: null,
        is_active: true,
        purchased_at: new Date().toISOString()
      };

      await cartelas.create(newCartela);
      assignedCartelas.push(newCartela);
    }

    res.status(201).json({
      message: `Successfully assigned ${assignedCartelas.length} cartelas to ${targetUser.username}`,
      assignedCartelas,
      summary: {
        totalRequested: sourceCartelaIds.length,
        successfullyAssigned: assignedCartelas.length,
        invalidCartelaIds: invalidCartelaIds
      },
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email
      }
    });
  } catch (error) {
    console.error('Assign existing cartelas error:', error);
    res.status(500).json({ error: 'Failed to assign existing cartelas' });
  }
});

// Create new cartela (public endpoint - no authentication required)
router.post('/', [
  body('cardId').isString().notEmpty().withMessage('Card ID is required'),
  body('numbers').isObject().withMessage('Numbers object is required'),
  body('numbers.B').isArray().withMessage('B column must be an array'),
  body('numbers.I').isArray().withMessage('I column must be an array'),
  body('numbers.N').isArray().withMessage('N column must be an array'),
  body('numbers.G').isArray().withMessage('G column must be an array'),
  body('numbers.O').isArray().withMessage('O column must be an array'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID'),
  body('userId').optional().isUUID().withMessage('User ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cardId, numbers, gameId, userId } = req.body;

    // Validate game if provided
    if (gameId) {
      const game = await games.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      if (game.status === 'finished') {
        return res.status(400).json({ error: 'Cannot add cartelas to finished game' });
      }
    }

    // Check if cardId already exists globally (since no user context required)
    const allCartelas = await cartelas.findAll();
    const existingCard = allCartelas.find(c => c.card_id === cardId && c.is_active);
    if (existingCard) {
      return res.status(400).json({ error: 'Card ID already exists' });
    }

    const newCartela = {
      id: uuidv4(),
      card_id: cardId,
      user_id: userId || null, // Allow null user_id for public access
      game_id: gameId || null,
      numbers,
      pattern: null,
      is_active: true,
      purchased_at: new Date().toISOString()
    };
    await cartelas.create(newCartela);

    res.status(201).json(newCartela);
  } catch (error) {
    console.error('Create cartela error:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create cartela' });
  }
});
// Get all cartelas from database (public endpoint)
router.get('/all-cartelas', async (req, res) => {
  try {
    // Fetch all cartelas from database
    const allCartelas = await cartelas.findAll();
    const activeCartelas = allCartelas.filter(c => c.is_active);

    console.log('Fetched cartelas from database, total:', activeCartelas.length);

    // Get all active games to exclude cartelas that are selected in active games
    const { games: gamesDb } = require('../data/database.js');
    const activeGames = await gamesDb.findByStatus('started');
    const activeGamesWithSessions = await gamesDb.findByStatus('active');

    // Combine active games
    const allActiveGames = [...activeGames, ...activeGamesWithSessions];

    // For /all-cartelas endpoint, we don't filter out selected cartelas
    // This allows all cartelas to be visible in CardList
    // The frontend will handle showing which ones are available vs selected
    const availableCartelas = activeCartelas;

    console.log(`Filtered cartelas: ${activeCartelas.length} total, ${availableCartelas.length} available`);

    // Transform the data to match the expected format with parsed numbers
    const transformedCartelas = await Promise.all(availableCartelas.map(async (cartela, index) => {
      let numbers;
      try {
        // Parse the JSON string from database
        const rawNumbers = typeof cartela.numbers === 'string'
          ? JSON.parse(cartela.numbers)
          : cartela.numbers;

        // Handle different number formats
        if (Array.isArray(rawNumbers) && rawNumbers.length === 5 && Array.isArray(rawNumbers[0])) {
          // Convert 2D array format to object format
          numbers = {
            B: rawNumbers.map(row => row[0]),
            I: rawNumbers.map(row => row[1]),
            N: rawNumbers.map(row => row[2]),
            G: rawNumbers.map(row => row[3]),
            O: rawNumbers.map(row => row[4])
          };
        } else if (rawNumbers && typeof rawNumbers === 'object' && rawNumbers.B) {
          // Already in correct object format
          numbers = rawNumbers;
        } else {
          throw new Error('Invalid number format');
        }
      } catch (error) {
        console.error(`Error parsing numbers for cartela ${cartela.card_id}:`, error);
        numbers = { B: [], I: [], N: [], G: [], O: [] };
      }

      // Dynamic winner checking if cartela has an associated game
      let dynamicWinnerStatus = false;
      let potentialWinningPatterns = [];

      if (cartela.game_id) {
        try {
          const game = await games.findById(cartela.game_id);
          if (game && (game.status === 'started' || game.status === 'active')) {
            let gameCalledNumbers = [];
            try {
              if (Array.isArray(game.called_numbers)) {
                gameCalledNumbers = game.called_numbers;
              } else if (typeof game.called_numbers === 'string') {
                const parsed = JSON.parse(game.called_numbers || '[]');
                gameCalledNumbers = Array.isArray(parsed) ? parsed : [];
              }
            } catch (parseError) {
              console.warn(`Error parsing called numbers for game ${game.id}:`, parseError);
            }

            if (gameCalledNumbers.length > 0) {
              const { checkWinningPatterns, validateCartela } = require('../utils/patternDetection');
              const formattedCartela = {
                card_id: cartela.card_id,
                numbers: numbers
              };

              if (validateCartela(formattedCartela)) {
                potentialWinningPatterns = checkWinningPatterns(gameCalledNumbers, formattedCartela, ["One Line", "Two Lines", "Full House"]);
                dynamicWinnerStatus = potentialWinningPatterns.length > 0;
              }
            }
          }
        } catch (gameCheckError) {
          console.warn(`Error checking winner status for cartela ${cartela.card_id}:`, gameCheckError);
        }
      }

      return {
        id: cartela.id,
        card_id: cartela.card_id,
        user_id: cartela.user_id,
        game_id: cartela.game_id,
        numbers,
        pattern: cartela.pattern,
        is_active: cartela.is_active,
        purchased_at: cartela.purchased_at,
        isWinner: cartela.is_winner || false, // Static winner status from database
        dynamicWinnerStatus: dynamicWinnerStatus, // Dynamic winner status based on current called numbers
        win: dynamicWinnerStatus, // Boolean: true if currently winning
        cardType: dynamicWinnerStatus ? 'win' : 'stillnotwin', // String: 'win' or 'stillnotwin'
        soundType: dynamicWinnerStatus ? 'winner' : 'notwinner', // String: 'winner' or 'notwinner'
        potentialWinningPatterns: potentialWinningPatterns, // Patterns that would win with current numbers
        createdAt: cartela.purchased_at
      };
    }));

    console.log(`Successfully transformed ${transformedCartelas.length} available cartelas from database`);

    res.json({
      cartelas: transformedCartelas,
      total: transformedCartelas.length,
      source: 'database'
    });
  } catch (error) {
    console.error('Get all cartelas error:', error);
    res.status(500).json({
      error: 'Failed to get all cartelas',
      message: error.message
    });
  }
});

// Get single cartela by ID or card_id (public endpoint - no authentication required)
// Accepts optional calledNumbers query parameter for user_session games
router.get('/:id', async (req, res) => {
  try {
    const cartelaId = req.params.id;
    const allCartelas = await cartelas.findAll();

    // Try to find by database ID (UUID) first, then by card_id
    let cartela = allCartelas.find(c => c.id === cartelaId && c.is_active);

    // If not found by ID, try to find by card_id
    if (!cartela) {
      cartela = allCartelas.find(c => c.card_id === cartelaId && c.is_active);
    }

    if (!cartela) {
      return res.status(404).json({ error: 'Cartela not found' });
    }

    // Parse and transform numbers like /all-cartelas endpoint does
    let numbers;
    try {
      // Parse the JSON string from database
      const rawNumbers = typeof cartela.numbers === 'string'
        ? JSON.parse(cartela.numbers)
        : cartela.numbers;

      // Handle different number formats
      if (Array.isArray(rawNumbers) && rawNumbers.length === 5 && Array.isArray(rawNumbers[0])) {
        // Convert 2D array format to object format
        numbers = {
          B: rawNumbers.map(row => row[0]),
          I: rawNumbers.map(row => row[1]),
          N: rawNumbers.map(row => row[2]),
          G: rawNumbers.map(row => row[3]),
          O: rawNumbers.map(row => row[4])
        };
      } else if (rawNumbers && typeof rawNumbers === 'object' && rawNumbers.B) {
        // Already in correct object format
        numbers = rawNumbers;
      } else {
        throw new Error('Invalid number format');
      }
    } catch (error) {
      console.error(`Error parsing numbers for cartela ${cartela.card_id}:`, error);
      numbers = { B: [], I: [], N: [], G: [], O: [] };
    }

    // Dynamic winner checking based on current game state
    let dynamicWinnerStatus = false;
    let potentialWinningPatterns = [];
    let gameCalledNumbers = [];

    // Check for called numbers from query parameter (for user_session games)
    if (req.query.calledNumbers) {
      try {
        gameCalledNumbers = JSON.parse(req.query.calledNumbers);
        console.log('🎯 Using called numbers from query parameter:', gameCalledNumbers.length, 'numbers');
      } catch (parseError) {
        console.warn('Error parsing calledNumbers from query:', parseError);
        gameCalledNumbers = [];
      }
    }

    // If no called numbers from query, check if cartela has an associated game
    if (gameCalledNumbers.length === 0 && cartela.game_id) {
      try {
        const { games } = require('../data/database.js');
        const game = await games.findById(cartela.game_id);

        if (game && (game.status === 'started' || game.status === 'active')) {
          // Get called numbers from the game database
          try {
            if (Array.isArray(game.called_numbers)) {
              gameCalledNumbers = game.called_numbers;
            } else if (typeof game.called_numbers === 'string') {
              const parsed = JSON.parse(game.called_numbers || '[]');
              gameCalledNumbers = Array.isArray(parsed) ? parsed : [];
            }
          } catch (parseError) {
            console.warn(`Error parsing called numbers for game ${game.id}:`, parseError);
            gameCalledNumbers = [];
          }
          console.log('🎯 Using called numbers from database:', gameCalledNumbers.length, 'numbers');
        }
      } catch (gameCheckError) {
        console.warn(`Error fetching game for cartela ${cartelaId}:`, gameCheckError);
      }
    }

    // Perform winner checking if we have called numbers
    if (gameCalledNumbers.length > 0) {
      try {
        // Import pattern detection
        const { checkWinningPatterns, validateCartela } = require('../utils/patternDetection');

        // Format cartela for pattern checking
        const formattedCartela = {
          card_id: cartela.card_id,
          numbers: numbers
        };

        // Validate cartela structure
        if (validateCartela(formattedCartela)) {
          // Check winning patterns
          potentialWinningPatterns = checkWinningPatterns(gameCalledNumbers, formattedCartela, ["One Line", "Two Lines", "Full House"]);
          dynamicWinnerStatus = potentialWinningPatterns.length > 0;
          
          console.log(`🔍 Winner check for cartela ${cartela.card_id}:`, {
            calledNumbersCount: gameCalledNumbers.length,
            hasWinner: dynamicWinnerStatus,
            patterns: potentialWinningPatterns
          });
        } else {
          console.warn(`Invalid cartela structure for ${cartela.card_id}`);
        }
      } catch (patternError) {
        console.error('Error checking patterns:', patternError);
      }
    } else {
      console.log(`⚠️ No called numbers available for cartela ${cartela.card_id}`);
    }

    // Return cartela response with dynamic winner checking
    const cartelaResponse = {
      id: cartela.id,
      card_id: cartela.card_id,
      user_id: cartela.user_id,
      game_id: cartela.game_id,
      numbers,
      pattern: cartela.pattern,
      is_active: cartela.is_active,
      purchased_at: cartela.purchased_at,
      isWinner: cartela.is_winner || false, // Static winner status from database
      dynamicWinnerStatus: dynamicWinnerStatus, // Dynamic winner status based on current called numbers
      win: dynamicWinnerStatus, // Boolean: true if currently winning
      cardType: dynamicWinnerStatus ? 'win' : 'stillnotwin', // String: 'win' or 'stillnotwin'
      soundType: dynamicWinnerStatus ? 'winner' : 'notwinner', // String: 'winner' or 'notwinner'
      potentialWinningPatterns: potentialWinningPatterns, // Patterns that would win with current numbers
      calledNumbersCount: gameCalledNumbers.length, // Debug info
      createdAt: cartela.purchased_at
    };

    res.json({
      cartela: cartelaResponse
    });
  } catch (error) {
    console.error('Get cartela by ID error:', error);
    res.status(500).json({ error: 'Failed to get cartela' });
  }
});

// Get all cartelas (public endpoint - no authentication required)
router.get('/', async (req, res) => {
  try {
    const allCartelas = await cartelas.findAll();
    const activeCartelas = allCartelas.filter(c => c.is_active);

    res.json({
      cartelas: activeCartelas,
      total: activeCartelas.length
    });
  } catch (error) {
    console.error('Get cartelas error:', error);
    res.status(500).json({ error: 'Failed to get cartelas' });
  }
});

// Get cartelas for a specific user (authenticated users only)
router.get('/user/:userId', authenticateToken, [
  param('userId').isUUID().withMessage('User ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.userId;
    const currentUser = req.user;

    // Users can only access their own cartelas unless they're admin
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You can only view your own cartelas.' });
    }

    const allCartelas = await cartelas.findAll();
    const userCartelas = allCartelas.filter(c => c.user_id === userId && c.is_active);

    res.json({
      cartelas: userCartelas,
      total: userCartelas.length
    });
  } catch (error) {
    console.error('Get user cartelas error:', error);
    res.status(500).json({ error: 'Failed to get user cartelas' });
  }
});

// Get all cartelas (admin only)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const allCartelas = await cartelas.findAll();

    // Get user information for each cartela
    const cartelasWithUsers = await Promise.all(
      allCartelas.map(async (cartela) => {
        const user = await users.findById(cartela.user_id);
        return {
          ...cartela,
          username: user?.username || 'Unknown',
          email: user?.email || 'Unknown'
        };
      })
    );

    res.json({
      cartelas: cartelasWithUsers,
      total: cartelasWithUsers.length
    });
  } catch (error) {
    console.error('Get all cartelas error:', error);
    res.status(500).json({ error: 'Failed to get cartelas' });
  }
});



// Get all available cartelas from database (public endpoint)
router.get('/available', async (req, res) => {
  try {
    const allCartelas = await cartelas.findAll();
    const activeCartelas = allCartelas.filter(c => c.is_active);

    // Group cartelas by card_id and return unique card patterns
    const uniqueCards = {};
    activeCartelas.forEach(cartela => {
      if (!uniqueCards[cartela.card_id]) {
        uniqueCards[cartela.card_id] = {
          cardId: cartela.card_id,
          numbers: cartela.numbers,
          available: true
        };
      }
    });

    const cardIds = Object.keys(uniqueCards);
    res.json({
      cardIds,
      cards: uniqueCards,
      total: cardIds.length
    });
  } catch (error) {
    console.error('Get available cartelas error:', error);
    res.status(500).json({ error: 'Failed to get available cartelas' });
  }
});

// Get cartelas status (which ones are selected in active games)
router.get('/status/active-games', async (req, res) => {
  try {
    // Get all active games
    const { games: gamesDb } = require('../data/database.js');
    const activeGames = await gamesDb.findByStatus('started');
    const activeGamesWithSessions = await gamesDb.findByStatus('active');

    // Combine active games
    const allActiveGames = [...activeGames, ...activeGamesWithSessions];

    // Collect all selected cartela IDs from active games
    const selectedCartelas = new Set();
    const gameSelections = {};

    for (const game of allActiveGames) {
      try {
        let selectedCartelasForGame = [];
        if (Array.isArray(game.selected_cartelas)) {
          selectedCartelasForGame = game.selected_cartelas;
        } else if (typeof game.selected_cartelas === 'string') {
          selectedCartelasForGame = JSON.parse(game.selected_cartelas || '[]');
        }

        // Add to global set and per-game mapping
        gameSelections[game.id] = {
          gameId: game.id,
          gameNumber: game.game_number,
          selectedCartelas: selectedCartelasForGame,
          status: game.status,
          winnerPattern: game.winner_pattern
        };

        selectedCartelasForGame.forEach(cartelaId => {
          if (cartelaId) selectedCartelas.add(cartelaId);
        });
      } catch (error) {
        console.warn('Error parsing selected_cartelas for game', game.id, error);
      }
    }

    res.json({
      selectedCartelaIds: Array.from(selectedCartelas),
      gameSelections: gameSelections,
      totalActiveGames: allActiveGames.length,
      totalSelectedCartelas: selectedCartelas.size
    });
  } catch (error) {
    console.error('Get cartelas status error:', error);
    res.status(500).json({ error: 'Failed to get cartelas status' });
  }
});

// Clean duplicate cartelas (admin only)
router.post('/clean-duplicates', requireAdmin, async (req, res) => {
  try {
    console.log('🧹 Admin requested duplicate cartela cleanup...');

    const { cleanDuplicateCartelas } = require('../clean-duplicate-cartelas');
    const result = await cleanDuplicateCartelas();

    res.json({
      message: 'Duplicate cartela cleanup completed',
      result: result
    });
  } catch (error) {
    console.error('Clean duplicates error:', error);
    res.status(500).json({
      error: 'Failed to clean duplicate cartelas',
      message: error.message
    });
  }
});

// Generate cartelas from existing database cartelas (public endpoint - no authentication required)
router.post('/generate-from-existing', [
  body('sourceCardIds').isArray().withMessage('Source card IDs must be an array'),
  body('sourceCardIds.*').isString().withMessage('Each source card ID must be a string'),
  body('cardIdPrefix').optional().isString().withMessage('Card ID prefix must be a string'),
  body('userId').optional().isUUID().withMessage('User ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sourceCardIds, cardIdPrefix = 'PUBLIC' } = req.body;
    const userId = req.body.userId; // Optional user ID for assignment

    if (sourceCardIds.length === 0) {
      return res.status(400).json({ error: 'No source card IDs provided' });
    }

    if (sourceCardIds.length > 10) {
      return res.status(400).json({ error: 'Cannot generate more than 10 cartelas at once' });
    }

    const generatedCartelas = [];
    const invalidCardIds = [];

    // Get all cartelas once outside the loop
    const allCartelas = await cartelas.findAll();

    // Process each source card ID
    for (let index = 0; index < sourceCardIds.length; index++) {
      const sourceCardId = sourceCardIds[index];
      const sourceCartela = allCartelas.find(c => c.card_id === sourceCardId && c.is_active);

      if (!sourceCartela) {
        invalidCardIds.push(sourceCardId);
        continue;
      }

      // Check if this specific card is already assigned to the specified user (if userId provided)
      if (userId) {
        const existingCard = allCartelas.find(c => c.card_id === sourceCardId && c.user_id === userId);
        if (existingCard) {
          invalidCardIds.push(`${sourceCardId} (already assigned to user)`);
          continue;
        }
      }

      const timestamp = Date.now();
      const cardId = `${cardIdPrefix}-${timestamp}-${index + 1}`;

      // Create new cartela for specified user or public access
      const newCartela = {
        id: uuidv4(),
        card_id: cardId,
        user_id: userId || null, // Allow null user_id for public access
        game_id: null,
        numbers: { ...sourceCartela.numbers },
        pattern: null,
        is_active: true,
        purchased_at: new Date().toISOString()
      };

      await cartelas.create(newCartela);
      generatedCartelas.push(newCartela);
    }

    res.status(201).json({
      message: `Successfully generated ${generatedCartelas.length} cartelas`,
      generatedCartelas,
      summary: {
        totalRequested: sourceCardIds.length,
        successfullyGenerated: generatedCartelas.length,
        invalidCardIds: invalidCardIds,
        cardIdPrefix: cardIdPrefix,
        assignedToUser: userId ? true : false
      }
    });
  } catch (error) {
    console.error('Generate from existing cartelas error:', error);
    res.status(500).json({ error: 'Failed to generate cartelas from existing' });
  }
});

// Add cartelas by range to user (admin only)
router.post('/add-by-range', requireAdmin, [
  body('targetUserId').isUUID().withMessage('Target user ID must be a valid UUID'),
  body('cardIdPrefix').isString().notEmpty().withMessage('Card ID prefix is required'),
  body('startRange').isInt({ min: 1, max: 10000 }).withMessage('Start range must be between 1 and 10000'),
  body('endRange').isInt({ min: 1, max: 10000 }).withMessage('End range must be between 1 and 10000'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID'),
  body('numbersTemplate').optional().isObject().withMessage('Numbers template must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { targetUserId, cardIdPrefix, startRange, endRange, gameId, numbersTemplate } = req.body;

    if (startRange > endRange) {
      return res.status(400).json({ error: 'Start range must be less than or equal to end range' });
    }

    if (endRange - startRange > 1000) {
      return res.status(400).json({ error: 'Cannot create more than 1000 cartelas at once' });
    }

    // Validate target user
    const targetUser = await users.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Validate game if provided
    if (gameId) {
      const game = await games.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      if (game.status === 'finished') {
        return res.status(400).json({ error: 'Cannot assign cartelas to finished game' });
      }
    }

    const createdCartelas = [];
    const duplicateCardIds = [];

    // Get all existing cartelas to check for duplicates
    const allCartelas = await cartelas.findAll();

    // Generate cartelas for the range
    for (let i = startRange; i <= endRange; i++) {
      const cardId = `${cardIdPrefix}-${i}`;

      // Check if cardId already exists for this user
      const existingCard = allCartelas.find(c => c.card_id === cardId && c.user_id === targetUserId);
      if (existingCard) {
        duplicateCardIds.push(cardId);
        continue;
      }

      // Generate numbers if template provided, otherwise use default pattern
      let numbers = numbersTemplate;
      if (!numbers) {
        // Generate default bingo card numbers
        numbers = {
          B: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 1),
          I: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 16),
          N: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 31),
          G: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 46),
          O: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 61)
        };
        // Set center square as free space
        numbers.N[2] = 0;
      }

      const newCartela = {
        id: uuidv4(),
        card_id: cardId,
        user_id: targetUserId,
        game_id: gameId || null,
        numbers,
        pattern: null,
        is_active: true,
        purchased_at: new Date().toISOString()
      };

      await cartelas.create(newCartela);
      createdCartelas.push(newCartela);
    }

    res.status(201).json({
      message: `Successfully created ${createdCartelas.length} cartelas for ${targetUser.username}`,
      createdCartelas,
      summary: {
        totalRequested: endRange - startRange + 1,
        successfullyCreated: createdCartelas.length,
        duplicateCardIds: duplicateCardIds,
        range: `${startRange}-${endRange}`,
        cardIdPrefix: cardIdPrefix
      },
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email
      }
    });
  } catch (error) {
    console.error('Add cartelas by range error:', error);
    res.status(500).json({ error: 'Failed to add cartelas by range' });
  }
});

// Delete cartela (admin only)
router.delete('/:id', requireAdmin, [
  param('id').isUUID().withMessage('Cartela ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const cartelaId = req.params.id;

    // Find the cartela
    const allCartelas = await cartelas.findAll();
    const cartela = allCartelas.find(c => c.id === cartelaId);

    if (!cartela) {
      return res.status(404).json({ error: 'Cartela not found' });
    }

    // Soft delete by setting is_active to false
    await cartelas.update(cartelaId, { is_active: false });

    res.json({
      message: 'Cartela deleted successfully',
      deletedCartela: {
        id: cartela.id,
        card_id: cartela.card_id,
        user_id: cartela.user_id,
        deleted_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Delete cartela error:', error);
    res.status(500).json({ error: 'Failed to delete cartela' });
  }
});

// Update cartela (admin only)
router.put('/:id', requireAdmin, [
  param('id').isUUID().withMessage('Cartela ID must be a valid UUID'),
  body('cardId').optional().isString().notEmpty().withMessage('Card ID must be a non-empty string'),
  body('numbers').optional().isObject().withMessage('Numbers must be an object'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const cartelaId = req.params.id;
    const updateData = req.body;

    // Find the cartela
    const allCartelas = await cartelas.findAll();
    const cartela = allCartelas.find(c => c.id === cartelaId);

    if (!cartela) {
      return res.status(404).json({ error: 'Cartela not found' });
    }

    // Check if cardId already exists for another cartela (if updating cardId)
    if (updateData.cardId && updateData.cardId !== cartela.card_id) {
      const existingCard = allCartelas.find(c =>
        c.card_id === updateData.cardId &&
        c.id !== cartelaId &&
        c.is_active
      );
      if (existingCard) {
        return res.status(400).json({ error: 'Card ID already exists for another cartela' });
      }
    }

    // Validate game if provided
    if (updateData.gameId) {
      const game = games.find(g => g.id === updateData.gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      if (game.status === 'finished') {
        return res.status(400).json({ error: 'Cannot assign cartela to finished game' });
      }
    }

    // Update the cartela
    const updatedCartela = {
      ...cartela,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    await cartelas.update(cartelaId, updatedCartela);

    res.json({
      message: 'Cartela updated successfully',
      updatedCartela: {
        id: updatedCartela.id,
        card_id: updatedCartela.card_id,
        user_id: updatedCartela.user_id,
        game_id: updatedCartela.game_id,
        is_active: updatedCartela.is_active,
        updated_at: updatedCartela.updated_at
      }
    });
  } catch (error) {
    console.error('Update cartela error:', error);
    res.status(500).json({ error: 'Failed to update cartela' });
  }
});

// Register cartela as winner (authenticated users)
router.post('/:id/register-winner', authenticateToken, [
  param('id').isString().notEmpty().withMessage('Cartela ID is required'),
  body('winningPatterns').isArray().withMessage('Winning patterns must be an array'),
  body('winningPatterns.*').isString().withMessage('Each winning pattern must be a string'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID'),
  body('winAmount').isFloat({ min: 0 }).withMessage('Win amount must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const cartelaId = req.params.id;
    const { winningPatterns, gameId, winAmount } = req.body;

    // Find the cartela
    const allCartelas = await cartelas.findAll();
    let cartela = allCartelas.find(c => c.id === cartelaId && c.is_active);

    // If not found by ID, try to find by card_id
    if (!cartela) {
      cartela = allCartelas.find(c => c.card_id === cartelaId && c.is_active);
    }

    if (!cartela) {
      return res.status(404).json({ error: 'Cartela not found' });
    }

    // Check if cartela is already marked as winner
    if (cartela.is_winner) {
      return res.status(400).json({ error: 'Cartela is already registered as a winner' });
    }

    // Validate that the user owns this cartela (if user_id is set)
    if (cartela.user_id && cartela.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to register this cartela as a winner' });
    }

    // Update cartela as winner
    const updateData = {
      is_winner: true,
      pattern: winningPatterns.join(', '), // Store winning patterns as comma-separated string
      updated_at: new Date().toISOString()
    };

    await cartelas.update(cartela.id, updateData);

    // If gameId is provided and winAmount > 0, update game win money
    if (gameId && winAmount > 0) {
      try {
        const { games } = require('../data/database.js');
        const game = await games.findById(gameId);
        if (game) {
          // Update game win money (add to existing win money)
          const currentWinMoney = parseFloat(game.win_money) || 0;
          const newWinMoney = currentWinMoney + winAmount;

          await games.update(gameId, {
            win_money: newWinMoney,
            updated_at: new Date().toISOString()
          });
        }
      } catch (gameUpdateError) {
        console.warn('Could not update game win money:', gameUpdateError);
        // Don't fail the request if game update fails
      }
    }

    // Update user statistics if cartela has a user_id and winAmount > 0
    if (cartela.user_id && winAmount > 0) {
      try {
        const { users } = require('../data/database.js');
        const user = await users.findById(cartela.user_id);
        if (user) {
          const currentWinnings = parseFloat(user.total_winnings) || 0;
          const currentBalance = parseFloat(user.balance) || 0;

          await users.update(cartela.user_id, {
            total_winnings: currentWinnings + winAmount,
            balance: currentBalance + winAmount,
            updated_at: new Date().toISOString()
          });
        }
      } catch (userUpdateError) {
        console.warn('Could not update user statistics:', userUpdateError);
        // Don't fail the request if user update fails
      }
    }

    res.json({
      message: 'Cartela registered as winner successfully',
      cartela: {
        id: cartela.id,
        card_id: cartela.card_id,
        is_winner: true,
        pattern: winningPatterns.join(', '),
        winAmount: winAmount
      }
    });
  } catch (error) {
    console.error('Register winner error:', error);
    res.status(500).json({ error: 'Failed to register cartela as winner' });
  }
});

// Get predefined bingo cards (admin only) - DEPRECATED: Use /available instead
router.get('/predefined', requireAdmin, (req, res) => {
  res.status(410).json({
    error: 'This endpoint is deprecated. Use GET /cartelas/available instead.',
    migrationGuide: 'Update your frontend code to use the /cartelas/available endpoint which serves data from the database.'
  });
});

module.exports = router;
