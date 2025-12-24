#!/usr/bin/env node

/**
 * Quick Cartela Fix Script
 * Adds sample cartelas to the new database with correct data types
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function addSampleCartelas() {
  console.log('🎯 Quick Cartela Fix');
  console.log('===================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  const client = await pool.connect();

  console.log('📋 Adding 100 sample cartelas...');

  try {
    for (let i = 1; i <= 100; i++) {
      const numbers = {
        B: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 1),
        I: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 16),
        N: Array.from({length: 5}, (_, idx) => idx === 2 ? 'FREE' : Math.floor(Math.random() * 15) + 31),
        G: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 46),
        O: Array.from({length: 5}, () => Math.floor(Math.random() * 15) + 61)
      };

      await client.query(`
        INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (card_id) DO NOTHING
      `, [
        uuidv4(),
        i.toString(),
        JSON.stringify(numbers),
        'Two Lines',
        true,
        false
      ]);

      if (i % 20 === 0) {
        console.log(`✅ Added ${i}/100 cartelas`);
      }
    }

    console.log('\n🔍 Verifying cartelas...');
    const result = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`✅ Total cartelas in database: ${result.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error adding cartelas:', error.message);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n🎉 Cartela fix complete!');
  console.log('✅ Your database now has sample cartelas');
  console.log('🚀 You can now start your server and test the new user workflow');
}

addSampleCartelas().catch(console.error);