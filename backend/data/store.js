const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { users: dbUsers, games: dbGames, cartelas: dbCartelas, adminLogs: dbAdminLogs } = require('./database');

// Database is ready - no initialization needed for PostgreSQL

// Database-backed data operations - use database methods directly
const users = dbUsers;

const games = {
  push: async (game) => {
    await dbGames.create(game);
  },
  findById: (id) => dbGames.findById(id),
  findAll: () => dbGames.findAll(),
  updateById: (id, updateData) => dbGames.update(id, updateData)
};

const cartelas = {
  push: async (cartela) => {
    await dbCartelas.create(cartela);
  },
  findByUserId: (userId) => dbCartelas.findByUserId(userId),
  findAll: () => dbCartelas.findAll(),
  findByCardId: (cardId) => dbCartelas.findByCardId(cardId),
  find: (predicate) => dbCartelas.findAll().then(allCartelas => allCartelas.find(predicate)),
  findIndex: (predicate) => dbCartelas.findAll().then(allCartelas => allCartelas.findIndex(predicate)),
  create: async (cartela) => {
    await dbCartelas.create(cartela);
  },
  update: async (id, updateData) => {
    await dbCartelas.update(id, updateData);
  }
};

const gameSessions = []; // Keep in memory for now, can be migrated later
const adminLogs = dbAdminLogs;



module.exports = {
  users,
  games,
  cartelas,
  gameSessions,
  adminLogs
};
