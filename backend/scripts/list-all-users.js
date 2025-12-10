const { pool } = require('../db');

async function listUsers() {
  console.log('👥 Listing All Users\n');

  try {
    const result = await pool.query(`
      SELECT id, username, user_type, balance, total_games_played, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`Found ${result.rows.length} users:\n`);
    
    result.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. Username: ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Type: ${user.user_type || 'NOT SET'}`);
      console.log(`   Balance: ${user.balance} Birr`);
      console.log(`   Games Played: ${user.total_games_played}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

listUsers()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
