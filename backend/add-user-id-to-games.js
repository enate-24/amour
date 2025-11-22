const { Pool } = require('pg');
require('dotenv').config();

// This will use the DATABASE_URL from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function addUserIdToGames() {
  console.log('🔄 Adding user_id column to games table...\n');

  try {
    // Add user_id column to games table
    await pool.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)
    `);
    
    console.log('✅ Added user_id column to games table');

    // Check current games count
    const gamesResult = await pool.query('SELECT COUNT(*) as count FROM games');
    console.log(`📊 Current games in database: ${gamesResult.rows[0].count}`);

    // Check if any games have null user_id
    const nullUserIdResult = await pool.query('SELECT COUNT(*) as count FROM games WHERE user_id IS NULL');
    console.log(`⚠️  Games with null user_id: ${nullUserIdResult.rows[0].count}`);

    if (nullUserIdResult.rows[0].count > 0) {
      console.log('\n🔧 Note: You may need to update existing games to assign user_id values');
      
      // Get a sample user to assign to existing games (optional)
      const sampleUserResult = await pool.query('SELECT id FROM users LIMIT 1');
      if (sampleUserResult.rows.length > 0) {
        const sampleUserId = sampleUserResult.rows[0].id;
        console.log(`💡 Suggestion: You can assign existing games to user ${sampleUserId} with:`);
        console.log(`   UPDATE games SET user_id = '${sampleUserId}' WHERE user_id IS NULL;`);
      }
    }

    console.log('\n✅ Database schema update completed!');

  } catch (error) {
    console.error('❌ Schema update failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

addUserIdToGames();