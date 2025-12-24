const { users, closePool } = require('../db');

async function diagnoseUserCreationError() {
  try {
    console.log('🔍 Diagnosing user creation issues...');
    
    // Check current users
    const allUsers = await users.findAll();
    console.log(`\n📊 Current users in database: ${allUsers.length}`);
    allUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.email}) - Role: ${user.role}`);
    });
    
    // Check environment variables
    console.log('\n🔧 Environment Check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  PORT: ${process.env.PORT}`);
    console.log(`  JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
    console.log(`  DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    
    // Test database connectivity
    console.log('\n🗄️ Database Connectivity Test:');
    const startTime = Date.now();
    try {
      const testUser = await users.findById('test-id');
      const endTime = Date.now();
      console.log(`  ✅ Database query successful (${endTime - startTime}ms)`);
    } catch (dbError) {
      console.log(`  ❌ Database query failed: ${dbError.message}`);
    }
    
    console.log('\n💡 Common causes of "Bad Request" errors:');
    console.log('  1. Missing required fields (username, email, password, voiceCategory)');
    console.log('  2. Invalid field values (voiceCategory must be "boy" or "girl")');
    console.log('  3. Duplicate username or email');
    console.log('  4. Network connectivity issues');
    console.log('  5. Database connection problems');
    console.log('  6. Invalid authentication token');
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('  1. Check browser developer tools for exact error message');
    console.log('  2. Verify all required fields are filled in the form');
    console.log('  3. Try refreshing the page and logging in again');
    console.log('  4. Check server logs for detailed error messages');
    
  } catch (error) {
    console.error('❌ Diagnosis error:', error.message);
  } finally {
    await closePool();
  }
}

// Run the diagnosis
diagnoseUserCreationError();