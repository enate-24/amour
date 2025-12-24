const { pool, closePool } = require('../db');

async function verifyGamesSchema() {
  try {
    console.log('🔍 Verifying games table schema...');
    
    // Query to get column information for games table
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'games' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Games table columns:');
    console.log('='.repeat(60));
    result.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(25)} | ${col.data_type.padEnd(15)} | ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check specifically for bet_amount_per_cartela
    const betAmountColumn = result.rows.find(col => col.column_name === 'bet_amount_per_cartela');
    if (betAmountColumn) {
      console.log('\n✅ bet_amount_per_cartela column found!');
      console.log(`   Type: ${betAmountColumn.data_type}`);
      console.log(`   Nullable: ${betAmountColumn.is_nullable}`);
    } else {
      console.log('\n❌ bet_amount_per_cartela column NOT found!');
    }
    
    console.log('\n✅ Schema verification completed!');
    
  } catch (error) {
    console.error('❌ Error verifying schema:', error.message);
  } finally {
    await closePool();
  }
}

// Run the verification
verifyGamesSchema();