#!/usr/bin/env node

/**
 * PostgreSQL Connection Fix Script
 * Attempts to resolve common connection issues with Render PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

async function fixPostgreSQLConnection() {
  console.log('🔧 PostgreSQL Connection Fix Tool');
  console.log('==================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL not found in environment');
    return;
  }

  console.log('🔍 Step 1: Testing current connection...');
  
  // Test 1: Basic connection with minimal timeout
  let pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    max: 1
  });

  try {
    const client = await pool.connect();
    console.log('✅ Basic connection successful!');
    client.release();
    await pool.end();
    console.log('🎉 Your PostgreSQL connection is working fine!');
    return;
  } catch (error) {
    console.log('❌ Basic connection failed:', error.message);
    await pool.end();
  }

  console.log('\n🔄 Step 2: Trying connection with extended timeout...');
  
  // Test 2: Extended timeout for slow connections
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    statement_timeout: 30000,
    query_timeout: 30000,
    max: 1,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  try {
    console.log('⏳ Waiting up to 30 seconds for connection...');
    const client = await pool.connect();
    console.log('✅ Extended timeout connection successful!');
    
    // Test database functionality
    const result = await client.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = $1', ['public']);
    console.log(`📊 Database has ${result.rows[0].table_count} tables`);
    
    client.release();
    await pool.end();
    console.log('🎉 PostgreSQL connection is working with extended timeout!');
    return;
  } catch (error) {
    console.log('❌ Extended timeout connection failed:', error.message);
    await pool.end();
  }

  console.log('\n🔄 Step 3: Trying multiple connection attempts...');
  
  // Test 3: Multiple retry attempts
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`⏳ Connection attempt ${attempt}/5...`);
    
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      statement_timeout: 15000,
      max: 1
    });

    try {
      const client = await pool.connect();
      console.log(`✅ Connection attempt ${attempt} successful!`);
      
      // Wake up the database with a simple query
      await client.query('SELECT 1 as wake_up');
      console.log('🌅 Database is now awake');
      
      client.release();
      await pool.end();
      console.log('🎉 PostgreSQL connection restored!');
      return;
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed:`, error.message);
      await pool.end();
      
      if (attempt < 5) {
        const delay = attempt * 2000; // Increasing delay
        console.log(`⏳ Waiting ${delay/1000} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.log('\n💡 Step 4: Troubleshooting Recommendations');
  console.log('==========================================');
  
  console.log('\n🔄 Immediate Actions:');
  console.log('1. Go to your Render Dashboard (https://dashboard.render.com)');
  console.log('2. Find your PostgreSQL service');
  console.log('3. Click "Manual Deploy" or "Restart" to wake up the database');
  console.log('4. Wait 1-2 minutes for the database to fully start');
  console.log('5. Run this script again');

  console.log('\n🌐 Network Troubleshooting:');
  console.log('1. Check your internet connection');
  console.log('2. Try from a different network (mobile hotspot)');
  console.log('3. Disable VPN if you\'re using one');
  console.log('4. Check if your firewall is blocking port 5432');

  console.log('\n⚙️ Database Configuration:');
  console.log('1. Verify your DATABASE_URL is correct');
  console.log('2. Check if you\'ve exceeded connection limits');
  console.log('3. Consider upgrading from free tier for better reliability');

  console.log('\n🔧 Code-Level Fixes:');
  console.log('1. Increase connection timeouts in your application');
  console.log('2. Implement connection retry logic');
  console.log('3. Add connection pooling with proper error handling');
  console.log('4. Use connection keep-alive settings');

  console.log('\n📞 If Problem Persists:');
  console.log('1. Contact Render support');
  console.log('2. Check Render status page for outages');
  console.log('3. Consider using a different PostgreSQL provider');
  console.log('4. Set up local PostgreSQL for development');
}

// Run the fix
fixPostgreSQLConnection().catch(console.error);