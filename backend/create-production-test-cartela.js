/**
 * Create a test cartela in the PRODUCTION PostgreSQL database
 * This connects directly to the production database
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function createProductionTestCartela() {
  // Use production database URL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🎯 Connecting to production database...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to production database');

    // Check if test user exists
    let testUserId;
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
    
    if (existingUser.rows.length > 0) {
      testUserId = existingUser.rows[0].id;
      console.log('✅ Using existing test user:', testUserId);
    } else {
      // Create test user
      testUserId = uuidv4();
      await pool.query(`
        INSERT INTO users (id, username, email, password, role, user_type, balance, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        testUserId,
        'testuser',
        'test@example.com',
        '$2a$10$abcdefghijklmnopqrstuv', // dummy hashed password
        'user',
        'prepaid',
        100,
        true,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      console.log('✅ Created test user:', testUserId);
    }

    // Check if test game exists
    let testGameId;
    const existingGame = await pool.query(
      'SELECT id FROM games WHERE user_id = $1 AND status = $2 LIMIT 1',
      [testUserId, 'started']
    );
    
    if (existingGame.rows.length > 0) {
      testGameId = existingGame.rows[0].id;
      console.log('✅ Using existing test game:', testGameId);
    } else {
      // Create test game
      testGameId = uuidv4();
      const testGameNumber = Math.floor(Math.random() * 10000);
      
      await pool.query(`
        INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, total_numbers, winner_pattern, user_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        testGameId,
        testGameNumber,
        'started',
        10.0,
        0,
        1,
        75,
        'One Line',
        testUserId,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      console.log('✅ Created test game:', testGameId);
    }

    // Check if cartela with card_id "8" exists
    const existingCartela = await pool.query('SELECT id FROM cartelas WHERE card_id = $1', ['8']);
    
    if (existingCartela.rows.length > 0) {
      console.log('⚠️ Cartela with card_id "8" already exists');
      console.log('Updating existing cartela...');
      
      const cartelaNumbers = {
        B: [7, 29, 31, 48, 74],
        I: [15, 23, 33, 53, 70],
        N: [8, 25, 0, 51, 65],
        G: [12, 24, 41, 52, 68],
        O: [5, 17, 38, 54, 63]
      };
      
      await pool.query(`
        UPDATE cartelas
        SET game_id = $1, user_id = $2, numbers = $3, is_active = 1
        WHERE card_id = $4
      `, [testGameId, testUserId, JSON.stringify(cartelaNumbers), '8']);
      
      console.log('✅ Updated cartela with card_id "8"');
    } else {
      // Create new cartela
      const cartelaId = uuidv4();
      const cartelaNumbers = {
        B: [7, 29, 31, 48, 74],
        I: [15, 23, 33, 53, 70],   // This column can be completed
        N: [8, 25, 0, 51, 65],     // 0 = FREE space
        G: [12, 24, 41, 52, 68],
        O: [5, 17, 38, 54, 63]
      };

      await pool.query(`
        INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        cartelaId,
        "8",
        testGameId,
        testUserId,
        JSON.stringify(cartelaNumbers),
        null,
        1,
        0,
        new Date().toISOString()
      ]);

      console.log('✅ Created test cartela with card_id "8"');
    }

    console.log('\n🎯 Test data created successfully!');
    console.log('📋 Details:');
    console.log('  - User ID:', testUserId);
    console.log('  - Game ID:', testGameId);
    console.log('  - Cartela card_id: "8"');
    console.log('\n✅ You can now test the winner-check endpoint with cartelaId: "8"');
    console.log('   Use called numbers [15, 23, 33, 53, 70] to complete the I column');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the script
createProductionTestCartela().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
