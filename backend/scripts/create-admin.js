const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { users, createTables } = require('../data/database.js');

async function createAdminUser() {
  try {
    console.log('Initializing database...');
    await createTables();
    
    // Check if admin user already exists
    const adminEmail = process.env.DEMO_EMAIL || 'admin@bingo.com';
    const adminUsername = 'admin';
    
    let existingAdmin = await users.findByEmail(adminEmail);
    if (!existingAdmin) {
      existingAdmin = await users.findByUsername(adminUsername);
    }
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      console.log('   Username:', existingAdmin.username);
      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('\n📝 Login credentials:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Password: (use the password you set during creation)');
      return;
    }
    
    // Create admin user
    const adminPassword = process.env.DEMO_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminData = {
      id: uuidv4(),
      username: 'admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await users.create(adminData);
    
    console.log('✅ Admin user created successfully!');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
    console.log('   Username: admin');
    console.log('\n⚠️  Please change the password after first login!');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createAdminUser();
