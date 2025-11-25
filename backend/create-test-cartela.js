/**
 * Create a test cartela in the database for testing winner-check functionality
 */

const { v4: uuidv4 } = require('uuid');
const { cartelas, users } = require('./data/database.js');

async function createTestCartela() {
  try {
    console.log('🎯 Creating test cartela...');

    // Create a test user first if needed
    const testUserId = uuidv4();
    const testUser = {
      id: testUserId,
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'user',
      userType: 'prepaid',
      balance: 100,
      is_active: true
    };

    try {
      await users.create(testUser);
      console.log('✅ Created test user:', testUserId);
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        console.log('ℹ️ Test user already exists');
      } else {
        throw error;
      }
    }

    // Create the test cartela with ID "8" (matching your debug script)
    const testCartela = {
      id: uuidv4(),
      card_id: "8", // This matches the ID in your debug script
      user_id: testUserId,
      game_id: null, // No specific game
      numbers: {
        B: [7, 29, 31, 48, 74],
        I: [15, 23, 33, 53, 70],   // This column can be completed
        N: [8, 25, 0, 51, 65],     // 0 = FREE space
        G: [12, 24, 41, 52, 68],
        O: [5, 17, 38, 54, 63]
      },
      pattern: null,
      is_active: true,
      is_winner: false,
      purchased_at: new Date().toISOString()
    };

    await cartelas.create(testCartela);
    console.log('✅ Created test cartela with card_id "8"');
    console.log('📋 Cartela details:', {
      id: testCartela.id,
      card_id: testCartela.card_id,
      user_id: testCartela.user_id,
      numbers: testCartela.numbers
    });

    console.log('\n🎯 Test cartela created successfully!');
    console.log('You can now test the winner-check endpoint with cartelaId: "8"');
    console.log('Use called numbers [15, 23, 33, 53, 70] to complete the I column');

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