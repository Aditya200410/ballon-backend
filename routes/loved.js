const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { isAdmin, authenticateToken } = require('../middleware/auth');
const { 
  getAllLovedProducts, 
  getLovedProduct, 
  createLovedProductWithFiles, 
  updateLovedProductWithFiles, 
  deleteLovedProduct 
} = require('../controllers/lovedController');

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
    folder: 'pawnshop-loved',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
    resource_type: 'auto'
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload multiple images (main image + 3 additional images)
const uploadImages = upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 }
]);

// Middleware to handle multer upload
const handleUpload = (req, res, next) => {
  uploadImages(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error', details: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'File upload error', details: err.message });
    }
    next();
  });
};

// Public routes
router.get("/", getAllLovedProducts);
router.get("/:id", getLovedProduct);

// Admin routes
router.post("/", authenticateToken, isAdmin, handleUpload, createLovedProductWithFiles);
router.post("/upload", authenticateToken, isAdmin, handleUpload, createLovedProductWithFiles);
router.put("/:id", authenticateToken, isAdmin, handleUpload, updateLovedProductWithFiles);
router.delete("/:id", authenticateToken, isAdmin, deleteLovedProduct);

module.exports = router;
