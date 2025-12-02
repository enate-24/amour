const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.username} (${socket.id})`);

    // Join game room
    socket.on('joinGame', (gameId) => {
      socket.join(`game:${gameId}`);
      console.log(`👤 ${socket.username} joined game ${gameId}`);
      
      // Notify others in the room
      socket.to(`game:${gameId}`).emit('playerJoined', {
        username: socket.username,
        userId: socket.userId
      });
    });

    // Leave game room
    socket.on('leaveGame', (gameId) => {
      socket.leave(`game:${gameId}`);
      console.log(`👋 ${socket.username} left game ${gameId}`);
      
      socket.to(`game:${gameId}`).emit('playerLeft', {
        username: socket.username,
        userId: socket.userId
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.username} (${socket.id})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Event emitters for game events
function emitNumberCalled(gameId, data) {
  if (io) {
    io.to(`game:${gameId}`).emit('numberCalled', data);
  }
}

function emitGameStatusChange(gameId, data) {
  if (io) {
    io.to(`game:${gameId}`).emit('gameStatusChanged', data);
  }
}

function emitWinnerDetected(gameId, data) {
  if (io) {
    io.to(`game:${gameId}`).emit('winnerDetected', data);
  }
}

function emitCartelaSelected(gameId, data) {
  if (io) {
    io.to(`game:${gameId}`).emit('cartelaSelected', data);
  }
}

function emitBonusUpdate(userId, data) {
  if (io) {
    // Send to specific user
    const sockets = Array.from(io.sockets.sockets.values());
    const userSocket = sockets.find(s => s.userId === userId);
    if (userSocket) {
      userSocket.emit('bonusUpdate', data);
    }
  }
}

module.exports = {
  initializeWebSocket,
  getIO,
  emitNumberCalled,
  emitGameStatusChange,
  emitWinnerDetected,
  emitCartelaSelected,
  emitBonusUpdate
};
