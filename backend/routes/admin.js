const express = require('express');
const { param, validationResult, body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
// Re-export operations for consistency
const { users, games, cartelas, adminLogs, get, all, run } = require('../db');
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

// Process PDF to create cartelas - DISABLED (missing create-cartela-from-pdf.js)
// router.post('/process-pdf-cartelas', requireAdmin, [
//   param('filename').notEmpty().withMessage('Filename is required')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }
//
//     const { filename } = req.body;
//
//     // Temporarily modify the PDF path in the script
//     const originalPdfPath = path.join(__dirname, '../create-cartela-from-pdf.js');
//     let scriptContent = require('fs').readFileSync(originalPdfPath, 'utf8');
//
//     // Replace the hardcoded PDF filename with the requested one
//     const originalPath = "Bingo Cards (2)-1-169_compressed.pdf";
//     scriptContent = scriptContent.replace(originalPath, filename);
//
//     // Write modified script to temp file
//     const tempScriptPath = path.join(__dirname, '../create-cartela-from-pdf-temp.js');
//     require('fs').writeFileSync(tempScriptPath, scriptContent);
//
//     // Import and run the modified script
//     const { createCartelaListFromPDF: processPDF } = require(tempScriptPath);
//
//     const result = await processPDF();
//
//     // Clean up temp file
//     require('fs').unlinkSync(tempScriptPath);
//
//     if (result.success) {
//       res.json({
//         message: 'Cartelas created successfully from PDF',
//         ...result
//       });
//     } else {
//       res.status(400).json({
//         error: 'Failed to process PDF',
//         details: result.message
//       });
//     }
//   } catch (error) {
//     console.error('Process PDF cartelas error:', error);
//     res.status(500).json({ error: 'Failed to process PDF file', details: error.message });
//   }
// });

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

// Create new user (Admin only)
router.post('/users', authenticateToken, requireAdmin, [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('shopname').optional().isLength({ min: 2 }).withMessage('Shop name must be at least 2 characters'),
  body('userType').optional().isIn(['prepaid', 'postpaid']).withMessage('User type must be prepaid or postpaid'),
  body('balanceLimit').optional().isNumeric().withMessage('Balance limit must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, shopname, role = 'user', userType = 'prepaid', balanceLimit } = req.body;

    // Check if user already exists
    const existingUserByEmail = await users.findByEmail(email);
    const existingUserByUsername = await users.findByUsername(username);

    if (existingUserByEmail || existingUserByUsername) {
      return res.status(400).json({ error: 'User already exists with this email or username' });
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
      userType,
      balance: 0,
      balanceLimit: balanceLimit ? parseFloat(balanceLimit) : null,
      totalGamesPlayed: 0,
      totalWinnings: 0,
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await users.create(newUser);

    // Log admin action
    await adminLogs.create({
      id: require('uuid').v4(),
      adminId: req.user.id,
      action: 'CREATE_USER',
      targetType: 'USER',
      targetId: newUser.id,
      details: { username, email, role, shopname, userType, balanceLimit },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
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

    // Remove passwords from response
    const safeUsers = allUsers.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    console.log(`✅ Returning ${safeUsers.length} users to admin`);

    res.json({
      success: true,
      total: safeUsers.length,
      users: safeUsers
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

// Get weekly report data (admin only)
router.get('/weekly-report', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('=== WEEKLY REPORT ENDPOINT CALLED ===');

    const { period = 'week' } = req.query; // 'week' or '15days'

    // Calculate date ranges
    const now = new Date();
    let startDate, endDate;

    if (period === '15days') {
      // Last 15 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 15);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Current week (Monday to Sunday)
      startDate = getMondayOfWeek(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // Sunday
      endDate.setHours(23, 59, 59, 999);
    }

    console.log(`Period: ${period}`);
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get all users with period statistics
    // Now using direct user_id link in games table (added via migration)
    const usersQuery = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.created_at,
        COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.bet_money * g.cartelas_selected ELSE 0 END), 0) as period_total_bet,
        COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.win_money ELSE 0 END), 0) as period_player_win,
        COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.bet_money * g.cartelas_selected * (COALESCE(g.house_cut_percentage, 10.0) / 100.0) ELSE 0 END), 0) as period_house_profit,
        COUNT(DISTINCT CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.id END) as period_games_played,
        COALESCE(SUM(CASE WHEN g.created_at >= $1 AND g.created_at <= $2 AND g.user_id = u.id THEN g.cartelas_selected ELSE 0 END), 0) as period_cartelas_played
      FROM users u
      LEFT JOIN games g ON u.id = g.user_id AND g.status = 'finished'
      WHERE u.role != 'admin'
      GROUP BY u.id, u.username, u.email, u.created_at
      ORDER BY period_total_bet DESC, u.username ASC
    `;

    console.log('Executing users query...');
    const users = await db.all(usersQuery, [startDate.toISOString(), endDate.toISOString()]);
    console.log(`Query returned ${users.length} users`);

    // Calculate overall statistics
    let totalBetPeriod = 0;
    let totalPlayerWinPeriod = 0;
    let totalHouseProfitPeriod = 0;
    let totalGamesPeriod = 0;
    let activeUsersPeriod = 0;

    const usersData = users.map(user => {
      const totalBet = parseFloat(user.period_total_bet || 0);
      const playerWin = parseFloat(user.period_player_win || 0);
      const houseProfit = parseFloat(user.period_house_profit || 0);
      const gamesPlayed = parseInt(user.period_games_played || 0);

      // Count active users (those who played at least one game)
      if (gamesPlayed > 0) {
        activeUsersPeriod++;
      }

      // Accumulate totals
      totalBetPeriod += totalBet;
      totalPlayerWinPeriod += playerWin;
      totalHouseProfitPeriod += houseProfit;
      totalGamesPeriod += gamesPlayed;

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        shopname: null, // shopname not in schema
        periodTotalBet: totalBet,
        periodPlayerWin: playerWin,
        periodHouseProfit: houseProfit,
        periodGamesPlayed: gamesPlayed,
        periodCartelasPlayed: parseInt(user.period_cartelas_played || 0)
      };
    });

    console.log('Preparing response...');

    res.json({
      users: usersData,
      summary: {
        totalUsers: users.length,
        activeUsersPeriod,
        totalBetPeriod,
        totalPlayerWinPeriod,
        totalHouseProfitPeriod,
        totalGamesPeriod,
        period,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reportGeneratedAt: new Date().toISOString()
      }
    });

    console.log('Response sent successfully');
  } catch (error) {
    console.error('Get weekly report error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch weekly report data', details: error.message });
  }
});

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
      GROUP BY u.id, u.username, u.is_active
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

    // Format results
    const stats = statsResults.map(row => {
      const weeklyProfit = Math.round(parseFloat(row.weekly_profit || 0));
      const dailyHouseProfit = Math.round(parseFloat(row.daily_house_profit || 0));
      const houseBonus = 200; // Fixed house bonus for all users

      // Debug logging for Alemu
      if (row.username.toLowerCase() === 'alemu') {
        console.log('\n🔍 ALEMU DATA FROM DATABASE:');
        console.log(`   User ID: ${row.user_id}`);
        console.log(`   Daily Games: ${row.daily_games}`);
        console.log(`   Daily House Profit: ${dailyHouseProfit}`);
        console.log(`   Weekly Games: ${row.weekly_games}`);
        console.log(`   Weekly Profit: ${weeklyProfit}`);
        console.log(`   House Bonus: ${houseBonus}`);
      }

      return {
        userId: row.user_id,
        username: row.username,
        dailyGames: parseInt(row.weekly_games || 0), // Show weekly games in the table
        dailyHouseProfit: dailyHouseProfit, // Today's profit (will be 0 if no games today)
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
    console.log(`=== FETCHING DAILY STATS FOR USER: ${userId} ===`);

    // Get daily statistics for the user (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
        AND g.status IN ('started', 'finished')
      GROUP BY DATE(g.created_at)
      ORDER BY DATE(g.created_at) DESC
    `;

    const dailyStats = await db.all(dailyStatsQuery, [userId, thirtyDaysAgo.toISOString()]);

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
      dailyStats: formattedStats
    });
  } catch (error) {
    console.error('Error fetching user daily stats:', error);
    res.status(500).json({ error: 'Failed to fetch user daily statistics' });
  }
});

module.exports = router;
