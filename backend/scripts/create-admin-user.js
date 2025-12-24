const { users, closePool } = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createAdminUser() {
  try {
    console.log('🔍 Creating admin user...');
    
    const adminData = {
      username: 'admin',
      email: 'adminamour@bingo.com',
      password: '0934942672'
    };

    // Check if admin already exists
    const existingAdmin = await users.findByEmail(adminData.email);
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists with this email');
      console.log(`Existing admin: ${existingAdmin.username} (${existingAdmin.email})`);
      
      // Ask if we should update the password
      console.log('🔄 Updating existing admin password...');
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      
      await users.update(existingAdmin.id, {
        password: hashedPassword,
        username: adminData.username
      });
      
      console.log('✅ Admin password updated successfully!');
      return;
    }

    // Check if username already exists
    const existingUser = await users.findByUsername(adminData.username);
    if (existingUser) {
      console.log('⚠️ Username "admin" already exists');
      console.log(`Existing user: ${existingUser.username} (${existingUser.email})`);
      
      console.log('🔄 Updating existing admin user...');
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      
      await users.update(existingUser.id, {
        role: 'admin',
        email: adminData.email,
        password: hashedPassword
      });
      
      console.log('✅ Admin user updated successfully!');
      console.log('📋 Updated Admin Details:');
      console.log(`   Username: ${adminData.username}`);
      console.log(`   Email: ${adminData.email}`);
      console.log(`   Password: ${adminData.password}`);
      console.log(`   Role: admin`);
      return;
    }

    // Create new admin user
    console.log('👤 Creating new admin user...');
    
    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    
    const newAdmin = {
      id: uuidv4(),
      username: adminData.username,
      email: adminData.email,
      password: hashedPassword,
      role: 'admin',
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await users.create(newAdmin);
    
    console.log('✅ Admin user created successfully!');
    console.log('📋 Admin Details:');
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Password: ${adminData.password}`);
    console.log(`   Role: admin`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    if (error.message.includes('duplicate key')) {
      console.log('💡 This error usually means the user already exists');
    }
  } finally {
    await closePool();
  }
}

// Run the script
createAdminUser();