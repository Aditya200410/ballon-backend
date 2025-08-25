const Seller = require('../models/Seller');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Register a new seller
exports.register = async (req, res) => {
  try {
    const { businessName, email, password, phone, address, businessType } = req.body;
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
    
    // Generate unique sellerToken
    const sellerToken = uuidv4();
    // Create websiteLink with sellerToken
    const websiteLink = `${'https://www.rikocraft.com/'}?seller=${sellerToken}`;
    // Generate QR code for websiteLink
    const qrCode = await QRCode.toDataURL(websiteLink);
    // Create seller with all info including images
    const seller = await Seller.create({
      businessName,
      email: normalizedEmail,
      password,
      phone,
      address,
      businessType,
      sellerToken,
      websiteLink,
      qrCode,
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
        sellerToken: seller.sellerToken,
        websiteLink: seller.websiteLink,
        qrCode: seller.qrCode,
        images: seller.images || [],
        createdAt: seller.createdAt,
        verified: seller.verified
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
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    // Check password
    const isMatch = await seller.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
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

    // Get withdrawal data from Withdraw model
    const Withdraw = require('../models/Withdraw');
    const withdrawals = await Withdraw.find({ seller: seller._id })
      .sort({ requestedAt: -1 })
      .select('amount status requestedAt processedAt bankDetails');

    // Map withdrawal data to match expected format
    const mappedWithdrawals = withdrawals.map(withdrawal => ({
      _id: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      requestedAt: withdrawal.requestedAt,
      processedDate: withdrawal.processedAt,
      adminNotes: null,
      rejectionReason: null,
      bankDetails: withdrawal.bankDetails
    }));

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
        accountHolderName: seller.accountHolderName,
        bankAccountNumber: seller.bankAccountNumber,
        ifscCode: seller.ifscCode,
        bankName: seller.bankName,
        sellerToken: seller.sellerToken,
        websiteLink: seller.websiteLink,
        qrCode: seller.qrCode,
        images: seller.images || [],
        profileImage: seller.profileImage || null,
        totalOrders: seller.totalOrders || 0,
        totalCommission: seller.totalCommission || 0,
        availableCommission: seller.availableCommission || 0,
        bankDetails: seller.bankDetails || {},
        withdrawals: mappedWithdrawals,
        createdAt: seller.createdAt,
        verified: seller.verified,
        blocked: seller.blocked,
        upi: seller.upi
      }
    });
  } catch (error) {
    console.error('Seller login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

// Get seller profile (JWT protected)
exports.getProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller._id).select('-password');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Get withdrawal data from Withdraw model
    const Withdraw = require('../models/Withdraw');
    const withdrawals = await Withdraw.find({ seller: seller._id })
      .sort({ requestedAt: -1 })
      .select('amount status requestedAt processedAt bankDetails');

    // Map withdrawal data to match expected format
    const mappedWithdrawals = withdrawals.map(withdrawal => ({
      _id: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      requestedAt: withdrawal.requestedAt,
      processedDate: withdrawal.processedAt,
      adminNotes: null,
      rejectionReason: null,
      bankDetails: withdrawal.bankDetails
    }));

    // Calculate available commission using the new system
    const CommissionHistory = require('../models/CommissionHistory');
    
    // Get all confirmed commissions
    const confirmedCommissions = await CommissionHistory.find({
      sellerId: seller._id,
      status: 'confirmed',
      type: 'earned'
    });

    // Ensure all commission amounts are rounded to nearest 10 (for legacy data safety)
    const totalConfirmedCommissions = confirmedCommissions.reduce((sum, commission) => sum + Math.round(commission.amount / 10) * 10, 0);

    // Get all completed withdrawals
    const completedWithdrawals = await Withdraw.find({
      seller: seller._id,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Get pending withdrawals (amounts that are already requested but not yet processed)
    const pendingWithdrawals = await Withdraw.find({
      seller: seller._id,
      status: 'pending'
    });

    const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Calculate available commission
    const availableCommission = Math.max(0, totalConfirmedCommissions - totalWithdrawn - totalPendingWithdrawals);

    // Update seller's available commission in the database to match calculation
    if (seller.availableCommission !== availableCommission) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    // Combine seller data with withdrawal data
    const sellerWithWithdrawals = {
      ...seller.toObject(),
      withdrawals: mappedWithdrawals,
      calculatedAvailableCommission: availableCommission
    };

    res.json({
      success: true,
      seller: sellerWithWithdrawals
    });
  } catch (error) {
    console.error('Get seller profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
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
    };
    if (req.body.accountHolderName !== undefined) updates.accountHolderName = req.body.accountHolderName;
    if (req.body.bankAccountNumber !== undefined) updates.bankAccountNumber = req.body.bankAccountNumber;
    if (req.body.ifscCode !== undefined) updates.ifscCode = req.body.ifscCode;
    if (req.body.bankName !== undefined) updates.bankName = req.body.bankName;
    if (req.body.upi !== undefined) updates.upi = req.body.upi;
    // Also update the bankDetails object for consistency
    if (
      req.body.accountHolderName !== undefined ||
      req.body.bankAccountNumber !== undefined ||
      req.body.ifscCode !== undefined ||
      req.body.bankName !== undefined ||
      req.body.upi !== undefined
    ) {
      updates.bankDetails = {
        accountName: req.body.accountHolderName || '',
        accountNumber: req.body.bankAccountNumber || '',
        ifsc: req.body.ifscCode || '',
        bankName: req.body.bankName || '',
        upi: req.body.upi || ''
      };
    }
    const seller = await Seller.findByIdAndUpdate(
      req.seller._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Get withdrawal data from Withdraw model
    const Withdraw = require('../models/Withdraw');
    const withdrawals = await Withdraw.find({ seller: seller._id })
      .sort({ requestedAt: -1 })
      .select('amount status requestedAt processedAt bankDetails');

    // Map withdrawal data to match expected format
    const mappedWithdrawals = withdrawals.map(withdrawal => ({
      _id: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      requestedAt: withdrawal.requestedAt,
      processedDate: withdrawal.processedAt,
      adminNotes: null,
      rejectionReason: null,
      bankDetails: withdrawal.bankDetails
    }));

    // Calculate available commission using the new system (same as getProfile)
    const CommissionHistory = require('../models/CommissionHistory');
    
    // Get all confirmed commissions
    const confirmedCommissions = await CommissionHistory.find({
      sellerId: seller._id,
      status: 'confirmed',
      type: 'earned'
    });

    // Ensure all commission amounts are rounded to nearest 10 (for legacy data safety)
    const totalConfirmedCommissions = confirmedCommissions.reduce((sum, commission) => sum + Math.round(commission.amount / 10) * 10, 0);

    // Get all completed withdrawals
    const completedWithdrawals = await Withdraw.find({
      seller: seller._id,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Get pending withdrawals (amounts that are already requested but not yet processed)
    const pendingWithdrawals = await Withdraw.find({
      seller: seller._id,
      status: 'pending'
    });

    const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Calculate available commission
    const availableCommission = Math.max(0, totalConfirmedCommissions - totalWithdrawn - totalPendingWithdrawals);

    // Update seller's available commission in the database to match calculation
    if (seller.availableCommission !== availableCommission) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    // Combine seller data with withdrawal data
    const sellerWithWithdrawals = {
      ...seller.toObject(),
      withdrawals: mappedWithdrawals,
      calculatedAvailableCommission: availableCommission
    };

    res.json({
      success: true,
      seller: sellerWithWithdrawals
    });
  } catch (error) {
    console.error('Update seller profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
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
    
    // Get withdrawal data for each seller
    const Withdraw = require('../models/Withdraw');
    const sellersWithWithdrawals = await Promise.all(
      sellers.map(async (seller) => {
        const withdrawals = await Withdraw.find({ seller: seller._id })
          .sort({ requestedAt: -1 })
          .select('amount status requestedAt processedAt bankDetails');
        
        console.log(`Seller ${seller.businessName} has ${withdrawals.length} withdrawals`);
        
        // Map withdrawal data to match expected format
        const mappedWithdrawals = withdrawals.map(withdrawal => ({
          _id: withdrawal._id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          requestedAt: withdrawal.requestedAt,
          processedDate: withdrawal.processedAt,
          adminNotes: null,
          rejectionReason: null,
          bankDetails: withdrawal.bankDetails
        }));
        
        return {
          ...seller.toObject(),
          withdrawals: mappedWithdrawals
        };
      })
    );

    console.log('=== SELLERS WITH WITHDRAWALS ===');
    sellersWithWithdrawals.forEach(seller => {
      console.log(`Seller: ${seller.businessName}, Withdrawals: ${seller.withdrawals.length}`);
      seller.withdrawals.forEach(w => {
        console.log(`  - Withdrawal: ${w._id}, Amount: ${w.amount}, Status: ${w.status}`);
      });
    });

    res.json({
      success: true,
      sellers: sellersWithWithdrawals
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
      const sellerToken = `seller_${seller._id.toString().slice(-8)}_${Date.now()}`;
      const websiteLink = `${'https://rikocraft.com'}?seller=${sellerToken}`;
      
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

// Handle seller withdrawal request
exports.requestWithdraw = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { bankDetails, amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }
    // Fetch seller
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    
    // Check if seller is approved
    if (!seller.approved) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is not yet approved. Please wait for admin approval before making withdrawal requests.' 
      });
    }
    
    // Check if seller is blocked
    if (seller.blocked) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is blocked. Please contact admin for assistance.' 
      });
    }

    // Calculate available commission using the new system
    const CommissionHistory = require('../models/CommissionHistory');
    const Withdraw = require('../models/Withdraw');
    
    // Get all confirmed commissions
    const confirmedCommissions = await CommissionHistory.find({
      sellerId: seller._id,
      status: 'confirmed',
      type: 'earned'
    });

    // Ensure all commission amounts are rounded to nearest 10 (for legacy data safety)
    const totalConfirmedCommissions = confirmedCommissions.reduce((sum, commission) => sum + Math.round(commission.amount / 10) * 10, 0);

    // Get all completed withdrawals
    const completedWithdrawals = await Withdraw.find({
      seller: seller._id,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Get pending withdrawals (amounts that are already requested but not yet processed)
    const pendingWithdrawals = await Withdraw.find({
      seller: seller._id,
      status: 'pending'
    });

    const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Calculate available commission
    const availableCommission = Math.max(0, totalConfirmedCommissions - totalWithdrawn - totalPendingWithdrawals);

    console.log('Withdrawal calculation:', {
      sellerId: seller._id,
      requestedAmount: amount,
      availableCommission,
      totalConfirmedCommissions,
      totalWithdrawn,
      totalPendingWithdrawals
    });

    // Check if seller has sufficient available commission
    if (availableCommission < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient available commission for withdrawal. Available: ₹${availableCommission}, Requested: ₹${amount}`
      });
    }
    
    // Create Withdraw record
    const withdraw = await Withdraw.create({
      seller: sellerId,
      amount,
      bankDetails: {
        accountName: bankDetails.accountName || seller.accountHolderName || seller.bankDetails?.accountName || '',
        accountNumber: bankDetails.accountNumber || seller.bankAccountNumber || seller.bankDetails?.accountNumber || '',
        ifsc: bankDetails.ifsc || seller.ifscCode || seller.bankDetails?.ifsc || '',
        bankName: bankDetails.bankName || seller.bankName || seller.bankDetails?.bankName || '',
        upi: bankDetails.upi || seller.upi || seller.bankDetails?.upi || ''
      }
    });

    // Add to seller's withdrawals array
    seller.withdrawals.push({
      amount,
      requestedAt: withdraw.requestedAt,
      status: withdraw.status,
      processedAt: withdraw.processedAt
    });

    // Update seller's available commission to match calculation
    seller.availableCommission = availableCommission - amount;
    await seller.save();

    res.json({ 
      success: true, 
      message: 'Withdrawal request submitted', 
      withdraw,
      availableCommission: availableCommission - amount
    });
  } catch (error) {
    console.error('Withdraw request error:', error);
    res.status(500).json({ success: false, message: 'Error processing withdrawal request' });
  }
};

// In the order placement logic (createOrder or addCommission), before adding commission:
// if (seller.blocked) { /* do not add commission, optionally log or return */ return; } 