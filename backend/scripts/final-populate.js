#!/usr/bin/env node

/**
 * Final Populate Script
 * Uses correct integer values for boolean columns
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function finalPopulate() {
  console.log('🎯 Final Database Population');
  console.log('============================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('📋 Adding cartelas with integer boolean values...');
    
    // Add cartelas using integers for boolean columns (1 = true, 0 = false)
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
        VALUES ($1, $2, $3, $4, 1, 0)
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

    // Verify cartelas
    const cartelaCount = await client.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`\n🎉 Total cartelas: ${cartelaCount.rows[0].count}`);

    // Check users
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`👤 Total users: ${userCount.rows[0].count}`);

    // Show sample cartela
    const sample = await client.query('SELECT card_id, numbers FROM cartelas LIMIT 1');
    if (sample.rows.length > 0) {
      console.log(`\n📋 Sample cartela ${sample.rows[0].card_id}:`);
      console.log(JSON.stringify(sample.rows[0].numbers, null, 2));
    }

    console.log('\n✅ Database population complete!');
    console.log('🚀 Your system is now ready to use');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('  1. Your server should be running on port 3003');
    console.log('  2. Login with admin/admin123');
    console.log('  3. Test creating users without cartelas');
    console.log('  4. Test assigning cartelas to users');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

finalPopulate().catch(console.error);