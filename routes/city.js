const express = require('express');
const router = express.Router();
const multer = require('multer');
const cityController = require('../controllers/cityController');

// Configure multer to handle form data without file uploads
const upload = multer();

// Get all cities
router.get('/', cityController.getCities);

// Add a city
router.post('/', cityController.addCity);

// Delete a city
router.delete('/:id', cityController.deleteCity);

// Update a city
router.put('/:id', cityController.updateCity);

// Toggle city active status
router.patch('/:id/toggle-status', cityController.toggleCityStatus);

// Get products for a specific city
router.get('/:id/products', cityController.getCityProducts);

// Add products to a city
router.post('/:id/products', cityController.addProductsToCity);

// Remove products from a city
router.delete('/:id/products', cityController.removeProductsFromCity);

// Update a specific product for a city (city-specific edit)
// upload.none() parses multipart/form-data without expecting file uploads
router.put('/:cityId/products/:productId', upload.none(), cityController.updateCityProduct);

// Import products from another city
router.post('/:id/import', cityController.importProductsFromCity);

// Category management
router.get('/:id/categories', cityController.getCityCategories);
router.post('/:id/categories', cityController.addCategoriesToCity);
router.delete('/:id/categories', cityController.removeCategoriesFromCity);

// SubCategory management
router.get('/:id/subcategories', cityController.getCitySubCategories);
router.post('/:id/subcategories', cityController.addSubCategoriesToCity);
router.delete('/:id/subcategories', cityController.removeSubCategoriesFromCity);

// Hero Carousel management
router.get('/:id/carousel', cityController.getCityCarouselItems);
router.post('/:id/carousel', cityController.addCarouselItemsToCity);
router.delete('/:id/carousel', cityController.removeCarouselItemsFromCity);

// Import all content from another city
router.post('/:id/import-all', cityController.importAllFromCity);

module.exports = router;
