const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// PostgreSQL connection configuration
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
} : {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'amour_bingo',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

async function applyIndexes() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Applying database indexes...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/add_cartela_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✅ Database indexes applied successfully!');
    
    // Verify indexes were created
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (tablename = 'cartelas' OR tablename = 'games')
      ORDER BY tablename, indexname;
    `);
    
    console.log('\n📊 Current indexes:');
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename}.${row.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
applyIndexes()
  .then(() => {
    console.log('\n✅ Index application complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Index application failed:', error);
    process.exit(1);
  });
