const { Pool } = require('pg');
const { bingoCards } = require('./data/cartela.js');
require('dotenv').config();

// This will use the DATABASE_URL from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Missing cartela IDs from the migration report
const missingCartelaIds = [
  'a6a5080c-08e7-4d3c-9a8f-b719b2d1b111', // card_id: 1005
  '08e5886e-c75b-45fa-80b9-85da756be558', // card_id: 1003
  'e99c3cee-6b34-47c3-9710-e40537356474', // card_id: 1007
  'e9b09253-570d-4eb9-827c-aab33eee71de', // card_id: 1000
  '8124fc12-dd18-406d-9c58-e77b39f5497e', // card_id: 1004
  '848a5f05-4f09-482e-b145-ce33b25678b2', // card_id: 1002
  '6a489591-743c-478a-8627-6680b083f1cb', // card_id: 100
  '4f4f3be9-f197-49a7-823e-1457f0fa2811', // card_id: 1001
  '669c58fb-5685-4ed9-839a-a8beeaaac5b6', // card_id: 1008
  '4f0e6a80-2b56-4e40-aed3-3bd632626bd2', // card_id: 1006
  '7244b6ac-2548-49ac-abc0-694d0fbdef95', // card_id: 3
  'b6d0f6c2-b3aa-45a8-9cdd-9a1fcb506db6', // card_id: 5
  '4a60fd14-3157-45ea-8376-55172b8c05cb', // card_id: 6
  'e86a272a-f2f3-417e-96c9-3ac35a8c1be8', // card_id: 7
  'fa905801-b667-4421-862d-82e1f7712bdb', // card_id: 2
  '4e857162-7609-4b4a-94fd-c16dfc58558f', // card_id: 1
  '304057aa-d510-41af-a218-9ae0d2c5124b'  // card_id: 4
];

// Map card_id to cartela UUID
const cartelaMapping = {
  1005: 'a6a5080c-08e7-4d3c-9a8f-b719b2d1b111',
  1003: '08e5886e-c75b-45fa-80b9-85da756be558',
  1007: 'e99c3cee-6b34-47c3-9710-e40537356474',
  1000: 'e9b09253-570d-4eb9-827c-aab33eee71de',
  1004: '8124fc12-dd18-406d-9c58-e77b39f5497e',
  1002: '848a5f05-4f09-482e-b145-ce33b25678b2',
  100: '6a489591-743c-478a-8627-6680b083f1cb',
  1001: '4f4f3be9-f197-49a7-823e-1457f0fa2811',
  1008: '669c58fb-5685-4ed9-839a-a8beeaaac5b6',
  1006: '4f0e6a80-2b56-4e40-aed3-3bd632626bd2',
  3: '7244b6ac-2548-49ac-abc0-694d0fbdef95',
  5: 'b6d0f6c2-b3aa-45a8-9cdd-9a1fcb506db6',
  6: '4a60fd14-3157-45ea-8376-55172b8c05cb',
  7: 'e86a272a-f2f3-417e-96c9-3ac35a8c1be8',
  2: 'fa905801-b667-4421-862d-82e1f7712bdb',
  1: '4e857162-7609-4b4a-94fd-c16dfc58558f',
  4: '304057aa-d510-41af-a218-9ae0d2c5124b'
};

function convertCartelaToNumbers(cartelaArray) {
  // Convert the 5x5 array to the JSON format expected by the database
  const numbers = {
    B: [],
    I: [],
    N: [],
    G: [],
    O: []
  };
  
  const columns = ['B', 'I', 'N', 'G', 'O'];
  
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const value = cartelaArray[row][col];
      if (value === "FREE" || value === "Free") {
        numbers[columns[col]].push(0); // FREE space is 0
      } else {
        numbers[columns[col]].push(parseInt(value));
      }
    }
  }
  
  return JSON.stringify(numbers);
}

async function migrateMissingCartelas() {
  console.log('🔄 Migrating missing cartelas from cartela.js...\n');

  try {
    let imported = 0;
    let skipped = 0;

    for (const [cardId, cartelaId] of Object.entries(cartelaMapping)) {
      const cardIdNum = parseInt(cardId);
      
      if (bingoCards[cardIdNum]) {
        const cartelaData = bingoCards[cardIdNum];
        const numbersJson = convertCartelaToNumbers(cartelaData);
        
        console.log(`📋 Processing cartela ${cartelaId} (card_id: ${cardId})`);
        
        try {
          await pool.query(`
            INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              card_id = EXCLUDED.card_id,
              numbers = EXCLUDED.numbers,
              pattern = EXCLUDED.pattern,
              is_active = EXCLUDED.is_active,
              is_winner = EXCLUDED.is_winner
          `, [
            cartelaId,
            cardId,
            null, // game_id set to null since the referenced games don't exist
            null, // user_id set to null since the referenced users don't exist
            numbersJson,
            'One Line', // default pattern
            1, // is_active = true
            0, // is_winner = false
            new Date().toISOString() // current timestamp
          ]);
          
          imported++;
          console.log(`✅ Imported cartela ${cartelaId}`);
        } catch (error) {
          console.log(`⚠️  Skipped cartela ${cartelaId}: ${error.message}`);
          skipped++;
        }
      } else {
        console.log(`❌ Card ID ${cardId} not found in cartela.js`);
        skipped++;
      }
    }

    console.log('\n📊 Migration Results:');
    console.log(`✅ Successfully imported: ${imported} cartelas`);
    console.log(`⚠️  Skipped: ${skipped} cartelas`);

    // Verify final count
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM cartelas');
    console.log(`📊 Total cartelas in database: ${finalCount.rows[0].count}`);

    console.log('\n✅ Missing cartelas migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

migrateMissingCartelas();