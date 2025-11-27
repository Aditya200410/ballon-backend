const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../data/subcategories');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for subcategory images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'subcat-' + uniqueSuffix + ext);
  }
});

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

    // Transform path to URL
    if (req.file) {
      const baseUrl = process.env.BACKEND_URL || 'https://api.decoryy.com';
      req.file.path = `${baseUrl}/decoryy/data/subcategories/${req.file.filename}`;
    }

    next();
  });
};

module.exports = {
  handleSubCategoryImage,
  cloudinary: null
};
