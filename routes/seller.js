const express = require('express');
const router = express.Router();
const sellerAuthController = require('../controllers/sellerAuthController');
const { handleMultipleImages, handleProfileImage } = require('../middleware/sellerUpload');
const sellerAuth = require('../middleware/sellerAuth');

// Test route
router.get('/test', sellerAuthController.test);

// Debug route to list all sellers
router.get('/list-all', sellerAuthController.listAllSellers);

// Public routes
router.post('/register', handleMultipleImages, sellerAuthController.register);
router.post('/login', sellerAuthController.login);

// Admin route to get all sellers
router.get('/all', sellerAuthController.getAllSellers);

// Profile routes (using JWT authentication)
router.get('/profile', sellerAuth, sellerAuthController.getProfile);
router.put('/profile', sellerAuth, sellerAuthController.updateProfile);
router.post('/upload-images', handleMultipleImages, sellerAuthController.uploadImages);
router.post('/upload-profile-image', handleProfileImage, sellerAuthController.uploadProfileImage);
router.delete('/delete-image/:imageId', sellerAuthController.deleteImage);

// Utility route to update unique fields
router.put('/update-unique-fields', sellerAuthController.updateUniqueFields);

// Delete seller (admin only)
router.delete('/:id', sellerAuthController.deleteSeller);

// Block/unblock seller (admin only)
router.patch('/:id/block', sellerAuthController.setBlockedStatus);

// Approve/disapprove seller (admin only)
router.patch('/:id/approve', sellerAuthController.setApprovalStatus);

// New route for withdrawing money
router.post('/withdraw', sellerAuth, sellerAuthController.requestWithdraw);

module.exports = router; 