#!/usr/bin/env node

/**
 * Database Connection Diagnostic Tool
 * Helps diagnose and fix PostgreSQL connection issues
 */

const { Pool } = require('pg');
require('dotenv').config();

async function diagnoseDatabaseConnection() {
  console.log('🔍 Database Connection Diagnostic Tool');
  console.log('=====================================\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Environment Configuration');
  console.log('------------------------------------');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log('✅ DATABASE_URL found');
    console.log(`🔗 URL: ${databaseUrl.replace(/:[^:@]*@/, ':****@')}`); // Hide password
    
    // Parse the URL to show components
    try {
      const url = new URL(databaseUrl);
      console.log(`📍 Host: ${url.hostname}`);
      console.log(`🚪 Port: ${url.port || 5432}`);
      console.log(`🗄️ Database: ${url.pathname.slice(1)}`);
      console.log(`👤 User: ${url.username}`);
    } catch (error) {
      console.log('❌ Invalid DATABASE_URL format');
    }
  } else {
    console.log('❌ DATABASE_URL not found');
    console.log('Individual DB params:');
    console.log(`   DB_HOST: ${process.env.DB_HOST || 'not set'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || 'not set'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || 'not set'}`);
    console.log(`   DB_USER: ${process.env.DB_USER || 'not set'}`);
  }

  // Step 2: Test basic connection
  console.log('\n🔌 Step 2: Testing Basic Connection');
  console.log('-----------------------------------');

  const basicConfig = {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 10000
  };

  let pool = new Pool(basicConfig);

  try {
    console.log('⏳ Attempting connection...');
    const client = await pool.connect();
    console.log('✅ Basic connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`🕐 Server time: ${result.rows[0].current_time}`);
    console.log(`📦 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    client.release();
  } catch (error) {
    console.log('❌ Basic connection failed:', error.message);
    
    // Analyze the error
    if (error.code === 'ENOTFOUND') {
      console.log('💡 DNS resolution failed - check hostname');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused - server may be down or port blocked');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Connection timeout - network or firewall issue');
    } else if (error.message.includes('password')) {
      console.log('💡 Authentication failed - check username/password');
    } else if (error.message.includes('database')) {
      console.log('💡 Database not found - check database name');
    } else if (error.message.includes('SSL')) {
      console.log('💡 SSL connection issue - trying without SSL...');
      
      // Try without SSL
      try {
        const noSslConfig = { ...basicConfig, ssl: false };
        const noSslPool = new Pool(noSslConfig);
        const client = await noSslPool.connect();
        console.log('✅ Connection successful without SSL');
        client.release();
        await noSslPool.end();
      } catch (noSslError) {
        console.log('❌ Connection failed even without SSL:', noSslError.message);
      }
    }
  } finally {
    await pool.end();
  }

  // Step 3: Test with retry logic
  console.log('\n🔄 Step 3: Testing Connection with Retry Logic');
  console.log('----------------------------------------------');

  const retryConfig = {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 2,
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    acquireTimeoutMillis: 15000,
    createTimeoutMillis: 15000
  };

  pool = new Pool(retryConfig);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`⏳ Retry attempt ${attempt}/3...`);
      const client = await pool.connect();
      console.log(`✅ Retry attempt ${attempt} successful!`);
      
      // Test table existence
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log(`📊 Found ${tableCheck.rows.length} tables in database`);
      if (tableCheck.rows.length > 0) {
        console.log('📋 Tables:', tableCheck.rows.map(r => r.table_name).join(', '));
      }
      
      client.release();
      break;
    } catch (error) {
      console.log(`❌ Retry attempt ${attempt} failed:`, error.message);
      if (attempt < 3) {
        console.log(`⏳ Waiting 2 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  await pool.end();

  // Step 4: Recommendations
  console.log('\n💡 Step 4: Recommendations');
  console.log('---------------------------');
  
  console.log('If connection is still failing, try these solutions:');
  console.log('');
  console.log('1. 🔄 Restart Render Database:');
  console.log('   - Go to Render dashboard');
  console.log('   - Find your PostgreSQL service');
  console.log('   - Click "Manual Deploy" or restart');
  console.log('');
  console.log('2. 🌐 Check Network:');
  console.log('   - Ensure internet connection is stable');
  console.log('   - Try from different network (mobile hotspot)');
  console.log('   - Disable VPN if using one');
  console.log('');
  console.log('3. 🔧 Database Configuration:');
  console.log('   - Verify DATABASE_URL is correct');
  console.log('   - Check if database is in sleep mode (free tier)');
  console.log('   - Consider upgrading to paid tier for better reliability');
  console.log('');
  console.log('4. 🏠 Local Development Alternative:');
  console.log('   - Set up local PostgreSQL for development');
  console.log('   - Use SQLite as fallback for testing');
  console.log('   - Run: npm run setup-local-db');

  console.log('\n🏁 Diagnostic Complete');
}

// Run the diagnostic
diagnoseDatabaseConnection().catch(console.error);