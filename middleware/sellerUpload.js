const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Check if Cloudinary credentials are available
const hasCloudinaryCredentials = process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryCredentials) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.warn('Cloudinary credentials not found. Image uploads will be disabled.');
}

// Configure storage for multiple images
const storage = hasCloudinaryCredentials ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'seller-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'fill' },
      { quality: 'auto' }
    ]
  }
}) : multer.memoryStorage();

// Configure storage for profile image
const profileStorage = hasCloudinaryCredentials ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'seller-profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill' },
      { quality: 'auto' }
    ]
  }
}) : multer.memoryStorage();

// Multer configuration for multiple images
const uploadMultipleImages = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
    fileSize: 2 * 1024 * 1024, // 2MB limit
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
  if (!hasCloudinaryCredentials) {
    // Skip image upload if Cloudinary is not configured
    req.files = [];
    return next();
  }

  uploadMultipleImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB.'
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
    next();
  });
};

// Middleware for handling profile image upload
const handleProfileImage = (req, res, next) => {
  if (!hasCloudinaryCredentials) {
    // Skip image upload if Cloudinary is not configured
    req.file = null;
    return next();
  }

  uploadProfileImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 2MB.'
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
    next();
  });
};

module.exports = {
  handleMultipleImages,
  handleProfileImage,
  cloudinary: hasCloudinaryCredentials ? cloudinary : null
}; 