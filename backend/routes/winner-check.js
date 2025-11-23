const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { cartelas, games } = require('../data/database.js');
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

    // Default patterns if not provided
    const selectedPatterns = patterns || ["One Line", "Two Lines", "Full House"];

    console.log(`🎯 Winner check request for cartela: ${cartelaId}, game: ${gameId || 'N/A'}, patterns: ${selectedPatterns.join(', ')}`);

    // Find the cartela by ID or card_id
    const allCartelas = await cartelas.findAll();
    let cartela = allCartelas.find(c => c.id === cartelaId && c.is_active);

    if (!cartela) {
      cartela = allCartelas.find(c => c.card_id === cartelaId && c.is_active);
    }

    if (!cartela) {
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

    // Get the game
    const game = await games.findById(targetGameId);
    if (!game) {
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
      card_id: cartela.card_id,
      numbers: cartelaNumbers
    };

    // Validate cartela structure
    if (!validateCartela(formattedCartela)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cartela structure',
        win: false,
        cardType: 'invalidstructure'
      });
    }

    // Check winning patterns
    const winningPatterns = checkWinningPatterns(calledNumbers, formattedCartela, selectedPatterns);
    const isWinner = winningPatterns.length > 0;

    console.log(`🎯 Winner check result for cartela ${cartela.card_id}: ${isWinner ? 'WINNER' : 'NOT WINNER'}`);
    if (winningPatterns.length > 0) {
      console.log(`🏆 Winning patterns: ${winningPatterns.join(', ')}`);
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
    console.error('Winner check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during winner check',
      win: false,
      cardType: 'error'
    });
  }
});

module.exports = router;
