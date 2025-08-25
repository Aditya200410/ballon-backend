const mongoose = require('mongoose');

const tempUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: false // Not required for password reset
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false // Not required for password reset
  },
  phone: {
    type: String,
    required: false // Not required for password reset
  },
  otp: {
    type: String,
    required: false // Not required for all cases
  },
  otpExpires: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Document will be automatically deleted after 10 minutes
  }
});

// Check if model exists before creating
module.exports = mongoose.models.TempUser || mongoose.model('TempUser', tempUserSchema); 