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
  console.warn('Cloudinary credentials not found. Blog image uploads will be disabled.');
}

// Configure storage for blog featured images
const storage = hasCloudinaryCredentials ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'blog-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1200, height: 800, crop: 'fill' },
      { quality: 'auto' }
    ]
  }
}) : multer.memoryStorage();

// Multer configuration for blog featured image
const uploadFeaturedImage = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one featured image
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
}).single('featuredImage');

// Middleware to handle blog image upload
const handleBlogImageUpload = (req, res, next) => {
  uploadFeaturedImage(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false,
        error: 'File upload error', 
        details: err.message 
      });
    } else if (err) {
      return res.status(500).json({ 
        success: false,
        error: 'File upload error', 
        details: err.message 
      });
    }
    next();
  });
};

module.exports = {
  handleBlogImageUpload,
  hasCloudinaryCredentials
};
