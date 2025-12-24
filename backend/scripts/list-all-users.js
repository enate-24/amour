const { users, closePool } = require('../db');

async function listAllUsers() {
  try {
    console.log('🔍 Fetching all users...');
    
    const allUsers = await users.findAll();
    
    console.log(`\n📋 ALL USERS (${allUsers.length} total):`);
    console.log('='.repeat(50));
    
    if (allUsers.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    allUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.is_active ? 'Active' : 'Inactive'}`);
      console.log(`   Balance: $${user.balance}`);
      console.log(`   Created: ${new Date(user.createdAt).toLocaleDateString()}`);
      if (user.shopname) {
        console.log(`   Shop: ${user.shopname}`);
      }
    });
    
    console.log('\n✅ User list completed!');
    
  } catch (error) {
    console.error('❌ Error listing users:', error.message);
  } finally {
    await closePool();
  }
}

// Run the script
listAllUsers();