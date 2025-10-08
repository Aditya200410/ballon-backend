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

// Get products for a specific city
router.get('/:id/products', cityController.getCityProducts);

// Add products to a city
router.post('/:id/products', cityController.addProductsToCity);

// Remove products from a city
router.delete('/:id/products', cityController.removeProductsFromCity);

// Import products from another city
router.post('/:id/import', cityController.importProductsFromCity);

module.exports = router;
