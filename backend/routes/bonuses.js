const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { dailyBonuses, users, games } = require('../db');

console.log('🎁 Bonus routes loaded successfully');
console.log('📊 Available operations:', { 
  dailyBonuses: !!dailyBonuses, 
  users: !!users, 
  games: !!games 
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Bonus routes are working!', 
    timestamp: new Date().toISOString() 
  });
});

// Daily bonus requirements configuration
const DAILY_REQUIREMENTS = {
  MIN_DAILY_PROFIT: 1000, // Minimum daily profit to unlock bonus
  HOUSE_BONUS_AMOUNT: 200 // Fixed house bonus amount
};

// Helper function to calculate if bonus is available
const calculateBonusEligibility = (dailyProfit) => {
  const requirementsMet = dailyProfit >= DAILY_REQUIREMENTS.MIN_DAILY_PROFIT;
  const bonusAmount = requirementsMet ? DAILY_REQUIREMENTS.HOUSE_BONUS_AMOUNT : 0;

  return { 
    bonusAmount, 
    requirementsMet,
    dailyProfit,
    profitNeeded: Math.max(0, DAILY_REQUIREMENTS.MIN_DAILY_PROFIT - dailyProfit)
  };
};

// GET /api/bonuses/daily - Get today's bonus status
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Calculate daily profit from games
    const allGames = await games.findAll();
    const todayGames = allGames.filter(game => {
      const gameDate = new Date(game.createdAt).toISOString().split('T')[0];
      return gameDate === today && game.user_id === userId && game.status === 'finished';
    });

    const dailyProfit = todayGames.reduce((total, game) => {
      const houseCut = (game.betMoney * game.cartelasSelected * (game.houseCutPercentage || 25)) / 100;
      return total + houseCut;
    }, 0);

    // Get or create today's bonus record
    let dailyBonus = await dailyBonuses.findByUserAndDate(userId, today);

    if (!dailyBonus) {
      // Create new daily bonus record
      await dailyBonuses.create({
        userId,
        bonusDate: today,
        dailyProfit: dailyProfit,
        bonusAmount: 200,
        requirementsMet: false,
        bonusClaimed: false,
        bonusUsed: false
      });
      dailyBonus = await dailyBonuses.findByUserAndDate(userId, today);
    } else {
      // Update daily profit
      await dailyBonuses.update(userId, today, { dailyProfit: dailyProfit });
      dailyBonus = await dailyBonuses.findByUserAndDate(userId, today);
    }

    // Calculate current bonus eligibility
    const bonusStatus = calculateBonusEligibility(dailyProfit);

    res.json({
      success: true,
      dailyBonus: {
        ...dailyBonus,
        dailyProfit: dailyProfit,
        bonusAvailable: bonusStatus.bonusAmount,
        requirementsMet: bonusStatus.requirementsMet,
        profitNeeded: bonusStatus.profitNeeded,
        requirements: DAILY_REQUIREMENTS
      }
    });
  } catch (error) {
    console.error('❌ Get daily bonus error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    res.status(500).json({ 
      error: 'Failed to get daily bonus status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/bonuses/use - Use house bonus (deduct from daily profit)
router.post('/use', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Get today's bonus record
    const dailyBonus = await dailyBonuses.findByUserAndDate(userId, today);

    if (!dailyBonus) {
      return res.status(404).json({ error: 'No bonus record found for today' });
    }

    if (dailyBonus.bonus_used) {
      return res.status(400).json({ error: 'House bonus already used today' });
    }

    // Check if daily profit meets requirement
    const bonusStatus = calculateBonusEligibility(dailyBonus.daily_profit);
    
    if (!bonusStatus.requirementsMet) {
      return res.status(400).json({ 
        error: 'Daily profit requirement not met',
        required: DAILY_REQUIREMENTS.MIN_DAILY_PROFIT,
        current: dailyBonus.daily_profit,
        needed: bonusStatus.profitNeeded
      });
    }

    // Update bonus record - mark as used and deduct from daily profit
    const newDailyProfit = dailyBonus.daily_profit - DAILY_REQUIREMENTS.HOUSE_BONUS_AMOUNT;
    
    await dailyBonuses.update(userId, today, {
      bonusUsed: true,
      bonusClaimed: true,
      dailyProfit: newDailyProfit
    });

    // Add bonus to user balance
    const user = await users.findById(userId);
    await users.update(userId, {
      balance: user.balance + DAILY_REQUIREMENTS.HOUSE_BONUS_AMOUNT
    });

    res.json({
      success: true,
      message: 'House bonus used successfully!',
      bonusAmount: DAILY_REQUIREMENTS.HOUSE_BONUS_AMOUNT,
      newBalance: user.balance + DAILY_REQUIREMENTS.HOUSE_BONUS_AMOUNT,
      newDailyProfit: newDailyProfit
    });
  } catch (error) {
    console.error('❌ Use bonus error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    res.status(500).json({ 
      error: 'Failed to use house bonus',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/bonuses/claim - Claim daily bonus (deprecated - keeping for compatibility)
router.post('/claim', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Get today's bonus record
    const dailyBonus = await dailyBonuses.findByUserAndDate(userId, today);

    if (!dailyBonus) {
      return res.status(404).json({ error: 'No bonus record found for today' });
    }

    if (dailyBonus.bonus_claimed) {
      return res.status(400).json({ error: 'Bonus already claimed today' });
    }

    // Calculate bonus
    const { bonus, requirementsMet } = calculateBonus(dailyBonus.games_played, dailyBonus.total_bet_amount);

    if (!requirementsMet) {
      return res.status(400).json({ 
        error: 'Daily requirements not met',
        requirements: DAILY_REQUIREMENTS,
        current: {
          gamesPlayed: dailyBonus.games_played,
          totalBetAmount: dailyBonus.total_bet_amount
        }
      });
    }

    // Update bonus record
    await dailyBonuses.update(userId, today, {
      bonusEarned: bonus,
      requirementsMet: true,
      bonusClaimed: true
    });

    // Add bonus to user balance
    const user = await users.findById(userId);
    await users.update(userId, {
      balance: user.balance + bonus
    });

    res.json({
      success: true,
      message: 'Daily bonus claimed successfully!',
      bonusAmount: bonus,
      newBalance: user.balance + bonus
    });
  } catch (error) {
    console.error('Claim bonus error:', error);
    res.status(500).json({ error: 'Failed to claim daily bonus' });
  }
});

// GET /api/bonuses/history - Get bonus history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30 } = req.query;

    const bonusHistory = await dailyBonuses.findByUser(userId, parseInt(limit));

    res.json({
      success: true,
      bonusHistory: bonusHistory.map(bonus => ({
        ...bonus,
        bonusDate: bonus.bonus_date
      }))
    });
  } catch (error) {
    console.error('Get bonus history error:', error);
    res.status(500).json({ error: 'Failed to get bonus history' });
  }
});

// GET /api/bonuses/leaderboard - Get daily leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const leaderboard = await dailyBonuses.getLeaderboard(date, 10);

    res.json({
      success: true,
      date,
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        dailyProfit: entry.daily_profit,
        bonusAmount: entry.bonus_amount,
        bonusUsed: entry.bonus_used,
        bonusClaimed: entry.bonus_claimed
      }))
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// POST /api/bonuses/refresh-profit - Refresh daily profit calculation
router.post('/refresh-profit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Calculate daily profit from games
    const allGames = await games.findAll();
    const todayGames = allGames.filter(game => {
      const gameDate = new Date(game.createdAt).toISOString().split('T')[0];
      return gameDate === today && game.user_id === userId && game.status === 'finished';
    });

    const dailyProfit = todayGames.reduce((total, game) => {
      const houseCut = (game.betMoney * game.cartelasSelected * (game.houseCutPercentage || 25)) / 100;
      return total + houseCut;
    }, 0);

    // Get or create today's bonus record
    let dailyBonus = await dailyBonuses.findByUserAndDate(userId, today);

    if (!dailyBonus) {
      await dailyBonuses.create({
        userId,
        bonusDate: today,
        dailyProfit: dailyProfit,
        bonusAmount: 200,
        requirementsMet: false,
        bonusClaimed: false,
        bonusUsed: false
      });
    } else {
      // Only update profit if bonus hasn't been used (to preserve deduction)
      if (!dailyBonus.bonus_used) {
        await dailyBonuses.update(userId, today, { dailyProfit: dailyProfit });
      }
    }

    // Get updated record
    const updatedBonus = await dailyBonuses.findByUserAndDate(userId, today);
    const bonusStatus = calculateBonusEligibility(updatedBonus.daily_profit);

    res.json({
      success: true,
      message: 'Daily profit refreshed successfully',
      dailyProfit: updatedBonus.daily_profit,
      bonusAvailable: bonusStatus.bonusAmount,
      requirementsMet: bonusStatus.requirementsMet,
      profitNeeded: bonusStatus.profitNeeded,
      bonusUsed: updatedBonus.bonus_used
    });
  } catch (error) {
    console.error('Refresh profit error:', error);
    res.status(500).json({ error: 'Failed to refresh daily profit' });
  }
});

module.exports = router;