/**
 * Create a test cartela in the database for testing winner-check functionality
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

async function createTestCartela() {
  try {
    console.log('🎯 Creating test cartela...');

    // Create a test user first if needed
    const testUserId = uuidv4();
    
    try {
      await db.run(`
        INSERT INTO users (id, username, email, password, role, user_type, balance, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        testUserId,
        'testuser',
        'test@example.com',
        'hashedpassword',
        'user',
        'prepaid',
        100,
        true,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      console.log('✅ Created test user:', testUserId);
    } catch (error) {
      if (error.message && error.message.includes('duplicate')) {
        console.log('ℹ️ Test user already exists, using existing user');
        const existingUser = await db.get('SELECT id FROM users WHERE email = $1', ['test@example.com']);
        if (existingUser) {
          testUserId = existingUser.id;
        }
      } else {
        throw error;
      }
    }

    // Create a test game first
    const testGameId = uuidv4();
    const testGameNumber = Math.floor(Math.random() * 1000);
    
    try {
      await db.run(`
        INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, total_numbers, winner_pattern, user_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        testGameId,
        testGameNumber,
        'started', // Active game
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
    } catch (error) {
      console.log('ℹ️ Using existing game or error:', error.message);
    }

    // Create the test cartela with ID "8" (matching your debug script)
    const cartelaNumbers = {
      B: [7, 29, 31, 48, 74],
      I: [15, 23, 33, 53, 70],   // This column can be completed
      N: [8, 25, 0, 51, 65],     // 0 = FREE space
      G: [12, 24, 41, 52, 68],
      O: [5, 17, 38, 54, 63]
    };

    const cartelaId = uuidv4();
    
    await db.run(`
      INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      cartelaId,
      "8", // This matches the ID in your debug script
      testGameId,
      testUserId,
      JSON.stringify(cartelaNumbers),
      null,
      1, // is_active
      0, // is_winner
      new Date().toISOString()
    ]);
    
    console.log('✅ Created test cartela with card_id "8"');
    console.log('📋 Cartela details:', {
      id: cartelaId,
      card_id: "8",
      game_id: testGameId,
      user_id: testUserId,
      numbers: cartelaNumbers
    });

    console.log('\n🎯 Test cartela created successfully!');
    console.log('You can now test the winner-check endpoint with cartelaId: "8"');
    console.log('Use called numbers [15, 23, 33, 53, 70] to complete the I column');
    console.log(`Game ID: ${testGameId}`);

  } catch (error) {
    console.error('❌ Error creating test cartela:', error);
  }
}

// Run the script
createTestCartela().then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});