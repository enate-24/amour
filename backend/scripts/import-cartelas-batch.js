#!/usr/bin/env node

/**
 * Import Cartelas in Batches
 * Imports real cartelas with better error handling and retry logic
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

async function importCartelasBatch() {
  console.log('📋 Import Real Cartelas (Batch Mode)');
  console.log('====================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    statement_timeout: 60000
  });

  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Check current count
    const currentCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Current cartelas: ${currentCount.rows[0].count}`);

    // Load cartela data
    const cartelaPath = path.join(__dirname, '../data/cartela.js');
    const { bingoCards } = require(cartelaPath);
    const cardIds = Object.keys(bingoCards);
    
    console.log(`📋 Found ${cardIds.length} cartelas to import`);

    // Import in smaller batches
    const batchSize = 50;
    let totalImported = 0;

    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cardIds.length/batchSize)} (${batch.length} cartelas)`);
      
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

          // Check if exists
          const exists = await client.query('SELECT id FROM cartelas WHERE card_id = $1', [cardId]);
          if (exists.rows.length > 0) {
            continue; // Skip if already exists
          }

          // Insert cartela
          await client.query(`
            INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
            VALUES ($1, $2, $3, $4, 1, 0)
          `, [
            uuidv4(),
            cardId,
            JSON.stringify(numbers),
            'Two Lines'
          ]);

          totalImported++;

        } catch (error) {
          console.error(`❌ Error with cartela ${cardId}:`, error.message);
        }
      }

      console.log(`✅ Batch complete. Total imported: ${totalImported}`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final verification
    const finalCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Import Complete!`);
    console.log(`📊 Total cartelas in database: ${finalCount.rows[0].count}`);
    console.log(`✅ Newly imported: ${totalImported}`);

    // Show sample
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

  } catch (error) {
    console.error('❌ Import failed:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

importCartelasBatch().catch(console.error);