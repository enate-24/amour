const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// Local database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'amour_bingo',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function exportDatabase() {
  console.log('🔄 Starting database export...\n');

  try {
    // Export users
    const users = await pool.query('SELECT * FROM users ORDER BY created_at');
    console.log(`✅ Exported ${users.rows.length} users`);

    // Export games
    const games = await pool.query('SELECT * FROM games ORDER BY created_at');
    console.log(`✅ Exported ${games.rows.length} games`);

    // Export cartelas
    const cartelas = await pool.query('SELECT * FROM cartelas ORDER BY purchased_at');
    console.log(`✅ Exported ${cartelas.rows.length} cartelas`);

    // Export admin logs
    const adminLogs = await pool.query('SELECT * FROM admin_logs ORDER BY created_at');
    console.log(`✅ Exported ${adminLogs.rows.length} admin logs`);

    // Export game analysis
    const gameAnalysis = await pool.query('SELECT * FROM game_analysis ORDER BY created_at');
    console.log(`✅ Exported ${gameAnalysis.rows.length} game analysis records`);

    // Export sounds
    const sounds = await pool.query('SELECT * FROM sounds ORDER BY id');
    console.log(`✅ Exported ${sounds.rows.length} sounds`);

    // Export user settings
    const userSettings = await pool.query('SELECT * FROM user_settings ORDER BY created_at');
    console.log(`✅ Exported ${userSettings.rows.length} user settings`);

    // Create export object
    const exportData = {
      exportDate: new Date().toISOString(),
      users: users.rows,
      games: games.rows,
      cartelas: cartelas.rows,
      adminLogs: adminLogs.rows,
      gameAnalysis: gameAnalysis.rows,
      sounds: sounds.rows,
      userSettings: userSettings.rows
    };

    // Write to file
    const filename = `database-export-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

    console.log(`\n✅ Database exported successfully to: ${filename}`);
    console.log(`📦 Total records: ${users.rows.length + games.rows.length + cartelas.rows.length + adminLogs.rows.length + gameAnalysis.rows.length + sounds.rows.length + userSettings.rows.length}`);

  } catch (error) {
    console.error('❌ Export failed:', error.message);
  } finally {
    await pool.end();
  }
}

exportDatabase();
