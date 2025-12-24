#!/usr/bin/env node

/**
 * Add Missing Cartelas Script
 * Checks existing cartelas and only adds the ones that are missing
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

async function addMissingCartelas() {
  console.log('🔍 Add Missing Cartelas');
  console.log('=======================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  const client = await pool.connect();

  try {
    // Step 1: Get existing cartela IDs
    console.log('📊 Step 1: Checking existing cartelas...');
    const existingResult = await client.query('SELECT card_id FROM cartelas ORDER BY CAST(card_id AS INTEGER)');
    const existingIds = new Set(existingResult.rows.map(row => row.card_id));
    console.log(`✅ Found ${existingIds.size} existing cartelas in database`);

    // Step 2: Load all cartelas from cartela.js
    console.log('\n📋 Step 2: Loading cartelas from cartela.js...');
    const cartelaPath = path.join(__dirname, '../data/cartela.js');
    const { bingoCards } = require(cartelaPath);
    const allCardIds = Object.keys(bingoCards);
    console.log(`✅ Found ${allCardIds.length} cartelas in cartela.js`);

    // Step 3: Find missing cartelas
    console.log('\n🔍 Step 3: Finding missing cartelas...');
    const missingIds = allCardIds.filter(id => !existingIds.has(id));
    console.log(`📋 Missing cartelas: ${missingIds.length}`);

    if (missingIds.length === 0) {
      console.log('🎉 All cartelas are already in the database!');
      return;
    }

    // Show some missing IDs
    const sampleMissing = missingIds.slice(0, 10);
    console.log(`📝 Sample missing IDs: ${sampleMissing.join(', ')}${missingIds.length > 10 ? '...' : ''}`);

    // Step 4: Add missing cartelas
    console.log(`\n📥 Step 4: Adding ${missingIds.length} missing cartelas...`);
    
    let added = 0;
    const batchSize = 50;

    for (let i = 0; i < missingIds.length; i += batchSize) {
      const batch = missingIds.slice(i, i + batchSize);
      
      for (const cardId of batch) {
        try {
          const cartelaGrid = bingoCards[cardId];
          
          // Convert to BINGO format
          const numbers = {
            B: [cartelaGrid[0][0], cartelaGrid[1][0], cartelaGrid[2][0], cartelaGrid[3][0], cartelaGrid[4][0]],
            I: [cartelaGrid[0][1], cartelaGrid[1][1], cartelaGrid[2][1], cartelaGrid[3][1], cartelaGrid[4][1]],
            N: [cartelaGrid[0][2], cartelaGrid[1][2], cartelaGrid[2][2], cartelaGrid[3][2], cartelaGrid[4][2]],
            G: [cartelaGrid[0][3], cartelaGrid[1][3], cartelaGrid[2][3], cartelaGrid[3][3], cartelaGrid[4][3]],
            O: [cartelaGrid[0][4], cartelaGrid[1][4], cartelaGrid[2][4], cartelaGrid[3][4], cartelaGrid[4][4]]
          };

          // Insert the missing cartela
          await client.query(`
            INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
            VALUES ($1, $2, $3, $4, 1, 0)
          `, [
            uuidv4(),
            cardId,
            JSON.stringify(numbers),
            'Two Lines'
          ]);

          added++;

        } catch (error) {
          console.error(`❌ Error adding cartela ${cardId}:`, error.message);
        }
      }

      console.log(`✅ Added batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingIds.length/batchSize)} - Total added: ${added}`);
    }

    // Step 5: Final verification
    console.log('\n🔍 Step 5: Final verification...');
    const finalCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Total cartelas now in database: ${finalCount.rows[0].count}`);

    // Check if we have all 2000
    if (parseInt(finalCount.rows[0].count) === 2000) {
      console.log('🎉 Perfect! All 2000 cartelas are now in the database!');
    } else {
      console.log(`⚠️ Expected 2000, but have ${finalCount.rows[0].count}`);
    }

    // Show cartela range
    const range = await client.query(`
      SELECT 
        MIN(CAST(card_id AS INTEGER)) as min_id,
        MAX(CAST(card_id AS INTEGER)) as max_id
      FROM cartelas
    `);
    console.log(`📈 Cartela range: ${range.rows[0].min_id} - ${range.rows[0].max_id}`);

    // Show a sample of the newly added cartelas
    if (added > 0) {
      const newSample = await client.query(`
        SELECT card_id, numbers 
        FROM cartelas 
        WHERE card_id = ANY($1)
        LIMIT 1
      `, [missingIds.slice(0, 1)]);

      if (newSample.rows.length > 0) {
        console.log(`\n📋 Sample newly added cartela ${newSample.rows[0].card_id}:`);
        const nums = newSample.rows[0].numbers;
        console.log(`B: ${nums.B.join(', ')}`);
        console.log(`I: ${nums.I.join(', ')}`);
        console.log(`N: ${nums.N.join(', ')}`);
        console.log(`G: ${nums.G.join(', ')}`);
        console.log(`O: ${nums.O.join(', ')}`);
      }
    }

    console.log('\n✅ MISSING CARTELAS ADDED SUCCESSFULLY!');
    console.log('======================================');
    console.log(`📊 Added ${added} missing cartelas`);
    console.log(`📋 Skipped ${existingIds.size} existing cartelas`);
    console.log(`🎯 Total cartelas: ${finalCount.rows[0].count}`);
    console.log('🚀 Your database now has all the real cartelas!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingCartelas().catch(console.error);