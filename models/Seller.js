const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const sellerSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  phone: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  businessType: {
    type: String,
    required: false
  },
  // Bank Details - Required fields
  bankAccountNumber: {
    type: String,
    required: false,
    trim: true
  },
  ifscCode: {
    type: String,
    required: false,
    trim: true,
    uppercase: true
  },
  bankName: {
    type: String,
    required: false,
    trim: true
  },
  accountHolderName: {
    type: String,
    required: false,
    trim: true
  },
  sellerToken: {
    type: String,
    required: false
  },
  websiteLink: {
    type: String,
    required: false
  },
  qrCode: {
    type: String // Base64 encoded QR code image
  },
  // Multiple images for seller profile
  images: [{
    public_id: { type: String },
    url: { type: String },
    alt: { type: String, default: 'Seller image' }
  }],
  profileImage: {
    public_id: { type: String },
    url: { type: String },
    alt: { type: String, default: 'Profile image' }
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalCommission: {
    type: Number,
    default: 0
  },
  availableCommission: {
    type: Number,
    default: 0
  },
  bankDetails: {
    accountName: { type: String },
    accountNumber: { type: String },
    ifsc: { type: String },
    bankName: { type: String },
    upi: { type: String }
  },
  withdrawals: [
    {
      amount: Number,
      requestedAt: Date,
      status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
      processedAt: Date
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  },
  blocked: {
    type: Boolean,
    default: false
  },
  approved: {
    type: Boolean,
    default: false
  },
  upi: {
    type: String,
    required: false,
    trim: true
  }
});

// Hash password before saving
sellerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
sellerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to add commission
sellerSchema.methods.addCommission = async function(orderAmount) {
  const commission = orderAmount * 0.30; // 30% commission
  console.log(`Seller.addCommission - Order amount: ${orderAmount}, Commission: ${commission}`);
  console.log(`Seller.addCommission - Before update - Total: ${this.totalCommission}, Available: ${this.availableCommission}, Orders: ${this.totalOrders}`);
  
  this.totalCommission += commission;
  // Note: availableCommission should not be updated here as commissions start as pending
  // and only become available when confirmed by admin
  this.totalOrders += 1;
  
  console.log(`Seller.addCommission - After update - Total: ${this.totalCommission}, Available: ${this.availableCommission}, Orders: ${this.totalOrders}`);
  
  await this.save();
  return commission;
};

module.exports = mongoose.model('Seller', sellerSchema); 