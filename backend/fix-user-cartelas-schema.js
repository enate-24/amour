require('dotenv').config();
const { Pool } = require('pg');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fixUserCartelasSchema() {
  console.log('🔧 Fixing user_cartelas table schema...\n');
  
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
    
    // Check current user_cartelas structure
    console.log('\n📋 Current user_cartelas table structure:');
    const currentColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_cartelas'
      ORDER BY ordinal_position
    `);
    
    currentColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Add missing columns that the application expects
    console.log('\n🔧 Adding missing columns...');
    
    const columnsToAdd = [
      {
        name: 'is_active',
        definition: 'INTEGER DEFAULT 1'
      },
      {
        name: 'card_id',
        definition: 'TEXT'
      },
      {
        name: 'numbers',
        definition: 'TEXT'
      },
      {
        name: 'pattern',
        definition: 'TEXT'
      }
    ];
    
    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const columnExists = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'user_cartelas' AND column_name = $1
        `, [column.name]);
        
        if (columnExists.rows.length === 0) {
          console.log(`➕ Adding ${column.name} column...`);
          await pool.query(`
            ALTER TABLE user_cartelas 
            ADD COLUMN ${column.name} ${column.definition}
          `);
          console.log(`✅ ${column.name} column added successfully`);
        } else {
          console.log(`✅ ${column.name} column already exists`);
        }
      } catch (error) {
        console.error(`❌ Failed to add ${column.name} column:`, error.message);
      }
    }
    
    // Verify the final structure
    console.log('\n🔍 Final user_cartelas table structure:');
    const finalColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_cartelas'
      ORDER BY ordinal_position
    `);
    
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    console.log('\n🎉 user_cartelas schema fix completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. The backend should now work without is_active column errors');
    console.log('2. Cartela assignment to users should work properly');
    console.log('3. Test the cartela assignment functionality');
    
  } catch (error) {
    console.error('❌ Failed to fix user_cartelas schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixUserCartelasSchema().catch(error => {
  console.error('❌ Process failed:', error);
  process.exit(1);
});