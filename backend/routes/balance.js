const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { users, pool } = require('../data/database');
const router = express.Router();

// Get user balance and transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user to check if they're prepaid
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow prepaid users to access balance transactions
    if (user.userType !== 'prepaid') {
      return res.status(403).json({ 
        error: 'Balance transactions are only available for prepaid users' 
      });
    }

    // Fetch all games for this user from the database with winner cartela info
    const gamesResult = await pool.query(`
      SELECT 
        g.id,
        g.game_number,
        g.status,
        g.bet_money,
        g.win_money,
        g.cartelas_selected,
        g.house_cut_percentage,
        g.created_at,
        g.updated_at,
        g.winner_pattern,
        g.total_numbers,
        g.selected_cartelas,
        ga.winner_cartela_ids
      FROM games g
      LEFT JOIN game_analysis ga ON g.id = ga.game_id
      WHERE g.user_id = $1
      ORDER BY g.created_at DESC
      LIMIT 100
    `, [userId]);

    const games = gamesResult.rows;

    // Transform games into transaction format
    const transactions = games.map((game) => {
      const betMoney = parseFloat(game.bet_money) || 0;
      const winMoney = parseFloat(game.win_money) || 0;
      const houseCut = (betMoney * (parseFloat(game.house_cut_percentage) || 0)) / 100;
      
      // Calculate profit/loss for this game
      // House cut is what the user pays (debit)
      const profit = winMoney - houseCut;
      
      // Determine transaction type and description
      let type, description, amount;
      
      if (game.game_number === 999999) {
        // Special bonus deduction game
        type = 'bonus';
        description = 'Daily Bonus Applied';
        amount = Math.abs(houseCut);
      } else if (profit > 0) {
        // User won money
        type = 'credit';
        description = `Game #${game.game_number} - Won`;
        amount = profit;
      } else if (profit < 0) {
        // User lost money (house cut)
        type = 'debit';
        description = `Game #${game.game_number} - House Cut`;
        amount = Math.abs(houseCut);
      } else {
        // Break even
        type = 'debit';
        description = `Game #${game.game_number} - House Cut`;
        amount = houseCut;
      }

      // Parse winner cartela IDs
      let winnerCartelaIds = [];
      try {
        if (game.winner_cartela_ids) {
          winnerCartelaIds = JSON.parse(game.winner_cartela_ids);
        }
      } catch (error) {
        console.warn('Failed to parse winner_cartela_ids:', game.winner_cartela_ids);
      }

      // Parse selected cartelas to show which ones the user played
      let selectedCartelaIds = [];
      try {
        if (game.selected_cartelas) {
          selectedCartelaIds = JSON.parse(game.selected_cartelas);
        }
      } catch (error) {
        console.warn('Failed to parse selected_cartelas:', game.selected_cartelas);
      }

      return {
        id: game.id,
        type: type,
        amount: amount,
        description: description,
        date: game.created_at,
        gameId: game.id,
        gameNumber: game.game_number,
        gameDetails: {
          status: game.status,
          betMoney: betMoney,
          winMoney: winMoney,
          cartelasSelected: game.cartelas_selected,
          houseCutPercentage: parseFloat(game.house_cut_percentage) || 0,
          houseCut: houseCut,
          profit: profit,
          winnerPattern: game.winner_pattern,
          totalNumbers: game.total_numbers,
          winnerCartelaIds: winnerCartelaIds,
          selectedCartelaIds: selectedCartelaIds,
          hasWinner: winnerCartelaIds.length > 0
        },
        balanceAfter: 0 // Will be calculated below
      };
    });

    // Calculate running balance (from oldest to newest, then reverse)
    let runningBalance = parseFloat(user.balance) || 0;
    
    // Start from current balance and work backwards
    for (let i = 0; i < transactions.length; i++) {
      transactions[i].balanceAfter = runningBalance;
      
      // Subtract/add to get previous balance
      if (transactions[i].type === 'credit' || transactions[i].type === 'bonus') {
        runningBalance -= transactions[i].amount;
      } else {
        runningBalance += transactions[i].amount;
      }
    }

    res.json({
      success: true,
      currentBalance: parseFloat(user.balance) || 0,
      totalGames: games.length,
      transactions: transactions
    });

  } catch (error) {
    console.error('Error fetching balance transactions:', error);
    res.status(500).json({ error: 'Failed to fetch balance transactions' });
  }
});

// Get current balance only
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow prepaid users
    if (user.userType !== 'prepaid') {
      return res.status(403).json({ 
        error: 'Balance information is only available for prepaid users' 
      });
    }

    res.json({
      success: true,
      balance: parseFloat(user.balance) || 0,
      userType: user.userType,
      balanceLimit: parseFloat(user.balanceLimit) || 0
    });

  } catch (error) {
    console.error('Error fetching current balance:', error);
    res.status(500).json({ error: 'Failed to fetch current balance' });
  }
});

module.exports = router;