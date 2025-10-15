const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['review', 'work', 'testimonial', 'demo'],
    default: 'review',
    required: true
  },
  video: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
videoSchema.index({ category: 1, isActive: 1 });

// Create and export the Video model
const Video = mongoose.model('Video', videoSchema);
module.exports = Video;
