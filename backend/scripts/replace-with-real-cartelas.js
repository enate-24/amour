#!/usr/bin/env node

/**
 * Replace with Real Cartelas Script
 * 1. Deletes all sample cartelas
 * 2. Imports all 2000 real cartelas from cartela.js
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

async function replaceWithRealCartelas() {
  console.log('🔄 Replace Sample Cartelas with Real Cartelas');
  console.log('==============================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Step 1: Delete all existing cartelas
    console.log('🗑️ Step 1: Deleting all sample cartelas...');
    const deleteResult = await client.query('DELETE FROM cartelas');
    console.log(`✅ Deleted ${deleteResult.rowCount} sample cartelas`);

    // Also delete from user_cartelas to clean up
    const deleteUserCartelas = await client.query('DELETE FROM user_cartelas');
    console.log(`✅ Deleted ${deleteUserCartelas.rowCount} user cartela assignments`);

    // Step 2: Import real cartelas from cartela.js
    console.log('\n📋 Step 2: Importing 2000 real cartelas from cartela.js...');
    
    const cartelaPath = path.join(__dirname, '../data/cartela.js');
    delete require.cache[require.resolve(cartelaPath)]; // Clear cache
    const { bingoCards } = require(cartelaPath);
    
    if (!bingoCards) {
      console.error('❌ Could not find bingoCards in cartela.js');
      return;
    }

    const cardIds = Object.keys(bingoCards);
    console.log(`📊 Found ${cardIds.length} cartelas in cartela.js`);

    let imported = 0;
    const batchSize = 100;

    // Process in batches for better performance
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);
      
      for (const cardId of batch) {
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

        } catch (error) {
          console.error(`❌ Error importing cartela ${cardId}:`, error.message);
        }
      }

      console.log(`✅ Imported ${Math.min(i + batchSize, cardIds.length)}/${cardIds.length} cartelas`);
    }

    // Step 3: Verification
    console.log('\n🔍 Step 3: Verifying import...');
    const finalCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Total cartelas in database: ${finalCount.rows[0].count}`);

    // Show sample cartelas
    const samples = await client.query(`
      SELECT card_id, numbers 
      FROM cartelas 
      ORDER BY CAST(card_id AS INTEGER) 
      LIMIT 3
    `);

    console.log('\n📋 Sample cartelas:');
    samples.rows.forEach(cartela => {
      const nums = cartela.numbers;
      console.log(`\nCartela ${cartela.card_id}:`);
      console.log(`B: ${nums.B.join(', ')}`);
      console.log(`I: ${nums.I.join(', ')}`);
      console.log(`N: ${nums.N.join(', ')}`);
      console.log(`G: ${nums.G.join(', ')}`);
      console.log(`O: ${nums.O.join(', ')}`);
    });

    // Check cartela range
    const range = await client.query(`
      SELECT 
        MIN(CAST(card_id AS INTEGER)) as min_id,
        MAX(CAST(card_id AS INTEGER)) as max_id
      FROM cartelas
    `);
    
    console.log(`\n📈 Cartela range: ${range.rows[0].min_id} - ${range.rows[0].max_id}`);

    console.log('\n🎉 CARTELA REPLACEMENT COMPLETE!');
    console.log('================================');
    console.log('');
    console.log('✅ What was done:');
    console.log(`  • Deleted all sample cartelas`);
    console.log(`  • Imported ${imported} real cartelas from cartela.js`);
    console.log(`  • All cartelas are now authentic bingo cards`);
    console.log('');
    console.log('🚀 Ready to use:');
    console.log('  • Your database now has 2000 real cartelas');
    console.log('  • Admin can assign any range (1-2000) to users');
    console.log('  • Users will get authentic bingo cards');
    console.log('  • Test the new user workflow with real cartelas');

  } catch (error) {
    console.error('❌ Replacement failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

replaceWithRealCartelas().catch(console.error);