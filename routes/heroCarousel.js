const express = require('express');
const router = express.Router();
const { isAdmin, authenticateToken } = require('../middleware/auth');

// Import the corrected middleware and controller functions
const {
  uploadMiddleware, // Changed from 'upload'
  getAllCarouselItems,
  getCarouselItem,
  getActiveCarouselItems,
  createCarouselItemWithFiles,
  updateCarouselItemWithFiles,
  deleteCarouselItem,
  toggleCarouselActive,
  updateCarouselOrder
} = require('../controllers/heroCarouselController');

// --- Public Routes ---
// Get all active carousel items for the public-facing site
router.get('/active', getActiveCarouselItems);

// Get all carousel items (useful for an admin panel)
router.get('/', getAllCarouselItems);


// --- Protected Admin Routes ---
// All routes below this point require authentication and admin privileges
router.use(authenticateToken);
router.use(isAdmin);

// Get a single carousel item by its ID
router.get('/:id', getCarouselItem);

// Create a new carousel item (with image upload)
router.post('/', uploadMiddleware, createCarouselItemWithFiles);

// Update an existing carousel item by ID (with optional new image upload)
router.put('/:id', uploadMiddleware, updateCarouselItemWithFiles);

// Delete a carousel item by ID
router.delete('/:id', deleteCarouselItem);

// Toggle the 'isActive' status of a carousel item
router.patch('/:id/toggle-active', toggleCarouselActive);

// Update the display order of all carousel items
router.post('/update-order', updateCarouselOrder);

module.exports = router;