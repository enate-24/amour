const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

// Initialize database
const { createTables } = require('../../db');

// Import routes
const authRoutes = require('../../routes/auth');
const userRoutes = require('../../routes/users');
const gameRoutes = require('../../routes/games');
const cartelaRoutes = require('../../routes/cartelas');
const winnerCheckRoutes = require('../../routes/winner-check');
const adminRoutes = require('../../routes/admin');
const dashboardRoutes = require('../../routes/dashboard');
const soundRoutes = require('../../routes/sound');
const settingsRoutes = require('../../routes/settings');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3003',
      'http://127.0.0.1:3003',
      // Add your Netlify domain here
      process.env.FRONTEND_URL
    ];

    if (allowedOrigins.includes(origin) || origin.includes('.netlify.app')) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.path.startsWith('/api/sound/') || req.path.includes('/call-number')
});
app.use(limiter);

const soundLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many sound requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const gameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many game calls, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/sound/', soundLimiter);
app.use('/api/games/*/call-number', gameLimiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/games', gameRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cartelas', cartelaRoutes);
app.use('/api/winner-check', winnerCheckRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sound', soundRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    platform: 'Netlify Functions'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database on cold start
let dbInitialized = false;
const initializeDatabase = async () => {
  if (!dbInitialized) {
    try {
      await createTables();
      console.log('✅ Database initialized successfully');
      dbInitialized = true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
    }
  }
};

// Wrap the Express app with serverless-http
const handler = serverless(app);

exports.handler = async (event, context) => {
  // Initialize database on first invocation
  await initializeDatabase();
  
  // Handle the request
  return await handler(event, context);
};
