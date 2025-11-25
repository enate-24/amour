const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { users, adminLogs } = require('../data/database.js');

const router = express.Router();

// Helper function to create admin log
const createAdminLog = async (logData) => {
  try {
    await adminLogs.create(logData);
    return logData;
  } catch (error) {
    console.error('Error creating admin log:', error);
    return null;
  }
};



// Register new user
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'user']).withMessage('Invalid role'),
  body('balance_type').optional().isIn(['limited', 'unlimited']).withMessage('Invalid balance type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role = 'user', balance_type = 'limited' } = req.body;

    // Check if user already exists
    const existingUser = await users.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      role,
      balance_type,
      balance: 0,
      totalGamesPlayed: 0,
      totalWinnings: 0,
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await users.create(userData);

    // Generate JWT token
    const tokenOptions = { id: userData.id, email: userData.email, role: userData.role, balance_type: userData.balance_type };
    const signOptions = process.env.JWT_EXPIRES_IN ? { expiresIn: process.env.JWT_EXPIRES_IN } : {};
    const token = jwt.sign(tokenOptions, process.env.JWT_SECRET, signOptions);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        balance_type: userData.balance_type,
        balance: userData.balance,
        totalGamesPlayed: userData.totalGamesPlayed,
        totalWinnings: userData.totalWinnings,
        is_active: userData.is_active
      },
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if password is provided
    if (!password) {
      return res.status(400).json({
        error: 'Password is required'
      });
    }

    // Check if either username or email is provided
    if (!username && !email) {
      return res.status(400).json({
        error: 'Username or email is required'
      });
    }

    let user = null;

    // If email is provided, check if it's a valid email format (for admin login)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email)) {
        // Try to find user by email (admin login)
        user = await users.findByEmail(email);
      }
    }

    // If no user found by email, try username (regular user login)
    if (!user && username) {
      user = await users.findByUsername(username);
    }

    // If still no user found, return error
    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Generate JWT token
    const tokenOptions = { id: user.id, email: user.email, role: user.role, balance_type: user.balance_type };
    const signOptions = process.env.JWT_EXPIRES_IN ? { expiresIn: process.env.JWT_EXPIRES_IN } : {};
    const token = jwt.sign(tokenOptions, process.env.JWT_SECRET, signOptions);

    // Log admin login
    if (user.role === 'admin') {
      await adminLogs.create({
        id: uuidv4(),
        adminId: user.id,
        action: 'LOGIN',
        targetType: 'AUTH',
        targetId: user.id,
        details: { email: user.email },
        ipAddress: req.ip || req.connection.remoteAddress
      });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance_type: user.balance_type,
        balance: user.balance,
        totalGamesPlayed: user.totalGamesPlayed,
        totalWinnings: user.totalWinnings,
        is_active: user.is_active
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await users.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ user: user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', [
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await users.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { username, email } = req.body;

    // Check for duplicate username/email
    if (username) {
      const existingUser = await users.findByUsername(username);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }
    if (email) {
      const existingUser = await users.findByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;

    await users.update(user.id, updateData);

    // Get updated user
    const updatedUser = await users.findById(user.id);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Change password
router.put('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await users.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await users.update(user.id, { password: hashedNewPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// Refresh token endpoint - extends token expiration
router.post('/refresh-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify current token (even if expired, we can still decode it)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // If token is expired, try to decode without verification to check if it's valid format
      if (error.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // Get user from database
    const user = await users.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Generate new token with extended expiration
    const tokenOptions = { id: user.id, email: user.email, role: user.role, balance_type: user.balance_type };
    const signOptions = process.env.JWT_EXPIRES_IN ? { expiresIn: process.env.JWT_EXPIRES_IN } : {};
    const newToken = jwt.sign(tokenOptions, process.env.JWT_SECRET, signOptions);

    console.log('✅ Token refreshed for user:', user.email);

    res.json({
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
        total_games_played: user.totalGamesPlayed,
        total_winnings: user.totalWinnings,
        is_active: user.is_active,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await users.findById(decoded.id);
      if (user && user.role === 'admin') {
        await createAdminLog({
          id: uuidv4(),
          adminId: user.id,
          action: 'LOGOUT',
          targetType: 'AUTH',
          targetId: user.id,
          details: { email: user.email },
          ipAddress: req.ip || req.connection.remoteAddress
        });
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success even if logging fails
    res.json({ message: 'Logout successful' });
  }
});

// Verify token endpoint
router.post('/verify-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await users.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});



module.exports = router;
