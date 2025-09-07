const Seller = require('../models/Seller');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

exports.register = async (req, res) => {
  try {
    const { 
      businessName, 
      email, 
      password, 
      phone, 
      address, 
      businessType,
      location,
      startingPrice,
      description,
      maxPersonsAllowed,
      amenity,
      totalHalls,
      enquiryDetails,
      bookingOpens,
      workingTimes,
      workingDates,
      foodType,
      roomsAvailable,
      bookingPolicy,
      additionalFeatures
    } = req.body;

    const normalizedEmail = email && email.toLowerCase().trim();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const existingSeller = await Seller.findOne({ email: normalizedEmail });
    if (existingSeller) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const requiredFields = ['businessName', 'email', 'password'];
    const missingFields = requiredFields.filter(field => !req.body[field] || req.body[field].toString().trim() === '');
    if (missingFields.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Process uploaded images
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => ({
        public_id: file.filename,
        url: file.path,
        alt: 'Business image'
      }));
    }

   
  
    // Create seller with all info including new fields
    const seller = await Seller.create({
      businessName,
      email: normalizedEmail,
      password,
      phone,
      address,
      businessType,
      location,
      startingPrice,
      description,
      maxPersonsAllowed,
      amenity: amenity ? (Array.isArray(amenity) ? amenity : amenity.split(',').map(item => item.trim())) : [],
      totalHalls: totalHalls || 1,
      enquiryDetails,
      bookingOpens,
      workingTimes,
      workingDates,
      foodType: foodType ? (Array.isArray(foodType) ? foodType : foodType.split(',').map(item => item.trim())) : [],
      roomsAvailable: roomsAvailable || 1,
      bookingPolicy,
      additionalFeatures: additionalFeatures ? (Array.isArray(additionalFeatures) ? additionalFeatures : additionalFeatures.split(',').map(item => item.trim())) : [],
      images
    });

    // Create JWT token for seller
    const token = jwt.sign(
      {
        id: seller._id,
        email: seller.email,
        businessName: seller.businessName,
        type: 'seller',
        isSeller: true
      },
      process.env.JWT_SECRET_SELLER || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Seller registered successfully',
      token,
      seller: {
        id: seller._id,
        businessName: seller.businessName,
        email: seller.email,
        phone: seller.phone,
        address: seller.address,
        businessType: seller.businessType,
        location: seller.location,
        startingPrice: seller.startingPrice,
        description: seller.description,
        maxPersonsAllowed: seller.maxPersonsAllowed,
        amenity: seller.amenity || [],
        totalHalls: seller.totalHalls || 1,
        enquiryDetails: seller.enquiryDetails || '',
        bookingOpens: seller.bookingOpens || '',
        workingTimes: seller.workingTimes || '',
        workingDates: seller.workingDates || '',
        foodType: seller.foodType || [],
        roomsAvailable: seller.roomsAvailable || 1,
        bookingPolicy: seller.bookingPolicy || '',
        additionalFeatures: seller.additionalFeatures || [],
        images: seller.images || [],
        profileImage: seller.profileImage || null,
        createdAt: seller.createdAt,
        verified: seller.verified,
        blocked: seller.blocked,
        approved: seller.approved
      }
    });
  } catch (error) {
    console.error('Seller registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering seller' });
  }
};

// Login seller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if seller exists
    const seller = await Seller.findOne({ email: normalizedEmail });
    if (!seller) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await seller.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: seller._id,
        email: seller.email,
        businessName: seller.businessName,
        type: 'seller',
        isSeller: true
      },
      process.env.JWT_SECRET_SELLER || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      seller: {
        id: seller._id,
        businessName: seller.businessName,
        email: seller.email,
        phone: seller.phone,
        address: seller.address,
        businessType: seller.businessType,
        location: seller.location,
        startingPrice: seller.startingPrice,
        description: seller.description,
        maxPersonsAllowed: seller.maxPersonsAllowed,
        amenity: seller.amenity || [],
        totalHalls: seller.totalHalls || 1,
        enquiryDetails: seller.enquiryDetails || '',
        bookingOpens: seller.bookingOpens || '',
        workingTimes: seller.workingTimes || '',
        workingDates: seller.workingDates || '',
        foodType: seller.foodType || [],
        roomsAvailable: seller.roomsAvailable || 1,
        bookingPolicy: seller.bookingPolicy || '',
        additionalFeatures: seller.additionalFeatures || [],
        images: seller.images || [],
        profileImage: seller.profileImage || null,
        createdAt: seller.createdAt,
        verified: seller.verified,
        blocked: seller.blocked,
        approved: seller.approved
      }
    });
  } catch (error) {
    console.error('Seller login error:', error);
    res.status(500).json({ success: false, message: 'Error logging in' });
  }
};

// Get seller profile (JWT protected)
exports.getProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller._id).select('-password');
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    res.json({ success: true, seller });
  } catch (error) {
    console.error('Get seller profile error:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};
// Update seller profile (JWT protected)
exports.updateProfile = async (req, res) => {
  try {
    const updates = {
      businessName: req.body.businessName,
      phone: req.body.phone,
      address: req.body.address,
      businessType: req.body.businessType,
      location: req.body.location,
      startingPrice: req.body.startingPrice,
      description: req.body.description,
      maxPersonsAllowed: req.body.maxPersonsAllowed
    };

    const seller = await Seller.findByIdAndUpdate(
      req.seller._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    res.json({ success: true, seller });
  } catch (error) {
    console.error('Update seller profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};
// Upload multiple images
exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const images = req.files.map(file => ({
      public_id: file.filename,
      url: file.path,
      alt: 'Seller image'
    }));

    const seller = await Seller.findByIdAndUpdate(
      req.seller.id,
      { $push: { images: { $each: images } } },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      images: seller.images
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading images'
    });
  }
};

// Upload profile image
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile image uploaded'
      });
    }

    const profileImage = {
      public_id: req.file.filename,
      url: req.file.path,
      alt: 'Profile image'
    };

    const seller = await Seller.findByIdAndUpdate(
      req.seller.id,
      { profileImage },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: seller.profileImage
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile image'
    });
  }
};

// Delete image
exports.deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { cloudinary } = require('../middleware/sellerUpload');

    // Find the image in the seller's images array
    const seller = await Seller.findById(req.seller.id);
    const image = seller.images.id(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Delete from Cloudinary if available
    if (cloudinary) {
      try {
        await cloudinary.uploader.destroy(image.public_id);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Remove from database
    seller.images.pull(imageId);
    await seller.save();

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting image'
    });
  }
};

// Get all sellers (for admin panel)
exports.getAllSellers = async (req, res) => {
  try {
    console.log('=== GET ALL SELLERS REQUEST ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    
    const sellers = await Seller.find({}, '-password');
    console.log('Found sellers count:', sellers.length);
    
   
    console.log('=== SELLERS WITH WITHDRAWALS ===');
    sellers.forEach(seller => {
      console.log(`Seller: ${seller.businessName}`);
      
    });

    res.json({
      success: true,
      sellers: sellers
    });
  } catch (error) {
    console.error('Error fetching all sellers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sellers',
      error: error.message
    });
  }
};

// Update unique fields for existing sellers
exports.updateUniqueFields = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const seller = await Seller.findOne({ email: normalizedEmail });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Generate unique fields if they don't exist
    if (!seller.sellerToken || !seller.websiteLink) {
    
      const updatedSeller = await Seller.findByIdAndUpdate(
        seller._id,
        { sellerToken, websiteLink },
        { new: true }
      );

      res.json({
        success: true,
        message: 'Unique fields updated successfully',
        seller: updatedSeller
      });
    } else {
      res.json({
        success: true,
        message: 'Seller already has unique fields',
        seller
      });
    }
  } catch (error) {
    console.error('Update unique fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating unique fields'
    });
  }
};

// Test endpoint to list all sellers (for debugging)
exports.listAllSellers = async (req, res) => {
  try {
    const sellers = await Seller.find({}, 'email businessName createdAt');
    res.json({
      success: true,
      count: sellers.length,
      sellers: sellers.map(s => ({
        email: s.email,
        businessName: s.businessName,
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('List all sellers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing sellers',
      error: error.message
    });
  }
};

// Test endpoint to verify seller controller is working
exports.test = async (req, res) => {
  try {
    // Test database connection
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({
      success: true,
      message: 'Seller controller is working',
      database: dbStates[dbState] || 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message
    });
  }
};
// controllers/sellerAuthController.js



// --- ADD THIS NEW CONTROLLER FUNCTION ---
exports.getSellerById = async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).select('-password');

    if (!seller) {
      return res.status(404).json({ 
        success: false, 
        message: 'Seller not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      seller: seller 
    });
  } catch (error) {
    console.error('Error fetching seller by ID:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
// Block or unblock a seller (admin only)
exports.setBlockedStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Blocked status must be boolean' });
    }
    const seller = await Seller.findByIdAndUpdate(id, { blocked }, { new: true });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    res.json({ success: true, message: `Seller ${blocked ? 'blocked' : 'unblocked'} successfully`, seller });
  } catch (error) {
    console.error('Set blocked status error:', error);
    res.status(500).json({ success: false, message: 'Error updating blocked status' });
  }
};

// Approve or disapprove a seller (admin only)
exports.setApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Approval status must be boolean' });
    }
    const seller = await Seller.findByIdAndUpdate(id, { approved }, { new: true });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    res.json({ success: true, message: `Seller ${approved ? 'approved' : 'disapproved'} successfully`, seller });
  } catch (error) {
    console.error('Set approval status error:', error);
    res.status(500).json({ success: false, message: 'Error updating approval status' });
  }
};

// Delete a seller (admin only)
exports.deleteSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findByIdAndDelete(id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    res.json({ success: true, message: 'Seller deleted successfully' });
  } catch (error) {
    console.error('Delete seller error:', error);
    res.status(500).json({ success: false, message: 'Error deleting seller' });
  }
};

