const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  userName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  stars: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  reviewDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure one review per email per product
// reviewSchema.index({ userEmail: 1, product: 1 }, { unique: true }); // Removed unique index for admin multi-review

// Create and export the Review model
const Review = mongoose.model('Review', reviewSchema);
module.exports = Review; 