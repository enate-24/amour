const { pool } = require('../db');

async function listUsers() {
  try {
    const result = await pool.query('SELECT username, id, user_type, balance, total_games_played FROM users ORDER BY username');
    
    console.log('\n👥 Users in Database:\n');
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Type: ${user.user_type}, Balance: ${user.balance} Birr, Games: ${user.total_games_played}`);
    });
    console.log('');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

listUsers();
