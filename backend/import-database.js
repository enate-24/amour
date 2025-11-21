const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

// This will use the DATABASE_URL from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function importDatabase(filename) {
  console.log('🔄 Starting database import...\n');

  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }

  try {
    // Read export file
    const exportData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log(`📂 Reading export from: ${exportData.exportDate}\n`);

    // Import users
    if (exportData.users && exportData.users.length > 0) {
      for (const user of exportData.users) {
        await pool.query(`
          INSERT INTO users (id, username, email, shopname, password, role, user_type, balance, balance_limit, total_games_played, total_winnings, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING
        `, [
          user.id, user.username, user.email, user.shopname, user.password,
          user.role, user.user_type, user.balance, user.balance_limit,
          user.total_games_played, user.total_winnings, user.is_active,
          user.created_at, user.updated_at
        ]);
      }
      console.log(`✅ Imported ${exportData.users.length} users`);
    }

    // Import games
    if (exportData.games && exportData.games.length > 0) {
      for (const game of exportData.games) {
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
      }
      console.log(`✅ Imported ${exportData.games.length} games`);
    }

    // Import cartelas
    if (exportData.cartelas && exportData.cartelas.length > 0) {
      for (const cartela of exportData.cartelas) {
        await pool.query(`
          INSERT INTO cartelas (id, card_id, game_id, user_id, numbers, pattern, is_active, is_winner, purchased_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          cartela.id, cartela.card_id, cartela.game_id, cartela.user_id,
          cartela.numbers, cartela.pattern, cartela.is_active,
          cartela.is_winner, cartela.purchased_at
        ]);
      }
      console.log(`✅ Imported ${exportData.cartelas.length} cartelas`);
    }

    // Import admin logs
    if (exportData.adminLogs && exportData.adminLogs.length > 0) {
      for (const log of exportData.adminLogs) {
        await pool.query(`
          INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          log.id, log.admin_id, log.action, log.target_type, log.target_id,
          log.details, log.ip_address, log.created_at
        ]);
      }
      console.log(`✅ Imported ${exportData.adminLogs.length} admin logs`);
    }

    // Import game analysis
    if (exportData.gameAnalysis && exportData.gameAnalysis.length > 0) {
      for (const analysis of exportData.gameAnalysis) {
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
      }
      console.log(`✅ Imported ${exportData.gameAnalysis.length} game analysis records`);
    }

    // Import sounds
    if (exportData.sounds && exportData.sounds.length > 0) {
      for (const sound of exportData.sounds) {
        await pool.query(`
          INSERT INTO sounds (id, name, file_path, type, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [
          sound.id, sound.name, sound.file_path, sound.type, sound.created_at
        ]);
      }
      console.log(`✅ Imported ${exportData.sounds.length} sounds`);
    }

    // Import user settings
    if (exportData.userSettings && exportData.userSettings.length > 0) {
      for (const settings of exportData.userSettings) {
        await pool.query(`
          INSERT INTO user_settings (id, user_id, selected_pattern, bet_amount, house_cut_percentage, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id) DO UPDATE SET
            selected_pattern = EXCLUDED.selected_pattern,
            bet_amount = EXCLUDED.bet_amount,
            house_cut_percentage = EXCLUDED.house_cut_percentage,
            updated_at = EXCLUDED.updated_at
        `, [
          settings.id, settings.user_id, settings.selected_pattern,
          settings.bet_amount, settings.house_cut_percentage,
          settings.created_at, settings.updated_at
        ]);
      }
      console.log(`✅ Imported ${exportData.userSettings.length} user settings`);
    }

    console.log('\n✅ Database import completed successfully!');

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Get filename from command line argument
const filename = process.argv[2] || 'database-export.json';
importDatabase(filename);
