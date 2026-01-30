const { Pool } = require('pg');
const { bingoCards } = require('./data/cartela.js');

// Load environment variables
require('dotenv').config();

// Database connection using the same config as the main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Always use SSL for Aiven
});

/**
 * Convert 5x5 grid format to BINGO column format
 * @param {Array} grid - 5x5 array where grid[row][col] represents the number
 * @returns {Object} - {B: [], I: [], N: [], G: [], O: []} format
 */
function convertGridToBingoFormat(grid) {
  const bingoNumbers = { B: [], I: [], N: [], G: [], O: [] };
  const columns = ['B', 'I', 'N', 'G', 'O'];
  
  // Convert from grid[row][col] to column format
  for (let col = 0; col < 5; col++) {
    const columnKey = columns[col];
    for (let row = 0; row < 5; row++) {
      const value = grid[row][col];
      // Handle FREE space (center cell)
      if (row === 2 && col === 2) {
        bingoNumbers[columnKey].push(0); // Use 0 for FREE space
      } else if (value === "FREE" || value === "Free") {
        bingoNumbers[columnKey].push(0);
      } else {
        bingoNumbers[columnKey].push(parseInt(value));
      }
    }
  }
  
  return bingoNumbers;
}

async function fixCartelaNumbers() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting cartela numbers fix...');
    console.log(`📊 Found ${Object.keys(bingoCards).length} cartelas in data file`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const [cardIdStr, gridNumbers] of Object.entries(bingoCards)) {
      const cardId = cardIdStr.toString();
      
      try {
        // Convert grid format to BINGO format
        const bingoNumbers = convertGridToBingoFormat(gridNumbers);
        
        console.log(`🔄 Processing cartela ${cardId}...`);
        console.log(`   Grid format: ${JSON.stringify(gridNumbers[0])} ... (5 rows)`);
        console.log(`   BINGO format: B[${bingoNumbers.B.length}], I[${bingoNumbers.I.length}], N[${bingoNumbers.N.length}], G[${bingoNumbers.G.length}], O[${bingoNumbers.O.length}]`);
        
        // Update the cartela in the database
        const result = await client.query(
          'UPDATE user_cartelas SET numbers = $1 WHERE card_id = $2',
          [JSON.stringify(bingoNumbers), cardId]
        );
        
        if (result.rowCount > 0) {
          console.log(`✅ Updated ${result.rowCount} cartela(s) with card_id ${cardId}`);
          updatedCount += result.rowCount;
        } else {
          console.log(`⚠️ No cartela found with card_id ${cardId}`);
        }
        
        // Also update the main cartelas table if it exists
        const mainResult = await client.query(
          'UPDATE cartelas SET numbers = $1 WHERE card_id = $2',
          [JSON.stringify(bingoNumbers), cardId]
        );
        
        if (mainResult.rowCount > 0) {
          console.log(`✅ Also updated ${mainResult.rowCount} cartela(s) in main cartelas table`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing cartela ${cardId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Fix Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} cartelas`);
    console.log(`❌ Errors: ${errorCount}`);
    
    // Verify a few cartelas
    console.log('\n🔍 Verification - checking first 3 cartelas:');
    const verifyResult = await client.query(
      'SELECT card_id, numbers FROM user_cartelas WHERE card_id IN ($1, $2, $3) ORDER BY card_id',
      ['1', '2', '3']
    );
    
    verifyResult.rows.forEach(row => {
      const numbers = typeof row.numbers === 'string' ? JSON.parse(row.numbers) : row.numbers;
      console.log(`\nCartela ${row.card_id}:`);
      console.log(`  B: [${numbers.B?.join(', ') || 'empty'}]`);
      console.log(`  I: [${numbers.I?.join(', ') || 'empty'}]`);
      console.log(`  N: [${numbers.N?.join(', ') || 'empty'}]`);
      console.log(`  G: [${numbers.G?.join(', ') || 'empty'}]`);
      console.log(`  O: [${numbers.O?.join(', ') || 'empty'}]`);
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixCartelaNumbers().catch(console.error);