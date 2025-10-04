const express = require('express');
const router = express.Router();
const cityController = require('../controllers/cityController');

// Get all cities
router.get('/', cityController.getCities);

// Add a city
router.post('/', cityController.addCity);

// Delete a city
router.delete('/:id', cityController.deleteCity);

// Update a city
router.put('/:id', cityController.updateCity);

module.exports = router;
