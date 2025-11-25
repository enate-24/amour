const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { checkWinningPatterns, validateCartela, convertCartelaToGrid, countCompletedLines } = require('../utils/patternDetection');

const router = express.Router();

/**
 * Check if a selected cartela wins in the current game
 * POST /api/winner-check
 */
router.post('/', [
  body('cartelaId').isString().notEmpty().withMessage('Cartela ID is required'),
  body('gameId').optional({ nullable: true }),
  body('patterns').optional().isArray().withMessage('Patterns must be an array'),
  body('patterns.*').isString().withMessage('Each pattern must be a string'),
  body('calledNumbers').optional().isArray().withMessage('Called numbers must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Validation errors:', errors.array());
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { cartelaId, gameId, patterns, calledNumbers: clientCalledNumbers } = req.body;
    console.log('📥 Winner check request body:', { cartelaId, gameId, patterns, clientCalledNumbers: clientCalledNumbers?.length || 0 });

    // Find the cartela by ID or card_id from PostgreSQL database
    let cartela = await db.get('SELECT * FROM cartelas WHERE id = $1 AND is_active = 1', [cartelaId]);

    if (!cartela) {
      cartela = await db.get('SELECT * FROM cartelas WHERE card_id = $1 AND is_active = 1', [cartelaId]);
    }

    if (!cartela) {
      console.error('❌ Cartela not found:', cartelaId);
      return res.status(404).json({
        success: false,
        message: 'Cartela not found',
        win: false,
        cardType: 'notfound'
      });
    }

    // Determine game ID - use provided gameId or cartela's game_id
    const targetGameId = gameId || cartela.game_id;

    if (!targetGameId) {
      return res.status(400).json({
        success: false,
        message: 'No game ID provided and cartela is not associated with any game',
        win: false,
        cardType: 'nogame'
      });
    }

    // Get the game from PostgreSQL database
    const game = await db.get('SELECT * FROM games WHERE id = $1', [targetGameId]);
    if (!game) {
      console.error('❌ Game not found:', targetGameId);
      return res.status(404).json({
        success: false,
        message: 'Game not found',
        win: false,
        cardType: 'gamenotfound'
      });
    }

    // Check if game is active (started or active status)
    if (!['started', 'active'].includes(game.status)) {
      return res.status(400).json({
        success: false,
        message: `Game is not active (status: ${game.status})`,
        win: false,
        cardType: 'gameinactive'
      });
    }

    // Get the winner pattern - priority order:
    // 1. Patterns from request body (frontend sends current selection)
    // 2. User settings from database
    // 3. Game pattern from database
    // 4. Default to "Two Lines"
    let selectedPatterns;
    
    if (patterns && Array.isArray(patterns) && patterns.length > 0) {
      selectedPatterns = patterns;
      console.log(`✅ Using patterns from request: ${JSON.stringify(selectedPatterns)}`);
    } else {
      console.log(`⚠️ No patterns in request body, checking user settings...`);
      
      // Try to get current user settings from PostgreSQL
      let userPattern = null;
      try {
        if (req.user && req.user.id) {
          const userSettingsData = await db.get('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
          if (userSettingsData && userSettingsData.selected_pattern) {
            userPattern = userSettingsData.selected_pattern;
            console.log(`✅ Found user settings pattern: ${userPattern}`);
          } else {
            console.log(`⚠️ No user settings found for user ${req.user.id}`);
          }
        } else {
          console.log(`⚠️ No authenticated user found in request`);
        }
      } catch (settingsError) {
        console.warn('Error fetching user settings:', settingsError);
      }
      
      // Use user pattern, game pattern, or default
      const finalPattern = userPattern || game.winner_pattern || "Two Lines";
      selectedPatterns = [finalPattern];
      console.log(`⚠️ Using fallback pattern: ${finalPattern} (source: ${userPattern ? 'user settings' : game.winner_pattern ? 'game' : 'default'})`);
    }
    
    console.log(`🎯 Winner check for cartela: ${cartelaId}, game: ${gameId}`);
    console.log(`🎯 Game winner_pattern from DB: ${game.winner_pattern}`);
    console.log(`🎯 Patterns from request body: ${JSON.stringify(patterns)}`);
    console.log(`🎯 Final selected patterns array: ${JSON.stringify(selectedPatterns)}`);

    // Parse and validate cartela numbers
    let cartelaNumbers;
    try {
      cartelaNumbers = typeof cartela.numbers === 'string'
        ? JSON.parse(cartela.numbers)
        : cartela.numbers;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cartela numbers format',
        win: false,
        cardType: 'invalidnumbers'
      });
    }

    // Convert 2D array format to BINGO column format if needed
    // Database stores as [[row1], [row2], ...] but validation expects {B: [...], I: [...], N: [...], G: [...], O: [...]}
    if (Array.isArray(cartelaNumbers) && cartelaNumbers.length === 5 && Array.isArray(cartelaNumbers[0])) {
      console.log('🔄 Converting 2D array format to BINGO column format');
      const bingoFormat = {
        B: [],
        I: [],
        N: [],
        G: [],
        O: []
      };
      const columns = ['B', 'I', 'N', 'G', 'O'];
      
      // Transpose: convert rows to columns
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          const value = cartelaNumbers[row][col];
          // Convert "FREE" or "Free" strings to 0 for the center square
          if (col === 2 && row === 2 && (value === "FREE" || value === "Free")) {
            bingoFormat[columns[col]].push(0);
          } else {
            bingoFormat[columns[col]].push(value);
          }
        }
      }
      cartelaNumbers = bingoFormat;
      console.log('✅ Converted to BINGO format:', cartelaNumbers);
    }

    // Handle "FREE" or "Free" strings in BINGO format (already in column format)
    if (cartelaNumbers && typeof cartelaNumbers === 'object' && !Array.isArray(cartelaNumbers)) {
      console.log('🔍 Checking BINGO format for FREE strings...');
      const columns = ['B', 'I', 'N', 'G', 'O'];
      for (const col of columns) {
        if (Array.isArray(cartelaNumbers[col])) {
          console.log(`  Column ${col} before:`, cartelaNumbers[col]);
          cartelaNumbers[col] = cartelaNumbers[col].map((value, index) => {
            // Convert "FREE" or "Free" strings to 0 (center of N column)
            if (col === 'N' && index === 2 && (value === "FREE" || value === "Free")) {
              console.log(`  ✅ Converting "${value}" to 0 in N column position 2`);
              return 0;
            }
            return value;
          });
          console.log(`  Column ${col} after:`, cartelaNumbers[col]);
        }
      }
      console.log('✅ Converted FREE strings to 0 in BINGO format');
    }
    
    console.log('🔍 Final cartelaNumbers before validation:', JSON.stringify(cartelaNumbers, null, 2));

    // Get called numbers from client only (not stored in database)
    let calledNumbers = [];
    if (clientCalledNumbers && Array.isArray(clientCalledNumbers) && clientCalledNumbers.length > 0) {
      console.log(`📱 Using client-provided called numbers (${clientCalledNumbers.length} numbers)`);
      calledNumbers = clientCalledNumbers;
    } else {
      console.log(`⚠️ No called numbers provided by client`);
      calledNumbers = [];
    }

    // Allow checking even with no called numbers - just show the cartela
    console.log(`🎲 Using ${calledNumbers.length} called numbers for winner check`);

    // Format cartela for pattern checking
    const formattedCartela = {
      card_id: String(cartela.card_id), // Ensure card_id is a string
      numbers: cartelaNumbers
    };

    console.log('🔍 Formatted cartela for validation:', {
      card_id: formattedCartela.card_id,
      card_id_type: typeof formattedCartela.card_id,
      has_numbers: !!formattedCartela.numbers,
      numbers_type: typeof formattedCartela.numbers,
      is_array: Array.isArray(formattedCartela.numbers)
    });

    // Validate cartela structure
    if (!validateCartela(formattedCartela)) {
      console.error('❌ Cartela validation failed for:', JSON.stringify(formattedCartela, null, 2));
      return res.status(400).json({
        success: false,
        message: 'Invalid cartela structure',
        win: false,
        cardType: 'invalidstructure'
      });
    }

    // Check winning patterns
    console.log(`🔍 About to check patterns with selectedPatterns: ${JSON.stringify(selectedPatterns)}`);
    const winningPatterns = checkWinningPatterns(calledNumbers, formattedCartela, selectedPatterns);
    const isWinner = winningPatterns.length > 0;

    console.log(`🎯 Winner check result for cartela ${cartela.card_id}: ${isWinner ? 'WINNER' : 'NOT WINNER'}`);
    console.log(`🎯 Winning patterns returned: ${JSON.stringify(winningPatterns)}`);
    if (winningPatterns.length > 0) {
      console.log(`🏆 Winning patterns: ${winningPatterns.join(', ')}`);
    } else {
      console.log(`❌ No winning patterns detected - check logs above for details`);
    }

    // Get completed lines for highlighting in UI
    const grid = convertCartelaToGrid(formattedCartela);
    const { completedLines } = countCompletedLines(grid, calledNumbers);
    console.log(`📊 Completed lines: ${completedLines.join(', ')}`);

    // Prepare response - always include cartela details
    const response = {
      success: true,
      cartelaId: cartela.card_id,
      gameId: targetGameId,
      win: isWinner,
      cardType: isWinner ? 'win' : 'stillnotwin',
      soundType: isWinner ? 'winner' : 'notwinner',
      winningPatterns: winningPatterns,
      calledNumbersCount: calledNumbers.length,
      message: isWinner
        ? `Congratulations! Cartela ${cartela.card_id} wins with pattern(s): ${winningPatterns.join(', ')}`
        : `Cartela ${cartela.card_id} has not won yet. Keep playing!`,
      cartela: {
        id: cartela.id,
        card_id: cartela.card_id,
        numbers: cartelaNumbers,
        completedLines: completedLines, // Add completed lines for UI highlighting
        pattern: isWinner ? winningPatterns.join(', ') : null,
        purchased_at: cartela.purchased_at
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌❌❌ Winner check error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    console.error('❌ Request body:', req.body);
    res.status(500).json({
      success: false,
      message: 'Internal server error during winner check',
      win: false,
      cardType: 'error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
