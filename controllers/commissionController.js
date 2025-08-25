const CommissionHistory = require('../models/CommissionHistory');
const Seller = require('../models/Seller');
const Order = require('../models/Order');

// Get seller's commission history
exports.getCommissionHistory = async (req, res) => {
  try {

    
    // Check if seller is authenticated
    if (!req.seller || !req.seller.id) {
      return res.status(401).json({
        success: false,
        message: 'Seller authentication required'
      });
    }

    const sellerId = req.seller.id;
    const { page = 1, limit = 10, type, status, startDate, endDate } = req.query;



    const query = { sellerId };
    
    if (type) query.type = type;
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }



    const commissionHistory = await CommissionHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('orderId', 'orderNumber customerName')
      .populate('withdrawalId', 'amount status')
      .populate('processedBy', 'name email');

    const total = await CommissionHistory.countDocuments(query);

    // Get summary statistics
    const summary = await CommissionHistory.aggregate([
      { $match: { sellerId: sellerId } },
      {
        $group: {
          _id: null,
          totalEarned: {
            $sum: {
              $cond: [
                { $in: ['$type', ['earned', 'bonus']] },
                '$amount',
                0
              ]
            }
          },
          totalDeducted: {
            $sum: {
              $cond: [
                { $in: ['$type', ['deducted', 'withdrawn']] },
                '$amount',
                0
              ]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                '$amount',
                0
              ]
            }
          },
          confirmedAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'confirmed'] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);



    res.json({
      success: true,
      commissionHistory,
      summary: summary[0] || {
        totalEarned: 0,
        totalDeducted: 0,
        pendingAmount: 0,
        confirmedAmount: 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get commission history error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission history',
      error: error.message
    });
  }
};

// Get commission details
exports.getCommissionDetails = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const sellerId = req.seller.id;

    const commission = await CommissionHistory.findOne({
      _id: commissionId,
      sellerId
    })
    .populate('orderId', 'orderNumber customerName items')
    .populate('withdrawalId', 'amount status bankDetails')
    .populate('processedBy', 'name email');

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission record not found'
      });
    }

    res.json({
      success: true,
      commission
    });

  } catch (error) {
    console.error('Get commission details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission details'
    });
  }
};

// Get commission summary
exports.getCommissionSummary = async (req, res) => {
  try {
    const sellerId = req.seller.id;

    // Get summary statistics (same as in getCommissionHistory)
    const summary = await CommissionHistory.aggregate([
      { $match: { sellerId: sellerId } },
      {
        $group: {
          _id: null,
          totalEarned: {
            $sum: {
              $cond: [
                { $in: ['$type', ['earned', 'bonus']] },
                '$amount',
                0
              ]
            }
          },
          totalDeducted: {
            $sum: {
              $cond: [
                { $in: ['$type', ['deducted', 'withdrawn']] },
                '$amount',
                0
              ]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                '$amount',
                0
              ]
            }
          },
          confirmedAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'confirmed'] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);

    const typeSummary = await CommissionHistory.aggregate([
      { $match: { sellerId: sellerId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    const statusSummary = await CommissionHistory.aggregate([
      { $match: { sellerId: sellerId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get monthly earnings for the last 12 months
    const monthlyEarnings = await CommissionHistory.aggregate([
      { 
        $match: { 
          sellerId: sellerId,
          type: 'earned',
          status: 'confirmed'
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalEarned: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      summary: summary[0] || {
        totalEarned: 0,
        totalDeducted: 0,
        pendingAmount: 0,
        confirmedAmount: 0
      },
      typeSummary,
      statusSummary,
      monthlyEarnings
    });

  } catch (error) {
    console.error('Get commission summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission summary'
    });
  }
};

// Create commission entry (called when order is completed)
exports.createCommissionEntry = async (orderId, sellerId, orderAmount, commissionRate = 0.05) => {
  try {

    
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    let commissionAmount = orderAmount * commissionRate;
    commissionAmount = Math.round(commissionAmount / 10) * 10; // round to nearest 10

    
    const commissionEntry = new CommissionHistory({
      sellerId,
      orderId,
      type: 'earned',
      amount: commissionAmount,
      commissionRate,
      orderAmount,
      description: `Commission earned from order #${order.orderNumber || orderId}`,
      status: 'confirmed',
      orderDetails: {
        orderNumber: order.orderNumber || `Order-${orderId}`,
        customerName: order.customerName || 'Unknown Customer',
        items: order.items ? order.items.map(item => ({
          productId: item.productId || null,
          productName: item.name || 'Unknown Product',
          quantity: item.quantity || 1,
          price: item.price || 0
        })) : []
      }
    });

    await commissionEntry.save();

    // Update seller's commission totals (only totalCommission, not availableCommission until confirmed)
    const seller = await Seller.findById(sellerId);
    if (seller) {
      seller.totalCommission += commissionAmount;
      seller.totalOrders += 1;
      
      await seller.save();
    } else {
      console.error('Seller not found for ID:', sellerId);
    }

    return commissionEntry;

  } catch (error) {
    console.error('Create commission entry error:', error);
    throw error;
  }
};

// Admin: Get all commission history
exports.getAllCommissionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, sellerId, type, status } = req.query;

    const query = {};
    if (sellerId) query.sellerId = sellerId;
    if (type) query.type = type;
    if (status) query.status = status;

    const commissionHistory = await CommissionHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('sellerId', 'businessName email phone')
      .populate('orderId', 'orderNumber customerName')
      .populate('withdrawalId', 'amount status')
      .populate('processedBy', 'name email');

    const total = await CommissionHistory.countDocuments(query);

    res.json({
      success: true,
      commissionHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all commission history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission history'
    });
  }
};

// Admin: Confirm commission
exports.confirmCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const adminId = req.admin.id;

    const commission = await CommissionHistory.findById(commissionId);
    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission record not found'
      });
    }

    // Only confirm if status is pending
    if (commission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Commission is not in pending status'
      });
    }

    await commission.confirm(adminId);

    // Recalculate available commission using the proper calculation function
    const withdrawalController = require('./withdrawalController');
    const { availableCommission } = await withdrawalController.calculateAvailableCommission(commission.sellerId);
    
    // Update seller's available commission
    const seller = await Seller.findById(commission.sellerId);
    if (seller) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    res.json({
      success: true,
      message: 'Commission confirmed successfully'
    });

  } catch (error) {
    console.error('Confirm commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm commission'
    });
  }
};

// Admin: Cancel commission
exports.cancelCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;

    const commission = await CommissionHistory.findById(commissionId);
    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission record not found'
      });
    }

    // Only cancel if status is pending
    if (commission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Commission is not in pending status'
      });
    }

    await commission.cancel(adminId, reason);

    res.json({
      success: true,
      message: 'Commission cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel commission'
    });
  }
};

// Helper function to recalculate seller's available commission
exports.recalculateSellerCommission = async (sellerId) => {
  try {
    // Use the proper calculation function from withdrawalController
    const withdrawalController = require('./withdrawalController');
    const { availableCommission } = await withdrawalController.calculateAvailableCommission(sellerId);

    // Update seller's available commission
    const seller = await Seller.findById(sellerId);
    if (seller) {
      seller.availableCommission = availableCommission;
      await seller.save();
    }

    return availableCommission;
  } catch (error) {
    console.error('Error recalculating seller commission:', error);
    throw error;
  }
}; 