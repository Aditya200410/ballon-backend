const express = require('express');
const router = express.Router();
const pinCodeServiceFeeController = require('../controllers/pinCodeServiceFeeController');
const { auth } = require('../middleware/auth');

// Public routes
router.get('/', pinCodeServiceFeeController.getAllPinCodeServiceFees);
router.get('/check/:pinCode', pinCodeServiceFeeController.getPinCodeServiceFee);

// Admin routes (protected)
router.get('/admin', auth, pinCodeServiceFeeController.getAllPinCodeServiceFeesAdmin);
router.post('/admin', auth, pinCodeServiceFeeController.createPinCodeServiceFee);
router.put('/admin/:id', auth, pinCodeServiceFeeController.updatePinCodeServiceFee);
router.delete('/admin/:id', auth, pinCodeServiceFeeController.deletePinCodeServiceFee);

module.exports = router;
