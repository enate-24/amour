const { pool } = require('../db');

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting daily_bonuses table migration...');
    
    // Create daily_bonuses table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_bonuses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        bonus_date DATE NOT NULL,
        daily_profit DECIMAL(10,2) DEFAULT 0,
        bonus_amount DECIMAL(10,2) DEFAULT 200,
        bonus_type VARCHAR(50) DEFAULT 'house_bonus',
        requirements_met BOOLEAN DEFAULT false,
        bonus_claimed BOOLEAN DEFAULT false,
        bonus_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, bonus_date)
      )
    `);
    
    console.log('✅ daily_bonuses table created successfully');
    
    // Check if table has data
    const result = await client.query('SELECT COUNT(*) FROM daily_bonuses');
    console.log(`📊 Current daily_bonuses records: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
