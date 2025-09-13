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
  console.warn('Cloudinary credentials not found. Subcategory image uploads will be disabled.');
}

// Configure storage for subcategory images
const storage = hasCloudinaryCredentials ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'subcategories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4'],
    resource_type: 'auto',
    transformation: [
      { width: 400, height: 400, crop: 'fill' },
      { quality: 'auto' }
    ]
  }
}) : multer.memoryStorage();

// Multer configuration for subcategory image upload
const uploadSubCategoryImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only 1 file
  },
  fileFilter: (req, file, cb) => {
    // Check file type (images and videos)
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
}).single('image');

// Middleware for handling subcategory image upload
const handleSubCategoryImage = (req, res, next) => {
  if (!hasCloudinaryCredentials) {
    // Skip image upload if Cloudinary is not configured
    req.file = null;
    return next();
  }

  uploadSubCategoryImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB.'
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
  handleSubCategoryImage,
  cloudinary: hasCloudinaryCredentials ? cloudinary : null
};
