const { Pool } = require('pg');
require('dotenv').config();

// This will use the DATABASE_URL from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function cleanTestData() {
  console.log('🧹 Cleaning test data from database...\n');

  try {
    // Delete test cartela
    const result = await pool.query(`DELETE FROM cartelas WHERE id = 'test_cartela_1'`);
    
    if (result.rowCount > 0) {
      console.log(`✅ Deleted ${result.rowCount} test cartela(s)`);
    } else {
      console.log('ℹ️  No test cartelas found to delete');
    }

    // Check current cartela count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Current cartelas in database: ${countResult.rows[0].count}`);

    console.log('\n✅ Database cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

cleanTestData();