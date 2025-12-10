const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: 'postgresql://amour_bingo_user:eEApBgGF73tBO8MRIniMrAnEKDNYlvAZ@dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com/amour_bingo_xeyz',
  ssl: { rejectUnauthorized: false }
});

async function fixTestpreBonus() {
  console.log('🔧 Fixing Bonus Deduction Game for testpre@bingo.com\n');

  try {
    // Get user
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = 'testpre@bingo.com'"
    );
    const user = userResult.rows[0];
    
    console.log(`👤 User: ${user.username}`);
    console.log(`   Current Balance: ${user.balance} Birr\n`);

    // Delete existing wrong bonus game if it exists
    const existingGame = await pool.query(`
      SELECT * FROM games WHERE user_id = $1 AND game_number = 999999
    `, [user.id]);
    
    if (existingGame.rows.length > 0) {
      console.log('🗑️  Deleting incorrect bonus game...');
      await pool.query(`DELETE FROM games WHERE user_id = $1 AND game_number = 999999`, [user.id]);
      console.log('   ✅ Deleted\n');
      
      // Revert balance if it was added incorrectly
      if (user.user_type === 'prepaid') {
        const revertedBalance = parseFloat(user.balance) - 200;
        await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [revertedBalance, user.id]);
        console.log(`💰 Reverted balance: ${user.balance} → ${revertedBalance.toFixed(2)} Birr\n`);
      }
    }

    console.log('📝 Creating correct bonus deduction game...\n');

    // Create the CORRECT bonus deduction game
    const bonusGameId = uuidv4();
    const today = new Date();
    
    await pool.query(`
      INSERT INTO games (
        id, game_number, user_id, bet_money, win_money, 
        cartelas_selected, total_numbers, house_cut_percentage, 
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      bonusGameId,
      999999,           // Special bonus game number
      user.id,
      0,                // bet_money = 0
      200,              // win_money = 200 (profit = 0 - 200 = -200)
      0,
      75,
      0,
      'finished',
      today.toISOString(),
      today.toISOString()
    ]);

    console.log('✅ Bonus deduction game created!');
    console.log(`   Game #999999`);
    console.log(`   Bet: 0, Win: 200, Profit: -200 Birr\n`);

    // Update user balance (add 200 Birr for prepaid users)
    if (user.user_type === 'prepaid') {
      const currentBalance = await pool.query('SELECT balance FROM users WHERE id = $1', [user.id]);
      const newBalance = parseFloat(currentBalance.rows[0].balance) + 200;
      await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);
      
      console.log('💰 Updated user balance:');
      console.log(`   Old Balance: ${currentBalance.rows[0].balance} Birr`);
      console.log(`   New Balance: ${newBalance.toFixed(2)} Birr`);
      console.log(`   Added: 200 Birr\n`);
    }

    // Verify the fix
    const todayStr = today.toISOString().split('T')[0];
    const profitCheck = await pool.query(`
      SELECT 
        COALESCE(SUM(bet_money - COALESCE(win_money, 0)), 0) as total_profit
      FROM games
      WHERE user_id = $1 AND DATE(created_at) = $2 AND status = 'finished'
    `, [user.id, todayStr]);
    
    console.log('📊 VERIFICATION:');
    console.log(`   Total Profit (with bonus): ${profitCheck.rows[0].total_profit} Birr`);
    console.log(`   Expected: 925 Birr (1125 - 200)`);
    
    if (parseFloat(profitCheck.rows[0].total_profit) === 925) {
      console.log('   ✅ Profit calculation is now correct!');
    } else {
      console.log('   ⚠️ Profit does not match expected value');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixTestpreBonus()
  .then(() => {
    console.log('\n✅ Fix Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix Failed:', error);
    process.exit(1);
  });
