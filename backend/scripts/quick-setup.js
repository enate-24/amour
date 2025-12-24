#!/usr/bin/env node

/**
 * Quick Setup Script
 * Adds essential data to get the system working
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function quickSetup() {
  console.log('⚡ Quick Setup');
  console.log('==============\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Check if cartelas exist
    const cartelaCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Current cartelas: ${cartelaCount.rows[0].count}`);

    if (parseInt(cartelaCount.rows[0].count) === 0) {
      console.log('📋 Adding 100 cartelas...');
      
      // Add cartelas one by one
      for (let i = 1; i <= 100; i++) {
        const numbers = {
          B: [i, i+1, i+2, i+3, i+4],
          I: [16+i, 17+i, 18+i, 19+i, 20+i],
          N: [31+i, 32+i, 'FREE', 34+i, 35+i],
          G: [46+i, 47+i, 48+i, 49+i, 50+i],
          O: [61+i, 62+i, 63+i, 64+i, 65+i]
        };

        await client.query(`
          INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
          VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        `, [
          uuidv4(),
          i.toString(),
          JSON.stringify(numbers),
          'Two Lines',
          true,
          false
        ]);

        if (i % 25 === 0) {
          console.log(`✅ Added ${i}/100 cartelas`);
        }
      }
    }

    // Verify final count
    const finalCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Total cartelas: ${finalCount.rows[0].count}`);

    // Check users
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`👤 Total users: ${userCount.rows[0].count}`);

    console.log('\n✅ Quick setup complete!');
    console.log('🚀 You can now test the new user workflow');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

quickSetup().catch(console.error);