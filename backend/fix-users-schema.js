require('dotenv').config();
const { Pool } = require('pg');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fixUsersSchema() {
  console.log('🔧 Fixing users table schema...\n');
  
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
    
    // Check current users structure
    console.log('\n📋 Current users table structure:');
    const currentColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    currentColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Add missing columns
    console.log('\n🔧 Adding missing columns...');
    
    const columnsToAdd = [
      {
        name: 'balance_limit',
        definition: 'DECIMAL(10,2)'
      },
      {
        name: 'total_games_played',
        definition: 'INTEGER DEFAULT 0'
      },
      {
        name: 'total_winnings',
        definition: 'DECIMAL(10,2) DEFAULT 0'
      }
    ];
    
    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const columnExists = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = $1
        `, [column.name]);
        
        if (columnExists.rows.length === 0) {
          console.log(`➕ Adding ${column.name} column...`);
          await pool.query(`
            ALTER TABLE users 
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
    console.log('\n🔍 Final users table structure:');
    const finalColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    console.log('\n🎉 users schema fix completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. The backend should now work without balance_limit column errors');
    console.log('2. User creation should work properly with all required fields');
    console.log('3. Test the user creation functionality');
    
  } catch (error) {
    console.error('❌ Failed to fix users schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixUsersSchema().catch(error => {
  console.error('❌ Process failed:', error);
  process.exit(1);
});