const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
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
  stock: {
    type: Number,
    default: 10
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isMostLoved: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0
  },
  reviews: {
    type: Number,
    default: 0
  },
  codAvailable: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// Create and export the Product model
const Product = mongoose.model('Product', productSchema);
module.exports = Product; 