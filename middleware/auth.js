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
    console.log('Token verification failed:', error.message);
    res.status(400).json({ message: 'Invalid token' });
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