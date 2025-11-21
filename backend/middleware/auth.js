const jwt = require('jsonwebtoken');
require('dotenv').config();

const { users } = require('../db');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  console.log('🔐 AUTH MIDDLEWARE CALLED');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);

  const authHeader = req.headers['authorization'];

  // More robust token extraction
  let token;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace
  }

  console.log('Auth header present:', !!authHeader);
  console.log('Auth header value:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');
  console.log('Token extracted:', token ? 'present' : 'missing');

  if (!token || token.length === 0) {
    console.log('❌ No valid token provided in request');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified successfully for user:', decoded.email || decoded.id);

    // Get user from database
    const user = await users.findById(decoded.id);
    if (!user) {
      console.error('❌ User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log('❌ User account is deactivated:', user.username);
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    console.log('✅ User authenticated successfully:', user.username, user.role);

    // Attach user to request
    req.user = user;
    console.log('✅ Calling next() middleware');
    next();
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);
    console.error('❌ Error details:', error);

    // Provide more specific error messages based on the error type
    let errorMessage = 'Invalid or expired token';
    if (error.message === 'jwt malformed') {
      errorMessage = 'Malformed authentication token';
    } else if (error.message === 'invalid signature') {
      errorMessage = 'Invalid token signature';
    } else if (error.message === 'jwt expired') {
      errorMessage = 'Token has expired';
    }

    // Return 401 for authentication failures, don't let error propagate
    return res.status(401).json({
      error: 'Authentication failed',
      message: errorMessage
    });
  }
};

// Middleware to check user roles
const requireRole = (roles) => {
  return (req, res, next) => {
    console.log('🔐 REQUIRE ROLE MIDDLEWARE CALLED');
    console.log('Required roles:', roles);
    console.log('Request user:', req.user ? req.user.username : 'NO USER');
    console.log('Request user role:', req.user ? req.user.role : 'NO ROLE');

    if (!req.user) {
      console.log('❌ No user in request - authentication required');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      console.log('❌ User role not in required roles');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    console.log('✅ Role check passed, calling next()');
    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole(['admin']);

// Middleware to check if user is admin or moderator
const requireModerator = requireRole(['admin', 'moderator']);

// Helper function to check if user is exempt from balance requirements
const isBalanceExempt = (user) => {
  return user && user.role === 'admin';
};

// Helper function to check if user has sufficient balance (returns true for admin users)
const hasSufficientBalance = (user, requiredAmount) => {
  // Admin users are always considered to have sufficient balance
  if (isBalanceExempt(user)) {
    return true;
  }

  // Regular users need to have enough balance
  return user && user.balance >= requiredAmount;
};

// Helper function to deduct balance (no-op for admin users)
const deductBalance = async (user, amount) => {
  // Admin users don't need balance deduction
  if (isBalanceExempt(user)) {
    console.log(`💰 Balance exemption applied for admin user: ${user.username}`);
    return { success: true, message: 'Admin user - no balance deduction required' };
  }

  // Regular users need balance deduction
  if (!user || user.balance < amount) {
    return { success: false, message: 'Insufficient balance' };
  }

  try {
    // Update user balance in database
    await users.update(user.id, {
      balance: user.balance - amount,
      totalGamesPlayed: user.totalGamesPlayed + 1
    });

    console.log(`💰 Deducted ${amount} from user ${user.username}'s balance`);
    return { success: true, message: `Balance deducted: ${amount}` };
  } catch (error) {
    console.error('Error deducting balance:', error);
    return { success: false, message: 'Failed to deduct balance' };
  }
};

// Helper function to add balance (works for all users)
const addBalance = async (user, amount) => {
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  try {
    // Update user balance in database
    await users.update(user.id, {
      balance: user.balance + amount,
      totalWinnings: user.totalWinnings + amount
    });

    console.log(`💰 Added ${amount} to user ${user.username}'s balance`);
    return { success: true, message: `Balance added: ${amount}` };
  } catch (error) {
    console.error('Error adding balance:', error);
    return { success: false, message: 'Failed to add balance' };
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireModerator,
  isBalanceExempt,
  hasSufficientBalance,
  deductBalance,
  addBalance
};
