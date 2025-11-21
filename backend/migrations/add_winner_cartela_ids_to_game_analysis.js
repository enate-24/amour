const db = require('../db');

async function addWinnerCartelaIdsColumn() {
  console.log('🔄 Adding winner_cartela_ids column to game_analysis table...');
  
  try {
    // Check if column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'game_analysis' 
      AND column_name = 'winner_cartela_ids'
    `;
    
    const columnExists = await db.get(checkColumnQuery);
    
    if (columnExists) {
      console.log('✅ winner_cartela_ids column already exists');
      return;
    }
    
    // Add the new column
    await db.run(`
      ALTER TABLE game_analysis 
      ADD COLUMN winner_cartela_ids TEXT DEFAULT '[]'
    `);
    
    console.log('✅ Successfully added winner_cartela_ids column to game_analysis table');
    
    // Update existing records to populate winner_cartela_ids from winner_info
    console.log('🔄 Updating existing records...');
    
    const existingRecords = await db.all(`
      SELECT id, game_id, winner_info 
      FROM game_analysis 
      WHERE winner_cartela_ids IS NULL OR winner_cartela_ids = '[]'
    `);
    
    for (const record of existingRecords) {
      // Get winner cartela IDs from the games/cartelas tables
      const winnerCartelas = await db.all(`
        SELECT card_id 
        FROM cartelas 
        WHERE game_id = $1 AND is_winner = 1
      `, [record.game_id]);
      
      const winnerCartelaIds = winnerCartelas.map(c => c.card_id);
      
      await db.run(`
        UPDATE game_analysis 
        SET winner_cartela_ids = $1 
        WHERE id = $2
      `, [JSON.stringify(winnerCartelaIds), record.id]);
      
      console.log(`✅ Updated record ${record.id} with ${winnerCartelaIds.length} winner cartela IDs`);
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addWinnerCartelaIdsColumn()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addWinnerCartelaIdsColumn };