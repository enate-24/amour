const { pool } = require('../db');

async function addIndexes() {
  console.log('🔧 Adding Performance Indexes\n');

  try {
    // Index for games queries by user_id and date
    console.log('Creating index on games(user_id, created_at)...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_games_user_date 
      ON games(user_id, created_at DESC)
    `);
    console.log('✅ Created idx_games_user_date');

    // Index for games queries by date and status
    console.log('Creating index on games(created_at, status)...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_games_date_status 
      ON games(created_at DESC, status)
    `);
    console.log('✅ Created idx_games_date_status');

    // Index for daily_bonuses queries
    console.log('Creating index on daily_bonuses(bonus_date, bonus_used)...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_bonuses_date_used 
      ON daily_bonuses(bonus_date, bonus_used)
    `);
    console.log('✅ Created idx_daily_bonuses_date_used');

    // Index for games queries by status (for active game lookup)
    console.log('Creating index on games(status, user_id)...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_games_status_user 
      ON games(status, user_id)
    `);
    console.log('✅ Created idx_games_status_user');

    // Index for cartelas queries by card_id (for validation)
    console.log('Creating index on cartelas(card_id, is_active)...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cartelas_card_active 
      ON cartelas(card_id, is_active)
    `);
    console.log('✅ Created idx_cartelas_card_active');

    console.log('\n✅ All indexes created successfully!');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addIndexes()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
