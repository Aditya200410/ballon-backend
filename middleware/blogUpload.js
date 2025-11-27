const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../data/blog-images');
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
    cb(null, 'blog-' + uniqueSuffix + ext);
  }
});

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
  uploadFeaturedImage(req, res, function (err) {
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

    // Transform path to URL if file exists
    if (req.file) {
      const baseUrl = process.env.BACKEND_URL || 'https://api.decoryy.com/api';
      req.file.path = `${baseUrl}/decoryy/data/blog-images/${req.file.filename}`;
    }

    next();
  });
};

module.exports = {
  handleBlogImageUpload,
  hasCloudinaryCredentials: true
};
