const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  console.log('Auth middleware called');
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Auth header:', authHeader);
  console.log('Token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const verified = jwt.verify(token, jwtSecret);
    console.log('Token verified:', verified);
    
    // Check if token has required admin properties
    if (!verified.isAdmin && !verified.role) {
      console.log('Token missing admin properties');
      return res.status(403).json({ message: 'Invalid token type. Admin token required.' });
    }
    
    req.user = verified;
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      console.log('Token expired at:', error.expiredAt);
      return res.status(401).json({ 
        message: 'Your session has expired. Please log in again.',
        error: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      console.log('Invalid token:', error.message);
      return res.status(401).json({ 
        message: 'Invalid authentication token. Please log in again.',
        error: 'INVALID_TOKEN'
      });
    }
    
    console.log('Token verification failed:', error.message);
    res.status(401).json({ message: 'Authentication failed. Please log in again.' });
  }
};

const isAdmin = (req, res, next) => {
  console.log('Admin check called');
  console.log('User:', req.user);
  console.log('Is admin:', req.user?.isAdmin);
  console.log('User role:', req.user?.role);
  
  if (req.user && (req.user.isAdmin === true || req.user.role === 'admin')) {
    console.log('Admin check passed');
    next();
  } else {
    console.error('Admin check failed:', {
      user: req.user,
      isAdmin: req.user?.isAdmin,
      role: req.user?.role
    });
    res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
};

// Combined middleware for admin authentication
const auth = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    isAdmin(req, res, next);
  });
};

module.exports = {
  authenticateToken,
  isAdmin,
  auth
}; 