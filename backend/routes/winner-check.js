const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { cartelas, games } = require('../data/database-postgres');
const { checkWinningPatterns, validateCartela } = require('../utils/patternDetection');

const router = express.Router();

/**
 * Check if a selected cartela wins in the current game
 * POST /api/winner-check
 */
router.post('/', [
  body('cartelaId').isString().notEmpty().withMessage('Cartela ID is required'),
  body('gameId').optional().isUUID().withMessage('Game ID must be a valid UUID'),
  body('patterns').optional().isArray().withMessage('Patterns must be an array'),
  body('patterns.*').isString().withMessage('Each pattern must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cartelaId, gameId, patterns } = req.body;

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

    // Get called numbers from game
    let calledNumbers = [];
    try {
      if (Array.isArray(game.called_numbers)) {
        calledNumbers = game.called_numbers;
      } else if (typeof game.called_numbers === 'string') {
        const parsed = JSON.parse(game.called_numbers || '[]');
        calledNumbers = Array.isArray(parsed) ? parsed : [];
      }
    } catch (parseError) {
      console.warn(`Error parsing called numbers for game ${game.id}:`, parseError);
      calledNumbers = [];
    }

    if (calledNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No numbers have been called yet in this game',
        win: false,
        cardType: 'nonumbers'
      });
    }

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

    // Prepare response
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
        : `Cartela ${cartela.card_id} has not won yet. Keep playing!`
    };

    // Add additional details if winner
    if (isWinner) {
      response.cartela = {
        id: cartela.id,
        card_id: cartela.card_id,
        numbers: cartelaNumbers,
        pattern: winningPatterns.join(', '),
        purchased_at: cartela.purchased_at
      };
    }

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
