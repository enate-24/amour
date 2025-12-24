// Export the PostgreSQL database operations
const { 
  pool, 
  users, 
  games, 
  cartelas, 
  userCartelas,
  adminLogs, 
  userSettings, 
  dailyBonuses, 
  createTables, 
  checkConnection,
  closePool,
  get, 
  all, 
  run 
} = require('./data/database');

module.exports = {
  pool,
  users,
  games,
  cartelas,
  userCartelas,
  adminLogs,
  userSettings,
  dailyBonuses,
  createTables,
  checkConnection,
  closePool,
  get,
  all,
  run
};
