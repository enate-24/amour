#!/usr/bin/env node

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function simplePopulate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('Adding 50 cartelas...');
    
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
        VALUES ($1, $2, $3, $4, 1, 0)
      `, [
        uuidv4(),
        i.toString(),
        JSON.stringify(numbers),
        'Two Lines'
      ]);

      if (i % 10 === 0) {
        console.log(`Added ${i}/50`);
      }
    }

    const count = await client.query('SELECT COUNT(*) FROM cartelas');
    console.log(`Total: ${count.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

simplePopulate();