const Coupon = require('../models/coupon');

// Get all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt');
    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ message: "Error fetching coupons", error: error.message });
  }
};

// Create new coupon
exports.createCoupon = async (req, res) => {
  try {
    const { code, name, discountPercentage, maxUses, minOrderAmount, expiryDate, isActive } = req.body;

    // Validate required fields
    if (!code || !discountPercentage || !maxUses || !minOrderAmount || !expiryDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType: 'percentage',
      discountValue: Number(discountPercentage),
      usageLimit: Number(maxUses),
      minPurchase: Number(minOrderAmount),
      endDate: new Date(expiryDate),
      isActive: isActive !== undefined ? isActive : true,
      startDate: new Date()
    });

    await newCoupon.save();
    res.status(201).json(newCoupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ message: "Error creating coupon", error: error.message });
  }
};

// Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { code, name, discountPercentage, maxUses, minOrderAmount, expiryDate, isActive } = req.body;
    
    // Check if coupon exists
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // If code is being changed, check if new code already exists
    if (code && code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (existingCoupon) {
        return res.status(400).json({ message: "Coupon code already exists" });
      }
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code: code ? code.toUpperCase() : coupon.code,
        discountType: 'percentage',
        discountValue: discountPercentage ? Number(discountPercentage) : coupon.discountValue,
        usageLimit: maxUses ? Number(maxUses) : coupon.usageLimit,
        minPurchase: minOrderAmount ? Number(minOrderAmount) : coupon.minPurchase,
        endDate: expiryDate ? new Date(expiryDate) : coupon.endDate,
        isActive: isActive !== undefined ? isActive : coupon.isActive
      },
      { new: true }
    );

    res.json(updatedCoupon);
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ message: "Error updating coupon", error: error.message });
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ message: "Error deleting coupon", error: error.message });
  }
};

// Validate coupon and calculate discounted price
exports.validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code || !cartTotal) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and cart total are required'
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired coupon code'
      });
    }

    // Check minimum purchase requirement
    if (cartTotal < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`
      });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit exceeded'
      });
    }

    // Calculate discount
    let discountAmount = (cartTotal * coupon.discountValue) / 100;
    
    // Apply max discount if specified
    if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }

    // Calculate final price
    const finalPrice = cartTotal - discountAmount;

    res.json({
      success: true,
      data: {
        coupon,
        discountAmount,
        finalPrice,
        message: `Coupon applied successfully! You saved ₹${discountAmount.toFixed(2)}`
      }
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating coupon'
    });
  }
};

// Apply coupon (increment usage count)
exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    
    const coupon = await Coupon.findOneAndUpdate(
      { code: code.toUpperCase() },
      { $inc: { usedCount: 1 } },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      message: 'Coupon applied successfully'
    });

  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying coupon'
    });
  }
}; 