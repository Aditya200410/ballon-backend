const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { auth } = require('../middleware/auth');

// GET /api/blog - Get all blogs with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const category = req.query.category;
    const search = req.query.search;
    const featured = req.query.featured === 'true';

    // Build query - only published blogs for public API
    const query = { isPublished: true };
    
    if (category) query.category = category;
    if (search) {
      // Use text search index for better performance
      query.$text = { $search: search };
    }
    if (featured) {
      query.featured = true;
    }

    const skip = (page - 1) * limit;

    // Use lean() for better performance and only select needed fields
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title slug featuredImage author category readTime views createdAt')
      .lean();

    // Use countDocuments with the same query for consistency
    const total = await Blog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      blogs,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/blog/categories - Get all blog categories
router.get('/categories', async (req, res) => {
  try {
    // Cache categories for 5 minutes
    const cacheKey = 'blog_categories';
    let categories = global.blogCategoriesCache;
    
    if (!categories || Date.now() - global.blogCategoriesCacheTime > 300000) { // 5 minutes
      categories = await Blog.distinct('category', { isPublished: true });
      global.blogCategoriesCache = categories;
      global.blogCategoriesCacheTime = Date.now();
    }
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/blog/:slug - Get single blog by slug
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ 
      slug: req.params.slug
    });

    if (!blog) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }

    // Increment views
    await blog.incrementViews();

    res.json({
      success: true,
      blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN ROUTES (Protected)

// GET /api/blog/admin/all - Get all blogs for admin (including unpublished)
router.get('/admin/all', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const status = req.query.status;
    const category = req.query.category;
    const skip = (page - 1) * limit;

    // Build query for admin
    const query = {};
    
    if (search) {
      query.$text = { $search: search };
    }
    if (status === 'published') {
      query.isPublished = true;
    } else if (status === 'draft') {
      query.isPublished = false;
    }
    if (category) {
      query.category = category;
    }

    // Use lean() for better performance and select only needed fields
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title slug featuredImage author category readTime views isPublished publishedAt createdAt')
      .lean();

    const total = await Blog.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      blogs,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching admin blogs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/blog/admin/:id - Get single blog for admin
router.get('/admin/:id', auth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }

    res.json({
      success: true,
      blog
    });
  } catch (error) {
    console.error('Error fetching admin blog:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/blog - Create new blog (Admin only)
router.post('/', auth, async (req, res) => {
  try {
    const blogData = req.body;
    
    // Set publishedAt if isPublished is true
    if (blogData.isPublished && !blogData.publishedAt) {
      blogData.publishedAt = new Date();
    }
    
    const blog = new Blog(blogData);
    await blog.save();

    // Clear categories cache when new blog is created
    global.blogCategoriesCache = null;

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      blog
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'A blog with this slug already exists' 
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/blog/:id - Update blog (Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const blogData = req.body;
    
    // Set publishedAt if isPublished is being set to true
    if (blogData.isPublished && !blogData.publishedAt) {
      blogData.publishedAt = new Date();
    }
    
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      blogData,
      { new: true, runValidators: true }
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Clear categories cache when blog is updated
    global.blogCategoriesCache = null;

    res.json({
      success: true,
      message: 'Blog post updated successfully',
      blog
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A blog with this slug already exists'
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/blog/:id - Delete blog (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }

    // Clear categories cache when blog is deleted
    global.blogCategoriesCache = null;

    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
