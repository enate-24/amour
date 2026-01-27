require('dotenv').config();
const { Pool } = require('pg');

async function healthCheck() {
  console.log('🏥 Health Check - Aiven Database Connection\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('aivencloud.com') ? {
      // Aiven-specific SSL configuration
      rejectUnauthorized: false, // Aiven uses self-signed certificates
      checkServerIdentity: () => undefined // Skip hostname verification for Aiven
    } : {
      rejectUnauthorized: true // Use proper SSL verification for other providers
    },
    max: 1,
    connectionTimeoutMillis: 10000
  });
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    
    console.log('✅ Database connection: OK');
    console.log(`✅ Current time: ${result.rows[0].current_time}`);
    console.log(`✅ PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
    
    // Check if our tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`✅ Tables found: ${tables.rows.length}`);
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    client.release();
    console.log('\n🎉 Health check passed! Database is ready.');
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

healthCheck();