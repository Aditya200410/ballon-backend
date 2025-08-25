const Withdraw = require('../models/Withdraw');
const Seller = require('../models/Seller');
const CommissionHistory = require('../models/CommissionHistory');

// Function to calculate available commission based on commission history and withdrawals
exports.calculateAvailableCommission = async (sellerId) => {
  try {
    // Get all confirmed commissions
    const confirmedCommissions = await CommissionHistory.find({
      sellerId,
      status: 'confirmed',
      type: 'earned'
    });

    const totalConfirmedCommissions = confirmedCommissions.reduce((sum, commission) => sum + commission.amount, 0);

    // Get all completed withdrawals
    const completedWithdrawals = await Withdraw.find({
      seller: sellerId,
      status: 'completed'
    });

    const totalWithdrawn = completedWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Get pending withdrawals (amounts that are already requested but not yet processed)
    const pendingWithdrawals = await Withdraw.find({
      seller: sellerId,
      status: 'pending'
    });

    const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);

    // Available commission = confirmed commissions - completed withdrawals - pending withdrawals
    const availableCommission = Math.max(0, totalConfirmedCommissions - totalWithdrawn - totalPendingWithdrawals);

    return {
      availableCommission,
      totalConfirmedCommissions,
      totalWithdrawn,
      totalPendingWithdrawals
    };
  } catch (error) {
    console.error('Error calculating available commission:', error);
    throw error;
  }
};

// Request withdrawal (updated to use proper calculation)
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, sellerNotes } = req.body;
    const sellerId = req.seller.id; // From auth middleware

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }

    // Get seller details
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Calculate available commission using the new system
    const { availableCommission, totalConfirmedCommissions, totalWithdrawn, totalPendingWithdrawals } = 
      await calculateAvailableCommission(sellerId);

    console.log('Withdrawal calculation:', {
      sellerId,
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

    // Validate bank details
    if (!seller.bankAccountNumber || !seller.ifscCode || !seller.bankName || !seller.accountHolderName) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your bank details before requesting withdrawal'
      });
    }

    // Create withdrawal request using old system
    const withdrawal = new Withdraw({
      seller: sellerId,
      amount,
      bankDetails: {
        accountName: seller.accountHolderName,
        accountNumber: seller.bankAccountNumber,
        ifsc: seller.ifscCode,
        bankName: seller.bankName
      }
    });

    await withdrawal.save();

    // Update seller's available commission in the database to match calculation
    seller.availableCommission = availableCommission - amount;
    await seller.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestDate: withdrawal.requestedAt
      },
      availableCommission: availableCommission - amount
    });

  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit withdrawal request'
    });
  }
};

// Get seller's withdrawal history (old system)
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const sellerId = req.seller.id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { seller: sellerId };
    if (status) {
      query.status = status;
    }

    const withdrawals = await Withdraw.find(query)
      .sort({ requestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Withdraw.countDocuments(query);

    res.json({
      success: true,
      withdrawals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal history'
    });
  }
};

// Get withdrawal details (old system)
exports.getWithdrawalDetails = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const sellerId = req.seller.id;

    const withdrawal = await Withdraw.findOne({
      _id: withdrawalId,
      seller: sellerId
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    res.json({
      success: true,
      withdrawal
    });

  } catch (error) {
    console.error('Get withdrawal details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal details'
    });
  }
};

// Cancel withdrawal request (old system)
exports.cancelWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const sellerId = req.seller.id;

    const withdrawal = await Withdraw.findOne({
      _id: withdrawalId,
      seller: sellerId,
      status: 'pending'
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found or cannot be cancelled'
      });
    }

    // Update withdrawal status
    withdrawal.status = 'cancelled';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Recalculate available commission after cancellation
    const { availableCommission } = await calculateAvailableCommission(sellerId);
    
    // Update seller's available commission
    const seller = await Seller.findById(sellerId);
    seller.availableCommission = availableCommission;
    await seller.save();

    res.json({
      success: true,
      message: 'Withdrawal request cancelled successfully',
      availableCommission
    });

  } catch (error) {
    console.error('Cancel withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel withdrawal request'
    });
  }
};

// Admin: Get all withdrawal requests (old system only)
exports.getAllWithdrawals = async (req, res) => {
  try {
    console.log('=== GET ALL WITHDRAWALS REQUEST ===');
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);
    console.log('Query params:', req.query);
    
    const { page = 1, limit = 20, status, sellerId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (sellerId) query.seller = sellerId;

    console.log('MongoDB query:', query);

    // Get withdrawals from old system (Withdraw model) only
    const Withdraw = require('../models/Withdraw');
    let withdrawals = await Withdraw.find(query)
      .sort({ requestedAt: -1 })
      .populate('seller', 'businessName email phone');

    console.log('Withdrawals count:', withdrawals.length);
    console.log('Withdrawals:', withdrawals.map(w => ({
      id: w._id,
      amount: w.amount,
      status: w.status,
      sellerId: w.seller,
      sellerName: w.seller?.businessName || 'Unknown'
    })));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedWithdrawals = withdrawals.slice(startIndex, endIndex);

    const total = withdrawals.length;

    res.json({
      success: true,
      withdrawals: paginatedWithdrawals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals'
    });
  }
};

// Admin: Approve withdrawal (old system only)
exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const adminId = req.user?.id;

    console.log('=== APPROVE WITHDRAWAL REQUEST ===');
    console.log('Withdrawal ID:', withdrawalId);
    console.log('Admin ID:', adminId);
    console.log('Request user:', req.user);
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);

    if (!withdrawalId) {
      console.log('No withdrawal ID provided');
      return res.status(400).json({
        success: false,
        message: 'Withdrawal ID is required'
      });
    }

    // Find in old system only
    const Withdraw = require('../models/Withdraw');
    const withdrawal = await Withdraw.findById(withdrawalId);

    if (!withdrawal) {
      console.log('Withdrawal not found:', withdrawalId);
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    console.log('Found withdrawal:', {
      id: withdrawal._id,
      status: withdrawal.status,
      amount: withdrawal.amount
    });

    if (withdrawal.status !== 'pending') {
      console.log('Withdrawal cannot be approved - current status:', withdrawal.status);
      return res.status(400).json({
        success: false,
        message: 'Withdrawal cannot be approved in current status'
      });
    }

    // Old system approval
    withdrawal.status = 'completed';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Recalculate available commission after approval
    const { availableCommission } = await calculateAvailableCommission(withdrawal.seller);
    
    // Update seller's available commission
    const seller = await Seller.findById(withdrawal.seller);
    if (seller) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    console.log('Withdrawal approved successfully');

    res.json({
      success: true,
      message: 'Withdrawal approved successfully. Amount will be credited in 3-5 business days.',
      withdrawal: {
        id: withdrawal._id,
        status: withdrawal.status,
        processedDate: withdrawal.processedAt
      },
      availableCommission
    });

  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve withdrawal',
      error: error.message
    });
  }
};

// Admin: Reject withdrawal (old system only)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    console.log('Rejecting withdrawal:', withdrawalId);

    // Find in old system only
    const Withdraw = require('../models/Withdraw');
    const withdrawal = await Withdraw.findById(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal cannot be rejected in current status'
      });
    }

    // Old system rejection
    withdrawal.status = 'rejected';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Recalculate available commission after rejection (pending amount is freed up)
    const { availableCommission } = await calculateAvailableCommission(withdrawal.seller);
    
    // Update seller's available commission
    const seller = await Seller.findById(withdrawal.seller);
    if (seller) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    console.log('Withdrawal rejected successfully');

    res.json({
      success: true,
      message: 'Withdrawal rejected successfully',
      availableCommission
    });

  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject withdrawal'
    });
  }
};

// Admin: Complete withdrawal (old system only)
exports.completeWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const adminId = req.user.id;

    console.log('Completing withdrawal:', withdrawalId);

    // Find in old system only
    const Withdraw = require('../models/Withdraw');
    const withdrawal = await Withdraw.findById(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending' && withdrawal.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal cannot be completed in current status'
      });
    }

    // Mark as completed
    withdrawal.status = 'completed';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Recalculate available commission after completion
    const { availableCommission } = await exports.calculateAvailableCommission(withdrawal.seller);
    
    // Update seller's available commission
    const seller = await Seller.findById(withdrawal.seller);
    if (seller) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    console.log('Withdrawal completed successfully');

    res.json({
      success: true,
      message: 'Withdrawal marked as completed',
      availableCommission
    });

  } catch (error) {
    console.error('Complete withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete withdrawal'
    });
  }
};

// Admin: Recalculate all sellers' available commission
exports.recalculateAllSellersCommission = async (req, res) => {
  try {
    console.log('=== RECALCULATE ALL SELLERS COMMISSION ===');
    
    const sellers = await Seller.find({});
    let updatedCount = 0;
    let errors = [];

    for (const seller of sellers) {
      try {
        const { availableCommission } = await exports.calculateAvailableCommission(seller._id);
        
        if (seller.availableCommission !== availableCommission) {
          seller.availableCommission = availableCommission;
          await seller.save();
          updatedCount++;
          
          console.log(`Updated seller ${seller.businessName}: ${seller.availableCommission} -> ${availableCommission}`);
        }
      } catch (error) {
        console.error(`Error updating seller ${seller.businessName}:`, error);
        errors.push({
          sellerId: seller._id,
          sellerName: seller.businessName,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Recalculated commission for ${updatedCount} sellers`,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Recalculate all sellers commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate sellers commission'
    });
  }
};

// Admin: Get all withdrawals for a specific seller (old system only)
exports.getWithdrawalsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'sellerId is required' });
    }

    console.log('=== GET WITHDRAWALS BY SELLER ===');
    console.log('Seller ID:', sellerId);

    // Get withdrawals from old system (Withdraw model) only
    const Withdraw = require('../models/Withdraw');
    const withdrawals = await Withdraw.find({ seller: sellerId })
      .sort({ requestedAt: -1 })
      .populate('seller', 'businessName email phone');

    console.log('Withdrawals for seller:', withdrawals.length);

    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('Get withdrawals by seller error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals for seller' });
  }
}; 