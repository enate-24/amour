const { users } = require('../data/database');

async function updateYabtest() {
  try {
    console.log('Finding Yabtest user...\n');
    
    const yabtest = await users.findByEmail('yabtest@gmail.com');
    
    if (!yabtest) {
      console.error('Yabtest user not found!');
      process.exit(1);
    }
    
    console.log('Current Yabtest data:');
    console.log(`  User Type: ${yabtest.userType}`);
    console.log(`  Balance: ${yabtest.balance}`);
    console.log(`  Balance Limit: ${yabtest.balanceLimit || 'NOT SET'}`);
    console.log('');
    
    console.log('Updating Yabtest to postpaid with balance limit of 5000...\n');
    
    await users.update(yabtest.id, {
      userType: 'postpaid',
      balanceLimit: 5000,
      balance: 0 // Reset balance to 0 for postpaid (will go negative as they accumulate debt)
    });
    
    console.log('✅ Yabtest updated successfully!');
    
    // Verify the update
    const updatedUser = await users.findByEmail('yabtest@gmail.com');
    console.log('\nUpdated Yabtest data:');
    console.log(`  User Type: ${updatedUser.userType}`);
    console.log(`  Balance: ${updatedUser.balance}`);
    console.log(`  Balance Limit: ${updatedUser.balanceLimit}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateYabtest();
