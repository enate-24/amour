const { users, userCartelas, cartelas, closePool, all } = require('../db');

async function diagnoseAmour1Cartelas() {
  try {
    console.log('🔍 Diagnosing amour1 cartela issue...');
    
    // Find amour1 user
    const amour1User = await users.findByUsername('amour1');
    if (!amour1User) {
      console.error('❌ User amour1 not found');
      return;
    }
    
    console.log('✅ Found user amour1:', amour1User.id);
    
    // Check user_cartelas table
    console.log('\n📋 Checking user_cartelas table:');
    const userCartelasData = await userCartelas.findByUserId(amour1User.id);
    console.log(`  Total entries: ${userCartelasData.length}`);
    
    if (userCartelasData.length > 0) {
      const activeCartelas = userCartelasData.filter(c => c.is_active).length;
      const inactiveCartelas = userCartelasData.length - activeCartelas;
      console.log(`  Active cartelas: ${activeCartelas}`);
      console.log(`  Inactive cartelas: ${inactiveCartelas}`);
      
      // Show card ID range
      const cardIds = userCartelasData.map(c => parseInt(c.card_id)).filter(id => !isNaN(id)).sort((a, b) => a - b);
      if (cardIds.length > 0) {
        console.log(`  Card ID range: ${cardIds[0]} - ${cardIds[cardIds.length - 1]}`);
        console.log(`  First 10 card IDs: ${cardIds.slice(0, 10).join(', ')}`);
        console.log(`  Last 10 card IDs: ${cardIds.slice(-10).join(', ')}`);
      }
      
      // Check for duplicates
      const duplicates = cardIds.filter((id, index) => cardIds.indexOf(id) !== index);
      if (duplicates.length > 0) {
        console.log(`  ⚠️ Duplicate card IDs found: ${duplicates.length}`);
        console.log(`  Duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
    
    // Check main cartelas table for comparison
    console.log('\n📋 Checking main cartelas table:');
    const allCartelas = await cartelas.findAll();
    console.log(`  Total cartelas in main table: ${allCartelas.length}`);
    
    const userCartelasInMain = allCartelas.filter(c => c.user_id === amour1User.id);
    console.log(`  Cartelas assigned to amour1 in main table: ${userCartelasInMain.length}`);
    
    // Run the exact query used by the admin endpoint
    console.log('\n🔍 Running admin endpoint query:');
    const cartelaCountQuery = `
      SELECT user_id, COUNT(*) as cartela_count 
      FROM user_cartelas 
      WHERE is_active = 1 
      GROUP BY user_id
    `;
    const cartelaCountResults = await all(cartelaCountQuery);
    
    const amour1Count = cartelaCountResults.find(row => row.user_id === amour1User.id);
    if (amour1Count) {
      console.log(`  Admin query result for amour1: ${amour1Count.cartela_count} cartelas`);
    } else {
      console.log(`  Admin query result for amour1: 0 cartelas (no entry found)`);
    }
    
    // Show all users with cartela counts
    console.log('\n📊 All users with cartela counts:');
    cartelaCountResults.forEach(row => {
      console.log(`  User ID ${row.user_id}: ${row.cartela_count} cartelas`);
    });
    
    console.log('\n✅ Diagnosis completed!');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
  } finally {
    await closePool();
  }
}

// Run the diagnosis
diagnoseAmour1Cartelas();