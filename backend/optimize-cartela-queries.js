require('dotenv').config();
const db = require('./db');

async function optimizeCartelaQueries() {
  try {
    console.log('🚀 Optimizing cartela database queries...\n');
    
    // Add composite index for user_cartelas pagination
    console.log('📊 Adding composite index for user_cartelas pagination...');
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_cartelas_user_active_cardid 
      ON user_cartelas(user_id, is_active, CAST(card_id AS INTEGER))
    `);
    console.log('✅ Added composite index for efficient pagination');
    
    // Add index for card_id ordering
    console.log('📊 Adding index for card_id ordering...');
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_cartelas_cardid_int 
      ON user_cartelas(CAST(card_id AS INTEGER))
    `);
    console.log('✅ Added index for card_id ordering');
    
    // Analyze table statistics
    console.log('📊 Analyzing table statistics...');
    await db.run('ANALYZE user_cartelas');
    console.log('✅ Table statistics updated');
    
    // Test query performance
    console.log('\n🧪 Testing query performance...');
    const startTime = Date.now();
    
    const testResult = await db.pool.query(`
      SELECT COUNT(*) as total 
      FROM user_cartelas 
      WHERE user_id = $1 AND is_active = 1
    `, [4]);
    
    const queryTime = Date.now() - startTime;
    console.log(`⚡ Count query took: ${queryTime}ms`);
    console.log(`📊 Total cartelas for user 4: ${testResult.rows[0].total}`);
    
    // Test paginated query
    const paginatedStart = Date.now();
    const paginatedResult = await db.pool.query(`
      SELECT * FROM user_cartelas 
      WHERE user_id = $1 AND is_active = 1 
      ORDER BY CAST(card_id AS INTEGER)
      LIMIT $2 OFFSET $3
    `, [4, 50, 0]);
    
    const paginatedTime = Date.now() - paginatedStart;
    console.log(`⚡ Paginated query took: ${paginatedTime}ms`);
    console.log(`📊 Retrieved ${paginatedResult.rows.length} cartelas`);
    
    console.log('\n✅ Database optimization complete!');
    
  } catch (error) {
    console.error('❌ Error optimizing database:', error);
  } finally {
    await db.pool.end();
  }
}

optimizeCartelaQueries();