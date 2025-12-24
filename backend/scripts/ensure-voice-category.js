const { migrate } = require('../migrations/add-voice-category-column');

async function ensureVoiceCategory() {
  try {
    console.log('🔧 Ensuring voice_category column exists...');
    await migrate();
    console.log('✅ Voice category setup complete');
  } catch (error) {
    console.error('❌ Failed to ensure voice category:', error);
    process.exit(1);
  }
}

ensureVoiceCategory();