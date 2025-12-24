#!/usr/bin/env node

/**
 * Fix and Populate Script
 * Fixes data types and populates the database
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function fixAndPopulate() {
  console.log('🔧 Fix and Populate Database');
  console.log('============================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('📋 Adding cartelas with correct data types...');
    
    // Add cartelas using PostgreSQL boolean literals
    for (let i = 1; i <= 100; i++) {
      const numbers = {
        B: [1, 2, 3, 4, 5],
        I: [16, 17, 18, 19, 20],
        N: [31, 32, 'FREE', 34, 35],
        G: [46, 47, 48, 49, 50],
        O: [61, 62, 63, 64, 65]
      };

      await client.query(`
        INSERT INTO cartelas (id, card_id, numbers, pattern, is_active, is_winner)
        VALUES ($1, $2, $3, $4, TRUE, FALSE)
        ON CONFLICT (card_id) DO NOTHING
      `, [
        uuidv4(),
        i.toString(),
        JSON.stringify(numbers),
        'Two Lines'
      ]);

      if (i % 25 === 0) {
        console.log(`✅ Added ${i}/100 cartelas`);
      }
    }

    // Verify
    const count = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Total cartelas: ${count.rows[0].count}`);

    console.log('\n✅ Database is ready!');
    console.log('🚀 You can now test the complete user workflow');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAndPopulate().catch(console.error);