require('dotenv').config({ path: __dirname + '/../.env' });
const { pool } = require('../data/database');

async function verifyCartelas() {
  const client = await pool.connect();
  
  try {
    console.log('Verifying updated cartelas...\n');
    
    // Check a few sample cartelas
    const sampleIds = [1, 10, 22, 39, 44, 56];
    
    for (const cardId of sampleIds) {
      const result = await client.query(
        'SELECT card_id, numbers FROM cartelas WHERE card_id = $1 LIMIT 1',
        [cardId.toString()]
      );
      
      if (result.rows.length > 0) {
        const cartela = result.rows[0];
        const numbers = JSON.parse(cartela.numbers);
        
        console.log(`Cartela ${cardId}:`);
        console.log(`  B: [${numbers.B.join(', ')}]`);
        console.log(`  I: [${numbers.I.join(', ')}]`);
        console.log(`  N: [${numbers.N.join(', ')}]`);
        console.log(`  G: [${numbers.G.join(', ')}]`);
        console.log(`  O: [${numbers.O.join(', ')}]`);
        console.log('');
      } else {
        console.log(`Cartela ${cardId}: NOT FOUND\n`);
      }
    }
    
    console.log('✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying cartelas:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyCartelas()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
