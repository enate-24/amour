const db = require('../data/database');

async function migrate() {
  try {
    console.log('🔄 Adding voice_category column to user_settings table...');

    // Add voice_category column to user_settings table
    await db.run(`
      ALTER TABLE user_settings 
      ADD COLUMN IF NOT EXISTS voice_category VARCHAR(10) DEFAULT 'girl'
    `);

    console.log('✅ voice_category column added successfully');

    // Update existing users to have default voice category
    const result = await db.run(`
      UPDATE user_settings 
      SET voice_category = 'girl' 
      WHERE voice_category IS NULL
    `);

    console.log(`✅ Updated ${result.changes || 0} existing user settings with default voice category`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
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

module.exports = { migrate };