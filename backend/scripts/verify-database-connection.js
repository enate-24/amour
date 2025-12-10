const { pool } = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function verifyConnection() {
  console.log('🔍 Database Connection Verification\n');

  try {
    // Show connection info (without password)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
      if (urlParts) {
        console.log('📡 Connected to REMOTE PostgreSQL Database:');
        console.log(`   Host: ${urlParts[3]}`);
        console.log(`   Database: ${urlParts[4]}`);
        console.log(`   User: ${urlParts[1]}`);
        console.log(`   Password: ${'*'.repeat(10)}`);
      }
    } else {
      console.log('📡 Connected to LOCAL PostgreSQL Database:');
      console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
      console.log(`   Database: ${process.env.DB_NAME || 'amour_bingo'}`);
      console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
    }
    console.log('');

    // Test connection
    const result = await pool.query('SELECT NOW() as current_time, current_database() as db_name, current_user as user_name');
    console.log('✅ Connection Successful!');
    console.log(`   Current Time: ${result.rows[0].current_time}`);
    console.log(`   Database Name: ${result.rows[0].db_name}`);
    console.log(`   Connected As: ${result.rows[0].user_name}`);
    console.log('');

    // Get user count
    const userCount = await pool.query('SELECT COUNT(*) as total FROM users');
    console.log(`👥 Total Users: ${userCount.rows[0].total}`);
    
    // Get game count
    const gameCount = await pool.query('SELECT COUNT(*) as total FROM games');
    console.log(`🎮 Total Games: ${gameCount.rows[0].total}`);
    
    // Get bonus count
    const bonusCount = await pool.query('SELECT COUNT(*) as total FROM daily_bonuses');
    console.log(`🎁 Total Bonuses: ${bonusCount.rows[0].total}`);
    console.log('');

    // List all users
    const users = await pool.query('SELECT username, email, balance, user_type FROM users ORDER BY created_at DESC');
    console.log('📋 All Users in This Database:');
    users.rows.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.username} (${user.email})`);
      console.log(`      Type: ${user.user_type}, Balance: ${user.balance} Birr`);
    });

  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyConnection()
  .then(() => {
    console.log('\n✅ Verification Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification Failed:', error);
    process.exit(1);
  });
