const express = require('express');
const router = express.Router();
const { adminLogin, adminSignup, updateAdminCredentials, verifyAdminToken } = require('../controllers/adminAuthController');
const { auth } = require('../middleware/auth');

// Admin login route
router.post('/login', adminLogin);

// Admin signup route
router.post('/signup', adminSignup);

// Admin token verification route
router.get('/verify', verifyAdminToken);

// Update admin credentials route (requires authentication)
router.put('/update-credentials', auth, updateAdminCredentials);

module.exports = router; 