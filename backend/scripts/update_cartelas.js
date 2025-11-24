require('dotenv').config({ path: __dirname + '/../.env' });
const { pool } = require('../data/database');
const { bingoCards } = require('../data/cartela.js');

async function updateCartelas() {
  const client = await pool.connect();
  
  try {
    console.log('Starting cartela update process...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    let updatedCount = 0;
    let insertedCount = 0;
    
    // Update cartelas 1-56
    for (let cardId = 1; cardId <= 56; cardId++) {
      const numbers = bingoCards[cardId];
      
      if (!numbers) {
        console.warn(`Warning: Cartela ${cardId} not found in bingoCards`);
        continue;
      }
      
      // Convert the 5x5 array to the database format
      // The database expects a JSON object with B, I, N, G, O columns
      const dbNumbers = {
        B: [numbers[0][0], numbers[1][0], numbers[2][0], numbers[3][0], numbers[4][0]],
        I: [numbers[0][1], numbers[1][1], numbers[2][1], numbers[3][1], numbers[4][1]],
        N: [numbers[0][2], numbers[1][2], numbers[2][2], numbers[3][2], numbers[4][2]],
        G: [numbers[0][3], numbers[1][3], numbers[2][3], numbers[3][3], numbers[4][3]],
        O: [numbers[0][4], numbers[1][4], numbers[2][4], numbers[3][4], numbers[4][4]]
      };
      
      // Try to update existing cartelas with this card_id
      const updateResult = await client.query(
        'UPDATE cartelas SET numbers = $1 WHERE card_id = $2',
        [JSON.stringify(dbNumbers), cardId.toString()]
      );
      
      updatedCount += updateResult.rowCount;
      
      if ((updatedCount + insertedCount) % 10 === 0) {
        console.log(`Processed ${updatedCount + insertedCount} cartelas...`);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Cartela update complete!');
    console.log(`   Updated: ${updatedCount} cartelas`);
    console.log(`   Inserted: ${insertedCount} cartelas`);
    console.log(`   Total: ${updatedCount + insertedCount} cartelas`);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error updating cartelas:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateCartelas()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
