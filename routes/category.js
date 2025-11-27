const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAdmin, authenticateToken } = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');

const SubCategory = require('../models/SubCategory');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../data/categories');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'category-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Upload multiple files (image + video)
const uploadFiles = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Middleware to handle multer upload
const handleUpload = (req, res, next) => {
  uploadFiles(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'File upload error', details: err.message });
    }
    next();
  });
};

// Middleware to transform local paths to URLs
const transformPathsToUrls = (req, res, next) => {
  if (req.files) {
    const baseUrl = process.env.BACKEND_URL || 'https://api.decoryy.com';

    Object.keys(req.files).forEach(key => {
      req.files[key].forEach(file => {
        // Convert absolute path to URL
        const filename = file.filename;
        file.path = `${baseUrl}/decoryy/data/categories/${filename}`;
      });
    });
  }
  next();
};

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/nested', categoryController.getNestedCategories);
router.get('/:id', categoryController.getCategory);

// Admin routes - get all categories (including inactive)
router.get('/admin/all', authenticateToken, isAdmin, categoryController.getAllCategoriesAdmin);

// Protected admin routes with file upload
router.post('/', authenticateToken, isAdmin, handleUpload, transformPathsToUrls, categoryController.createCategory);
router.post('/upload', authenticateToken, isAdmin, handleUpload, transformPathsToUrls, categoryController.createCategory);
router.post('/update-order', authenticateToken, isAdmin, categoryController.updateCategoryOrder);
router.put('/:id', authenticateToken, isAdmin, handleUpload, transformPathsToUrls, categoryController.updateCategory);
router.put('/:id/upload', authenticateToken, isAdmin, handleUpload, transformPathsToUrls, categoryController.updateCategory);
router.delete('/:id', authenticateToken, isAdmin, categoryController.deleteCategory);

module.exports = router; 