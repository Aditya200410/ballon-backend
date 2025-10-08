const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  // Reference to the parent category
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category', // This must match the model name you used for Category
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  video: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  // Cities where this subcategory is available
  cities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City'
  }]
}, {
  timestamps: true
});

// Add indexes for faster lookups
subCategorySchema.index({ name: 1 });
subCategorySchema.index({ slug: 1 });
subCategorySchema.index({ parentCategory: 1 }); // Index the parent category for efficient queries

// Pre-save middleware to generate slug from the name
subCategorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('SubCategory', subCategorySchema);