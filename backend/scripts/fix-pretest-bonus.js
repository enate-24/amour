const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

async function fixPretestBonus() {
  console.log('🔧 Fixing pretest bonus - creating deduction game\n');

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get pretest user
    const userResult = await pool.query("SELECT * FROM users WHERE username = 'pretest'");
    const user = userResult.rows[0];
    
    console.log(`👤 User: ${user.username}`);
    console.log(`   Balance: ${user.balance} Birr`);
    
    // Check if bonus deduction game already exists
    const existingResult = await pool.query(`
      SELECT * FROM games
      WHERE user_id = $1 AND bet_money = 0 AND win_money = 200
      AND DATE(created_at) = $2
    `, [user.id, today]);
    
    if (existingResult.rows.length > 0) {
      console.log('✅ Bonus deduction game already exists');
      return;
    }
    
    // Create bonus deduction game
    const bonusGameId = uuidv4();
    const bonusGameNumber = 999999; // Use a special number for bonus deduction games
    
    await pool.query(`
      INSERT INTO games (
        id, game_number, user_id, bet_money, win_money,
        cartelas_selected, total_numbers, house_cut_percentage, 
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      bonusGameId,
      bonusGameNumber,
      user.id,
      0,        // bet = 0
      200,      // win = 200 (profit = -200)
      0,        // cartelas_selected = 0
      75,       // total_numbers = 75
      0,        // house cut = 0
      'finished',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    console.log('✅ Created bonus deduction game');
    console.log(`   Game ID: ${bonusGameId}`);
    console.log(`   Profit: -200 Birr`);
    
    // Verify
    const verifyResult = await pool.query(`
      SELECT SUM(bet_money - COALESCE(win_money, 0)) as total_profit
      FROM games
      WHERE user_id = $1 AND DATE(created_at) = $2 AND status = 'finished'
    `, [user.id, today]);
    
    console.log(`\n📊 Verification:`);
    console.log(`   Total Daily Profit (with bonus deduction): ${verifyResult.rows[0].total_profit} Birr`);
    console.log(`   Expected: 1000 Birr`);
    
    if (parseFloat(verifyResult.rows[0].total_profit) === 1000) {
      console.log('   ✅ Correct!');
    } else {
      console.log('   ❌ Incorrect!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixPretestBonus()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
