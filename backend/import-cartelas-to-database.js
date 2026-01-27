require('dotenv').config();
const { Pool } = require('pg');
const { bingoCards } = require('./data/cartela.js');

// Disable SSL certificate validation for Aiven connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function importCartelasToDatabase() {
  console.log('🎯 Importing cartelas from cartela.js to database...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: null,
      key: null,
      cert: null
    },
    max: 10,
    connectionTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 10000,
    createRetryIntervalMillis: 5000
  });
  
  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    client.release();
    
    // Check current cartelas count
    console.log('\n📊 Checking current cartelas in database...');
    const currentCount = await pool.query('SELECT COUNT(*) FROM cartelas');
    console.log(`Current cartelas in database: ${currentCount.rows[0].count}`);
    
    // Get cartela data from file
    const cartelaIds = Object.keys(bingoCards);
    console.log(`\n📋 Found ${cartelaIds.length} cartelas in cartela.js file`);
    console.log(`Card ID range: ${Math.min(...cartelaIds.map(Number))} to ${Math.max(...cartelaIds.map(Number))}`);
    
    // Check which cartelas already exist
    console.log('\n🔍 Checking for existing cartelas...');
    const existingCartelas = await pool.query(`
      SELECT card_id FROM cartelas 
      WHERE card_id = ANY($1)
    `, [cartelaIds]);
    
    const existingCardIds = new Set(existingCartelas.rows.map(row => row.card_id));
    const newCartelas = cartelaIds.filter(cardId => !existingCardIds.has(cardId));
    
    console.log(`Existing cartelas: ${existingCardIds.size}`);
    console.log(`New cartelas to import: ${newCartelas.length}`);
    
    if (newCartelas.length === 0) {
      console.log('\n✅ All cartelas already exist in database. No import needed.');
      return;
    }
    
    // Import new cartelas in batches
    console.log('\n📥 Starting cartela import...');
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < newCartelas.length; i += batchSize) {
      const batch = newCartelas.slice(i, i + batchSize);
      
      // Prepare batch insert
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const cardId of batch) {
        const numbers = bingoCards[cardId];
        
        // Convert the 5x5 grid to PostgreSQL array format
        // Flatten the 2D array and convert "FREE"/"Free" to 0
        const flatNumbers = numbers.flat().map(num => {
          if (typeof num === 'string' && (num.toLowerCase() === 'free' || num === 'FREE')) {
            return 0; // Convert FREE space to 0
          }
          return parseInt(num);
        });
        
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
        values.push(
          cardId,                    // card_id
          null,                      // game_id (null for available cartelas)
          null,                      // user_id (null for available cartelas)
          flatNumbers,               // numbers (PostgreSQL array)
          1                          // is_active (1 = active)
        );
        paramIndex += 5;
      }
      
      const query = `
        INSERT INTO cartelas (card_id, game_id, user_id, numbers, is_active)
        VALUES ${placeholders.join(', ')}
      `;
      
      await pool.query(query, values);
      imported += batch.length;
      
      console.log(`📥 Imported batch: ${imported}/${newCartelas.length} cartelas`);
    }
    
    // Verify import
    console.log('\n🔍 Verifying import...');
    const finalCount = await pool.query('SELECT COUNT(*) FROM cartelas');
    const newCount = parseInt(finalCount.rows[0].count);
    const addedCount = newCount - parseInt(currentCount.rows[0].count);
    
    console.log(`\n📊 Import Summary:`);
    console.log(`- Previous count: ${currentCount.rows[0].count}`);
    console.log(`- New count: ${newCount}`);
    console.log(`- Added: ${addedCount} cartelas`);
    
    // Show sample of imported cartelas
    console.log('\n📋 Sample of imported cartelas:');
    const sampleCartelas = await pool.query(`
      SELECT card_id, numbers 
      FROM cartelas 
      WHERE card_id = ANY($1)
      ORDER BY card_id::INTEGER 
      LIMIT 5
    `, [newCartelas.slice(0, 5)]);
    
    sampleCartelas.rows.forEach(cartela => {
      const numbers = cartela.numbers; // Already an array from PostgreSQL
      console.log(`Card ${cartela.card_id}:`);
      // Convert flat array back to 5x5 grid for display
      for (let i = 0; i < 5; i++) {
        const row = numbers.slice(i * 5, (i + 1) * 5);
        const displayRow = row.map(num => num === 0 ? 'FREE' : num);
        console.log(`  [${displayRow.join(', ')}]`);
      }
      console.log('');
    });
    
    console.log('🎉 Cartela import completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Cartelas are now available in the database');
    console.log('2. They can be assigned to users through the admin interface');
    console.log('3. Users can select these cartelas for games');
    
  } catch (error) {
    console.error('❌ Failed to import cartelas:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

importCartelasToDatabase().catch(error => {
  console.error('❌ Import process failed:', error);
  process.exit(1);
});