const { Pool } = require('pg');
const fs = require('fs');

// Your new Render database URL
const DATABASE_URL = 'postgresql://amour_bingo_user:IEFx8yENqCjmAM5V6JqMt9NDtxLdLNYz@dpg-d4gcjsshg0os73bu2ra0-a.oregon-postgres.render.com/amour_bingo';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateData() {
  console.log('🔄 Starting data migration to new backend...\n');

  const filename = 'database-export-1763759794911.json';
  
  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }

  try {
    // Read export file
    const exportData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log(`📂 Reading export from: ${exportData.exportDate}\n`);

    // Import users (but skip the test user we just created)
    if (exportData.users && exportData.users.length > 0) {
      let importedUsers = 0;
      for (const user of exportData.users) {
        try {
          await pool.query(`
            INSERT INTO users (id, username, email, shopname, password, role, user_type, balance, balance_limit, total_games_played, total_winnings, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (username) DO UPDATE SET
              email = EXCLUDED.email,
              balance = EXCLUDED.balance,
              total_games_played = EXCLUDED.total_games_played,
              total_winnings = EXCLUDED.total_winnings,
              updated_at = EXCLUDED.updated_at
          `, [
            user.id, user.username, user.email, user.shopname, user.password,
            user.role, user.user_type, user.balance, user.balance_limit,
            user.total_games_played, user.total_winnings, user.is_active,
            user.created_at, user.updated_at
          ]);
          importedUsers++;
        } catch (err) {
          console.log(`⚠️  Skipped user ${user.username}: ${err.message}`);
        }
      }
      console.log(`✅ Imported ${importedUsers} users`);
    }

    // Import games
    if (exportData.games && exportData.games.length > 0) {
      let importedGames = 0;
      for (const game of exportData.games) {
        try {
          await pool.query(`
            INSERT INTO games (id, game_number, status, bet_money, win_money, cartelas_selected, selected_cartelas, called_numbers, number_sequence, total_numbers, winner_pattern, house_cut_percentage, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO NOTHING
          `, [
            game.id, game.game_number, game.status, game.bet_money, game.win_money,
            game.cartelas_selected, game.selected_cartelas, game.called_numbers,
            game.number_sequence, game.total_numbers, game.winner_pattern,
            game.house_cut_percentage, game.created_at, game.updated_at
          ]);
          importedGames++;
        } catch (err) {
          console.log(`⚠️  Skipped game ${game.id}: ${err.message}`);
        }
      }
      console.log(`✅ Imported ${importedGames} games`);
    }

    // Import cartelas
    if (exportData.cartelas && exportData.cartelas.length > 0) {
      let importedCartelas = 0;
      for (const cartela of exportData.cartelas) {
        try {
          await pool.query(`
            INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [
            cartela.id, cartela.card_id, cartela.game_id, cartela.user_id,
            cartela.numbers, cartela.pattern, cartela.is_active,
            cartela.is_winner, cartela.purchased_at
          ]);
          importedCartelas++;
        } catch (err) {
          console.log(`⚠️  Skipped cartela ${cartela.id}: ${err.message}`);
        }
      }
      console.log(`✅ Imported ${importedCartelas} cartelas`);
    }

    // Import admin logs
    if (exportData.adminLogs && exportData.adminLogs.length > 0) {
      let importedLogs = 0;
      for (const log of exportData.adminLogs) {
        try {
          await pool.query(`
            INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
          `, [
            log.id, log.admin_id, log.action, log.target_type, log.target_id,
            log.details, log.ip_address, log.created_at
          ]);
          importedLogs++;
        } catch (err) {
          console.log(`⚠️  Skipped log ${log.id}: ${err.message}`);
        }
      }
      console.log(`✅ Imported ${importedLogs} admin logs`);
    }

    // Import game analysis
    if (exportData.gameAnalysis && exportData.gameAnalysis.length > 0) {
      let importedAnalysis = 0;
      for (const analysis of exportData.gameAnalysis) {
        try {
          await pool.query(`
            INSERT INTO game_analysis (id, game_id, game_number, players, bet, total_bet, cut_percentage, profit, house_bonus, winner_info, status, date, user_id, username, final_win_amount, called_numbers, selected_cartelas, winner_cartela_ids, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id) DO NOTHING
          `, [
            analysis.id, analysis.game_id, analysis.game_number, analysis.players,
            analysis.bet, analysis.total_bet, analysis.cut_percentage, analysis.profit,
            analysis.house_bonus, analysis.winner_info, analysis.status, analysis.date,
            analysis.user_id, analysis.username, analysis.final_win_amount,
            analysis.called_numbers, analysis.selected_cartelas, analysis.winner_cartela_ids,
            analysis.created_at, analysis.updated_at
          ]);
          importedAnalysis++;
        } catch (err) {
          console.log(`⚠️  Skipped analysis ${analysis.id}: ${err.message}`);
        }
      }
      console.log(`✅ Imported ${importedAnalysis} game analysis records`);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ All your data has been migrated to the new backend');
    console.log('🔗 Backend URL: https://amour-bingo-backend.onrender.com');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

migrateData();