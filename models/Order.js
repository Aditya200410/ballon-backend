const mongoose = require('mongoose');

// Schema for individual items within an order
const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: false },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  image: { type: String, required: false }, // Store primary image for reference
}, { _id: false });


// Main schema for an order
const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  email: { type: String, required: true, index: true }, // Index for fast lookups
  phone: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true },
  },
  items: [orderItemSchema], // Use the correct schema for items
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  orderStatus: { 
    type: String, 
    default: 'processing',
    enum: ['processing', 'confirmed', 'manufacturing', 'shipped', 'delivered']
  },
  paymentStatus: { 
    type: String, 
    required: true,
    enum: ['pending', 'completed', 'failed', 'pending_upfront']
  },
  upfrontAmount: { type: Number, default: 0 }, // Upfront payment amount for COD orders
  remainingAmount: { type: Number, default: 0 }, // Remaining amount to be paid on delivery
  sellerToken: { type: String, required: false }, // Track which seller referred this order
  commission: { type: Number, default: 0 }, // Commission amount for this order
  transactionId: { type: String, required: false }, // PhonePe transaction ID
  couponCode: { type: String, required: false }, // Coupon code if applied
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
