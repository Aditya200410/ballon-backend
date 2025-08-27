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

  // ✅ New Fields
  location: {
    type: String,
    required: false,
    trim: true
  },
  startingPrice: {
    type: Number,
    required: false,
    default: 0
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  maxPersonsAllowed: {
    type: Number,
    required: false,
    default: 50
  },

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



module.exports = mongoose.model('Seller', sellerSchema);
