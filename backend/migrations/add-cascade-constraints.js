const { Pool } = require('pg');
require('dotenv').config();

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

async function addCascadeConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration: Adding CASCADE constraints...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. Drop existing foreign key constraints
    console.log('🗑️ Dropping existing foreign key constraints...');
    
    // Drop cartelas foreign keys
    await client.query(`
      ALTER TABLE cartelas 
      DROP CONSTRAINT IF EXISTS cartelas_game_id_fkey,
      DROP CONSTRAINT IF EXISTS cartelas_user_id_fkey
    `);
    
    // Drop admin_logs foreign key
    await client.query(`
      ALTER TABLE admin_logs 
      DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey
    `);
    
    // Drop games foreign key
    await client.query(`
      ALTER TABLE games 
      DROP CONSTRAINT IF EXISTS games_user_id_fkey
    `);
    
    console.log('✅ Existing constraints dropped');
    
    // 2. Add new foreign key constraints with CASCADE
    console.log('➕ Adding new CASCADE constraints...');
    
    // Add cartelas foreign keys with CASCADE
    await client.query(`
      ALTER TABLE cartelas 
      ADD CONSTRAINT cartelas_game_id_fkey 
      FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
    `);
    
    await client.query(`
      ALTER TABLE cartelas 
      ADD CONSTRAINT cartelas_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    `);
    
    // Add admin_logs foreign key with CASCADE
    await client.query(`
      ALTER TABLE admin_logs 
      ADD CONSTRAINT admin_logs_admin_id_fkey 
      FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
    `);
    
    // Add games foreign key with SET NULL (preserve game history)
    await client.query(`
      ALTER TABLE games 
      ADD CONSTRAINT games_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    `);
    
    console.log('✅ New CASCADE constraints added');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  addCascadeConstraints()
    .then(() => {
      console.log('🎉 CASCADE constraints migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addCascadeConstraints };