const express = require('express');
const router = express.Router();
const dataPageController = require('../controllers/dataPageController');

// Get all data pages
router.get('/', dataPageController.getAllDataPages);

// Get data page by type
router.get('/:type', dataPageController.getDataPageByType);

// Add new data page
router.post('/', dataPageController.addDataPage);

// Update data page by type
router.put('/:type', dataPageController.updateDataPage);

// Initialize default policies data
router.post('/init', dataPageController.initializePolicies);

module.exports = router; 