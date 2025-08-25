const jwt = require('jsonwebtoken');
const Seller = require('../models/Seller');

const sellerAuth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token found'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_SELLER);
    
    // Check if it's a seller token
    if (decoded.type !== 'seller') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Find seller
    const seller = await Seller.findById(decoded.id).select('-password');
    if (!seller) {
      return res.status(401).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Add seller to request
    req.seller = seller;
    next();
  } catch (error) {
    console.error('Seller authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

module.exports = sellerAuth; 