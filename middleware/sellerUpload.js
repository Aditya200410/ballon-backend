const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const sellerImagesDir = path.join(__dirname, '../data/seller-images');
const sellerProfilesDir = path.join(__dirname, '../data/seller-profiles');

[sellerImagesDir, sellerProfilesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for multiple images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, sellerImagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'seller-img-' + uniqueSuffix + ext);
  }
});

// Configure storage for profile image
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, sellerProfilesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'seller-profile-' + uniqueSuffix + ext);
  }
});

// Multer configuration for multiple images
const uploadMultipleImages = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 10 // Maximum 10 images
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
}).array('images', 10); // 'images' is the field name, max 10 files

// Multer configuration for single profile image
const uploadProfileImage = multer({
  storage: profileStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 1 // Only 1 file
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
}).single('profileImage');

// Middleware for handling multiple image uploads
const handleMultipleImages = (req, res, next) => {
  uploadMultipleImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 20MB.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum is 10 images.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Transform paths to URLs
    if (req.files && req.files.length > 0) {
      const baseUrl = process.env.BACKEND_URL || 'https://api.decoryy.com';
      req.files.forEach(file => {
        file.path = `${baseUrl}/decoryy/data/seller-images/${file.filename}`;
      });
    }

    next();
  });
};

// Middleware for handling profile image upload
const handleProfileImage = (req, res, next) => {
  uploadProfileImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 20MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Transform path to URL
    if (req.file) {
      const baseUrl = process.env.BACKEND_URL || 'https://api.decoryy.com';
      req.file.path = `${baseUrl}/decoryy/data/seller-profiles/${req.file.filename}`;
    }

    next();
  });
};

module.exports = {
  handleMultipleImages,
  handleProfileImage,
  cloudinary: null
}; 