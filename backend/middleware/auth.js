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
    console.log('🔍 Decoded token payload:', JSON.stringify(decoded, null, 2));

    // Get user from database
    let user = await users.findById(decoded.id);
    
    // Handle UUID to integer ID transition
    if (!user && typeof decoded.id === 'string' && decoded.email) {
      console.log('🔄 User not found by ID, trying email lookup for transition period...');
      user = await users.findByEmail(decoded.email);
      if (user) {
        console.log('✅ Found user by email during UUID->integer transition:', user.username);
      }
    }
    
    if (!user) {
      console.error('❌ User not found for ID:', decoded.id, '(type:', typeof decoded.id, ')');
      console.error('❌ Also tried email:', decoded.email);
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log('❌ User account is deactivated:', user.username);
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    console.log('✅ User authenticated successfully:', user.username, user.role);
    console.log('🔍 User object from DB:', {
      id: user.id,
      idType: typeof user.id,
      username: user.username,
      role: user.role
    });

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
  console.log('💰 hasSufficientBalance called:', {
    userId: user?.id,
    username: user?.username,
    userType: user?.userType || user?.user_type,
    balance: user?.balance,
    requiredAmount: requiredAmount,
    isAdmin: user?.role === 'admin'
  });

  // Admin users are always considered to have sufficient balance
  if (isBalanceExempt(user)) {
    console.log('✅ Admin user - balance check bypassed');
    return true;
  }

  // Get userType (handle both camelCase and snake_case)
  const userType = user.userType || user.user_type;

  // For prepaid users: check if balance is sufficient (limited by their balance)
  if (userType === 'prepaid') {
    const hasSufficient = user && user.balance >= requiredAmount;
    console.log(`💰 Prepaid user balance check: ${user.balance} >= ${requiredAmount} = ${hasSufficient}`);
    return hasSufficient;
  }

  // For postpaid users: unlimited credit (no limit)
  if (userType === 'postpaid') {
    console.log('✅ Postpaid user - unlimited credit');
    return true; // Postpaid users have unlimited credit
  }

  // Default: check positive balance
  console.log(`⚠️ Unknown user type: ${userType}, checking balance: ${user.balance} >= ${requiredAmount}`);
  return user && user.balance >= requiredAmount;
};

// Helper function to deduct balance (no-op for admin users)
const deductBalance = async (user, amount) => {
  console.log('💰 deductBalance called:', {
    userId: user?.id,
    username: user?.username,
    userType: user?.userType || user?.user_type,
    currentBalance: user?.balance,
    amountToDeduct: amount
  });

  // Admin users don't need balance deduction
  if (isBalanceExempt(user)) {
    console.log(`💰 Balance exemption applied for admin user: ${user.username}`);
    return { success: true, message: 'Admin user - no balance deduction required' };
  }

  // Check if user has sufficient balance/credit
  if (!hasSufficientBalance(user, amount)) {
    const userType = user.userType || user.user_type;
    console.log(`❌ Insufficient balance: ${user.balance} < ${amount} (userType: ${userType})`);
    return { success: false, message: 'Insufficient balance' };
  }

  try {
    const newBalance = user.balance - amount;
    const userType = user.userType || user.user_type;
    
    // Update user balance in database
    await users.update(user.id, {
      balance: newBalance,
      totalGamesPlayed: user.totalGamesPlayed + 1
    });

    console.log(`💰 Deducted ${amount} from user ${user.username}'s balance. New balance: ${newBalance}`);
    
    // Check if prepaid user is running low on balance (below 10% of original)
    let warning = null;
    if (userType === 'prepaid' && newBalance > 0) {
      // Warning when balance is low (you can adjust the threshold)
      if (newBalance < 100) {
        warning = `⚠️ Low balance warning: Your balance is ${newBalance.toFixed(2)} Birr`;
        console.log(warning);
      }
    }
    
    return { 
      success: true, 
      message: `Balance deducted: ${amount}`,
      newBalance,
      warning
    };
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
