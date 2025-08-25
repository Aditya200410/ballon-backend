const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');

// Get all settings
router.get('/', authenticateToken, settingsController.getAllSettings);

// Create or update a setting
router.post('/', authenticateToken, settingsController.upsertSetting);

// Public endpoint to get COD upfront amount (must come before /:key route)
router.get('/cod-upfront-amount', settingsController.getCodUpfrontAmount);

// Get a specific setting by key
router.get('/:key', authenticateToken, settingsController.getSettingByKey);

// Update a setting
router.put('/:key', authenticateToken, settingsController.upsertSetting);

// Delete a setting
router.delete('/:key', authenticateToken, settingsController.deleteSetting);

module.exports = router; 