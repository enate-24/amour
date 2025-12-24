require('dotenv').config({ path: '../.env' });
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { bingoCards } = require('../data/cartela.js');

async function populateCartelas() {
  try {
    console.log('🚀 Starting cartela population...');
    
    // First, check if cartelas already exist
    const existingCartelas = await db.cartelas.findAll();
    console.log(`📊 Found ${existingCartelas.length} existing cartelas`);
    
    if (existingCartelas.length > 0) {
      console.log('⚠️ Cartelas already exist. Skipping population.');
      console.log('💡 If you want to repopulate, delete existing cartelas first.');
      return;
    }
    
    console.log('📋 Starting to populate cartelas from cartela.js...');
    
    let insertedCount = 0;
    const totalCards = Object.keys(bingoCards).length;
    
    for (const [cardIdStr, numbers] of Object.entries(bingoCards)) {
      const cardId = parseInt(cardIdStr);
      
      try {
        await db.cartelas.create({
          id: uuidv4(),
          card_id: cardId.toString(),
          numbers: numbers, // This will be JSON.stringify'd in the create method
          pattern: null,
          is_active: true,
          is_winner: false,
          user_id: null,
          game_id: null,
          purchased_at: new Date().toISOString()
        });
        
        insertedCount++;
        
        if (insertedCount % 100 === 0) {
          console.log(`✅ Inserted ${insertedCount}/${totalCards} cartelas...`);
        }
      } catch (error) {
        console.error(`❌ Error inserting card ${cardId}:`, error.message);
      }
    }
    
    console.log(`🎉 Successfully populated ${insertedCount} cartelas in the database!`);
    console.log('📊 Cartelas are now available for assignment to users.');
    
  } catch (error) {
    console.error('❌ Error during cartela population:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Close database connection
    await db.closePool();
    process.exit(0);
  }
}

// Run the script
populateCartelas();