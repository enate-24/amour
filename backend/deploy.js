#!/usr/bin/env node

/**
 * Deployment Script for Bingo Backend
 * Handles database migration and initial setup
 * 
 * This script can be run:
 * 1. During build (will skip if DATABASE_URL not available)
 * 2. Manually after deployment
 * 3. As part of server startup
 */

const { pool, createTables, users } = require('./data/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Check if we should skip deployment (e.g., during build without database)
const SKIP_DEPLOY = process.env.SKIP_DEPLOY === 'true' || !process.env.DATABASE_URL;

async function deploy() {
  console.log('🚀 Starting deployment process...\n');
  
  // Skip deployment if DATABASE_URL is not set (e.g., during build)
  if (SKIP_DEPLOY) {
    console.log('⏭️  Skipping deployment (DATABASE_URL not available or SKIP_DEPLOY=true)');
    console.log('   Database setup will happen on first server start');
    process.exit(0);
  }
  
  let client;
  try {
    // Step 1: Test database connection with timeout
    console.log('1. Testing database connection...');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    const connectionTimeout = setTimeout(() => {
      console.error('⚠️ Database connection timeout after 30 seconds');
      process.exit(1);
    }, 30000);
    
    client = await pool.connect();
    clearTimeout(connectionTimeout);
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    client.release();
    client = null;
    console.log('');
    
    // Step 2: Initialize database schema
    console.log('2. Initializing database schema...');
    await createTables();
    console.log('✅ Database schema initialized\n');
    
    // Step 3: Create admin user if not exists
    console.log('3. Setting up admin user...');
    const adminEmail = process.env.DEMO_EMAIL || 'admin@bingo.com';
    const adminPassword = process.env.DEMO_PASSWORD || 'admin123';
    
    let existingAdmin;
    try {
      existingAdmin = await users.findByEmail(adminEmail);
    } catch (err) {
      console.log('   Note: Could not check for existing admin, will try to create');
      existingAdmin = null;
    }
    
    if (!existingAdmin) {
      try {
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
      } catch (err) {
        if (err.message.includes('duplicate') || err.code === '23505') {
          console.log(`✅ Admin user already exists: ${adminEmail}\n`);
        } else {
          throw err;
        }
      }
    } else {
      console.log(`✅ Admin user already exists: ${adminEmail}\n`);
    }
    
    // Step 4: Create demo user (Tare.a2) if not exists
    console.log('4. Setting up demo user...');
    const demoEmail = 'tare.a2@example.com';
    const demoPassword = '0934942672';
    
    let existingDemo;
    try {
      existingDemo = await users.findByEmail(demoEmail);
    } catch (err) {
      console.log('   Note: Could not check for existing demo user, will try to create');
      existingDemo = null;
    }
    
    if (!existingDemo) {
      try {
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
      } catch (err) {
        if (err.message.includes('duplicate') || err.code === '23505') {
          console.log(`✅ Demo user already exists: ${demoEmail}\n`);
        } else {
          throw err;
        }
      }
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
    console.log('   1. Server will start automatically');
    console.log('   2. Test health endpoint: GET /api/health');
    console.log('   3. Test login with demo user');
    
    // Close pool before exit
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error stack:', error.stack);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('   - Check DATABASE_URL is correct');
    console.error('   - Ensure database is running and accessible');
    console.error('   - Verify all environment variables are set');
    console.error('   - Check network connectivity');
    console.error('   - Review database logs');
    
    // Clean up
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  deploy();
}

module.exports = { deploy };