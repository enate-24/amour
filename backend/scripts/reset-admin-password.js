const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { users, createTables } = require('../data/database.js');

async function resetAdminPassword() {
  try {
    console.log('Initializing database...');
    await createTables();
    
    // Find admin user
    const adminEmail = 'admin@amour-bingo.com';
    const admin = await users.findByEmail(adminEmail);
    
    if (!admin) {
      console.log('❌ Admin user not found with email:', adminEmail);
      console.log('Trying to find by username...');
      const adminByUsername = await users.findByUsername('admin');
      if (!adminByUsername) {
        console.log('❌ No admin user found!');
        return;
      }
      console.log('✅ Found admin user:', adminByUsername.email);
    }
    
    const user = admin || await users.findByUsername('admin');
    
    // Set new password
    const newPassword = process.env.DEMO_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await users.update(user.id, { password: hashedPassword });
    
    console.log('✅ Admin password reset successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Email:', user.email);
    console.log('   Username:', user.username);
    console.log('   Password:', newPassword);
    console.log('\n⚠️  Please change the password after login!');
    
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

resetAdminPassword();
