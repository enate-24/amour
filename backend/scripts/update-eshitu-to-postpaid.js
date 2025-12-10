const { users } = require('../data/database');

async function updateEshitu() {
  try {
    console.log('Finding Eshitu user...\n');
    
    const eshitu = await users.findByEmail('eshitu@bingo.com');
    
    if (!eshitu) {
      console.error('Eshitu user not found!');
      process.exit(1);
    }
    
    console.log('Current Eshitu data:');
    console.log(`  User Type: ${eshitu.userType}`);
    console.log(`  Balance: ${eshitu.balance}`);
    console.log(`  Balance Limit: ${eshitu.balanceLimit || 'NOT SET'}`);
    console.log('');
    
    console.log('Updating Eshitu to postpaid with unlimited credit...\n');
    
    await users.update(eshitu.id, {
      userType: 'postpaid',
      balanceLimit: null, // No limit for postpaid
      balance: 0 // Reset balance to 0 for postpaid (will go negative as they accumulate debt)
    });
    
    console.log('✅ Eshitu updated successfully!');
    
    // Verify the update
    const updatedUser = await users.findByEmail('eshitu@bingo.com');
    console.log('\nUpdated Eshitu data:');
    console.log(`  User Type: ${updatedUser.userType}`);
    console.log(`  Balance: ${updatedUser.balance}`);
    console.log(`  Balance Limit: ${updatedUser.balanceLimit || 'UNLIMITED'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateEshitu();
