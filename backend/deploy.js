#!/usr/bin/env node

/**
 * Deployment Script for Bingo Backend
 * Handles database migration and initial setup
 */

const { pool, createTables, users } = require('./data/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function deploy() {
  console.log('🚀 Starting deployment process...\n');
  
  try {
    // Step 1: Test database connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful\n');
    
    // Step 2: Initialize database schema
    console.log('2. Initializing database schema...');
    await createTables();
    console.log('✅ Database schema initialized\n');
    
    // Step 3: Create admin user if not exists
    console.log('3. Setting up admin user...');
    const adminEmail = process.env.DEMO_EMAIL || 'admin@bingo.com';
    const adminPassword = process.env.DEMO_PASSWORD || 'admin123';
    
    const existingAdmin = await users.findByEmail(adminEmail);
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await users.create({
        id: uuidv4(),
        username: 'admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        is_active: true
      });
      console.log(`✅ Admin user created: ${adminEmail}\n`);
    } else {
      console.log(`✅ Admin user already exists: ${adminEmail}\n`);
    }
    
    // Step 4: Create demo user (Tare.a2) if not exists
    console.log('4. Setting up demo user...');
    const demoEmail = 'tare.a2@example.com';
    const demoPassword = '0934942672';
    
    const existingDemo = await users.findByEmail(demoEmail);
    
    if (!existingDemo) {
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
      await users.create({
        id: uuidv4(),
        username: 'Tare.a2',
        email: demoEmail,
        password: hashedPassword,
        role: 'user',
        userType: 'prepaid',
        balance: 1000, // Starting balance
        is_active: true
      });
      console.log(`✅ Demo user created: ${demoEmail}\n`);
    } else {
      console.log(`✅ Demo user already exists: ${demoEmail}\n`);
    }
    
    // Step 5: Verify deployment
    console.log('5. Verifying deployment...');
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Total users in database: ${userCount.rows[0].count}\n`);
    
    // Summary
    console.log('🎉 Deployment completed successfully!');
    console.log('📊 Deployment Summary:');
    console.log(`   - Database: Connected and initialized`);
    console.log(`   - Admin user: ${adminEmail}`);
    console.log(`   - Demo user: ${demoEmail}`);
    console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - Port: ${process.env.PORT || 3000}`);
    
    console.log('\n🔗 Next steps:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Test health endpoint: GET /api/health');
    console.log('   3. Test login with demo user');
    console.log('   4. Update frontend VITE_API_URL');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('   - Check DATABASE_URL is correct');
    console.error('   - Ensure database is running and accessible');
    console.error('   - Verify all environment variables are set');
    console.error('   - Check network connectivity');
    console.error('   - Review database logs');
    
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  deploy();
}

module.exports = { deploy };