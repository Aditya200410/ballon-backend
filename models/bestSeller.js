// File: admin/backend/models/Product.js
const mongoose = require("mongoose");

const bestSellerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  material: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: String,
    required: true,
    trim: true
  },
  colour: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  weight: {
    type: String,
    required: true,
    trim: true
  },
  utility: {
    type: String,
    required: true,
    trim: true
  },
  care: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  regularPrice: {
    type: Number,
    required: true,
    min: 0
  },
  image: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  inStock: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0
  },
  reviews: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Add timestamps
});

// Add index for faster lookups
bestSellerSchema.index({ category: 1 });

module.exports = mongoose.model('BestSeller', bestSellerSchema);

