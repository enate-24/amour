const { all, closePool } = require('../db');

async function simpleUserCount() {
  try {
    console.log('🔍 Connecting to database...');
    
    // Simple count query
    const totalResult = await all('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalResult[0].count;
    
    // Count by role
    const roleResult = await all(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY count DESC
    `);
    
    // Count active vs inactive
    const statusResult = await all(`
      SELECT is_active, COUNT(*) as count 
      FROM users 
      GROUP BY is_active
    `);
    
    console.log('\n📈 USER COUNT SUMMARY:');
    console.log('=====================');
    console.log(`Total Users: ${totalUsers}`);
    
    console.log('\n👥 By Role:');
    roleResult.forEach(row => {
      console.log(`  ${row.role}: ${row.count}`);
    });
    
    console.log('\n📊 By Status:');
    statusResult.forEach(row => {
      const status = row.is_active ? 'Active' : 'Inactive';
      console.log(`  ${status}: ${row.count}`);
    });
    
    // Get recent user count (last 7 days)
    const recentResult = await all(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    
    console.log(`\n🕒 New Users (Last 7 days): ${recentResult[0].count}`);
    
    console.log('\n✅ User count check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // If it's a connection error, provide helpful info
    if (error.message.includes('getaddrinfo') || error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Database connection failed. This could be due to:');
      console.log('   - Remote database is down or unreachable');
      console.log('   - Network connectivity issues');
      console.log('   - Database credentials have changed');
      console.log('   - Database server is overloaded');
    }
  } finally {
    await closePool();
  }
}

// Run the check
simpleUserCount();