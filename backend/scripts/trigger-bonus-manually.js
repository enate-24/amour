const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

async function triggerBonus() {
  console.log('🎁 Manually Triggering House Bonus\n');

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get user
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', ['pretest']);
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`👤 User: ${user.username}`);
    console.log(`   Type: ${user.user_type}`);
    console.log(`   Current Balance: ${user.balance} Birr\n`);

    // Calculate today's profit
    const profitQuery = `
      SELECT COALESCE(SUM(bet_money - COALESCE(win_money, 0)), 0) as daily_profit
      FROM games
      WHERE user_id = $1 AND DATE(created_at) = $2 AND status = 'finished'
    `;
    const profitResult = await pool.query(profitQuery, [user.id, today]);
    const dailyProfit = parseFloat(profitResult.rows[0]?.daily_profit || 0);
    
    console.log(`💰 Daily Profit: ${dailyProfit} Birr`);

    if (dailyProfit < 1000) {
      console.log(`❌ Not eligible - need ${1000 - dailyProfit} more Birr`);
      return;
    }

    // Check bonus record
    const bonusQuery = 'SELECT * FROM daily_bonuses WHERE user_id = $1 AND bonus_date = $2';
    const bonusResult = await pool.query(bonusQuery, [user.id, today]);
    
    let bonusRecord = bonusResult.rows[0];

    if (!bonusRecord) {
      console.log('📝 Creating bonus record...');
      await pool.query(`
        INSERT INTO daily_bonuses (id, user_id, bonus_date, daily_profit, bonus_amount, requirements_met, bonus_claimed, bonus_used)
        VALUES ($1, $2, $3, $4, 200, 0, 0, 0)
      `, [uuidv4(), user.id, today, dailyProfit]);
      
      const newBonusResult = await pool.query(bonusQuery, [user.id, today]);
      bonusRecord = newBonusResult.rows[0];
      console.log('✅ Bonus record created\n');
    } else {
      console.log(`📝 Bonus record exists`);
      console.log(`   Stored profit: ${bonusRecord.daily_profit} Birr`);
      console.log(`   Bonus used: ${bonusRecord.bonus_used ? 'Yes' : 'No'}\n`);
      
      if (bonusRecord.bonus_used) {
        console.log('❌ Bonus already used today');
        return;
      }

      // Update daily profit
      console.log('📝 Updating daily profit...');
      await pool.query('UPDATE daily_bonuses SET daily_profit = $1 WHERE user_id = $2 AND bonus_date = $3', 
        [dailyProfit, user.id, today]);
      console.log('✅ Daily profit updated\n');
    }

    // Apply bonus
    console.log('🎁 Applying house bonus...\n');

    if (user.user_type === 'postpaid') {
      // Postpaid: Deduct from daily profit
      const newDailyProfit = dailyProfit - 200;
      await pool.query(`
        UPDATE daily_bonuses 
        SET daily_profit = $1, bonus_used = true, bonus_claimed = true
        WHERE user_id = $2 AND bonus_date = $3
      `, [newDailyProfit, user.id, today]);
      
      console.log(`✅ Postpaid bonus applied!`);
      console.log(`   Daily profit: ${dailyProfit} → ${newDailyProfit} Birr`);
      console.log(`   (200 Birr deducted from debt)`);
    } else {
      // Prepaid: Add to balance
      const newBalance = parseFloat(user.balance) + 200;
      await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);
      
      const newDailyProfit = dailyProfit - 200;
      await pool.query(`
        UPDATE daily_bonuses 
        SET daily_profit = $1, bonus_used = true, bonus_claimed = true
        WHERE user_id = $2 AND bonus_date = $3
      `, [newDailyProfit, user.id, today]);
      
      console.log(`✅ Prepaid bonus applied!`);
      console.log(`   Balance: ${user.balance} → ${newBalance.toFixed(2)} Birr`);
      console.log(`   Daily profit: ${dailyProfit} → ${newDailyProfit} Birr`);
    }

    console.log('\n🎉 House bonus successfully applied!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

triggerBonus()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
