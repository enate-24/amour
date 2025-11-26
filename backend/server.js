const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

// Initialize database
const { createTables } = require('./db');

// Database is ready - no initialization needed for PostgreSQL
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const cartelaRoutes = require('./routes/cartelas');
const winnerCheckRoutes = require('./routes/winner-check');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const soundRoutes = require('./routes/sound');
const settingsRoutes = require('./routes/settings');
const bonusRoutes = require('./routes/bonuses');

const app = express();
const PORT = process.env.PORT || 3003; // Changed from 3001 to 3002

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Disable CORP for CORS compatibility
  crossOriginOpenerPolicy: false    // Disable COOP for CORS compatibility
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow any localhost port
    if (process.env.NODE_ENV === 'development') {
      if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        return callback(null, true);
      }
    }

    // Get frontend URLs from environment variables
    const frontendUrls = process.env.FRONTEND_URLS 
      ? process.env.FRONTEND_URLS.split(',').map(url => url.trim())
      : [];

    // Support for wildcard patterns (optional)
    const wildcardPatterns = process.env.FRONTEND_PATTERNS
      ? process.env.FRONTEND_PATTERNS.split(',').map(pattern => pattern.trim())
      : [];

    // Check wildcard patterns
    const matchesPattern = wildcardPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(origin);
      }
      return false;
    });

    // Development allowed origins
    const developmentOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3003',
      'http://127.0.0.1:3003'
    ];

    // Combine all allowed origins
    const allowedOrigins = [
      ...developmentOrigins,
      ...frontendUrls,
      // Fallback for backward compatibility
      'https://abisinya-bingo.netlify.app/',
      'https://amour-bingo.vercel.app'
    ];

    console.log('🌐 Configured frontend URLs:', frontendUrls);
    console.log('🔍 Checking origin:', origin);

    if (allowedOrigins.includes(origin) || matchesPattern) {
      console.log('✅ CORS allowed for origin:', origin);
      return callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      console.log('📋 Allowed origins:', allowedOrigins);
      console.log('🔍 Wildcard patterns:', wildcardPatterns);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
}));

// Rate limiting - exclude sound files and game calls from global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs (increased for real-time games)
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.path.startsWith('/api/sound/') || req.path.includes('/call-number') // Skip rate limiting for sound files and number calls
});
app.use(limiter);

// Separate rate limiter for sound files - more generous limits
const soundLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow up to 1000 sound requests per 15 minutes
  message: 'Too many sound requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Separate rate limiter for game number calls - very generous for real-time gameplay
const gameLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Allow up to 200 number calls per minute (about 3-4 per second)
  message: 'Too many game calls, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply sound limiter only to sound routes
app.use('/api/sound/', soundLimiter);

// Apply game limiter to call-number endpoints
app.use('/api/games/*/call-number', gameLimiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware - JSON only for API routes
app.use(express.json({ limit: '10mb' }));

// Debug route - catch all requests
app.use('*', (req, res, next) => {
  console.log('🔥 REQUEST RECEIVED:', req.method, req.originalUrl);
  next();
});

// Routes - games first for testing
app.use('/api/games', (req, res, next) => {
  console.log('🎯 Games router hit:', req.method, req.path, req.query);
  next();
}, gameRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cartelas', cartelaRoutes);
app.use('/api/winner-check', winnerCheckRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', (req, res, next) => {
  console.log('🎯 Dashboard router hit:', req.method, req.path);
  next();
}, dashboardRoutes);
app.use('/api/sound', soundRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/bonuses', (req, res, next) => {
  console.log('🎁 Bonus router hit:', req.method, req.path);
  next();
}, bonusRoutes);



// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// CORS debug endpoint
app.get('/api/cors-test', (req, res) => {
  const frontendUrls = process.env.FRONTEND_URLS 
    ? process.env.FRONTEND_URLS.split(',').map(url => url.trim())
    : [];
  
  res.json({
    message: 'CORS configuration test',
    configuredUrls: frontendUrls,
    requestOrigin: req.headers.origin,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
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

// Start the server
app.listen(PORT, async () => {
  console.log(`🚀 Bingo Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Using PostgreSQL database`);

  // Initialize database tables
  try {
    await createTables();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
});

module.exports = app;
