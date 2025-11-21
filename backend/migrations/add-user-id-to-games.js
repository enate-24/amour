/**
 * Migration: Add user_id column to games table
 * This allows direct linking of games to users for better reporting
 */

const db = require('../db');

async function addUserIdToGames() {
  console.log('=== Adding user_id to games table ===\n');

  try {
    // Step 1: Check users table id type
    console.log('Step 1: Checking users table structure...');
    const tableInfo = await db.pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
    `);
    console.log(`   users.id type: ${tableInfo.rows[0]?.data_type || 'unknown'}\n`);

    // Step 2: Add user_id column (without foreign key constraint for now)
    console.log('Step 2: Adding user_id column...');
    await db.pool.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS user_id TEXT
    `);
    console.log('✅ Column added\n');

    // Step 3: Create index for performance
    console.log('Step 3: Creating index...');
    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)
    `);
    console.log('✅ Index created\n');

    // Step 4: Check if there are any regular users
    const usersResult = await db.pool.query(`
      SELECT id, username FROM users WHERE role != 'admin' LIMIT 1
    `);

    if (usersResult.rows.length > 0) {
      const firstUser = usersResult.rows[0];
      console.log(`Step 4: Assigning existing games to user: ${firstUser.username}`);
      
      const updateResult = await db.pool.query(`
        UPDATE games 
        SET user_id = $1 
        WHERE user_id IS NULL OR user_id = ''
      `, [firstUser.id]);
      
      console.log(`✅ Assigned ${updateResult.rowCount} games to ${firstUser.username}\n`);
    } else {
      console.log('⚠️  No regular users found. Games will remain unassigned.\n');
    }

    // Step 5: Verify the migration
    console.log('Step 5: Verifying migration...');
    const verifyResult = await db.pool.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(user_id) as games_with_user,
        COUNT(*) - COUNT(user_id) as games_without_user
      FROM games
    `);
    
    const stats = verifyResult.rows[0];
    console.log(`   Total games: ${stats.total_games}`);
    console.log(`   Games with user_id: ${stats.games_with_user}`);
    console.log(`   Games without user_id: ${stats.games_without_user}`);
    console.log('');

    console.log('✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Restart the backend server');
    console.log('2. Test the weekly report page');
    console.log('3. You should now see bet amounts instead of 0\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addUserIdToGames();
