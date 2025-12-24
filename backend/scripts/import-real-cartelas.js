#!/usr/bin/env node

/**
 * Import Real Cartelas Script
 * Imports all cartelas from backend/data/cartela.js
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

async function importRealCartelas() {
  console.log('📋 Importing Real Cartelas');
  console.log('==========================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Import the cartela data
    const cartelaPath = path.join(__dirname, '../data/cartela.js');
    delete require.cache[require.resolve(cartelaPath)]; // Clear cache
    const cartelaData = require(cartelaPath);
    
    console.log('📊 Checking current cartela count...');
    const currentCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`Current cartelas in database: ${currentCount.rows[0].count}`);

    // Get the bingoCards object
    const { bingoCards } = require(cartelaPath);
    
    if (!bingoCards) {
      console.error('❌ Could not find bingoCards in cartela.js');
      return;
    }

    const cardIds = Object.keys(bingoCards);
    console.log(`📋 Found ${cardIds.length} cartelas in cartela.js`);

    let imported = 0;
    let skipped = 0;

    for (const cardId of cardIds) {
      const cartelaGrid = bingoCards[cardId];
      
      // Convert the 5x5 grid to BINGO format
      const numbers = {
        B: [cartelaGrid[0][0], cartelaGrid[1][0], cartelaGrid[2][0], cartelaGrid[3][0], cartelaGrid[4][0]],
        I: [cartelaGrid[0][1], cartelaGrid[1][1], cartelaGrid[2][1], cartelaGrid[3][1], cartelaGrid[4][1]],
        N: [cartelaGrid[0][2], cartelaGrid[1][2], cartelaGrid[2][2], cartelaGrid[3][2], cartelaGrid[4][2]],
        G: [cartelaGrid[0][3], cartelaGrid[1][3], cartelaGrid[2][3], cartelaGrid[3][3], cartelaGrid[4][3]],
        O: [cartelaGrid[0][4], cartelaGrid[1][4], cartelaGrid[2][4], cartelaGrid[3][4], cartelaGrid[4][4]]
      };

      try {
        // Check if cartela already exists
        const existing = await client.query('SELECT id FROM cartelas WHERE card_id = $1', [cardId]);
        
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        // Insert the cartela
        await client.query(`
          INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
          VALUES ($1, $2, $3, $4, 1, 0)
        `, [
          uuidv4(),
          cardId,
          JSON.stringify(numbers),
          'Two Lines'
        ]);

        imported++;

        if (imported % 100 === 0) {
          console.log(`✅ Imported ${imported}/${cardIds.length} cartelas`);
        }

      } catch (error) {
        console.error(`❌ Error importing cartela ${cardId}:`, error.message);
      }
    }

    // Final verification
    const finalCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Import Complete!`);
    console.log(`📊 Total cartelas in database: ${finalCount.rows[0].count}`);
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️ Skipped (already existed): ${skipped}`);

    // Show sample cartela
    const sample = await client.query('SELECT card_id, numbers FROM cartelas ORDER BY CAST(card_id AS INTEGER) LIMIT 1');
    if (sample.rows.length > 0) {
      console.log(`\n📋 Sample cartela ${sample.rows[0].card_id}:`);
      const nums = sample.rows[0].numbers;
      console.log(`B: ${nums.B.join(', ')}`);
      console.log(`I: ${nums.I.join(', ')}`);
      console.log(`N: ${nums.N.join(', ')}`);
      console.log(`G: ${nums.G.join(', ')}`);
      console.log(`O: ${nums.O.join(', ')}`);
    }

    console.log('\n✅ Real cartelas imported successfully!');
    console.log('🚀 Your database now has the actual cartela data');

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

importRealCartelas().catch(console.error);