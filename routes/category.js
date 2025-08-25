const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { isAdmin, authenticateToken } = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pawnshop-categories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'ogg'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
    resource_type: 'auto', // This allows both images and videos
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for videos
  }
});

// Upload multiple files (image + video)
const uploadFiles = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Middleware to handle multer upload
const handleUpload = (req, res, next) => {
  uploadFiles(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'File upload error', details: err.message });
    }
    next();
  });
};

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);

// Protected admin routes with file upload
router.post('/', authenticateToken, isAdmin, handleUpload, categoryController.createCategory);
router.post('/upload', authenticateToken, isAdmin, handleUpload, categoryController.createCategory);
router.put('/:id', authenticateToken, isAdmin, handleUpload, categoryController.updateCategory);
router.put('/:id/upload', authenticateToken, isAdmin, handleUpload, categoryController.updateCategory);
router.delete('/:id', authenticateToken, isAdmin, categoryController.deleteCategory);

module.exports = router; 