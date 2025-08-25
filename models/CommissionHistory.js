const mongoose = require('mongoose');

const commissionHistorySchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  type: {
    type: String,
    enum: ['earned', 'deducted', 'adjusted', 'withdrawn', 'refunded', 'bonus'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  commissionRate: {
    type: Number,
    default: 0.05 // 5% default commission rate
  },
  orderAmount: {
    type: Number,
    required: false,
    default: 0
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  // For withdrawal-related entries
  withdrawalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal'
  },
  // For order details
  orderDetails: {
    orderNumber: String,
    customerName: String,
    items: [{
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      quantity: Number,
      price: Number
    }]
  },
  // For tracking purposes
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  notes: {
    type: String
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
commissionHistorySchema.index({ sellerId: 1, type: 1 });
commissionHistorySchema.index({ sellerId: 1, createdAt: -1 });
commissionHistorySchema.index({ orderId: 1 });
commissionHistorySchema.index({ withdrawalId: 1 });

// Pre-save middleware
commissionHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for formatted amount
commissionHistorySchema.virtual('formattedAmount').get(function() {
  const prefix = this.type === 'deducted' || this.type === 'withdrawn' ? '-' : '+';
  return `${prefix}₹${Math.abs(this.amount).toFixed(2)}`;
});

// Virtual for formatted order amount
commissionHistorySchema.virtual('formattedOrderAmount').get(function() {
  return `₹${this.orderAmount.toFixed(2)}`;
});

// Method to confirm commission
commissionHistorySchema.methods.confirm = function(adminId) {
  this.status = 'confirmed';
  this.processedBy = adminId;
  this.confirmedAt = new Date();
  return this.save();
};

// Method to cancel commission
commissionHistorySchema.methods.cancel = function(adminId, reason) {
  this.status = 'cancelled';
  this.processedBy = adminId;
  this.notes = reason;
  return this.save();
};

// Method to refund commission
commissionHistorySchema.methods.refund = function(adminId, reason) {
  this.status = 'refunded';
  this.processedBy = adminId;
  this.notes = reason;
  return this.save();
};

// Static method to get seller's total earnings
commissionHistorySchema.statics.getTotalEarnings = function(sellerId) {
  return this.aggregate([
    { $match: { sellerId: sellerId, status: 'confirmed' } },
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
        }
      }
    }
  ]);
};

// Static method to get seller's commission summary
commissionHistorySchema.statics.getCommissionSummary = function(sellerId) {
  return this.aggregate([
    { $match: { sellerId: sellerId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('CommissionHistory', commissionHistorySchema); 