const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// This will use the DATABASE_URL from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function migrateCartelasOnly(filename) {
  console.log('🔄 Starting cartelas migration...\n');

  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }

  try {
    // Read export file
    const exportData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log(`📂 Reading export from: ${exportData.exportDate}\n`);

    // Import cartelas only
    if (exportData.cartelas && exportData.cartelas.length > 0) {
      console.log(`🎯 Found ${exportData.cartelas.length} cartelas to migrate`);
      
      let imported = 0;
      let skipped = 0;
      const batchSize = 100;
      
      // Process in batches for better performance
      for (let i = 0; i < exportData.cartelas.length; i += batchSize) {
        const batch = exportData.cartelas.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(exportData.cartelas.length/batchSize)} (${batch.length} cartelas)`);
        
        for (const cartela of batch) {
          try {
            await pool.query(`
              INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO UPDATE SET
                card_id = EXCLUDED.card_id,
                numbers = EXCLUDED.numbers,
                pattern = EXCLUDED.pattern,
                is_active = EXCLUDED.is_active,
                is_winner = EXCLUDED.is_winner
            `, [
              cartela.id, cartela.card_id, cartela.game_id, cartela.user_id,
              cartela.numbers, cartela.pattern, 
              cartela.is_active ? 1 : 0,  // Convert boolean to integer
              cartela.is_winner ? 1 : 0,  // Convert boolean to integer
              cartela.purchased_at
            ]);
            imported++;
          } catch (error) {
            console.log(`⚠️  Skipped cartela ${cartela.id}: ${error.message}`);
            skipped++;
          }
        }
      }
      
      console.log(`✅ Imported ${imported} cartelas`);
      if (skipped > 0) {
        console.log(`⚠️  Skipped ${skipped} cartelas (duplicates or errors)`);
      }
    } else {
      console.log('❌ No cartelas found in export file');
    }

    console.log('\n✅ Cartelas migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Get filename from command line argument
const filename = process.argv[2] || 'database-export-1763759794911.json';
migrateCartelasOnly(filename);