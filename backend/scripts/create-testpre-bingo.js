const { pool } = require('../db');

async function createTestUser() {
  console.log('👤 Creating Test User with email: testpre@bingo.com\n');

  try {
    const email = 'testpre@bingo.com';
    
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1", [email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  User with this email already exists!');
      console.log(`   Username: ${existingUser.rows[0].username}`);
      console.log(`   Balance: ${existingUser.rows[0].balance} Birr`);
      console.log(`   Type: ${existingUser.rows[0].user_type || 'NOT SET'}`);
      return;
    }

    // Create new user with UUID
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    const username = 'testpre';
    const password = 'test123';
    
    const result = await pool.query(`
      INSERT INTO users (id, username, email, password, user_type, balance, total_games_played)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId, username, email, password, 'prepaid', 5000, 0]);
    
    const newUser = result.rows[0];
    
    console.log('✅ User Created Successfully!');
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Type: ${newUser.user_type}`);
    console.log(`   Initial Balance: ${newUser.balance} Birr`);
    console.log(`   Password: test123`);
    console.log('');
    console.log('🎮 You can now login with:');
    console.log(`   Username: ${newUser.username}`);
    console.log('   Password: test123');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createTestUser()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
