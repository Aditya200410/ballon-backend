const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require('path');
const fs = require('fs');
const { isAdmin, authenticateToken } = require('../middleware/auth');
const {
  getAllLovedProducts,
  getLovedProduct,
  createLovedProductWithFiles,
  updateLovedProductWithFiles,
  deleteLovedProduct
} = require('../controllers/lovedController');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../data/loved');
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
    cb(null, 'loved-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Upload multiple images (main image + 9 additional images)
const uploadImages = upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 },
  { name: 'image5', maxCount: 1 },
  { name: 'image6', maxCount: 1 },
  { name: 'image7', maxCount: 1 },
  { name: 'image8', maxCount: 1 },
  { name: 'image9', maxCount: 1 }
]);

// Middleware to handle multer upload
const handleUpload = (req, res, next) => {
  uploadImages(req, res, function (err) {
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
        file.path = `${baseUrl}/decoryy/data/loved/${filename}`;
      });
    });
  }
  next();
};

// Public routes
router.get("/", getAllLovedProducts);
router.get("/:id", getLovedProduct);

// Admin routes
router.post("/", authenticateToken, isAdmin, handleUpload, transformPathsToUrls, createLovedProductWithFiles);
router.post("/upload", authenticateToken, isAdmin, handleUpload, transformPathsToUrls, createLovedProductWithFiles);
router.put("/:id", authenticateToken, isAdmin, handleUpload, transformPathsToUrls, updateLovedProductWithFiles);
router.delete("/:id", authenticateToken, isAdmin, deleteLovedProduct);

module.exports = router;
