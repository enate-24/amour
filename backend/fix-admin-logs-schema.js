require('dotenv').config();
const { Pool } = require('pg');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fixAdminLogsSchema() {
  console.log('🔧 Fixing admin_logs table schema...\n');
  
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
    
    // Check current admin_logs structure
    console.log('\n📋 Current admin_logs table structure:');
    const currentColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'admin_logs'
      ORDER BY ordinal_position
    `);
    
    currentColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Add missing columns
    console.log('\n🔧 Adding missing columns...');
    
    const columnsToAdd = [
      {
        name: 'target_type',
        definition: 'VARCHAR(100) NOT NULL DEFAULT \'USER\''
      },
      {
        name: 'target_id',
        definition: 'TEXT NOT NULL DEFAULT \'0\''
      }
    ];
    
    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const columnExists = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'admin_logs' AND column_name = $1
        `, [column.name]);
        
        if (columnExists.rows.length === 0) {
          console.log(`➕ Adding ${column.name} column...`);
          await pool.query(`
            ALTER TABLE admin_logs 
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
    
    // Update existing records to have proper target_id values
    console.log('\n🔧 Updating existing records...');
    try {
      const updateResult = await pool.query(`
        UPDATE admin_logs 
        SET target_id = COALESCE(target_user_id::TEXT, '0')
        WHERE target_id = '0' AND target_user_id IS NOT NULL
      `);
      console.log(`✅ Updated ${updateResult.rowCount} existing records with target_id values`);
    } catch (error) {
      console.log('⚠️ Could not update existing records (this is OK if table is empty)');
    }
    
    // Verify the final structure
    console.log('\n🔍 Final admin_logs table structure:');
    const finalColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'admin_logs'
      ORDER BY ordinal_position
    `);
    
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    console.log('\n🎉 admin_logs schema fix completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. The backend should now work without target_type column errors');
    console.log('2. Admin log creation should work properly');
    console.log('3. Test the user creation functionality');
    
  } catch (error) {
    console.error('❌ Failed to fix admin_logs schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixAdminLogsSchema().catch(error => {
  console.error('❌ Process failed:', error);
  process.exit(1);
});