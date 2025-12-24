#!/usr/bin/env node

/**
 * Add Basic Cartelas
 * Adds a few cartelas to test the system
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function addBasicCartelas() {
  console.log('🎯 Adding Basic Cartelas');
  console.log('========================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Check current cartela count
    const currentCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Current cartelas: ${currentCount.rows[0].count}`);

    if (parseInt(currentCount.rows[0].count) > 0) {
      console.log('✅ Cartelas already exist, skipping...');
      return;
    }

    console.log('📋 Adding 50 basic cartelas...');

    // Add cartelas one by one to avoid batch issues
    for (let i = 1; i <= 50; i++) {
      const numbers = {
        B: [1, 2, 3, 4, 5],
        I: [16, 17, 18, 19, 20],
        N: [31, 32, 'FREE', 34, 35],
        G: [46, 47, 48, 49, 50],
        O: [61, 62, 63, 64, 65]
      };

      await client.query(`
        INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuidv4(),
        i.toString(),
        JSON.stringify(numbers),
        'Two Lines',
        true,
        false
      ]);

      if (i % 10 === 0) {
        console.log(`✅ Added ${i}/50 cartelas`);
      }
    }

    const finalCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Success! Total cartelas: ${finalCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addBasicCartelas().catch(console.error);