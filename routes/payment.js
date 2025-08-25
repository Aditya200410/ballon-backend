const express = require('express');
const router = express.Router();
const phonepeController = require('../controllers/phonepeController');

// Debugging
console.log('Controller keys:', Object.keys(phonepeController)); // should include 'createPhonePeOrder'

// PhonePe Payment Routes
router.post('/phonepe', phonepeController.createPhonePeOrder);
router.post('/phonepe/callback', phonepeController.phonePeCallback);
router.get('/phonepe/status/:orderId', phonepeController.getPhonePeStatus);

// PhonePe Refund Routes
router.post('/phonepe/refund', phonepeController.refundPayment);
router.get('/phonepe/refund/:merchantRefundId/status', phonepeController.getRefundStatus);

module.exports = router;
