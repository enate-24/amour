require('dotenv').config({ path: '../.env' });
const db = require('../db');

async function addVoiceCategoryColumn() {
  try {
    console.log('🔧 Adding voice_category column to user_settings table...');
    
    // Check if column already exists
    const checkResult = await db.all(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' 
      AND column_name = 'voice_category'
    `);
    
    if (checkResult.length > 0) {
      console.log('✅ voice_category column already exists');
      return;
    }
    
    // Add the column
    await db.run(`ALTER TABLE user_settings ADD COLUMN voice_category VARCHAR(10)`);
    
    console.log('✅ Successfully added voice_category column to user_settings table');
    
    // Verify the column was added
    const verifyResult = await db.all(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' 
      AND column_name = 'voice_category'
    `);
    
    if (verifyResult.length > 0) {
      console.log('🔍 Column details:', verifyResult[0]);
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('❌ Failed to verify column creation');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.closePool();
    process.exit(0);
  }
}

addVoiceCategoryColumn();