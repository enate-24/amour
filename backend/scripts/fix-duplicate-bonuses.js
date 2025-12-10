const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://amour_bingo_user:eEApBgGF73tBO8MRIniMrAnEKDNYlvAZ@dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com/amour_bingo_xeyz',
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixDuplicateBonuses() {
  console.log('🔧 Fixing Duplicate Bonus Games\n');

  try {
    // Find user amour1
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', ['amour1']);
    const user = userResult.rows[0];
    const userId = user.id;

    console.log(`👤 User: ${user.username} (${userId})\n`);

    // Find duplicate bonus games
    console.log('🔍 Finding duplicate bonus games...');
    const duplicateGamesQuery = `
      SELECT 
        id,
        game_number,
        DATE(created_at) as game_date,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY DATE(created_at) ORDER BY created_at) as row_num
      FROM games
      WHERE user_id = $1 AND game_number = 999999
      ORDER BY created_at
    `;
    const duplicateGames = await pool.query(duplicateGamesQuery, [userId]);
    
    console.log(`Found ${duplicateGames.rows.length} bonus games:`);
    duplicateGames.rows.forEach((game, index) => {
      console.log(`  ${index + 1}. ID: ${game.id}, Date: ${game.game_date}, Row: ${game.row_num}, Created: ${game.created_at}`);
    });

    // Delete duplicate games (keep only the first one for each date)
    const duplicatesToDelete = duplicateGames.rows.filter(game => game.row_num > 1);
    
    if (duplicatesToDelete.length > 0) {
      console.log(`\n🗑️ Deleting ${duplicatesToDelete.length} duplicate bonus games:`);
      
      for (const game of duplicatesToDelete) {
        console.log(`  Deleting game ID: ${game.id} (${game.game_date})`);
        await pool.query('DELETE FROM games WHERE id = $1', [game.id]);
      }
      
      console.log('✅ Duplicate bonus games deleted');
    } else {
      console.log('\n✅ No duplicate bonus games to delete');
    }

    // Verify the fix
    console.log('\n🔍 Verification - Remaining bonus games:');
    const remainingGamesQuery = `
      SELECT 
        id,
        game_number,
        DATE(created_at) as game_date,
        created_at
      FROM games
      WHERE user_id = $1 AND game_number = 999999
      ORDER BY created_at
    `;
    const remainingGames = await pool.query(remainingGamesQuery, [userId]);
    
    if (remainingGames.rows.length > 0) {
      remainingGames.rows.forEach((game, index) => {
        console.log(`  ${index + 1}. ID: ${game.id}, Date: ${game.game_date}, Created: ${game.created_at}`);
      });
    } else {
      console.log('  No bonus games found');
    }

    // Check bonus records
    console.log('\n🎁 Current bonus records:');
    const bonusRecordsQuery = `
      SELECT bonus_date, bonus_used, daily_profit
      FROM daily_bonuses
      WHERE user_id = $1
      ORDER BY bonus_date DESC
    `;
    const bonusRecords = await pool.query(bonusRecordsQuery, [userId]);
    
    bonusRecords.rows.forEach((bonus, index) => {
      console.log(`  ${index + 1}. Date: ${bonus.bonus_date}, Used: ${bonus.bonus_used}, Profit: ${bonus.daily_profit}`);
    });

    console.log('\n✅ Fix completed!');
    console.log('\n💡 Prevention measures added:');
    console.log('  - Added check for existing bonus games before creating new ones');
    console.log('  - Enhanced logging to detect duplicate attempts');
    console.log('  - Fixed boolean type handling (true/false instead of 1/0)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixDuplicateBonuses();