const mongoose = require('mongoose');

const pinCodeServiceFeeSchema = new mongoose.Schema({
  startPinCode: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{6}$/.test(v);
      },
      message: 'Start pin code must be a 6-digit number'
    }
  },
  endPinCode: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{6}$/.test(v);
      },
      message: 'End pin code must be a 6-digit number'
    }
  },
  serviceFee: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster lookups
pinCodeServiceFeeSchema.index({ startPinCode: 1, endPinCode: 1 });
pinCodeServiceFeeSchema.index({ isActive: 1 });

// Validation to ensure startPinCode <= endPinCode
pinCodeServiceFeeSchema.pre('save', function(next) {
  if (parseInt(this.startPinCode) > parseInt(this.endPinCode)) {
    return next(new Error('Start pin code must be less than or equal to end pin code'));
  }
  next();
});

module.exports = mongoose.model('PinCodeServiceFee', pinCodeServiceFeeSchema);
