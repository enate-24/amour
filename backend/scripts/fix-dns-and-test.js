#!/usr/bin/env node

/**
 * DNS Fix and Database Test Script
 * Attempts to resolve DNS issues and test database connection
 */

const { exec } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config();

async function fixDNSAndTest() {
  console.log('🔧 DNS Fix and Database Test');
  console.log('============================\n');

  console.log('🌐 Step 1: Flushing DNS cache...');
  
  // Flush DNS cache on Windows
  const flushDNS = () => {
    return new Promise((resolve, reject) => {
      exec('ipconfig /flushdns', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Failed to flush DNS:', error.message);
          reject(error);
        } else {
          console.log('✅ DNS cache flushed successfully');
          console.log(stdout);
          resolve();
        }
      });
    });
  };

  try {
    await flushDNS();
  } catch (error) {
    console.log('⚠️ DNS flush failed, continuing anyway...');
  }

  console.log('\n🔍 Step 2: Testing with alternative DNS...');
  
  // Try to resolve using Node.js with different DNS servers
  const dns = require('dns');
  const { Resolver } = dns;
  
  const dnsServers = [
    ['8.8.8.8', '8.8.4.4'], // Google
    ['1.1.1.1', '1.0.0.1'], // Cloudflare
    ['208.67.222.222', '208.67.220.220'] // OpenDNS
  ];

  const hostname = 'db.goknirxxgqoszibullum.supabase.co';
  let resolved = false;

  for (const [primary, secondary] of dnsServers) {
    console.log(`⏳ Trying DNS servers: ${primary}, ${secondary}`);
    
    const resolver = new Resolver();
    resolver.setServers([primary, secondary]);
    
    try {
      const addresses = await new Promise((resolve, reject) => {
        resolver.resolve4(hostname, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      
      console.log(`✅ DNS resolution successful with ${primary}`);
      console.log(`📍 IP Address: ${addresses[0]}`);
      resolved = true;
      break;
    } catch (error) {
      console.log(`❌ Failed with ${primary}:`, error.message);
    }
  }

  if (!resolved) {
    console.log('\n❌ All DNS servers failed. This indicates:');
    console.log('1. Network connectivity issues');
    console.log('2. Firewall blocking DNS queries');
    console.log('3. ISP DNS filtering');
    console.log('4. VPN/Proxy interference');
    console.log('\n💡 Manual Solutions:');
    console.log('1. Change Windows DNS settings to 8.8.8.8, 8.8.4.4');
    console.log('2. Try mobile hotspot');
    console.log('3. Disable VPN/antivirus temporarily');
    console.log('4. Contact your network administrator');
    return;
  }

  console.log('\n🐘 Step 3: Testing PostgreSQL connection...');
  
  const testConfigs = [
    {
      name: 'Standard connection',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        statement_timeout: 15000
      }
    },
    {
      name: 'Extended timeout',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        statement_timeout: 30000,
        query_timeout: 30000
      }
    }
  ];

  for (const { name, config } of testConfigs) {
    console.log(`\n⏳ Testing ${name}...`);
    const pool = new Pool(config);
    
    try {
      const client = await pool.connect();
      console.log(`✅ ${name} successful!`);
      
      // Test database functionality
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      console.log(`🕐 Server time: ${result.rows[0].current_time}`);
      console.log(`📦 PostgreSQL: ${result.rows[0].version.split(' ')[0]}`);
      
      // Test if we can create tables
      await client.query('SELECT 1');
      console.log('✅ Database is ready for use');
      
      client.release();
      await pool.end();
      
      console.log('\n🎉 SUCCESS! Your Supabase database is working!');
      console.log('🚀 You can now start your server with: npm start');
      return;
    } catch (error) {
      console.log(`❌ ${name} failed:`, error.message);
      await pool.end();
    }
  }

  console.log('\n💡 Database connection failed. Possible issues:');
  console.log('1. Incorrect password in DATABASE_URL');
  console.log('2. Supabase project is paused/inactive');
  console.log('3. Network firewall blocking port 5432');
  console.log('4. SSL certificate issues');
  
  console.log('\n🔧 Next steps:');
  console.log('1. Verify your Supabase project is active');
  console.log('2. Double-check your password');
  console.log('3. Try from a different network');
  console.log('4. Contact Supabase support');
}

// Run the fix and test
fixDNSAndTest().catch(console.error);