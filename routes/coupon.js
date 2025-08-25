const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticateToken } = require('../middleware/auth');

// Admin routes (protected)
router.get('/', authenticateToken, couponController.getAllCoupons);
router.post('/', authenticateToken, couponController.createCoupon);
router.put('/:id', authenticateToken, couponController.updateCoupon);
router.delete('/:id', authenticateToken, couponController.deleteCoupon);

// Public routes
router.post('/validate', couponController.validateCoupon);
router.post('/apply', couponController.applyCoupon);

module.exports = router; 