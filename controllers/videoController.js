const Video = require('../models/Video');
const mongoose = require('mongoose');

// Get all videos with optional filtering
exports.getAllVideos = async (req, res) => {
  try {
    const { category, limit, page, active } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by active status (default to true for frontend)
    if (active !== 'false') {
      query.isActive = true;
    }
    
    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query with sorting
    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const totalVideos = await Video.countDocuments(query);
    
    res.json({
      videos,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalVideos / limitNum),
        totalVideos,
        hasNext: pageNum < Math.ceil(totalVideos / limitNum),
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

// Get single video by ID
exports.getVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ video });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};

// Create new video
exports.createVideo = async (req, res) => {
  try {
    const { title, category, video } = req.body;
    
    // Validate required fields
    if (!title || !video || !category) {
      return res.status(400).json({ 
        error: 'Title, video, and category are required' 
      });
    }
    
    // Validate category
    const validCategories = ['review', 'work', 'testimonial', 'demo'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category. Must be one of: ' + validCategories.join(', ') 
      });
    }
    
    const videoDoc = new Video({
      title,
      category,
      video
    });
    
    await videoDoc.save();
    
    res.status(201).json({ video: videoDoc });
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
};

// Update video
exports.updateVideo = async (req, res) => {
  try {
    const { title, category, video, isActive } = req.body;
    
    const updateData = {};
    
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (video !== undefined) updateData.video = video;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const videoDoc = await Video.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!videoDoc) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ video: videoDoc });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};

// Get videos by category
exports.getVideosByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const validCategories = ['review', 'work', 'testimonial', 'demo'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category. Must be one of: ' + validCategories.join(', ') 
      });
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const videos = await Video.find({ 
      category, 
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    const totalVideos = await Video.countDocuments({ category, isActive: true });
    
    res.json({
      videos,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalVideos / limitNum),
        totalVideos,
        hasNext: pageNum < Math.ceil(totalVideos / limitNum),
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching videos by category:', error);
    res.status(500).json({ error: 'Failed to fetch videos by category' });
  }
};
