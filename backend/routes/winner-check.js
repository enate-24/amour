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

    // Find the cartela by ID or card_id from PostgreSQL database (single optimized query)
    const cartela = await db.get(
      'SELECT * FROM cartelas WHERE (id = $1 OR card_id = $1) AND is_active = 1 LIMIT 1',
      [cartelaId]
    );

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
    // 1. Patterns from request body (frontend always sends current selection)
    // 2. Game pattern from database
    // 3. Default to "Two Lines"
    let selectedPatterns;
    
    if (patterns && Array.isArray(patterns) && patterns.length > 0) {
      selectedPatterns = patterns;
      console.log(`✅ Using patterns from request: ${JSON.stringify(selectedPatterns)}`);
    } else {
      // Fallback to game pattern or default
      const finalPattern = game.winner_pattern || "Two Lines";
      selectedPatterns = [finalPattern];
      console.log(`⚠️ Using fallback pattern: ${finalPattern}`);
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

    // If this cartela is a winner, save it to the database
    if (isWinner) {
      try {
        console.log('💾 Saving winner cartela to database...');
        console.log(`🎯 Target game ID: ${targetGameId}`);
        console.log(`🎫 Winner cartela ID: ${cartela.card_id}`);

        // First, get existing winner cartela IDs from game_analysis
        let existingWinners = [];
        console.log('🔍 Checking for existing winners in game_analysis...');
        
        const existingAnalysis = await db.get(
          'SELECT winner_cartela_ids FROM game_analysis WHERE game_id = $1',
          [targetGameId]
        );

        console.log('📊 Existing analysis result:', existingAnalysis);

        if (existingAnalysis && existingAnalysis.winner_cartela_ids) {
          try {
            existingWinners = JSON.parse(existingAnalysis.winner_cartela_ids);
            console.log('✅ Parsed existing winners:', existingWinners);
          } catch (parseError) {
            console.warn('Failed to parse existing winner cartela IDs:', parseError);
            existingWinners = [];
          }
        } else {
          console.log('ℹ️ No existing game_analysis record found for this game');
        }

        // Add this cartela to winners if not already present
        if (!existingWinners.includes(cartela.card_id)) {
          existingWinners.push(cartela.card_id);
          console.log('➕ Added cartela to winners list:', existingWinners);

          // Update or insert into game_analysis table
          // First try to update existing record
          console.log('🔄 Attempting to update existing game_analysis record...');
          const updateResult = await db.run(`
            UPDATE game_analysis 
            SET winner_cartela_ids = $1, updated_at = $2
            WHERE game_id = $3
          `, [
            JSON.stringify(existingWinners),
            new Date().toISOString(),
            targetGameId
          ]);

          console.log('📊 Update result:', updateResult);

          // If no existing record was updated, create a new one with required fields
          if (updateResult.changes === 0) {
            console.log('📝 No existing record found, creating new game_analysis record...');
            // Get game details for required fields
            console.log('🎮 Fetching game details for new record...');
            const gameDetails = await db.get('SELECT * FROM games WHERE id = $1', [targetGameId]);
            console.log('📊 Game details:', gameDetails);
            
            if (gameDetails) {
              console.log('📝 Inserting new game_analysis record...');
              const insertResult = await db.run(`
                INSERT INTO game_analysis (
                  id, game_id, game_number, players, bet, total_bet, cut_percentage,
                  profit, house_bonus, winner_info, status, date, user_id, username,
                  final_win_amount, winner_cartela_ids, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
              `, [
                require('crypto').randomUUID(),
                targetGameId,
                gameDetails.game_number || 0,
                1, // players
                parseFloat(gameDetails.bet_money) || 0,
                parseFloat(gameDetails.bet_money) || 0,
                parseFloat(gameDetails.house_cut_percentage) || 25,
                parseFloat(gameDetails.win_money) || 0,
                (parseFloat(gameDetails.bet_money) || 0) * (parseFloat(gameDetails.house_cut_percentage) || 25) / 100,
                `Winner: ${cartela.card_id}`,
                gameDetails.status || 'active',
                gameDetails.created_at || new Date().toISOString(),
                gameDetails.user_id || 'unknown',
                'unknown',
                parseFloat(gameDetails.win_money) || 0,
                JSON.stringify(existingWinners),
                new Date().toISOString(),
                new Date().toISOString()
              ]);
              console.log('📊 Insert result:', insertResult);
            }
          }

          // Mark the cartela as winner in the cartelas table
          console.log('🏷️ Marking cartela as winner in cartelas table...');
          const cartelaUpdateResult = await db.run(`
            UPDATE cartelas 
            SET is_winner = 1, pattern = $1, updated_at = $2
            WHERE card_id = $3
          `, [
            winningPatterns[0] || selectedPatterns[0],
            new Date().toISOString(),
            cartela.card_id
          ]);
          console.log('📊 Cartela update result:', cartelaUpdateResult);

          console.log(`✅ Successfully saved winner cartela ${cartela.card_id} to database`);
          console.log(`📊 Total winners for game ${targetGameId}: ${existingWinners.length}`);
        } else {
          console.log(`ℹ️ Cartela ${cartela.card_id} already marked as winner`);
        }

      } catch (saveError) {
        console.error('❌ Error saving winner information:', saveError);
        // Don't fail the response, just log the error
      }
    }

    // Get completed lines for highlighting in UI
    const grid = convertCartelaToGrid(formattedCartela);
    const { lines: completedLines } = countCompletedLines(grid, calledNumbers);
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
      },
      winnerSaved: isWinner // Indicate if winner was saved to database
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

// Debug endpoint to check winner data
router.get('/debug/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    
    // Get game_analysis data
    const analysisData = await db.get(
      'SELECT * FROM game_analysis WHERE game_id = $1',
      [gameId]
    );
    
    // Get winner cartelas
    const winnerCartelas = await db.all(
      'SELECT card_id, is_winner, pattern FROM cartelas WHERE game_id = $1 AND is_winner = 1',
      [gameId]
    );
    
    res.json({
      gameId: gameId,
      analysisData: analysisData,
      winnerCartelas: winnerCartelas,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
