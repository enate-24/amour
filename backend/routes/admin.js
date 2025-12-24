const express = require('express');
const { param, validationResult, body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
// Re-export operations for consistency
const { users, games, cartelas, userCartelas, adminLogs, userSettings, get, all, run } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
// const { createCartelaListFromPDF } = require('../create-cartela-from-pdf'); // File not found

const router = express.Router();

// Get admin dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get data from database
    const allUsers = await users.findAll();
    const allGames = await games.findAll();
    const allCartelas = await cartelas.findAll();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate statistics
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => u.is_active).length;
    const totalGames = allGames.length;
    const activeGames = allGames.filter(g => g.status === 'started' || g.status === 'waiting').length;
    const finishedGames = allGames.filter(g => g.status === 'finished');

    // Daily stats
    const todayGames = allGames.filter(g => new Date(g.created_at) >= today);
    const todayFinished = todayGames.filter(g => g.status === 'finished');
    const dailyRevenue = todayFinished.reduce((sum, g) => sum + g.betMoney, 0);
    const dailyPayout = todayFinished.reduce((sum, g) => sum + g.winMoney, 0);
    const dailyProfit = todayFinished.reduce((sum, g) => sum + (g.betMoney * g.cartelasSelected * ((g.houseCutPercentage || 10) / 100)), 0);

    // Weekly stats
    const weekGames = allGames.filter(g => new Date(g.created_at) >= thisWeek);
    const weekFinished = weekGames.filter(g => g.status === 'finished');
    const weeklyRevenue = weekFinished.reduce((sum, g) => sum + g.betMoney, 0);
    const weeklyPayout = weekFinished.reduce((sum, g) => sum + g.winMoney, 0);
    const weeklyProfit = weekFinished.reduce((sum, g) => sum + (g.betMoney * g.cartelasSelected * ((g.houseCutPercentage || 10) / 100)), 0);

    // Monthly stats
    const monthGames = allGames.filter(g => new Date(g.created_at) >= thisMonth);
    const monthFinished = monthGames.filter(g => g.status === 'finished');
    const monthlyRevenue = monthFinished.reduce((sum, g) => sum + g.betMoney, 0);
    const monthlyPayout = monthFinished.reduce((sum, g) => sum + g.winMoney, 0);
    const monthlyProfit = monthFinished.reduce((sum, g) => sum + (g.betMoney * g.cartelasSelected * ((g.houseCutPercentage || 10) / 100)), 0);

    // Total stats
    const totalRevenue = finishedGames.reduce((sum, g) => sum + g.betMoney, 0);
    const totalPayout = finishedGames.reduce((sum, g) => sum + g.winMoney, 0);
    const totalProfit = finishedGames.reduce((sum, g) => sum + (g.betMoney * g.cartelasSelected * ((g.houseCutPercentage || 10) / 100)), 0);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      games: {
        total: totalGames,
        active: activeGames,
        finished: finishedGames.length,
        cancelled: allGames.filter(g => g.status === 'cancelled').length
      },
      revenue: {
        daily: {
          games: todayFinished.length,
          revenue: dailyRevenue,
          payout: dailyPayout,
          profit: dailyProfit
        },
        weekly: {
          games: weekFinished.length,
          revenue: weeklyRevenue,
          payout: weeklyPayout,
          profit: weeklyProfit
        },
        monthly: {
          games: monthFinished.length,
          revenue: monthlyRevenue,
          payout: monthlyPayout,
          profit: monthlyProfit
        },
        total: {
          games: finishedGames.length,
          revenue: totalRevenue,
          payout: totalPayout,
          profit: totalProfit
        }
      },
      cartelas: {
        total: allCartelas.length,
        winners: allCartelas.filter(c => c.is_winner === 1 || c.is_winner === true).length,
        available: allCartelas.filter(c => !c.user_id && !c.game_id).length,
        assigned: allCartelas.filter(c => c.user_id || c.game_id).length
      }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get admin logs
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, adminId } = req.query;

    // Get all logs from database
    const allLogs = await adminLogs.findAll();

    let filteredLogs = [...allLogs];

    // Filter by action
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    // Filter by admin
    if (adminId) {
      filteredLogs = filteredLogs.filter(log => log.admin_id === adminId);
    }

    // Sort by creation date (newest first)
    filteredLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Get all users for admin information
    const allUsers = await users.findAll();
    const usersMap = {};
    allUsers.forEach(user => {
      usersMap[user.id] = user;
    });

    // Add admin information
    const logsWithAdmins = paginatedLogs.map(log => {
      const admin = usersMap[log.admin_id];
      return {
        ...log,
        admin: admin ? { id: admin.id, username: admin.username, email: admin.email } : null
      };
    });

    res.json({
      logs: logsWithAdmins,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredLogs.length / limit),
        totalItems: filteredLogs.length,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({ error: 'Failed to fetch admin logs' });
  }
});

// Get system health
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Get database counts
    const allUsers = await users.findAll();
    const allGames = await games.findAll();
    const allCartelas = await cartelas.findAll();
    const allLogs = await adminLogs.findAll();

    const health = {
      status: 'healthy',
      uptime: {
        seconds: uptime,
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      database: {
        users: allUsers.length,
        games: allGames.length,
        cartelas: allCartelas.length,
        logs: allLogs.length
      },
      timestamp: new Date().toISOString()
    };

    res.json({ health });
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// Get recent activities
router.get('/activities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Get recent logs from database
    const allLogs = await adminLogs.findAll();
    const recentLogs = allLogs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, parseInt(limit));

    // Get all users for admin information
    const allUsers = await users.findAll();
    const usersMap = {};
    allUsers.forEach(user => {
      usersMap[user.id] = user;
    });

    // Add admin information
    const activitiesWithAdmins = recentLogs.map(log => {
      const admin = usersMap[log.admin_id];
      return {
        ...log,
        admin: admin ? { username: admin.username, email: admin.email } : null
      };
    });

    res.json({ activities: activitiesWithAdmins });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activities' });
  }
});

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // Ensure uploads directory exists
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename but add timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Check if file is PDF
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload PDF file
router.post('/upload-pdf', authenticateToken, requireAdmin, upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      uploadedAt: new Date().toISOString()
    };

    res.json({
      message: 'PDF uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ error: 'Failed to upload PDF file' });
  }
});

// Get list of uploaded PDF files
router.get('/pdf-files', authenticateToken, requireAdmin, (req, res) => {
  try {
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../uploads');

    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(uploadDir)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          uploadedAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ files });
  } catch (error) {
    console.error('Get PDF files error:', error);
    res.status(500).json({ error: 'Failed to retrieve PDF files' });
  }
});

// Process PDF to create cartelas with progress tracking and optional user assignment
router.post('/process-pdf-cartelas-with-progress', authenticateToken, requireAdmin, [
  body('filename').notEmpty().withMessage('Filename is required'),
  body('count').optional().isInt({ min: 1, max: 1000 }).withMessage('Count must be between 1 and 1000'),
  body('startCardId').optional().isInt({ min: 1 }).withMessage('Start card ID must be positive'),
  body('assignToUserId').optional().isString().withMessage('User ID must be a string'),
  body('replaceExisting').optional().isBoolean().withMessage('Replace existing must be boolean')
], async (req, res) => {
  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendProgress({ 
        type: 'error', 
        errors: errors.array() 
      });
      res.end();
      return;
    }

    const { filename, count = 50, startCardId, assignToUserId, replaceExisting = false } = req.body;
    const filePath = path.join(__dirname, '../uploads', filename);

    sendProgress({
      type: 'progress',
      phase: 'starting',
      message: 'Starting PDF processing...'
    });

    // Import PDF extractor
    const { processPDFCartelas, saveCartelasToUserTable } = require('../utils/pdfCartelaExtractor');

    sendProgress({
      type: 'progress',
      phase: 'reading',
      message: 'Reading PDF file...'
    });

    // Process PDF
    const result = await processPDFCartelas(filePath, { 
      count: parseInt(count),
      startCardId: startCardId ? parseInt(startCardId) : null
    });

    if (!result.success) {
      sendProgress({
        type: 'error',
        message: 'Failed to process PDF',
        details: result.message,
        errors: result.errors
      });
      res.end();
      return;
    }

    sendProgress({
      type: 'progress',
      phase: 'extracted',
      message: `Successfully extracted ${result.cartelas.length} cartelas from PDF`,
      extracted: result.cartelas.length
    });

    // Save directly to user_cartelas table (no intermediate step)
    if (!assignToUserId) {
      sendProgress({
        type: 'error',
        message: 'User ID is required for PDF processing. Cartelas will be saved directly to the specified user.'
      });
      res.end();
      return;
    }

    // Find user first
    const user = await users.findById(assignToUserId);
    if (!user) {
      sendProgress({
        type: 'error',
        message: `User with ID ${assignToUserId} not found`
      });
      res.end();
      return;
    }

    sendProgress({
      type: 'progress',
      phase: 'saving',
      message: `Saving cartelas directly to user ${user.username}...`,
      current: 0,
      total: result.cartelas.length,
      progress: 0
    });

    // Check if user already has cartelas assigned
    const existingCartelas = await userCartelas.findByUserId(assignToUserId);
    if (existingCartelas.length > 0 && !replaceExisting) {
      sendProgress({
        type: 'error',
        message: `User ${user.username} already has ${existingCartelas.length} cartelas assigned. Enable "Replace existing" to overwrite.`
      });
      res.end();
      return;
    }

    // If replacing, clear existing cartelas
    if (replaceExisting && existingCartelas.length > 0) {
      await userCartelas.deleteByUserId(assignToUserId);
      sendProgress({
        type: 'progress',
        phase: 'saving',
        message: `Cleared ${existingCartelas.length} existing cartelas for user ${user.username}`,
        progress: 10
      });
    }

    // Save cartelas directly to user_cartelas table
    const saveResult = await saveCartelasToUserTable(result.cartelas, { userCartelas }, assignToUserId, (progressData) => {
      sendProgress({
        type: 'progress',
        ...progressData
      });
    });

    if (!saveResult.success) {
      sendProgress({
        type: 'error',
        message: 'Failed to save cartelas to user',
        details: saveResult.errors.join(', ')
      });
      res.end();
      return;
    }

    const assignmentResult = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      assignedCount: saveResult.savedCount,
      cardRange: `${result.cartelas[0].card_id}-${result.cartelas[saveResult.savedCount - 1].card_id}`,
      replaceExisting
    };

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'PROCESS_PDF_AND_SAVE_TO_USER',
      targetType: 'USER_CARTELA',
      targetId: assignToUserId,
      details: {
        filename,
        extractedCount: result.cartelas.length,
        savedCount: saveResult.savedCount,
        errors: [...result.errors, ...saveResult.errors],
        assignment: assignmentResult
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    sendProgress({
      type: 'success',
      message: `Successfully processed PDF and saved ${saveResult.savedCount} cartelas directly to user ${assignmentResult.user.username}`,
      extracted: result.cartelas.length,
      saved: saveResult.savedCount,
      errors: [...result.errors, ...saveResult.errors],
      cartelas: result.cartelas.slice(0, 5), // Show first 5 as preview
      assignment: assignmentResult
    });

  } catch (error) {
    console.error('Process PDF cartelas with progress error:', error);
    sendProgress({
      type: 'error',
      message: 'Failed to process PDF file',
      details: error.message
    });
  } finally {
    res.end();
  }
});

// Process PDF to create cartelas
router.post('/process-pdf-cartelas', authenticateToken, requireAdmin, [
  body('filename').notEmpty().withMessage('Filename is required'),
  body('count').optional().isInt({ min: 1, max: 1000 }).withMessage('Count must be between 1 and 1000'),
  body('startCardId').optional().isInt({ min: 1 }).withMessage('Start card ID must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { filename, count = 50, startCardId } = req.body;
    const filePath = path.join(__dirname, '../uploads', filename);

    // Import PDF extractor
    const { processPDFCartelas, saveCartelasToDatabase } = require('../utils/pdfCartelaExtractor');

    // Process PDF
    const result = await processPDFCartelas(filePath, { 
      count: parseInt(count),
      startCardId: startCardId ? parseInt(startCardId) : null
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process PDF',
        details: result.message,
        errors: result.errors
      });
    }

    // Save to database
    const saveResult = await saveCartelasToDatabase(result.cartelas, { cartelas });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'PROCESS_PDF_CARTELAS',
      targetType: 'CARTELA',
      targetId: filename,
      details: {
        filename,
        extractedCount: result.cartelas.length,
        savedCount: saveResult.savedCount,
        errors: [...result.errors, ...saveResult.errors]
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: `Successfully processed PDF and saved ${saveResult.savedCount} cartelas`,
      extracted: result.cartelas.length,
      saved: saveResult.savedCount,
      errors: [...result.errors, ...saveResult.errors],
      cartelas: result.cartelas.slice(0, 5) // Show first 5 as preview
    });

  } catch (error) {
    console.error('Process PDF cartelas error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF file', 
      details: error.message 
    });
  }
});

// Assign cartelas from range to user
router.post('/assign-cartelas-to-user', authenticateToken, requireAdmin, [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('startCardId').isInt({ min: 1 }).withMessage('Start card ID must be positive'),
  body('endCardId').isInt({ min: 1 }).withMessage('End card ID must be positive'),
  body('replaceExisting').optional().isBoolean().withMessage('Replace existing must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, startCardId, endCardId, replaceExisting = false } = req.body;

    // Validate range
    if (startCardId >= endCardId) {
      return res.status(400).json({ error: 'End card ID must be greater than start card ID' });
    }

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has cartelas assigned
    const existingCartelas = await userCartelas.findByUserId(userId);
    if (existingCartelas.length > 0 && !replaceExisting) {
      return res.status(400).json({ 
        error: 'User already has cartelas assigned. Set replaceExisting=true to replace them.',
        existingCount: existingCartelas.length,
        existingRange: {
          start: Math.min(...existingCartelas.map(c => parseInt(c.card_id))),
          end: Math.max(...existingCartelas.map(c => parseInt(c.card_id)))
        }
      });
    }

    // If replacing, clear existing cartelas
    if (replaceExisting && existingCartelas.length > 0) {
      await userCartelas.deleteByUserId(userId);
      console.log(`🗑️ Cleared ${existingCartelas.length} existing cartelas for user ${userId}`);
    }

    // Copy cartelas with progress tracking
    console.log(`🔄 Assigning cartelas ${startCardId}-${endCardId} to user ${user.username}`);
    
    const copiedCartelas = await userCartelas.copyFromCartelas(userId, {
      start: startCardId,
      end: endCardId
    });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'ASSIGN_CARTELAS_TO_USER',
      targetType: 'USER',
      targetId: userId,
      details: {
        username: user.username,
        cartelaRange: `${startCardId}-${endCardId}`,
        assignedCount: copiedCartelas.length,
        replaceExisting
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: `Successfully assigned ${copiedCartelas.length} cartelas to user ${user.username}`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      assignedCartelas: {
        range: `${startCardId}-${endCardId}`,
        count: copiedCartelas.length,
        cardIds: copiedCartelas.slice(0, 10).map(c => c.card_id) // Show first 10
      },
      replaceExisting
    });

  } catch (error) {
    console.error('Assign cartelas to user error:', error);
    res.status(500).json({ error: 'Failed to assign cartelas to user' });
  }
});

// Get cartela assignment preview
router.post('/preview-cartela-assignment', authenticateToken, requireAdmin, [
  body('startCardId').isInt({ min: 1 }).withMessage('Start card ID must be positive'),
  body('endCardId').isInt({ min: 1 }).withMessage('End card ID must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startCardId, endCardId } = req.body;

    // Validate range
    if (startCardId >= endCardId) {
      return res.status(400).json({ error: 'End card ID must be greater than start card ID' });
    }

    // Get cartelas in the specified range
    const allCartelas = await cartelas.findAll();
    const availableCartelas = allCartelas.filter(c => {
      const cardNum = parseInt(c.card_id);
      return cardNum >= startCardId && cardNum <= endCardId && c.is_active;
    });

    // Get sample cartelas for preview
    const sampleCartelas = availableCartelas.slice(0, 5).map(cartela => ({
      card_id: cartela.card_id,
      numbers: typeof cartela.numbers === 'string' ? JSON.parse(cartela.numbers) : cartela.numbers
    }));

    res.json({
      range: `${startCardId}-${endCardId}`,
      totalAvailable: availableCartelas.length,
      expectedCount: endCardId - startCardId + 1,
      missingCount: (endCardId - startCardId + 1) - availableCartelas.length,
      sampleCartelas,
      isValid: availableCartelas.length > 0
    });

  } catch (error) {
    console.error('Preview cartela assignment error:', error);
    res.status(500).json({ error: 'Failed to preview cartela assignment' });
  }
});

// Delete PDF file
router.delete('/pdf-files/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads', filename);

    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'PDF file deleted successfully' });
    } else {
      res.status(404).json({ error: 'PDF file not found' });
    }
  } catch (error) {
    console.error('Delete PDF file error:', error);
    res.status(500).json({ error: 'Failed to delete PDF file' });
  }
});

// Export data (admin only)
router.get('/export/:type', authenticateToken, requireAdmin, [
  param('type').isIn(['users', 'games', 'cartelas', 'logs']).withMessage('Invalid export type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type } = req.params;
    let data;

    switch (type) {
      case 'users':
        const allUsers = await users.findAll();
        data = allUsers.map(user => {
          const { password, ...safeUser } = user;
          return safeUser;
        });
        break;
      case 'games':
        data = await games.findAll();
        break;
      case 'cartelas':
        data = await cartelas.findAll();
        break;
      case 'logs':
        data = await adminLogs.findAll();
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({ data, exportedAt: new Date().toISOString(), type, count: data.length });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Create new user with progress tracking (Admin only) - NO CARTELA ASSIGNMENT
router.post('/users/with-progress', authenticateToken, requireAdmin, [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('shopname').optional().isLength({ min: 2 }).withMessage('Shop name must be at least 2 characters'),
  body('userType').optional().isIn(['prepaid', 'postpaid']).withMessage('User type must be prepaid or postpaid'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
  body('balanceLimit').optional().isNumeric().withMessage('Balance limit must be a number'),
  body('voiceCategory').isIn(['boy', 'girl']).withMessage('Voice category must be boy or girl')
], async (req, res) => {
  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendProgress({ 
        type: 'error', 
        errors: errors.array() 
      });
      res.end();
      return;
    }

    const { 
      username, 
      email, 
      password, 
      shopname, 
      role = 'user', 
      userType = 'prepaid', 
      balance,
      voiceCategory
    } = req.body;

    sendProgress({
      type: 'progress',
      phase: 'validation',
      message: 'Validating user data...'
    });

    // Validate prepaid user has balance
    if (userType === 'prepaid' && (balance === undefined || balance === null)) {
      sendProgress({ 
        type: 'error', 
        message: 'Balance is required for prepaid users' 
      });
      res.end();
      return;
    }

    // Postpaid users start with 0 balance (will go negative)
    const initialBalance = userType === 'postpaid' ? 0 : (balance !== undefined ? parseFloat(balance) : 0);

    sendProgress({
      type: 'progress',
      phase: 'checking',
      message: 'Checking for existing users...'
    });

    // Check if user already exists
    const existingUserByEmail = await users.findByEmail(email);
    const existingUserByUsername = await users.findByUsername(username);

    if (existingUserByEmail || existingUserByUsername) {
      sendProgress({ 
        type: 'error', 
        message: 'User already exists with this email or username' 
      });
      res.end();
      return;
    }

    sendProgress({
      type: 'progress',
      phase: 'creating_user',
      message: 'Creating user account...'
    });

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: require('uuid').v4(),
      username,
      email,
      shopname,
      password: hashedPassword,
      role: role,
      userType: userType,
      balance: initialBalance,
      balanceLimit: null,
      totalGamesPlayed: 0,
      totalWinnings: 0,
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await users.create(newUser);

    sendProgress({
      type: 'progress',
      phase: 'setting_voice',
      message: 'Setting voice category...'
    });

    // Set user voice category (no cartela assignment)
    await userSettings.create(newUser.id, { 
      voiceCategory: voiceCategory,
      selectedPattern: 'Two Lines',
      betAmount: 10.0,
      houseCutPercentage: 10.0
    });

    sendProgress({
      type: 'progress',
      phase: 'logging',
      message: 'Creating admin log...'
    });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'CREATE_USER',
      targetType: 'USER',
      targetId: newUser.id,
      details: { 
        username, 
        email, 
        role, 
        shopname, 
        userType, 
        balance: newUser.balance,
        voiceCategory: voiceCategory,
        note: 'User created without cartelas - cartelas to be assigned separately'
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    sendProgress({
      type: 'success',
      message: 'User created successfully! Cartelas can be assigned separately.',
      user: userResponse,
      voiceCategory: voiceCategory,
      note: 'No cartelas assigned - use Assign Cartelas feature to add cartelas'
    });

  } catch (error) {
    console.error('Create user with progress error:', error);
    sendProgress({
      type: 'error',
      message: 'Failed to create user: ' + error.message
    });
  } finally {
    res.end();
  }
});

// Create new user (Admin only) - Original endpoint for backward compatibility
router.post('/users', authenticateToken, requireAdmin, [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('shopname').optional().isLength({ min: 2 }).withMessage('Shop name must be at least 2 characters'),
  body('userType').optional().isIn(['prepaid', 'postpaid']).withMessage('User type must be prepaid or postpaid'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
  body('balanceLimit').optional().isNumeric().withMessage('Balance limit must be a number'),
  body('voiceCategory').isIn(['boy', 'girl']).withMessage('Voice category must be boy or girl')
], async (req, res) => {
  try {
    console.log('🔥 POST /users endpoint called');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      username, 
      email, 
      password, 
      shopname, 
      role = 'user', 
      userType = 'prepaid', 
      balance,
      cartelaRangeStart,
      cartelaRangeEnd,
      voiceCategory
    } = req.body;

    // If cartela range is provided, validate it
    if (cartelaRangeStart !== undefined && cartelaRangeEnd !== undefined) {
      // Manual validation for cartela range
      if (!Number.isInteger(cartelaRangeStart) || cartelaRangeStart < 1) {
        return res.status(400).json({ error: 'Cartela range start must be a positive integer' });
      }
      if (!Number.isInteger(cartelaRangeEnd) || cartelaRangeEnd < 1) {
        return res.status(400).json({ error: 'Cartela range end must be a positive integer' });
      }
      if (cartelaRangeStart >= cartelaRangeEnd) {
        return res.status(400).json({ error: 'Cartela range end must be greater than start' });
      }
    } else if (cartelaRangeStart !== undefined || cartelaRangeEnd !== undefined) {
      // If only one is provided, that's an error
      return res.status(400).json({ error: 'Both cartelaRangeStart and cartelaRangeEnd must be provided together, or both omitted' });
    }

    // Validate prepaid user has balance
    if (userType === 'prepaid' && (balance === undefined || balance === null)) {
      return res.status(400).json({ error: 'Balance is required for prepaid users' });
    }

    // Postpaid users start with 0 balance (will go negative)
    const initialBalance = userType === 'postpaid' ? 0 : (balance !== undefined ? parseFloat(balance) : 0);

    // Check if user already exists
    const existingUserByEmail = await users.findByEmail(email);
    const existingUserByUsername = await users.findByUsername(username);

    if (existingUserByEmail || existingUserByUsername) {
      return res.status(400).json({ error: 'User already exists with this email or username' });
    }

    let availableCartelas = [];
    let willAssignCartelas = false;

    // Only validate and prepare cartelas if range is provided
    if (cartelaRangeStart !== undefined && cartelaRangeEnd !== undefined) {
      console.log(`📋 Cartela range provided: ${cartelaRangeStart}-${cartelaRangeEnd}`);
      willAssignCartelas = true;
      
      // Validate that cartelas exist in the specified range
      const allCartelas = await cartelas.findAll();
      availableCartelas = allCartelas.filter(c => {
        const cardNum = parseInt(c.card_id);
        return cardNum >= cartelaRangeStart && cardNum <= cartelaRangeEnd && c.is_active;
      });

      if (availableCartelas.length === 0) {
        return res.status(400).json({ 
          error: `No cartelas found in range ${cartelaRangeStart}-${cartelaRangeEnd}` 
        });
      }

      console.log(`📋 Found ${availableCartelas.length} cartelas in range ${cartelaRangeStart}-${cartelaRangeEnd} to copy`);
    } else {
      console.log('📋 No cartela range provided - user will be created without cartelas');
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: require('uuid').v4(),
      username,
      email,
      shopname,
      password: hashedPassword,
      role: role,
      userType: userType,
      balance: initialBalance,
      balanceLimit: null, // No balance limit for either type
      totalGamesPlayed: 0,
      totalWinnings: 0,
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await users.create(newUser);

    let copiedCartelas = [];
    
    // Only assign cartelas if range was provided
    if (willAssignCartelas) {
      console.log(`🔗 Copying cartelas from range ${cartelaRangeStart}-${cartelaRangeEnd} to user_cartelas table`);
      copiedCartelas = await userCartelas.copyFromCartelas(newUser.id, {
        start: cartelaRangeStart,
        end: cartelaRangeEnd
      });
    } else {
      console.log('🔗 Skipping cartela assignment - no range provided');
    }

    // Set user voice category
    await userSettings.create(newUser.id, { 
      voiceCategory: voiceCategory,
      selectedPattern: 'Two Lines',
      betAmount: 10.0,
      houseCutPercentage: 10.0
    });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: willAssignCartelas ? 'CREATE_USER_WITH_CARTELAS' : 'CREATE_USER',
      targetType: 'USER',
      targetId: newUser.id,
      details: { 
        username, 
        email, 
        role, 
        shopname, 
        userType, 
        balance: newUser.balance,
        cartelaRange: willAssignCartelas ? `${cartelaRangeStart}-${cartelaRangeEnd}` : 'none',
        copiedCartelas: copiedCartelas.length,
        voiceCategory: voiceCategory
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    const response = {
      message: willAssignCartelas 
        ? `User created successfully with ${copiedCartelas.length} cartelas and voice category`
        : 'User created successfully with voice category (no cartelas assigned)',
      user: userResponse,
      voiceCategory: voiceCategory
    };

    if (willAssignCartelas) {
      response.assignedCartelas = {
        range: `${cartelaRangeStart}-${cartelaRangeEnd}`,
        count: copiedCartelas.length,
        cardIds: copiedCartelas.slice(0, 10).map(c => c.card_id) // Show first 10 only
      };
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('=== ADMIN USERS ENDPOINT CALLED ===');
    console.log('Request user:', req.user ? req.user.username : 'NO USER');
    console.log('Request user role:', req.user ? req.user.role : 'NO ROLE');
    console.log('Request headers:', req.headers.authorization ? 'TOKEN PRESENT' : 'NO TOKEN');

    if (!req.user) {
      console.log('❌ No user attached to request - authentication failed');
      return res.status(401).json({ error: 'Authentication required - no user' });
    }

    console.log('✅ User authenticated successfully in admin endpoint');

    const allUsers = await users.findAll();

    // Get cartela counts for all users in a single query (much faster)
    let cartelaCounts = {};
    try {
      const cartelaCountQuery = `
        SELECT user_id, COUNT(*) as cartela_count 
        FROM user_cartelas 
        WHERE is_active = 1 
        GROUP BY user_id
      `;
      const cartelaCountResults = await all(cartelaCountQuery);
      
      // Convert to a lookup object for fast access
      cartelaCounts = cartelaCountResults.reduce((acc, row) => {
        acc[row.user_id] = parseInt(row.cartela_count) || 0;
        return acc;
      }, {});
      
      console.log(`✅ Retrieved cartela counts for ${cartelaCountResults.length} users with cartelas`);
    } catch (error) {
      console.error('Error getting cartela counts:', error);
      // Continue with empty counts if query fails
    }

    // Add cartela counts to users (no additional queries needed)
    const usersWithCartelas = allUsers.map(user => {
      const { password, ...safeUser } = user;
      return {
        ...safeUser,
        cartelaCount: cartelaCounts[user.id] || 0
      };
    });

    console.log(`✅ Returning ${usersWithCartelas.length} users with cartela counts to admin`);

    res.json({
      success: true,
      total: usersWithCartelas.length,
      users: usersWithCartelas
    });
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (Admin only)
router.put('/users/:userId', authenticateToken, requireAdmin, [
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('shopname').optional().isLength({ min: 2 }).withMessage('Shop name must be at least 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { username, email, shopname, role, is_active } = req.body;

    // Find current user
    const currentUser = await users.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating or changing role of admin users
    if (currentUser.role === 'admin') {
      if (is_active === false) {
        return res.status(403).json({ error: 'Admin users cannot be deactivated' });
      }
      if (role && role !== 'admin') {
        return res.status(403).json({ error: 'Admin role cannot be changed' });
      }
    }

    // Check for duplicate username/email
    if (username || email) {
      const allUsers = await users.findAll();
      const duplicate = allUsers.find(u =>
        u.id !== userId && ((username && u.username === username) || (email && u.email === email))
      );
      if (duplicate) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
    }

    // Update user
    const updateData = {
      ...(username && { username }),
      ...(email && { email }),
      ...(shopname !== undefined && { shopname }),
      ...(role && { role }),
      ...(is_active !== undefined && { is_active }),
      updatedAt: new Date().toISOString()
    };

    await users.update(userId, updateData);

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'UPDATE_USER',
      targetType: 'USER',
      targetId: userId,
      details: updateData,
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Get updated user
    const updatedUser = await users.findById(userId);
    const { password: _, ...userResponse } = updatedUser;

    res.json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user balance (Admin only) - for package management
router.put('/users/:userId/balance', authenticateToken, requireAdmin, [
  body('balance').isNumeric().withMessage('Balance must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { balance } = req.body;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('🔍 User data for balance update:', {
      userId: user.id,
      username: user.username,
      userType: user.userType,
      user_type: user.user_type,
      balance: user.balance
    });

    // Only allow balance updates for prepaid users
    // Check both camelCase and snake_case for compatibility
    const userType = user.userType || user.user_type;
    if (userType !== 'prepaid') {
      return res.status(400).json({ 
        error: 'Balance can only be updated for prepaid users',
        currentUserType: userType
      });
    }

    // Validate balance is not negative
    if (balance < 0) {
      return res.status(400).json({ error: 'Balance cannot be negative for prepaid users' });
    }

    const oldBalance = user.balance;

    // Update balance
    await users.update(userId, {
      balance: parseFloat(balance),
      updatedAt: new Date().toISOString()
    });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'UPDATE_USER_BALANCE',
      targetType: 'USER',
      targetId: userId,
      details: {
        oldBalance: oldBalance,
        newBalance: balance,
        difference: balance - oldBalance
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Get updated user
    const updatedUser = await users.findById(userId);
    const { password: _, ...userResponse } = updatedUser;

    res.json({
      message: 'Balance updated successfully',
      user: userResponse,
      oldBalance: oldBalance,
      newBalance: balance
    });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Delete user with all data (Admin only) - Hard delete
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { hardDelete } = req.query;

    console.log('🔍 Looking for user to delete:', userId);
    
    // Find user before deletion
    const user = await users.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ User found:', { id: user.id, username: user.username, role: user.role });

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin users cannot be deleted' });
    }

    if (hardDelete === 'true') {
      // Hard delete: Remove user and all associated data (CASCADE will handle dependencies)
      // First, get counts for logging
      const allCartelas = await cartelas.findAll();
      const userCartelas = allCartelas.filter(c => c.user_id === userId);
      const allGames = await games.findAll();
      const userGames = allGames.filter(g => g.user_id === userId);

      console.log('🗑️ Starting hard delete process for user:', userId);
      console.log(`   - User cartelas: ${userCartelas.length}`);
      console.log(`   - User games: ${userGames.length}`);

      // Log admin action BEFORE deletion to avoid foreign key constraint issues
      console.log('📝 Creating admin log for user deletion...');
      await adminLogs.create({
        id: uuidv4(),
        adminId: req.user.id,
        action: 'HARD_DELETE_USER',
        targetType: 'USER',
        targetId: userId,
        details: { 
          username: user.username, 
          email: user.email,
          deletedCartelas: userCartelas.length,
          userGames: userGames.length
        },
        ipAddress: req.ip || req.connection.remoteAddress
      });
      console.log('✅ Admin log created successfully');

      // Now delete user (CASCADE will automatically delete cartelas, admin_logs, user_settings, daily_bonuses)
      // Games will have user_id set to NULL (ON DELETE SET NULL)
      console.log('🗑️ Deleting user from database (CASCADE will handle dependencies)...');
      const deleteResult = await run('DELETE FROM users WHERE id = $1', [userId]);
      console.log('✅ User deletion completed:', deleteResult);

      res.json({ 
        message: 'User and all associated data deleted successfully',
        deletedData: {
          cartelas: userCartelas.length,
          userGames: userGames.length,
          note: 'CASCADE automatically deleted cartelas, admin_logs, user_settings, and daily_bonuses'
        }
      });
    } else {
      // Soft delete: Just deactivate the user
      await users.update(userId, { is_active: false });

      // Log admin action
      await adminLogs.create({
        id: require('uuid').v4(),
        adminId: req.user.id,
        action: 'SOFT_DELETE_USER',
        targetType: 'USER',
        targetId: userId,
        details: { username: user.username, email: user.email },
        ipAddress: req.ip || req.connection.remoteAddress
      });

      res.json({ message: 'User deactivated successfully' });
    }
  } catch (error) {
    console.error('❌ Delete user error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
      hardDelete: req.query.hardDelete
    });
    
    // Provide more specific error message
    let errorMessage = 'Failed to delete user';
    if (error.message.includes('foreign key')) {
      errorMessage = 'Cannot delete user due to data dependencies';
    } else if (error.message.includes('not found')) {
      errorMessage = 'User not found';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user password (Admin only)
router.patch('/users/:userId/password', authenticateToken, requireAdmin, [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await users.update(userId, { 
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'UPDATE_USER_PASSWORD',
      targetType: 'USER',
      targetId: userId,
      details: { username: user.username, email: user.email },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Ban/Unban user (Admin only)
router.patch('/users/:userId/ban', authenticateToken, requireAdmin, [
  body('banned').isBoolean().withMessage('Banned status must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { banned } = req.body;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from banning themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot ban your own account' });
    }

    // Prevent banning/deactivating admin users
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin users cannot be deactivated or banned' });
    }

    // Update user status
    await users.update(userId, { 
      is_active: !banned,
      updatedAt: new Date().toISOString()
    });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: banned ? 'BAN_USER' : 'UNBAN_USER',
      targetType: 'USER',
      targetId: userId,
      details: { 
        username: user.username, 
        email: user.email,
        newStatus: banned ? 'banned' : 'active'
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({ 
      message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
      user: {
        id: user.id,
        username: user.username,
        is_active: !banned
      }
    });
  } catch (error) {
    console.error('Ban/unban user error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get all cartelas (Admin only)
router.get('/cartelas', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get all cartelas from database
    const allCartelas = await cartelas.findAll();

    // Format cartelas for display
    const formattedCartelas = allCartelas.map(cartela => ({
      id: cartela.id,
      cardId: cartela.card_id,
      userId: cartela.user_id,
      gameId: cartela.game_id,
      numbers: typeof cartela.numbers === 'string' ? JSON.parse(cartela.numbers) : cartela.numbers,
      pattern: cartela.pattern,
      isActive: cartela.is_active === 1,
      isWinner: cartela.is_winner === 1,
      purchasedAt: cartela.purchased_at,
      // Add some useful computed properties
      isAssigned: !!(cartela.user_id || cartela.game_id),
      status: cartela.is_winner === 1 ? 'Winner' : cartela.user_id ? 'Assigned' : 'Available'
    }));

    res.json({
      success: true,
      total: formattedCartelas.length,
      cartelas: formattedCartelas
    });
  } catch (error) {
    console.error('Error fetching cartelas for admin:', error);
    res.status(500).json({ error: 'Failed to fetch cartelas' });
  }
});

// Get cartela statistics (Admin only)
router.get('/cartelas/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allCartelas = await cartelas.findAll();

    const stats = {
      total: allCartelas.length,
      available: allCartelas.filter(c => !c.user_id && !c.game_id).length,
      assigned: allCartelas.filter(c => c.user_id || c.game_id).length,
      active: allCartelas.filter(c => c.is_active === 1).length,
      inactive: allCartelas.filter(c => c.is_active === 0).length,
      winners: allCartelas.filter(c => c.is_winner === 1).length
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching cartela stats:', error);
    res.status(500).json({ error: 'Failed to fetch cartela statistics' });
  }
});

// Helper function to get Monday of the current week
const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};


// Get user statistics (Admin only)
router.get('/user-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('=== USER STATS ENDPOINT CALLED ===');

    // Calculate date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log(`Today: ${today.toISOString()}, Week start: ${thisWeek.toISOString()}`);

    // Query database directly for accurate statistics (matching dashboard logic)
    // Dashboard calculates profit as: bet_money - win_money
    const statsQuery = `
      SELECT
        u.id as user_id,
        u.username,
        u.is_active,
        u.user_type,
        u.balance,
        u.balance_limit,
        -- Daily stats (today)
        COUNT(DISTINCT CASE 
          WHEN g.created_at >= $1 AND g.created_at < $2 AND g.user_id = u.id AND g.status IN ('started', 'finished')
          THEN g.id 
        END) as daily_games,
        COALESCE(SUM(CASE 
          WHEN g.created_at >= $1 AND g.created_at < $2 AND g.user_id = u.id AND g.status IN ('started', 'finished')
          THEN g.bet_money - COALESCE(g.win_money, 0)
          ELSE 0 
        END), 0) as daily_house_profit,
        -- Weekly stats (last 7 days)
        COUNT(DISTINCT CASE 
          WHEN g.created_at >= $3 AND g.user_id = u.id AND g.status IN ('started', 'finished')
          THEN g.id 
        END) as weekly_games,
        COALESCE(SUM(CASE 
          WHEN g.created_at >= $3 AND g.user_id = u.id AND g.status IN ('started', 'finished')
          THEN g.bet_money - COALESCE(g.win_money, 0)
          ELSE 0 
        END), 0) as weekly_profit
      FROM users u
      LEFT JOIN games g ON u.id = g.user_id
      GROUP BY u.id, u.username, u.is_active, u.user_type, u.balance, u.balance_limit
      ORDER BY weekly_profit DESC, u.username ASC
    `;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Executing stats query...');
    const statsResults = await db.all(statsQuery, [
      today.toISOString(),
      tomorrow.toISOString(),
      thisWeek.toISOString()
    ]);

    console.log(`Query returned ${statsResults.length} users`);

    // Check bonus usage for all users
    const todayStr = today.toISOString().split('T')[0];
    const bonusCheckQuery = `
      SELECT user_id, bonus_used, daily_profit
      FROM daily_bonuses
      WHERE bonus_date = $1
    `;
    const bonusRecords = await db.all(bonusCheckQuery, [todayStr]);
    const bonusMap = new Map(bonusRecords.map(b => [b.user_id, b]));

    // Format results
    const stats = statsResults.map(row => {
      const weeklyProfit = Math.round(parseFloat(row.weekly_profit || 0));
      let dailyHouseProfit = Math.round(parseFloat(row.daily_house_profit || 0));
      
      // Check if user has used their bonus today
      const bonusRecord = bonusMap.get(row.user_id);
      const bonusUsed = bonusRecord?.bonus_used || false;
      
      // If bonus was used, the daily_bonuses table has the adjusted profit (with 200 deducted)
      // Use that value instead of the raw calculation
      if (bonusUsed && bonusRecord) {
        dailyHouseProfit = Math.round(parseFloat(bonusRecord.daily_profit || 0));
      }
      
      // Simple house bonus logic: 200 if DAILY house profit >= 1000, otherwise 0
      // But if already used, show 0
      const houseBonus = bonusUsed ? 0 : (dailyHouseProfit >= 1000 ? 200 : 0);

      // Debug logging for Alemu
      if (row.username.toLowerCase() === 'alemu') {
        console.log('\n🔍 ALEMU DATA FROM DATABASE:');
        console.log(`   User ID: ${row.user_id}`);
        console.log(`   Daily Games: ${row.daily_games}`);
        console.log(`   Daily House Profit: ${dailyHouseProfit}`);
        console.log(`   Bonus Used: ${bonusUsed}`);
        console.log(`   Weekly Games: ${row.weekly_games}`);
        console.log(`   Weekly Profit: ${weeklyProfit}`);
        console.log(`   House Bonus: ${houseBonus}`);
      }

      return {
        userId: row.user_id,
        username: row.username,
        userType: row.user_type,
        balance: parseFloat(row.balance || 0),
        balanceLimit: row.balance_limit ? parseFloat(row.balance_limit) : null,
        dailyGames: parseInt(row.weekly_games || 0), // Sholance_limit) : null,
        dailyGames: parseInt(row.weekly_games || 0), // Show weekly games in the table
        dailyHouseProfit: dailyHouseProfit, // Today's profit (adjusted if bonus used)
        weeklyProfit: weeklyProfit, // Last 7 days profit
        houseBonus: houseBonus,
        isActive: row.is_active,
        date: new Date().toISOString()
      };
    });

    console.log(`✅ Returning statistics for ${stats.length} users`);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get daily statistics for a specific user (Admin only)
router.get('/user-daily-stats/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { days, startDate, endDate } = req.query;
    
    let fromDate, toDate;
    
    if (startDate && endDate) {
      // Custom date range
      fromDate = new Date(startDate);
      toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999); // Include the entire end date
      console.log(`=== FETCHING DAILY STATS FOR USER: ${userId} (${startDate} to ${endDate}) ===`);
    } else {
      // Days-based range
      const daysCount = parseInt(days || '30');
      toDate = new Date();
      fromDate = new Date();
      fromDate.setDate(toDate.getDate() - daysCount);
      console.log(`=== FETCHING DAILY STATS FOR USER: ${userId} (${daysCount} days) ===`);
    }

    const dailyStatsQuery = `
      SELECT
        DATE(g.created_at) as date,
        COUNT(g.id) as games,
        COALESCE(SUM(g.bet_money), 0) as total_bet,
        COALESCE(SUM(g.win_money), 0) as total_win,
        COALESCE(SUM(g.bet_money - COALESCE(g.win_money, 0)), 0) as house_profit
      FROM games g
      WHERE g.user_id = $1 
        AND g.created_at >= $2 
        AND g.created_at <= $3
        AND g.status IN ('started', 'finished')
      GROUP BY DATE(g.created_at)
      ORDER BY DATE(g.created_at) DESC
    `;

    const dailyStats = await db.all(dailyStatsQuery, [
      userId, 
      fromDate.toISOString(), 
      toDate.toISOString()
    ]);

    const formattedStats = dailyStats.map(stat => ({
      date: new Date(stat.date).toLocaleDateString(),
      games: parseInt(stat.games || 0),
      totalBet: parseFloat(stat.total_bet || 0),
      totalWin: parseFloat(stat.total_win || 0),
      houseProfit: parseFloat(stat.house_profit || 0)
    }));

    console.log(`✅ Returning ${formattedStats.length} days of data`);

    res.json({
      success: true,
      dailyStats: formattedStats,
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error fetching user daily stats:', error);
    res.status(500).json({ error: 'Failed to fetch user daily statistics' });
  }
});

// Assign cartelas to user (Admin only)
router.post('/users/:userId/assign-cartelas', authenticateToken, requireAdmin, [
  body('cartelaIds').isArray().withMessage('Cartela IDs must be an array'),
  body('cartelaIds.*').isString().withMessage('Each cartela ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { cartelaIds } = req.body;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate cartelas exist and are available
    const allCartelas = await cartelas.findAll();
    const targetCartelas = allCartelas.filter(c => cartelaIds.includes(c.id));
    
    if (targetCartelas.length !== cartelaIds.length) {
      return res.status(400).json({ error: 'Some cartelas not found' });
    }

    // Check if any cartelas are already assigned
    const alreadyAssigned = targetCartelas.filter(c => c.user_id || c.game_id);
    if (alreadyAssigned.length > 0) {
      return res.status(400).json({ 
        error: 'Some cartelas are already assigned',
        assignedCartelas: alreadyAssigned.map(c => c.card_id)
      });
    }

    // Assign cartelas to user
    const assignedCount = await Promise.all(
      cartelaIds.map(cartelaId => 
        cartelas.update(cartelaId, { user_id: userId })
      )
    );

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'ASSIGN_CARTELAS',
      targetType: 'USER',
      targetId: userId,
      details: {
        username: user.username,
        cartelaIds: cartelaIds,
        cartelaCount: cartelaIds.length
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: `Successfully assigned ${cartelaIds.length} cartelas to user ${user.username}`,
      assignedCartelas: cartelaIds,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Assign cartelas error:', error);
    res.status(500).json({ error: 'Failed to assign cartelas' });
  }
});

// Remove cartelas from user (Admin only)
router.post('/users/:userId/remove-cartelas', authenticateToken, requireAdmin, [
  body('cartelaIds').isArray().withMessage('Cartela IDs must be an array'),
  body('cartelaIds.*').isString().withMessage('Each cartela ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { cartelaIds } = req.body;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate cartelas exist and are assigned to this user
    const allCartelas = await cartelas.findAll();
    const targetCartelas = allCartelas.filter(c => 
      cartelaIds.includes(c.id) && c.user_id === userId
    );
    
    if (targetCartelas.length !== cartelaIds.length) {
      return res.status(400).json({ 
        error: 'Some cartelas not found or not assigned to this user' 
      });
    }

    // Remove cartelas from user (set user_id to null)
    await Promise.all(
      cartelaIds.map(cartelaId => 
        cartelas.update(cartelaId, { user_id: null })
      )
    );

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'REMOVE_CARTELAS',
      targetType: 'USER',
      targetId: userId,
      details: {
        username: user.username,
        cartelaIds: cartelaIds,
        cartelaCount: cartelaIds.length
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: `Successfully removed ${cartelaIds.length} cartelas from user ${user.username}`,
      removedCartelas: cartelaIds,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Remove cartelas error:', error);
    res.status(500).json({ error: 'Failed to remove cartelas' });
  }
});

// Delete ALL assigned cartelas from user (Admin only)
router.delete('/users/:userId/cartelas', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all user's assigned cartelas from user_cartelas table
    const assignedCartelas = await userCartelas.findByUserId(userId);
    
    if (assignedCartelas.length === 0) {
      return res.status(400).json({ 
        error: 'User has no assigned cartelas to delete' 
      });
    }

    // Delete all cartelas from user_cartelas table
    await userCartelas.deleteByUserId(userId);

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'DELETE_ALL_USER_CARTELAS',
      targetType: 'USER',
      targetId: userId,
      details: {
        username: user.username,
        deletedCartelaCount: assignedCartelas.length,
        cartelaRange: assignedCartelas.length > 0 ? {
          start: Math.min(...assignedCartelas.map(c => parseInt(c.card_id))),
          end: Math.max(...assignedCartelas.map(c => parseInt(c.card_id)))
        } : null
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: `Successfully deleted all ${assignedCartelas.length} assigned cartelas from user ${user.username}`,
      deletedCount: assignedCartelas.length,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Delete all user cartelas error:', error);
    res.status(500).json({ error: 'Failed to delete user cartelas' });
  }
});

// Get user's assigned cartelas (Admin only)
router.get('/users/:userId/cartelas', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's assigned cartelas from user_cartelas table
    const assignedCartelas = await userCartelas.findByUserId(userId);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        shopname: user.shopname
      },
      cartelas: assignedCartelas.map(cartela => ({
        id: cartela.id,
        card_id: cartela.card_id,
        numbers: cartela.numbers,
        is_active: cartela.is_active,
        is_winner: cartela.is_winner,
        created_at: cartela.created_at
      })),
      total: assignedCartelas.length,
      range: assignedCartelas.length > 0 ? {
        start: Math.min(...assignedCartelas.map(c => parseInt(c.card_id))),
        end: Math.max(...assignedCartelas.map(c => parseInt(c.card_id)))
      } : null
    });
  } catch (error) {
    console.error('Get user cartelas error:', error);
    res.status(500).json({ error: 'Failed to fetch user cartelas' });
  }
});

// Set user voice category (Admin only)
router.put('/users/:userId/voice-category', authenticateToken, requireAdmin, [
  body('voiceCategory').isIn(['boy', 'girl']).withMessage('Voice category must be "boy" or "girl"')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { voiceCategory } = req.body;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user settings with voice category
    await userSettings.create(userId, { voiceCategory });

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'SET_VOICE_CATEGORY',
      targetType: 'USER',
      targetId: userId,
      details: {
        username: user.username,
        voiceCategory: voiceCategory
      },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: `Voice category set to "${voiceCategory}" for user ${user.username}`,
      user: {
        id: user.id,
        username: user.username
      },
      voiceCategory: voiceCategory
    });
  } catch (error) {
    console.error('Set voice category error:', error);
    res.status(500).json({ error: 'Failed to set voice category' });
  }
});

// Get user settings including voice category (Admin only)
router.get('/users/:userId/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user settings
    const settings = await userSettings.findByUserId(userId);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      },
      settings: settings || {
        selectedPattern: 'Two Lines',
        betAmount: 10.0,
        houseCutPercentage: 10.0,
        voiceCategory: null
      }
    });
  } catch (error) {
    console.error('Get user settings error:', error);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

// Get available cartelas for assignment (Admin only)
router.get('/cartelas/available', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get available cartelas (not assigned to any user or game)
    const allCartelas = await cartelas.findAll();
    const availableCartelas = allCartelas
      .filter(cartela => !cartela.user_id && !cartela.game_id && cartela.is_active)
      .slice(0, parseInt(limit))
      .map(cartela => ({
        id: cartela.id,
        card_id: cartela.card_id,
        numbers: typeof cartela.numbers === 'string' ? JSON.parse(cartela.numbers) : cartela.numbers,
        is_active: cartela.is_active,
        purchased_at: cartela.purchased_at
      }));

    res.json({
      success: true,
      cartelas: availableCartelas,
      total: availableCartelas.length,
      totalAvailable: allCartelas.filter(c => !c.user_id && !c.game_id && c.is_active).length
    });
  } catch (error) {
    console.error('Get available cartelas error:', error);
    res.status(500).json({ error: 'Failed to fetch available cartelas' });
  }
});

module.exports = router;
