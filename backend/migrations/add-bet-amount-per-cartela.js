/**
 * Migration: Add bet_amount_per_cartela column to games table
 * This separates the per-cartela bet amount from the total bet amount
 * to fix the issue where bet amounts appear to change automatically
 */

const db = require('../db');

async function addBetAmountPerCartela() {
  console.log('=== Adding bet_amount_per_cartela to games table ===\n');

  try {
    // Step 1: Add bet_amount_per_cartela column
    console.log('Step 1: Adding bet_amount_per_cartela column...');
    await db.pool.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS bet_amount_per_cartela DECIMAL(10, 2)
    `);
    console.log('✅ Column added\n');

    // Step 2: Calculate bet_amount_per_cartela for existing games
    console.log('Step 2: Calculating bet_amount_per_cartela for existing games...');
    
    // First, check how many games need migration
    const countResult = await db.pool.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN bet_amount_per_cartela IS NULL THEN 1 END) as games_needing_migration,
        COUNT(CASE WHEN cartelas_selected = 0 THEN 1 END) as games_with_zero_cartelas
      FROM games
    `);
    
    const stats = countResult.rows[0];
    console.log(`   Total games: ${stats.total_games}`);
    console.log(`   Games needing migration: ${stats.games_needing_migration}`);
    console.log(`   Games with zero cartelas: ${stats.games_with_zero_cartelas}`);
    console.log('');

    // Update games where cartelas_selected > 0
    console.log('Step 3: Updating games with valid cartela counts...');
    const updateResult = await db.pool.query(`
      UPDATE games 
      SET bet_amount_per_cartela = CASE 
        WHEN cartelas_selected > 0 THEN bet_money / cartelas_selected
        ELSE 5.0
      END
      WHERE bet_amount_per_cartela IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} games\n`);

    // Step 4: Verify the migration
    console.log('Step 4: Verifying migration...');
    const verifyResult = await db.pool.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(bet_amount_per_cartela) as games_with_bet_amount,
        MIN(bet_amount_per_cartela) as min_bet_amount,
        MAX(bet_amount_per_cartela) as max_bet_amount,
        AVG(bet_amount_per_cartela) as avg_bet_amount
      FROM games
    `);
    
    const verifyStats = verifyResult.rows[0];
    console.log(`   Total games: ${verifyStats.total_games}`);
    console.log(`   Games with bet_amount_per_cartela: ${verifyStats.games_with_bet_amount}`);
    console.log(`   Min bet amount: ${verifyStats.min_bet_amount}`);
    console.log(`   Max bet amount: ${verifyStats.max_bet_amount}`);
    console.log(`   Avg bet amount: ${parseFloat(verifyStats.avg_bet_amount).toFixed(2)}`);
    console.log('');

    // Step 5: Show sample of migrated data
    console.log('Step 5: Sample of migrated data...');
    const sampleResult = await db.pool.query(`
      SELECT 
        id,
        game_number,
        bet_money,
        cartelas_selected,
        bet_amount_per_cartela,
        (bet_amount_per_cartela * cartelas_selected) as calculated_total
      FROM games
      WHERE bet_amount_per_cartela IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('   Recent games:');
    sampleResult.rows.forEach(game => {
      console.log(`   Game #${game.game_number}: ${game.cartelas_selected} cartelas × ${game.bet_amount_per_cartela} = ${game.bet_money} (calculated: ${game.calculated_total})`);
    });
    console.log('');

    console.log('✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Update backend API to use bet_amount_per_cartela');
    console.log('2. Update frontend to display per-cartela amount');
    console.log('3. Test with new games to verify correct storage\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addBetAmountPerCartela();
