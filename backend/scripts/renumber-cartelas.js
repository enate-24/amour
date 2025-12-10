const db = require('../data/database');

async function renumberCartelas() {
  try {
    console.log('🔄 Starting cartela renumbering...\n');
    
    // Get all cartelas sorted by their current card_id
    const allCartelas = await db.all('SELECT * FROM cartelas WHERE is_active = 1 ORDER BY CAST(card_id AS INTEGER)');
    
    console.log(`Found ${allCartelas.length} active cartelas\n`);
    
    if (allCartelas.length === 0) {
      console.log('No cartelas to renumber');
      process.exit(0);
    }
    
    console.log('Current card_ids range:');
    console.log(`  First: ${allCartelas[0].card_id}`);
    console.log(`  Last: ${allCartelas[allCartelas.length - 1].card_id}`);
    console.log('');
    
    console.log('Renumbering cartelas to start from 1...\n');
    
    let updated = 0;
    let errors = 0;
    
    for (let i = 0; i < allCartelas.length; i++) {
      const cartela = allCartelas[i];
      const newCardId = (i + 1).toString();
      
      try {
        await db.run(
          'UPDATE cartelas SET card_id = $1 WHERE id = $2',
          [newCardId, cartela.id]
        );
        
        if ((i + 1) % 100 === 0) {
          console.log(`  Updated ${i + 1}/${allCartelas.length} cartelas...`);
        }
        
        updated++;
      } catch (error) {
        console.error(`  ❌ Error updating cartela ${cartela.card_id}:`, error.message);
        errors++;
      }
    }
    
    console.log('');
    console.log('✅ Renumbering complete!');
    console.log(`  Updated: ${updated} cartelas`);
    console.log(`  Errors: ${errors}`);
    console.log('');
    console.log('New card_ids range: 1 to', allCartelas.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

renumberCartelas();
