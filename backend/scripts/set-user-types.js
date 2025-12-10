const { users } = require('../db');

async function setUserTypes() {
  console.log('🔧 Setting User Types\n');

  try {
    // Get all users
    const allUsers = await users.findAll();
    console.log(`📊 Found ${allUsers.length} users\n`);

    for (const user of allUsers) {
      // Skip if already has user_type
      if (user.user_type) {
        console.log(`✅ ${user.username} already has type: ${user.user_type}`);
        continue;
      }

      // Set default user_type based on role
      let userType = 'prepaid'; // Default to prepaid
      
      // Admin users can be prepaid (they don't play games)
      if (user.role === 'admin') {
        userType = 'prepaid';
      }

      console.log(`🔄 Updating ${user.username} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Setting type: ${userType}`);
      console.log(`   Current balance: ${user.balance}`);

      await users.update(user.id, {
        user_type: userType
      });

      console.log(`   ✅ Updated to ${userType}\n`);
    }

    // Verify updates
    console.log('\n📋 Verification:');
    const updatedUsers = await users.findAll();
    
    const prepaidCount = updatedUsers.filter(u => u.user_type === 'prepaid').length;
    const postpaidCount = updatedUsers.filter(u => u.user_type === 'postpaid').length;
    const noTypeCount = updatedUsers.filter(u => !u.user_type).length;

    console.log(`  Prepaid users: ${prepaidCount}`);
    console.log(`  Postpaid users: ${postpaidCount}`);
    console.log(`  No type set: ${noTypeCount}`);

    console.log('\n✅ User types set successfully!');

  } catch (error) {
    console.error('❌ Error setting user types:', error);
    throw error;
  }
}

// Run
setUserTypes()
  .then(() => {
    console.log('\n✅ Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
