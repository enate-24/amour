const db = require('./data/database');

async function clearVoiceDefaults() {
  try {
    console.log('🧹 Clearing default voice categories from database...');
    
    // Check current voice categories
    console.log('\n1. Current voice categories:');
    const currentSettings = await db.all('SELECT user_id, voice_category FROM user_settings');
    currentSettings.forEach(setting => {
      console.log(`  User ${setting.user_id}: ${setting.voice_category || 'NULL'}`);
    });
    
    // Clear all voice categories to NULL
    console.log('\n2. Clearing voice categories...');
    const result = await db.run('UPDATE user_settings SET voice_category = NULL');
    console.log(`✅ Updated ${result.changes || 0} user settings`);
    
    // Verify the change
    console.log('\n3. After clearing:');
    const updatedSettings = await db.all('SELECT user_id, voice_category FROM user_settings');
    updatedSettings.forEach(setting => {
      console.log(`  User ${setting.user_id}: ${setting.voice_category || 'NULL'}`);
    });
    
    console.log('\n✅ All users must now explicitly choose their voice category');
    
  } catch (error) {
    console.error('❌ Error clearing voice defaults:', error);
  } finally {
    process.exit(0);
  }
}

clearVoiceDefaults();