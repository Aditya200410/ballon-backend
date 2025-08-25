const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');
const sellerAuth = require('../middleware/sellerAuth');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Test endpoint to check if routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Commission routes are working',
    timestamp: new Date().toISOString()
  });
});

// Seller routes (protected by sellerAuth)
router.get('/history', sellerAuth, commissionController.getCommissionHistory);
router.get('/details/:commissionId', sellerAuth, commissionController.getCommissionDetails);
router.get('/summary', sellerAuth, commissionController.getCommissionSummary);

// Admin routes (protected by adminAuth)
router.get('/admin/all', authenticateToken, isAdmin, commissionController.getAllCommissionHistory);
router.put('/admin/confirm/:commissionId', authenticateToken, isAdmin, commissionController.confirmCommission);
router.put('/admin/cancel/:commissionId', authenticateToken, isAdmin, commissionController.cancelCommission);

module.exports = router; 