#!/usr/bin/env node

/**
 * Complete Cartelas Script
 * Efficiently adds all missing cartelas with retry logic
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

async function completeCartelas() {
  console.log('🎯 Complete Cartelas Database');
  console.log('=============================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    max: 3
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Load cartela data
    const cartelaPath = path.join(__dirname, '../data/cartela.js');
    const { bingoCards } = require(cartelaPath);
    
    // Get existing cartelas
    const existing = await client.query('SELECT card_id FROM cartelas');
    const existingSet = new Set(existing.rows.map(r => r.card_id));
    
    console.log(`📊 Existing: ${existingSet.size}/2000 cartelas`);
    
    if (existingSet.size === 2000) {
      console.log('🎉 All cartelas already present!');
      return;
    }

    // Find missing cartelas
    const allIds = Object.keys(bingoCards);
    const missing = allIds.filter(id => !existingSet.has(id));
    
    console.log(`📋 Adding ${missing.length} missing cartelas...`);

    // Add in small batches
    let added = 0;
    for (let i = 0; i < missing.length; i += 10) {
      const batch = missing.slice(i, i + 10);
      
      for (const cardId of batch) {
        try {
          const grid = bingoCards[cardId];
          const numbers = {
            B: [grid[0][0], grid[1][0], grid[2][0], grid[3][0], grid[4][0]],
            I: [grid[0][1], grid[1][1], grid[2][1], grid[3][1], grid[4][1]],
            N: [grid[0][2], grid[1][2], grid[2][2], grid[3][2], grid[4][2]],
            G: [grid[0][3], grid[1][3], grid[2][3], grid[3][3], grid[4][3]],
            O: [grid[0][4], grid[1][4], grid[2][4], grid[3][4], grid[4][4]]
          };

          await client.query(`
            INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
            VALUES ($1, $2, $3, $4, 1, 0)
          `, [uuidv4(), cardId, JSON.stringify(numbers), 'Two Lines']);

          added++;
        } catch (err) {
          console.error(`Error with ${cardId}:`, err.message);
        }
      }

      if (added % 100 === 0 || i + 10 >= missing.length) {
        console.log(`✅ Progress: ${added}/${missing.length} added`);
      }
    }

    // Verify
    const final = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Complete! Total cartelas: ${final.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

completeCartelas().catch(console.error);