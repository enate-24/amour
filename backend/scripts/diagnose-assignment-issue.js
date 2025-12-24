require('dotenv').config({ path: '../.env' });
const db = require('../db');

async function diagnoseAssignmentIssue() {
  try {
    console.log('🔍 Diagnosing cartela assignment issue...');
    
    // Step 1: Check what cartelas exist in the main table
    console.log('\n📊 Step 1: Checking cartelas table...');
    const allCartelas = await db.all('SELECT card_id, user_id, game_id, is_active FROM cartelas ORDER BY CAST(card_id AS INTEGER) DESC LIMIT 20');
    console.log(`Found ${allCartelas.length} cartelas in main table (showing last 20):`);
    
    allCartelas.forEach((c, index) => {
      console.log(`   ${index + 1}. Card ID: ${c.card_id}, User: ${c.user_id || 'null'}, Game: ${c.game_id || 'null'}, Active: ${c.is_active}`);
    });
    
    // Get total count and ranges
    const totalCount = await db.get('SELECT COUNT(*) as count FROM cartelas');
    const ranges = await db.get('SELECT MIN(CAST(card_id AS INTEGER)) as min_card, MAX(CAST(card_id AS INTEGER)) as max_card FROM cartelas');
    console.log(`📊 Total cartelas: ${totalCount.count}`);
    console.log(`🎯 Card ID range: ${ranges.min_card} - ${ranges.max_card}`);
    
    // Step 2: Check available cartelas (not assigned to users or games)
    console.log('\n📊 Step 2: Checking available cartelas...');
    const availableCartelas = await db.all('SELECT card_id FROM cartelas WHERE user_id IS NULL AND game_id IS NULL AND is_active = 1 ORDER BY CAST(card_id AS INTEGER) DESC LIMIT 10');
    console.log(`Found ${availableCartelas.length} available cartelas (showing last 10):`);
    
    availableCartelas.forEach((c, index) => {
      console.log(`   ${index + 1}. Card ID: ${c.card_id}`);
    });
    
    // Step 3: Check if testuser123 exists
    console.log('\n👤 Step 3: Checking if testuser123 exists...');
    const testUser = await db.users.findByUsername('testuser123');
    if (testUser) {
      console.log(`✅ Found user: ${testUser.username} (ID: ${testUser.id})`);
      
      // Check if user already has cartelas
      const userCartelas = await db.userCartelas.findByUserId(testUser.id);
      console.log(`📋 User currently has ${userCartelas.length} assigned cartelas`);
      
      if (userCartelas.length > 0) {
        console.log('   User\'s cartela card IDs:');
        userCartelas.slice(0, 10).forEach((uc, index) => {
          console.log(`     ${index + 1}. Card ID: ${uc.card_id}`);
        });
      }
    } else {
      console.log('❌ User testuser123 not found');
      
      // Show available users
      const allUsers = await db.users.findAll();
      console.log(`📊 Available users (${allUsers.length} total):`);
      allUsers.slice(0, 10).forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username} (ID: ${user.id})`);
      });
    }
    
    // Step 4: Test the copyFromCartelas function with a specific range
    console.log('\n🧪 Step 4: Testing copyFromCartelas function...');
    
    if (testUser && availableCartelas.length > 0) {
      // Get a small range of available cartelas
      const testRange = availableCartelas.slice(0, 3).map(c => parseInt(c.card_id));
      const minCard = Math.min(...testRange);
      const maxCard = Math.max(...testRange);
      
      console.log(`Testing assignment of cards ${minCard}-${maxCard} to user ${testUser.username}...`);
      
      // Check what cartelas are in this range
      const rangeCartelas = await db.all('SELECT card_id, user_id, game_id, is_active FROM cartelas WHERE CAST(card_id AS INTEGER) >= $1 AND CAST(card_id AS INTEGER) <= $2', [minCard, maxCard]);
      console.log(`Found ${rangeCartelas.length} cartelas in range ${minCard}-${maxCard}:`);
      
      rangeCartelas.forEach((c, index) => {
        console.log(`   ${index + 1}. Card ID: ${c.card_id}, User: ${c.user_id || 'null'}, Game: ${c.game_id || 'null'}, Active: ${c.is_active}`);
      });
      
      // Check if any are available for assignment
      const availableInRange = rangeCartelas.filter(c => !c.user_id && !c.game_id && c.is_active === 1);
      console.log(`📊 Available for assignment in range: ${availableInRange.length}`);
      
      if (availableInRange.length > 0) {
        console.log('✅ Should be able to assign these cartelas');
      } else {
        console.log('❌ No cartelas available for assignment in this range');
        console.log('💡 Reasons cartelas might not be available:');
        console.log('   - Already assigned to a user (user_id not null)');
        console.log('   - Already assigned to a game (game_id not null)');
        console.log('   - Not active (is_active = 0)');
      }
    }
    
    // Step 5: Show the copyFromCartelas query that would be executed
    console.log('\n🔍 Step 5: Showing the assignment query logic...');
    console.log('The copyFromCartelas function looks for cartelas with:');
    console.log('   - card_id in the specified range');
    console.log('   - user_id IS NULL (not assigned to any user)');
    console.log('   - game_id IS NULL (not assigned to any game)');
    console.log('   - is_active = 1 (active cartelas)');
    
    console.log('\n💡 Common issues:');
    console.log('1. Cartelas already assigned to users from previous tests');
    console.log('2. Card ID range doesn\'t match saved cartelas');
    console.log('3. Cartelas marked as inactive');
    console.log('4. User ID doesn\'t exist');
    
    console.log('\n🔧 Suggested fixes:');
    console.log('1. Use a unique card ID range (e.g., 30001-30050)');
    console.log('2. Clear existing assignments if needed');
    console.log('3. Verify user exists before assignment');
    console.log('4. Check cartela availability before processing');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.closePool();
    process.exit(0);
  }
}

diagnoseAssignmentIssue();