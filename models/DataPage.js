const mongoose = require('mongoose');

const dataPageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['terms', 'refund', 'privacy'],
    required: true,
    unique: true
  },
  heading: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('DataPage', dataPageSchema); 