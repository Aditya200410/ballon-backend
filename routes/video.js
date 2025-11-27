const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAdmin, authenticateToken } = require('../middleware/auth');
const {
  getAllVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  getVideosByCategory
} = require('../controllers/videoController');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../data/videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for videos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

// Configure multer with file size limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024 // 1000MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
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
          return res.status(400).json({ error: 'File too large. Maximum size is 1000MB.' });
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

      const baseUrl = process.env.BACKEND_URL || 'https://api.decoryy.com';
      const videoUrl = `${baseUrl}/decoryy/data/videos/${req.file.filename}`;

      res.json({
        videoUrl: videoUrl,
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
