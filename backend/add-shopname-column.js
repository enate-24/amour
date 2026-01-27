require('dotenv').config();
const { Pool } = require('pg');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function addShopnameColumn() {
  console.log('🔧 Adding missing shopname column to users table...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: null,
      key: null,
      cert: null
    },
    max: 3,
    connectionTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 10000,
    createRetryIntervalMillis: 5000
  });
  
  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    client.release();
    
    // Check if shopname column exists
    console.log('\n📋 Checking if shopname column exists...');
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'shopname'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ shopname column already exists');
    } else {
      console.log('➕ Adding shopname column...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN shopname VARCHAR(255)
      `);
      console.log('✅ shopname column added successfully');
    }
    
    // Verify the column was added
    console.log('\n🔍 Verifying users table structure...');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    tableStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n🎉 shopname column fix completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. The backend should now work without shopname column errors');
    console.log('2. You can create users with shopname field');
    console.log('3. Test the admin user creation functionality');
    
  } catch (error) {
    console.error('❌ Failed to add shopname column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addShopnameColumn().catch(error => {
  console.error('❌ Process failed:', error);
  process.exit(1);
});