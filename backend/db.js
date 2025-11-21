// Export the PostgreSQL database operations
const { pool, users, games, cartelas, adminLogs, userSettings, createTables, get, all, run } = require('./data/database');

module.exports = {
  pool,
  users,
  games,
  cartelas,
  adminLogs,
  userSettings,
  createTables,
  get,
  all,
  run
};
