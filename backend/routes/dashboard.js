const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// GET /api/dashboard/health - Simple health check
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const testQuery = 'SELECT 1 as test';
    const result = await db.get(testQuery);
    
    res.json({
      status: 'OK',
      database: result ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'Connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/dashboard/test - Test authentication
router.get('/test', authenticateToken, async (req, res) => {
  try {
    res.json({
      status: 'OK',
      user: {
        id: req.user?.id,
        role: req.user?.role,
        username: req.user?.username
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/dashboard - Get dashboard data
router.get('/', authenticateToken, async (req, res) => {
  console.log('Dashboard route called - authentication required');
  
  // Get user ID from authenticated token
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'User authentication required' });
  }
  
  console.log('Dashboard request for user:', userId);
  try {
    console.log('Dashboard request received');
    console.log('User ID being used:', userId);

    // Get today's date range (in UTC to match database timestamps)
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

    // Get this week's date range (Monday to Sunday)
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get 15 days ago
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(today.getDate() - 15);

    // Check if user is admin
    const isAdmin = req.user?.role === 'admin';
    
    // Daily query: show all games (games don't have user_id, they're global)
    // Use lowercase aliases because PostgreSQL converts unquoted identifiers to lowercase
    const dailyQuery = `
      SELECT
        COALESCE(SUM(g.bet_money), 0) as dailytotal,
        COALESCE(SUM(g.bet_money - COALESCE(g.win_money, 0)), 0) as dailyprofit,
        COUNT(g.id) as dailygames
      FROM games g
      WHERE g.created_at >= $1 AND g.created_at < $2 AND g.status IN ('started', 'finished')
    `;

    // Weekly query: show all games (games don't have user_id, they're global)
    // Use lowercase aliases because PostgreSQL converts unquoted identifiers to lowercase
    const weeklyQuery = `
      SELECT
        COALESCE(SUM(g.bet_money), 0) as weeklytotal,
        COALESCE(SUM(g.bet_money - COALESCE(g.win_money, 0)), 0) as weeklyprofit
      FROM games g
      WHERE g.created_at >= $1 AND g.created_at < $2 AND g.status IN ('started', 'finished')
    `;

    // Use lowercase aliases because PostgreSQL converts unquoted identifiers to lowercase
    const fifteenDayQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN c.user_id = $1 THEN g.bet_money ELSE 0 END), 0) as userfifteendaybets,
        COALESCE(SUM(CASE WHEN c.user_id = $1 AND c.is_winner = 1 THEN g.win_money ELSE 0 END), 0) as userfifteendaywinnings
      FROM cartelas c
      LEFT JOIN games g ON c.game_id = g.id AND g.created_at >= $2 AND g.status IN ('started', 'active')
      WHERE c.user_id IS NOT NULL
    `;

    // Execute queries
    let dailyResults, weeklyResults, fifteenDayResults;
    try {
      const dailyParams = [startOfDay.toISOString(), endOfDay.toISOString()];
      console.log('Executing daily query with params:', dailyParams);
      const dailyResult = await db.get(dailyQuery, dailyParams);
      console.log('Daily result:', dailyResult);
      
      // PostgreSQL returns lowercase column names
      dailyResults = [{
        dailyprofit: dailyResult?.dailyprofit || 0,
        dailytotal: dailyResult?.dailytotal || 0,
        dailygames: dailyResult?.dailygames || 0
      }];

      const weeklyParams = [startOfWeek.toISOString(), endOfWeek.toISOString()];
      console.log('Executing weekly query with params:', weeklyParams);
      const weeklyResult = await db.get(weeklyQuery, weeklyParams);
      console.log('Weekly result:', weeklyResult);
      
      // PostgreSQL returns lowercase column names
      weeklyResults = [{
        weeklytotal: weeklyResult?.weeklytotal || 0,
        weeklyprofit: weeklyResult?.weeklyprofit || 0
      }];

      console.log('Executing fifteen day query with params:', [userId, fifteenDaysAgo.toISOString()]);
      fifteenDayResults = await db.all(fifteenDayQuery, [userId, fifteenDaysAgo.toISOString()]);
      console.log('Fifteen day results:', fifteenDayResults);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      console.error('Error details:', dbError.stack);
      throw new Error(`Database error: ${dbError.message}`);
    }



    // Get recent games data - show only days with game data, up to 10 days max
    let recentGames = [];

    // Get user creation date
    const userQuery = 'SELECT created_at FROM users WHERE id = $1';
    const userResult = await db.get(userQuery, [userId]);
    const userCreatedAt = userResult?.created_at ? new Date(userResult.created_at) : new Date();

    console.log('User created at:', userCreatedAt.toISOString());

    // Get recent games data - show all games (games don't have user_id, they're global)
    // Use lowercase aliases because PostgreSQL converts unquoted identifiers to lowercase
    const recentGamesQuery = `
      SELECT
        DATE(g.created_at) as created_date,
        COUNT(g.id) as games,
        COALESCE(SUM(g.bet_money), 0) as playersbet,
        COALESCE(SUM(g.win_money), 0) as playerswon,
        COALESCE(SUM(g.bet_money - COALESCE(g.win_money, 0)), 0) as houseprofit
      FROM games g
      WHERE g.created_at >= $1 AND g.status IN ('started', 'finished')
      GROUP BY DATE(g.created_at)
      ORDER BY DATE(g.created_at) DESC
      LIMIT 10
    `;

    try {
      const recentGamesParams = [userCreatedAt.toISOString()];
      const recentGamesResults = await db.all(recentGamesQuery, recentGamesParams);

      console.log('Found game data for', recentGamesResults.length, 'days');

      // Format the results - only include days with actual game data
      recentGames = recentGamesResults.map(game => {
        const gameDate = new Date(game.created_date);
        const dateStr = gameDate.getFullYear() + '-' +
                        String(gameDate.getMonth() + 1).padStart(2, '0') + '-' +
                        String(gameDate.getDate()).padStart(2, '0');

        return {
          date: dateStr,
          games: game.games,
          playersBet: `${parseFloat(game.playersbet || 0).toLocaleString()} Birr`,
          playersWon: `${parseFloat(game.playerswon || 0).toLocaleString()} Birr`,
          houseProfit: `${parseFloat(game.houseprofit || 0).toLocaleString()} Birr`
        };
      });

      console.log('Recent games data:', recentGames);
    } catch (error) {
      console.error('Error fetching recent games:', error);
      recentGames = [];
    }

    let chartData = [];

    try {
      // Get chart data for last 30 days - filter by user_id for regular users
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // Use lowercase aliases because PostgreSQL converts unquoted identifiers to lowercase
      const chartDataQuery = `
        SELECT
          DATE(g.created_at) as date,
          COUNT(g.id) as games,
          COALESCE(SUM(g.bet_money), 0) as totalbets,
          COALESCE(SUM(g.bet_money - COALESCE(g.win_money, 0)), 0) as houseprofit
        FROM games g
        WHERE g.created_at >= $1 AND g.status IN ('started', 'finished')
        GROUP BY DATE(g.created_at)
        ORDER BY date ASC
      `;

      const chartDataParams = [thirtyDaysAgo.toISOString()];
      console.log('Executing chart data query with params:', chartDataParams);
      const chartDataResults = await db.all(chartDataQuery, chartDataParams);
      console.log('Chart data results:', chartDataResults);

      chartData = chartDataResults.map(data => {
        // Ensure date is formatted as YYYY-MM-DD string
        const dateObj = new Date(data.date);
        const dateStr = dateObj.getFullYear() + '-' +
                        String(dateObj.getMonth() + 1).padStart(2, '0') + '-' +
                        String(dateObj.getDate()).padStart(2, '0');
        
        return {
          date: dateStr,
          games: data.games,
          totalBets: parseFloat(data.totalbets || 0),
          houseProfit: parseFloat(data.houseprofit || 0)
        };
      });
      
      console.log('Formatted chart data:', chartData);
    } catch (chartError) {
      console.error('Error fetching chart data:', chartError);
      // Return empty chart data on error
      chartData = [];
    }

    // Calculate 15-day house profit - show all games (games don't have user_id, they're global)
    // Use lowercase aliases because PostgreSQL converts unquoted identifiers to lowercase
    const fifteenDayHouseProfitQuery = `
      SELECT COALESCE(SUM(g.bet_money - COALESCE(g.win_money, 0)), 0) as fifteendayhouseprofit
      FROM games g
      WHERE g.created_at >= $1 AND g.status IN ('started', 'finished')
    `;

    const fifteenDayParams = [fifteenDaysAgo.toISOString()];
    const fifteenDayHouseProfitResult = await db.get(fifteenDayHouseProfitQuery, fifteenDayParams);
    // PostgreSQL returns lowercase column names
    const fifteenDayProfit = parseFloat(fifteenDayHouseProfitResult?.fifteendayhouseprofit || 0);

    // Return actual computed data - ensure all values are numbers
    const dashboardData = {
      dailyProfit: parseFloat(dailyResults[0]?.dailyprofit || 0),
      dailyTotal: parseFloat(dailyResults[0]?.dailytotal || 0),
      dailyGames: parseInt(dailyResults[0]?.dailygames || 0),
      weeklyTotal: parseFloat(weeklyResults[0]?.weeklytotal || 0),
      weeklyProfit: parseFloat(weeklyResults[0]?.weeklyprofit || 0),
      fifteenDayProfit: fifteenDayProfit,
      totalGamesPlayed: parseInt(dailyResults[0]?.dailygames || 0),
      totalWinnings: 0, // Removed user-specific winnings for admin view
      recentGames: recentGames,
      chartData: chartData
    };

    console.log('Dashboard data being returned:', dashboardData);
    res.json(dashboardData);

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    console.error('Error stack:', error.stack);
    
    // Log more details about the error
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.detail) {
      console.error('Error detail:', error.detail);
    }
    
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message || 'Internal server error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

module.exports = router;
