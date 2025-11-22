#!/usr/bin/env node

/**
 * Health Check Script for Bingo Backend
 * Tests database connectivity and basic API functionality
 */

const { pool, createTables } = require('./data/database');
require('dotenv').config();

async function healthCheck() {
  console.log('🔍 Starting health check...\n');
  
  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful\n');
    
    // Test 2: Database Schema
    console.log('2. Testing database schema...');
    await createTables();
    console.log('✅ Database schema verified\n');
    
    // Test 3: Basic Queries
    console.log('3. Testing basic database operations...');
    const testResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Users table accessible (${testResult.rows[0].count} users)\n`);
    
    // Test 4: Environment Variables
    console.log('4. Checking environment variables...');
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'NODE_ENV',
      'PORT'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('❌ Missing environment variables:', missingVars.join(', '));
      process.exit(1);
    }
    
    console.log('✅ All required environment variables present\n');
    
    // Summary
    console.log('🎉 Health check completed successfully!');
    console.log('📊 System Status:');
    console.log(`   - Database: Connected (${process.env.DATABASE_URL ? 'PostgreSQL' : 'Local'})`);
    console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - Port: ${process.env.PORT || 3000}`);
    console.log(`   - JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Missing'}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('   - Check DATABASE_URL is correct');
    console.error('   - Ensure database is running and accessible');
    console.error('   - Verify all environment variables are set');
    console.error('   - Check network connectivity');
    
    process.exit(1);
  }
}

// Run health check if called directly
if (require.main === module) {
  healthCheck();
}

module.exports = { healthCheck };