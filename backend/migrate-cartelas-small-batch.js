const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// This will use the DATABASE_URL from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function migrateCartelasSmallBatch(filename, maxCartelas = 200) {
  console.log(`🔄 Starting cartelas migration (max ${maxCartelas})...\n`);

  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }

  try {
    // Read export file
    const exportData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log(`📂 Reading export from: ${exportData.exportDate}\n`);

    // Import cartelas only (limited batch)
    if (exportData.cartelas && exportData.cartelas.length > 0) {
      const cartelasToProcess = exportData.cartelas.slice(0, maxCartelas);
      console.log(`🎯 Processing ${cartelasToProcess.length} cartelas (out of ${exportData.cartelas.length} total)`);
      
      let imported = 0;
      let skipped = 0;
      let updated = 0;
      
      for (let i = 0; i < cartelasToProcess.length; i++) {
        const cartela = cartelasToProcess[i];
        
        if (i % 50 === 0) {
          console.log(`📊 Progress: ${i}/${cartelasToProcess.length} (${Math.round(i/cartelasToProcess.length*100)}%)`);
        }
        
        try {
          const result = await pool.query(`
            INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              card_id = EXCLUDED.card_id,
              numbers = EXCLUDED.numbers,
              pattern = EXCLUDED.pattern,
              is_active = EXCLUDED.is_active,
              is_winner = EXCLUDED.is_winner
            RETURNING (xmax = 0) AS inserted
          `, [
            cartela.id, cartela.card_id, cartela.game_id, cartela.user_id,
            cartela.numbers, cartela.pattern, 
            cartela.is_active ? 1 : 0,  // Convert boolean to integer
            cartela.is_winner ? 1 : 0,  // Convert boolean to integer
            cartela.purchased_at
          ]);
          
          if (result.rows[0].inserted) {
            imported++;
          } else {
            updated++;
          }
        } catch (error) {
          console.log(`⚠️  Skipped cartela ${cartela.id}: ${error.message}`);
          skipped++;
        }
      }
      
      console.log(`\n📊 Final Results:`);
      console.log(`✅ Imported: ${imported} new cartelas`);
      console.log(`🔄 Updated: ${updated} existing cartelas`);
      if (skipped > 0) {
        console.log(`⚠️  Skipped: ${skipped} cartelas (errors)`);
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

// Get filename and max cartelas from command line arguments
const filename = process.argv[2] || 'database-export-1763759794911.json';
const maxCartelas = parseInt(process.argv[3]) || 200;
migrateCartelasSmallBatch(filename, maxCartelas);