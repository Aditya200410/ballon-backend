const mongoose = require('mongoose');

// Counter model to track sequential numbers for various entities
const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  sequence: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Static method to get the next sequence number
counterSchema.statics.getNextSequence = async function(counterName) {
  const counter = await this.findOneAndUpdate(
    { name: counterName },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );
  return counter.sequence;
};

module.exports = mongoose.model('Counter', counterSchema);

