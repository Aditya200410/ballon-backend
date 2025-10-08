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

  // ✅ New Fields for Enhanced Venue Information
  amenity: {
    type: [String],
    required: false,
    default: []
  },
  totalHalls: {
    type: Number,
    required: false,
    default: 1
  },
  enquiryDetails: {
    type: String,
    required: false,
    trim: true
  },

  // ✅ Enhanced Venue Details
  bookingOpens: {
    type: String,
    required: false,
    trim: true
  },
  workingTimes: {
    type: String,
    required: false,
    trim: true
  },
  workingDates: {
    type: String,
    required: false,
    trim: true
  },
  foodType: {
    type: [String],
    required: false,
    default: []
  },
  roomsAvailable: {
    type: Number,
    required: false,
    default: 1
  },
  bookingPolicy: {
    type: String,
    required: false,
    trim: true
  },
  additionalFeatures: {
    type: [String],
    required: false,
    default: []
  },

  // ✅ NEW: Included/Excluded/FAQ Fields
  included: {
    type: [String],
    required: false,
    default: []
  },
  excluded: {
    type: [String],
    required: false,
    default: []
  },
  faq: [{
    question: { type: String, required: false },
    answer: { type: String, required: false }
  }],

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
  views: {
    type: Number,
    default: 0
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

// Compare password method
sellerSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Seller', sellerSchema);
