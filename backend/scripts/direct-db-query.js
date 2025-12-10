const { Pool } = require('pg');

// Direct connection to your Render database
const pool = new Pool({
  connectionString: 'postgresql://amour_bingo_user:eEApBgGF73tBO8MRIniMrAnEKDNYlvAZ@dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com/amour_bingo_xeyz',
  ssl: {
    rejectUnauthorized: false
  }
});

async function directQuery() {
  console.log('🔍 Direct Query to Render Database\n');
  console.log('Database: amour_bingo_xeyz');
  console.log('Host: dpg-d4ger7be5dus73bisgl0-a.oregon-postgres.render.com\n');

  try {
    // Get all users - RAW query
    console.log('📊 Executing: SELECT * FROM users ORDER BY created_at DESC\n');
    
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    
    console.log(`✅ Query returned ${result.rows.length} rows\n`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (result.rows.length === 0) {
      console.log('❌ NO USERS FOUND IN DATABASE');
    } else {
      result.rows.forEach((user, idx) => {
        console.log(`USER #${idx + 1}:`);
        console.log(`  id: ${user.id}`);
        console.log(`  username: ${user.username}`);
        console.log(`  email: ${user.email}`);
        console.log(`  role: ${user.role}`);
        console.log(`  user_type: ${user.user_type}`);
        console.log(`  balance: ${user.balance}`);
        console.log(`  total_games_played: ${user.total_games_played}`);
        console.log(`  is_active: ${user.is_active}`);
        console.log(`  created_at: ${user.created_at}`);
        console.log(`  updated_at: ${user.updated_at}`);
        console.log('');
      });
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Check for testpre@bingo.com specifically
    console.log('🔎 Checking for testpre@bingo.com...\n');
    const testpreResult = await pool.query(
      "SELECT * FROM users WHERE email = 'testpre@bingo.com'"
    );
    
    if (testpreResult.rows.length > 0) {
      console.log('✅ FOUND testpre@bingo.com:');
      console.log(JSON.stringify(testpreResult.rows[0], null, 2));
    } else {
      console.log('❌ testpre@bingo.com NOT FOUND in database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    throw error;
  } finally {
    await pool.end();
  }
}

directQuery()
  .then(() => {
    console.log('\n✅ Query Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Query Failed:', error);
    process.exit(1);
  });
