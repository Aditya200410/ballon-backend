const express = require('express');
const router = express.Router();
const multer = require('multer');
const { isAdmin, authenticateToken } = require('../middleware/auth');

const {
  upload,
  getAllCarouselItems,
  getCarouselItem,
  getActiveCarouselItems,
  createCarouselItemWithFiles,
  updateCarouselItemWithFiles,
  deleteCarouselItem,
  toggleCarouselActive,
  updateCarouselOrder
} = require('../controllers/heroCarouselController');

// Configure single file upload field
const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 }
]);

// Middleware to handle multer upload
const handleUpload = (req, res, next) => {
  uploadFields(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Server error', details: err.message });
    }
    next();
  });
};

// Public routes
router.get('/active', getActiveCarouselItems);
router.get('/', getAllCarouselItems);

// Protected routes
router.use(authenticateToken);
router.use(isAdmin);

router.get('/:id', getCarouselItem);
router.post('/', handleUpload, createCarouselItemWithFiles);
router.put('/:id', handleUpload, updateCarouselItemWithFiles);
router.delete('/:id', deleteCarouselItem);
router.patch('/:id/toggle-active', toggleCarouselActive);
router.post('/update-order', updateCarouselOrder);

module.exports = router; 