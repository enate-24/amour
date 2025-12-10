const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://amour_bingo_user:eEApBgGF73tBO8MRIniMrAnEKDNYlvAZ@dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com/amour_bingo_xeyz',
  ssl: { rejectUnauthorized: false }
});

async function findBonusGames() {
  console.log('🔍 Searching for Bonus Deduction Games\n');

  try {
    // Get testpre user
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = 'testpre@bingo.com'"
    );
    const user = userResult.rows[0];
    
    console.log(`👤 User: ${user.username} (${user.email})\n`);

    // Search for game #999999
    const game999999 = await pool.query(`
      SELECT * FROM games WHERE user_id = $1 AND game_number = 999999
    `, [user.id]);
    
    console.log('🔎 Searching for game_number = 999999:');
    if (game999999.rows.length > 0) {
      console.log(`   ✅ Found ${game999999.rows.length} game(s)`);
      game999999.rows.forEach(g => {
        console.log(`      Bet: ${g.bet_money}, Win: ${g.win_money}, Profit: ${g.bet_money - (g.win_money || 0)}`);
        console.log(`      Created: ${g.created_at}`);
      });
    } else {
      console.log('   ❌ No games found');
    }
    console.log('');

    // Search for games with bet=0 and win=200
    const bonusPattern1 = await pool.query(`
      SELECT * FROM games 
      WHERE user_id = $1 AND bet_money = 0 AND win_money = 200
    `, [user.id]);
    
    console.log('🔎 Searching for bet=0, win=200:');
    if (bonusPattern1.rows.length > 0) {
      console.log(`   ✅ Found ${bonusPattern1.rows.length} game(s)`);
      bonusPattern1.rows.forEach(g => {
        console.log(`      Game #${g.game_number}, Profit: ${g.bet_money - (g.win_money || 0)}`);
        console.log(`      Created: ${g.created_at}`);
      });
    } else {
      console.log('   ❌ No games found');
    }
    console.log('');

    // Search for games with bet=200 and win=0
    const bonusPattern2 = await pool.query(`
      SELECT * FROM games 
      WHERE user_id = $1 AND bet_money = 200 AND win_money = 0
    `, [user.id]);
    
    console.log('🔎 Searching for bet=200, win=0:');
    if (bonusPattern2.rows.length > 0) {
      console.log(`   ✅ Found ${bonusPattern2.rows.length} game(s)`);
      bonusPattern2.rows.forEach(g => {
        console.log(`      Game #${g.game_number}, Profit: ${g.bet_money - (g.win_money || 0)}`);
        console.log(`      Created: ${g.created_at}`);
      });
    } else {
      console.log('   ❌ No games found');
    }
    console.log('');

    // List ALL games for today
    const today = new Date().toISOString().split('T')[0];
    const allGames = await pool.query(`
      SELECT game_number, bet_money, win_money, 
             (bet_money - COALESCE(win_money, 0)) as profit,
             status, created_at
      FROM games
      WHERE user_id = $1 AND DATE(created_at) = $2
      ORDER BY created_at ASC
    `, [user.id, today]);
    
    console.log(`📋 ALL GAMES TODAY (${allGames.rows.length} total):`);
    allGames.rows.forEach((game, idx) => {
      const time = new Date(game.created_at).toLocaleTimeString();
      console.log(`  ${idx + 1}. Game #${game.game_number} at ${time}`);
      console.log(`     Bet: ${game.bet_money}, Win: ${game.win_money || 0}, Profit: ${parseFloat(game.profit).toFixed(2)}`);
    });
    console.log('');
    
    // Calculate total
    const total = allGames.rows.reduce((sum, g) => sum + parseFloat(g.profit), 0);
    console.log(`💰 Total Profit: ${total.toFixed(2)} Birr`);
    console.log(`📊 Expected after bonus: ${(total - 200).toFixed(2)} Birr`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

findBonusGames()
  .then(() => {
    console.log('\n✅ Search Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
