const db = require('../db');

async function migrate() {
  try {
    console.log('🔄 Creating user_settings table...');

    // Create user_settings table
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        selected_pattern VARCHAR(50) DEFAULT 'Two Lines',
        bet_amount DECIMAL(10,2) DEFAULT 10.0,
        house_cut_percentage DECIMAL(5,2) DEFAULT 10.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    console.log('✅ user_settings table created successfully');

    // Create default settings for existing users
    const users = await db.all('SELECT id FROM users');
    console.log(`📝 Creating default settings for ${users.length} existing users...`);

    for (const user of users) {
      await db.run(`
        INSERT INTO user_settings (user_id, selected_pattern, bet_amount, house_cut_percentage, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO NOTHING
      `, [
        user.id,
        'Two Lines',
        10.0,
        10.0,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
    }

    console.log('✅ Default settings created for all users');
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
