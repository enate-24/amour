const { users, closePool } = require('../db');

async function diagnoseAdminError() {
  try {
    console.log('🔍 Diagnosing admin endpoint error...');
    
    // Check if admin user exists
    const adminUser = await users.findByEmail('adminamour@bingo.com');
    if (!adminUser) {
      console.error('❌ Admin user not found with email: adminamour@bingo.com');
      
      // Check all users
      const allUsers = await users.findAll();
      console.log('\n📋 All users in database:');
      allUsers.forEach(user => {
        console.log(`  - ${user.username} (${user.email}) - Role: ${user.role} - Active: ${user.is_active}`);
      });
      return;
    }
    
    console.log('✅ Admin user found:');
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Role: ${adminUser.role}`);
    console.log(`  Active: ${adminUser.is_active}`);
    console.log(`  ID: ${adminUser.id}`);
    
    // Check JWT secret
    console.log('\n🔑 JWT Configuration:');
    console.log(`  JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
    console.log(`  JWT_SECRET length: ${process.env.JWT_SECRET?.length || 0}`);
    
    // Check server configuration
    console.log('\n🌐 Server Configuration:');
    console.log(`  PORT: ${process.env.PORT || 3003}`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
    // Test database connection
    console.log('\n🗄️ Database Test:');
    const testUsers = await users.findAll();
    console.log(`  Total users: ${testUsers.length}`);
    console.log(`  Admin users: ${testUsers.filter(u => u.role === 'admin').length}`);
    console.log(`  Active users: ${testUsers.filter(u => u.is_active).length}`);
    
    console.log('\n✅ Diagnosis completed!');
    console.log('\n💡 Common causes of 400 Bad Request on /api/admin/users:');
    console.log('  1. Missing or invalid Authorization header');
    console.log('  2. Expired JWT token');
    console.log('  3. User not logged in as admin');
    console.log('  4. Server not running or wrong port');
    console.log('  5. CORS issues');
    
  } catch (error) {
    console.error('❌ Diagnosis error:', error.message);
  } finally {
    await closePool();
  }
}

// Run the diagnosis
diagnoseAdminError();