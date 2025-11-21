const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { users, adminLogs, cartelas } = require('../data/database.js');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper functions for database operations
const findAllUsers = async () => {
  try {
    return await users.findAll();
  } catch (error) {
    console.error('Error finding all users:', error);
    return [];
  }
};

const findUserById = async (id) => {
  try {
    return await users.findById(id);
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
};

const findUserByEmail = async (email) => {
  try {
    return await users.findByEmail(email);
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
};

const findUserByUsername = async (username) => {
  try {
    return await users.findByUsername(username);
  } catch (error) {
    console.error('Error finding user by username:', error);
    return null;
  }
};

const updateUserById = async (id, updateData) => {
  try {
    return await users.update(id, updateData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

const createUser = async (userData) => {
  try {
    return await users.create(userData);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

const createAdminLog = async (logData) => {
  try {
    return await adminLogs.create(logData);
  } catch (error) {
    console.error('Error creating admin log:', error);
    return null;
  }
};

const findAllCartelas = async () => {
  try {
    return await cartelas.findAll();
  } catch (error) {
    console.error('Error finding all cartelas:', error);
    return [];
  }
};

// Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status } = req.query;

    // Get all users from database
    const allUsers = await findAllUsers();

    let filteredUsers = allUsers;

    // Filter by role
    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }

    // Filter by status
    if (status === 'active') {
      filteredUsers = filteredUsers.filter(u => u.is_active === true || u.is_active === 1);
    } else if (status === 'inactive') {
      filteredUsers = filteredUsers.filter(u => u.is_active === false || u.is_active === 0);
    }

    // Sort by creation date (newest first)
    filteredUsers.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Get cartela counts for each user
    const allCartelasData = await findAllCartelas();

    // Remove passwords and add cartela counts
    const safeUsers = paginatedUsers.map((user) => {
      const { password, ...safeUser } = user;
      const userCartelas = allCartelasData.filter(c => c.user_id === user.id);
      const activeCartelas = userCartelas.filter(c => c.is_active === true || c.is_active === 1);

      return {
        ...safeUser,
        cartelaCount: userCartelas.length,
        activeCartelaCount: activeCartelas.length,
        // Ensure consistent boolean for is_active
        is_active: Boolean(safeUser.is_active)
      };
    });

    res.json({
      users: safeUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredUsers.length / limit),
        totalItems: filteredUsers.length,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID (admin only)
router.get('/:id', requireAdmin, [
  param('id').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    const { password, ...safeUser } = user;
    // Ensure consistent boolean for is_active
    safeUser.is_active = Boolean(safeUser.is_active);
    
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (admin only)
router.post('/', requireAdmin, [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'user']).withMessage('Invalid role'),
  body('balance_type').optional().isIn(['limited', 'unlimited']).withMessage('Invalid balance type'),
  body('balance').optional().isFloat({ min: 0 }).withMessage('Balance must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role, balance_type = 'limited', balance = 0 } = req.body;

    // Check if user already exists
    const existingUserByEmail = await findUserByEmail(email);
    const existingUserByUsername = await findUserByUsername(username);
    if (existingUserByEmail || existingUserByUsername) {
      return res.status(400).json({ error: 'User already exists with this email or username' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      role,
      balance_type,
      balance: parseFloat(balance),
      totalGamesPlayed: 0,
      totalWinnings: 0,
      is_active: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await createUser(newUser);

    // Log admin action
    await createAdminLog({
      id: uuidv4(),
      adminId: req.user.id,
      action: 'CREATE_USER',
      targetType: 'USER',
      targetId: newUser.id,
      details: { username, email, role },
      ipAddress: req.ip || req.connection.remoteAddress,
      createdAt: new Date().toISOString()
    });

    // Remove password from response and convert is_active to boolean for response
    const { password: _, ...userResponse } = newUser;
    userResponse.is_active = Boolean(userResponse.is_active);

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/:id', requireAdmin, [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('role').optional().isIn(['admin', 'user']).withMessage('Invalid role'),
  body('balance_type').optional().isIn(['limited', 'unlimited']).withMessage('Invalid balance type'),
  body('balance').optional().isFloat({ min: 0 }).withMessage('Balance must be non-negative'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { username, email, role, balance_type, balance, isActive } = req.body;

    // Find current user
    const currentUser = await findUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for duplicate username/email
    if (username || email) {
      const allUsers = await findAllUsers();
      const duplicate = allUsers.find(u =>
        u.id !== userId && ((username && u.username === username) || (email && u.email === email))
      );
      if (duplicate) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
    }

    // Update user
    const originalUser = { ...currentUser };
    const updateData = {
      ...(username !== undefined && { username }),
      ...(email !== undefined && { email }),
      ...(role !== undefined && { role }),
      ...(balance_type !== undefined && { balance_type }),
      ...(balance !== undefined && { balance: parseFloat(balance) }),
      ...(isActive !== undefined && { is_active: isActive ? 1 : 0 }),
      updatedAt: new Date().toISOString()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    await updateUserById(userId, updateData);

    // Log admin action
    await createAdminLog({
      id: uuidv4(),
      adminId: req.user.id,
      action: 'UPDATE_USER',
      targetType: 'USER',
      targetId: userId,
      details: { 
        changes: { username, email, role, balance_type, balance, isActive },
        originalUser: { 
          username: originalUser.username, 
          email: originalUser.email, 
          role: originalUser.role,
          balance_type: originalUser.balance_type,
          balance: originalUser.balance,
          isActive: Boolean(originalUser.is_active)
        }
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      createdAt: new Date().toISOString()
    });

    // Get updated user data
    const updatedUser = await findUserById(userId);
    const { password: _, ...userResponse } = updatedUser;
    userResponse.is_active = Boolean(userResponse.is_active);
    
    res.json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only) - Soft delete implementation
router.delete('/:id', requireAdmin, [
  param('id').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;

    // Find user first
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const allUsers = await findAllUsers();
      const adminCount = allUsers.filter(u => u.role === 'admin' && (u.is_active === true || u.is_active === 1)).length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    // Soft delete by setting is_active to false
    await updateUserById(userId, { 
      is_active: 0, 
      updatedAt: new Date().toISOString() 
    });

    // Log admin action
    await createAdminLog({
      id: uuidv4(),
      adminId: req.user.id,
      action: 'DELETE_USER',
      targetType: 'USER',
      targetId: userId,
      details: { 
        username: user.username, 
        email: user.email, 
        role: user.role,
        type: 'soft_delete'
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      createdAt: new Date().toISOString()
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user balance (admin only)
router.put('/:id/balance', requireAdmin, [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('amount').isFloat().withMessage('Amount must be a number'),
  body('operation').isIn(['add', 'subtract', 'set']).withMessage('Operation must be add, subtract, or set')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { amount, operation } = req.body;

    // Find user first
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const originalBalance = parseFloat(user.balance) || 0;
    const operationAmount = parseFloat(amount);
    let newBalance;

    switch (operation) {
      case 'add':
        newBalance = originalBalance + operationAmount;
        break;
      case 'subtract':
        newBalance = Math.max(0, originalBalance - operationAmount);
        break;
      case 'set':
        newBalance = Math.max(0, operationAmount);
        break;
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }

    // Update user balance
    await updateUserById(userId, {
      balance: newBalance,
      updatedAt: new Date().toISOString()
    });

    // Log admin action
    await createAdminLog({
      id: uuidv4(),
      adminId: req.user.id,
      action: 'UPDATE_BALANCE',
      targetType: 'USER',
      targetId: userId,
      details: {
        operation,
        amount: operationAmount,
        originalBalance,
        newBalance,
        username: user.username
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      createdAt: new Date().toISOString()
    });

    // Get updated user data
    const updatedUser = await findUserById(userId);
    const { password: _, ...userResponse } = updatedUser;
    userResponse.is_active = Boolean(userResponse.is_active);

    res.json({
      message: 'Balance updated successfully',
      user: userResponse,
      balanceChange: {
        operation,
        amount: operationAmount,
        originalBalance,
        newBalance
      }
    });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Update user status (admin only)
router.patch('/:id/status', requireAdmin, [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('is_active').isBoolean().withMessage('is_active must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { is_active } = req.body;

    // Find current user
    const currentUser = await findUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating the last admin
    if (currentUser.role === 'admin' && !is_active) {
      const allUsers = await findAllUsers();
      const activeAdmins = allUsers.filter(u => u.role === 'admin' && (u.is_active === true || u.is_active === 1));
      if (activeAdmins.length <= 1) {
        return res.status(400).json({ error: 'Cannot deactivate the last active admin user' });
      }
    }

    // Update user status
    await updateUserById(userId, {
      is_active: is_active ? 1 : 0,
      updatedAt: new Date().toISOString()
    });

    // Log admin action
    await createAdminLog({
      id: uuidv4(),
      adminId: req.user.id,
      action: 'UPDATE_USER_STATUS',
      targetType: 'USER',
      targetId: userId,
      details: {
        newStatus: is_active ? 'active' : 'inactive',
        username: currentUser.username,
        role: currentUser.role
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      createdAt: new Date().toISOString()
    });

    // Get updated user data
    const updatedUser = await findUserById(userId);
    const { password: _, ...userResponse } = updatedUser;
    userResponse.is_active = Boolean(userResponse.is_active);

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: userResponse
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get user statistics
router.get('/:id/stats', requireAdmin, [
  param('id').isUUID().withMessage('Invalid user ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;

    // Find user first
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's cartelas and games
    const allCartelasData = await findAllCartelas();
    const userCartelas = allCartelasData.filter(c => c.user_id === userId);
    const winningCartelas = userCartelas.filter(c => c.isWinner === true || c.isWinner === 1);

    const stats = {
      totalGamesPlayed: user.totalGamesPlayed || 0,
      totalWinnings: parseFloat(user.totalWinnings) || 0,
      currentBalance: parseFloat(user.balance) || 0,
      totalCartelas: userCartelas.length,
      winningCartelas: winningCartelas.length,
      winRate: userCartelas.length > 0 ? (winningCartelas.length / userCartelas.length * 100).toFixed(2) : 0,
      accountAge: Math.floor((new Date() - new Date(user.createdAt || user.created_at)) / (1000 * 60 * 60 * 24)), // days
      lastActivity: user.updatedAt || user.updated_at
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

module.exports = router;
