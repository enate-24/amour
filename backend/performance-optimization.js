require('dotenv').config();
const { pool } = require('./data/database');

async function optimizePerformance() {
  try {
    console.log('🚀 Starting comprehensive performance optimization...\n');
    
    // 1. Add database indexes for better query performance
    console.log('📊 Adding database indexes...');
    
    const indexes = [
      // User cartelas indexes
      {
        name: 'idx_user_cartelas_user_active_cardid',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_cartelas_user_active_cardid 
              ON user_cartelas(user_id, is_active, CAST(card_id AS INTEGER))`
      },
      {
        name: 'idx_user_cartelas_cardid_int',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_cartelas_cardid_int 
              ON user_cartelas(CAST(card_id AS INTEGER))`
      },
      {
        name: 'idx_user_cartelas_user_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_cartelas_user_id 
              ON user_cartelas(user_id)`
      },
      {
        name: 'idx_user_cartelas_is_active',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_cartelas_is_active 
              ON user_cartelas(is_active)`
      },
      // Main cartelas table indexes
      {
        name: 'idx_cartelas_card_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_cartelas_card_id 
              ON cartelas(card_id)`
      },
      {
        name: 'idx_cartelas_user_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_cartelas_user_id 
              ON cartelas(user_id)`
      },
      {
        name: 'idx_cartelas_is_active',
        sql: `CREATE INDEX IF NOT EXISTS idx_cartelas_is_active 
              ON cartelas(is_active)`
      },
      {
        name: 'idx_cartelas_game_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_cartelas_game_id 
              ON cartelas(game_id)`
      }
    ];

    for (const index of indexes) {
      try {
        await pool.query(index.sql);
        console.log(`✅ Added index: ${index.name}`);
      } catch (error) {
        console.warn(`⚠️ Index ${index.name} might already exist:`, error.message);
      }
    }

    // 2. Update table statistics for better query planning
    console.log('\n📊 Updating table statistics...');
    const tables = ['user_cartelas', 'cartelas', 'users', 'games'];
    
    for (const table of tables) {
      try {
        await pool.query(`ANALYZE ${table}`);
        console.log(`✅ Analyzed table: ${table}`);
      } catch (error) {
        console.warn(`⚠️ Could not analyze table ${table}:`, error.message);
      }
    }

    // 3. Test query performance
    console.log('\n🧪 Testing query performance...');
    
    // Test user cartelas count query
    const countStart = Date.now();
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM user_cartelas 
      WHERE is_active = 1
    `);
    const countTime = Date.now() - countStart;
    console.log(`⚡ Count query took: ${countTime}ms (${countResult.rows[0].total} total cartelas)`);

    // Test paginated query
    const paginatedStart = Date.now();
    const paginatedResult = await pool.query(`
      SELECT id, card_id, user_id, numbers, is_active, created_at
      FROM user_cartelas 
      WHERE is_active = 1 
      ORDER BY CAST(card_id AS INTEGER)
      LIMIT 50 OFFSET 0
    `);
    const paginatedTime = Date.now() - paginatedStart;
    console.log(`⚡ Paginated query took: ${paginatedTime}ms (${paginatedResult.rows.length} rows)`);

    // Test main cartelas query
    const mainStart = Date.now();
    const mainResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM cartelas 
      WHERE is_active = 1
    `);
    const mainTime = Date.now() - mainStart;
    console.log(`⚡ Main cartelas count took: ${mainTime}ms (${mainResult.rows[0].total} total)`);

    // 4. Connection pool optimization
    console.log('\n🔧 Connection pool info:');
    console.log(`Total connections: ${pool.totalCount}`);
    console.log(`Idle connections: ${pool.idleCount}`);
    console.log(`Waiting clients: ${pool.waitingCount}`);

    console.log('\n✅ Performance optimization complete!');
    console.log('\n📋 Recommendations:');
    console.log('1. Use pagination with LIMIT/OFFSET for large datasets');
    console.log('2. Cache frequently accessed data in sessionStorage');
    console.log('3. Load cartela numbers only when needed (lazy loading)');
    console.log('4. Use database indexes for WHERE and ORDER BY clauses');
    console.log('5. Consider implementing Redis cache for hot data');
    
  } catch (error) {
    console.error('❌ Error during optimization:', error);
  } finally {
    await pool.end();
  }
}

// Run optimization if called directly
if (require.main === module) {
  optimizePerformance();
}

module.exports = { optimizePerformance };