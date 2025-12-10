const { pool } = require('../db');

async function verifyBonusProfitFix() {
  console.log('🔍 Verifying Bonus Profit Calculation Fix\n');

  try {
    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`📅 Checking data for: ${todayStr}\n`);

    // Find users who have used bonus today
    const bonusUsersQuery = `
      SELECT db.user_id, db.bonus_used, db.daily_profit, u.username, u.user_type
      FROM daily_bonuses db
      JOIN users u ON db.user_id = u.id
      WHERE db.bonus_date = $1 AND db.bonus_used = true
    `;
    
    const bonusUsers = await pool.query(bonusUsersQuery, [todayStr]);
    
    if (bonusUsers.rows.length === 0) {
      console.log('ℹ️  No users have used bonus today');
      console.log('💡 To test, play games until profit reaches 1000+ Birr\n');
      return;
    }

    console.log(`✅ Found ${bonusUsers.rows.length} user(s) with bonus applied today:\n`);

    for (const user of bonusUsers.rows) {
      console.log(`👤 User: ${user.username} (${user.user_type})`);
      console.log(`   User ID: ${user.user_id}`);
      
      // Calculate raw daily profit (before bonus deduction)
      const rawDailyQuery = `
        SELECT COALESCE(SUM(bet_money - COALESCE(win_money, 0)), 0) as raw_profit
        FROM games
        WHERE user_id = $1 
          AND DATE(created_at) = $2
          AND status = 'finished'
      `;
      
      const rawDailyResult = await pool.query(rawDailyQuery, [user.user_id, todayStr]);
      const rawDailyProfit = parseFloat(rawDailyResult.rows[0].raw_profit);
      
      // Calculate adjusted daily profit (after bonus deduction)
      const adjustedDailyProfit = rawDailyProfit - 200;
      
      console.log(`   📊 Daily Profit:`);
      console.log(`      Raw: ${rawDailyProfit.toFixed(2)} Birr`);
      console.log(`      Adjusted: ${adjustedDailyProfit.toFixed(2)} Birr (after -200 bonus)`);
      
      // Calculate weekly profit
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStartStr = startOfWeek.toISOString().split('T')[0];
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const weekEndStr = endOfWeek.toISOString().split('T')[0];
      
      const rawWeeklyQuery = `
        SELECT COALESCE(SUM(bet_money - COALESCE(win_money, 0)), 0) as raw_profit
        FROM games
        WHERE user_id = $1 
          AND DATE(created_at) >= $2
          AND DATE(created_at) < $3
          AND status = 'finished'
      `;
      
      const rawWeeklyResult = await pool.query(rawWeeklyQuery, [user.user_id, weekStartStr, weekEndStr]);
      const rawWeeklyProfit = parseFloat(rawWeeklyResult.rows[0].raw_profit);
      const adjustedWeeklyProfit = rawWeeklyProfit - 200;
      
      console.log(`   📊 Weekly Profit:`);
      console.log(`      Raw: ${rawWeeklyProfit.toFixed(2)} Birr`);
      console.log(`      Adjusted: ${adjustedWeeklyProfit.toFixed(2)} Birr (after -200 bonus)`);
      
      // Calculate 15-day profit
      const fifteenDaysAgo = new Date(today);
      fifteenDaysAgo.setDate(today.getDate() - 15);
      const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split('T')[0];
      
      const raw15DayQuery = `
        SELECT COALESCE(SUM(bet_money - COALESCE(win_money, 0)), 0) as raw_profit
        FROM games
        WHERE user_id = $1 
          AND DATE(created_at) >= $2
          AND status = 'finished'
      `;
      
      const raw15DayResult = await pool.query(raw15DayQuery, [user.user_id, fifteenDaysAgoStr]);
      const raw15DayProfit = parseFloat(raw15DayResult.rows[0].raw_profit);
      const adjusted15DayProfit = raw15DayProfit - 200;
      
      console.log(`   📊 15-Day Profit:`);
      console.log(`      Raw: ${raw15DayProfit.toFixed(2)} Birr`);
      console.log(`      Adjusted: ${adjusted15DayProfit.toFixed(2)} Birr (after -200 bonus)`);
      
      // Verify consistency
      console.log(`\n   ✅ Verification:`);
      if (adjustedDailyProfit === adjustedWeeklyProfit && adjustedWeeklyProfit === adjusted15DayProfit) {
        console.log(`      ✅ All profit calculations are consistent!`);
      } else {
        console.log(`      ⚠️  Profit calculations may differ due to games played on other days`);
      }
      
      // Check for bonus deduction game
      const bonusGameQuery = `
        SELECT * FROM games
        WHERE user_id = $1 
          AND game_number = 999999
          AND DATE(created_at) = $2
      `;
      
      const bonusGameResult = await pool.query(bonusGameQuery, [user.user_id, todayStr]);
      
      if (bonusGameResult.rows.length > 0) {
        const bonusGame = bonusGameResult.rows[0];
        console.log(`      ✅ Bonus deduction game found (Game #999999)`);
        console.log(`         Bet: ${bonusGame.bet_money}, Win: ${bonusGame.win_money}, Profit: ${bonusGame.bet_money - bonusGame.win_money}`);
      } else {
        console.log(`      ⚠️  No bonus deduction game found`);
      }
      
      console.log('');
    }

    // Check admin aggregated view
    console.log('\n📊 Admin Aggregated View:\n');
    
    // Daily total bonus deductions
    const dailyBonusQuery = `
      SELECT COALESCE(SUM(200), 0) as total_deductions, COUNT(*) as bonus_count
      FROM daily_bonuses
      WHERE bonus_date = $1 AND bonus_used = true
    `;
    const dailyBonusResult = await pool.query(dailyBonusQuery, [todayStr]);
    console.log(`   Daily Bonus Deductions: ${dailyBonusResult.rows[0].total_deductions} Birr (${dailyBonusResult.rows[0].bonus_count} users)`);
    
    // Weekly total bonus deductions
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStartStr = startOfWeek.toISOString().split('T')[0];
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const weekEndStr = endOfWeek.toISOString().split('T')[0];
    
    const weeklyBonusQuery = `
      SELECT COALESCE(SUM(200), 0) as total_deductions, COUNT(*) as bonus_count
      FROM daily_bonuses
      WHERE bonus_date >= $1 AND bonus_date < $2 AND bonus_used = true
    `;
    const weeklyBonusResult = await pool.query(weeklyBonusQuery, [weekStartStr, weekEndStr]);
    console.log(`   Weekly Bonus Deductions: ${weeklyBonusResult.rows[0].total_deductions} Birr (${weeklyBonusResult.rows[0].bonus_count} bonuses)`);
    
    // 15-day total bonus deductions
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(today.getDate() - 15);
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split('T')[0];
    
    const fifteenDayBonusQuery = `
      SELECT COALESCE(SUM(200), 0) as total_deductions, COUNT(*) as bonus_count
      FROM daily_bonuses
      WHERE bonus_date >= $1 AND bonus_used = true
    `;
    const fifteenDayBonusResult = await pool.query(fifteenDayBonusQuery, [fifteenDaysAgoStr]);
    console.log(`   15-Day Bonus Deductions: ${fifteenDayBonusResult.rows[0].total_deductions} Birr (${fifteenDayBonusResult.rows[0].bonus_count} bonuses)`);

    console.log('\n✅ Verification Complete!\n');
    console.log('💡 The dashboard should now show these deductions in all profit calculations.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyBonusProfitFix()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
