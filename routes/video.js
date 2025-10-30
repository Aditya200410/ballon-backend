const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { isAdmin, authenticateToken } = require('../middleware/auth');
const {
  getAllVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  getVideosByCategory
} = require('../controllers/videoController');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure storage for videos
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'videos',
    resource_type: 'auto', // Let Cloudinary auto-detect video files
    allowed_formats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
    transformation: [{ quality: 'auto' }]
  }
});

// Configure multer with file size limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024 // 1000MB limit for videos
  }
});

// Public routes (no authentication required)
router.get('/', getAllVideos);
router.get('/category/:category', getVideosByCategory);
router.get('/:id', getVideo);

// Protected routes (admin authentication required)
router.post('/', authenticateToken, isAdmin, createVideo);
router.put('/:id', authenticateToken, isAdmin, updateVideo);
router.delete('/:id', authenticateToken, isAdmin, deleteVideo);

// Upload video route with error handling
router.post('/upload', authenticateToken, isAdmin, (req, res) => {
  upload.single('video')(req, res, (err) => {
    try {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
        }
        return res.status(400).json({ error: 'File upload error', details: err.message });
      } else if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed', details: err.message });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
      }
      
      console.log('Video uploaded successfully:', req.file);
      
      res.json({ 
        videoUrl: req.file.path,
        publicId: req.file.filename,
        size: req.file.size,
        originalName: req.file.originalname
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      res.status(500).json({ error: 'Failed to upload video', details: error.message });
    }
  });
});

module.exports = router;
