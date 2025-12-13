const db = require('../data/database');

async function optimizeWinnerCheckPerformance() {
  console.log('🚀 Optimizing winner check performance...');
  
  try {
    // Add composite index for faster cartela lookups in winner check
    console.log('📊 Creating optimized indexes...');
    
    // Index for cartela lookup by card_id or id with is_active filter
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_cartelas_winner_check 
      ON cartelas(card_id, is_active) 
      WHERE is_active = 1
    `);
    
    // Index for game lookup by id and status
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_games_winner_check 
      ON games(id, status) 
      WHERE status IN ('started', 'active')
    `);
    
    // Index for game_analysis winner updates
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_game_analysis_winner_update 
      ON game_analysis(game_id, winner_cartela_ids)
    `);
    
    console.log('✅ Performance indexes created successfully');
    
    // Analyze table statistics for better query planning
    console.log('📈 Updating table statistics...');
    await db.run('ANALYZE cartelas');
    await db.run('ANALYZE games');
    await db.run('ANALYZE game_analysis');
    
    console.log('✅ Table statistics updated');
    
    // Test query performance
    console.log('🧪 Testing query performance...');
    
    const testStart = Date.now();
    const testCartela = await db.get(
      'SELECT * FROM cartelas WHERE (id = $1 OR card_id = $1) AND is_active = 1 LIMIT 1',
      ['1']
    );
    const testTime = Date.now() - testStart;
    
    console.log(`⏱️ Test cartela lookup took: ${testTime}ms`);
    
    if (testTime > 100) {
      console.log('⚠️ Query still slow, consider checking database connection');
    } else {
      console.log('✅ Query performance looks good');
    }
    
  } catch (error) {
    console.error('❌ Error optimizing performance:', error.message);
  }
}

// Run optimization
optimizeWinnerCheckPerformance()
  .then(() => {
    console.log('🎯 Performance optimization complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  });