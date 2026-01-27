require('dotenv').config();
const db = require('./db');

async function verifySchemaFix() {
  console.log('🔍 Verifying database schema after fix...\n');
  
  try {
    // Check users table structure
    console.log('📋 Users table structure:');
    const usersColumns = await db.pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('id', 'username')
      ORDER BY ordinal_position
    `);
    
    usersColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check games table structure
    console.log('\n📋 Games table structure:');
    const gamesColumns = await db.pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'games' AND column_name IN ('id', 'user_id', 'status')
      ORDER BY ordinal_position
    `);
    
    gamesColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test a sample user lookup
    console.log('\n👤 Sample user data:');
    const sampleUser = await db.pool.query(`
      SELECT id, username, user_type 
      FROM users 
      WHERE role != 'admin' 
      LIMIT 1
    `);
    
    if (sampleUser.rows.length > 0) {
      const user = sampleUser.rows[0];
      console.log(`  - ID: ${user.id} (type: ${typeof user.id})`);
      console.log(`  - Username: ${user.username}`);
      console.log(`  - User Type: ${user.user_type}`);
    } else {
      console.log('  - No regular users found');
    }
    
    console.log('\n✅ Schema verification complete');
    
  } catch (error) {
    console.error('❌ Error verifying schema:', error.message);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  verifySchemaFix();
}

module.exports = { verifySchemaFix };