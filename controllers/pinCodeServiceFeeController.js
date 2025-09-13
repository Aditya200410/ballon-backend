const PinCodeServiceFee = require('../models/PinCodeServiceFee');

// Get all pin code service fees
const getAllPinCodeServiceFees = async (req, res) => {
  try {
    const pinCodeFees = await PinCodeServiceFee.find({ isActive: true })
      .sort({ startPinCode: 1 });
    
    res.status(200).json({ 
      success: true, 
      pinCodeFees 
    });
  } catch (error) {
    console.error('Error fetching pin code service fees:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pin code service fees', 
      error: error.message 
    });
  }
};

// Get pin code service fee by pin code
const getPinCodeServiceFee = async (req, res) => {
  try {
    const { pinCode } = req.params;
    
    if (!pinCode || !/^\d{6}$/.test(pinCode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid 6-digit pin code is required' 
      });
    }

    const pinCodeInt = parseInt(pinCode);
    
    // Find the pin code range that contains this pin code
    const pinCodeFee = await PinCodeServiceFee.findOne({
      isActive: true,
      startPinCode: { $lte: pinCode },
      endPinCode: { $gte: pinCode }
    });

    if (pinCodeFee) {
      res.status(200).json({ 
        success: true, 
        pinCodeFee,
        serviceFee: pinCodeFee.serviceFee
      });
    } else {
      // Return default service fee if no specific range found
      const defaultSetting = await require('../models/Settings').findOne({ key: 'default_service_fee' });
      const defaultFee = defaultSetting ? Number(defaultSetting.value) : 0;
      
      res.status(200).json({ 
        success: true, 
        pinCodeFee: null,
        serviceFee: defaultFee,
        isDefault: true
      });
    }
  } catch (error) {
    console.error('Error fetching pin code service fee:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pin code service fee', 
      error: error.message 
    });
  }
};

// Create new pin code service fee
const createPinCodeServiceFee = async (req, res) => {
  try {
    const { startPinCode, endPinCode, serviceFee, description } = req.body;
    
    if (!startPinCode || !endPinCode || serviceFee === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start pin code, end pin code, and service fee are required' 
      });
    }

    // Check for overlapping ranges
    const overlappingRange = await PinCodeServiceFee.findOne({
      isActive: true,
      $or: [
        {
          startPinCode: { $lte: endPinCode },
          endPinCode: { $gte: startPinCode }
        }
      ]
    });

    if (overlappingRange) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pin code range overlaps with existing range' 
      });
    }

    const pinCodeFee = new PinCodeServiceFee({
      startPinCode,
      endPinCode,
      serviceFee: Number(serviceFee),
      description: description || ''
    });

    await pinCodeFee.save();

    res.status(201).json({ 
      success: true, 
      message: 'Pin code service fee created successfully',
      pinCodeFee 
    });
  } catch (error) {
    console.error('Error creating pin code service fee:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create pin code service fee', 
      error: error.message 
    });
  }
};

// Update pin code service fee
const updatePinCodeServiceFee = async (req, res) => {
  try {
    const { id } = req.params;
    const { startPinCode, endPinCode, serviceFee, description, isActive } = req.body;
    
    const pinCodeFee = await PinCodeServiceFee.findById(id);
    if (!pinCodeFee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pin code service fee not found' 
      });
    }

    // Check for overlapping ranges (excluding current record)
    if (startPinCode || endPinCode) {
      const start = startPinCode || pinCodeFee.startPinCode;
      const end = endPinCode || pinCodeFee.endPinCode;
      
      const overlappingRange = await PinCodeServiceFee.findOne({
        _id: { $ne: id },
        isActive: true,
        $or: [
          {
            startPinCode: { $lte: end },
            endPinCode: { $gte: start }
          }
        ]
      });

      if (overlappingRange) {
        return res.status(400).json({ 
          success: false, 
          message: 'Pin code range overlaps with existing range' 
        });
      }
    }

    const updateData = {};
    if (startPinCode !== undefined) updateData.startPinCode = startPinCode;
    if (endPinCode !== undefined) updateData.endPinCode = endPinCode;
    if (serviceFee !== undefined) updateData.serviceFee = Number(serviceFee);
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedPinCodeFee = await PinCodeServiceFee.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );

    res.status(200).json({ 
      success: true, 
      message: 'Pin code service fee updated successfully',
      pinCodeFee: updatedPinCodeFee 
    });
  } catch (error) {
    console.error('Error updating pin code service fee:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update pin code service fee', 
      error: error.message 
    });
  }
};

// Delete pin code service fee
const deletePinCodeServiceFee = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pinCodeFee = await PinCodeServiceFee.findByIdAndDelete(id);
    if (!pinCodeFee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pin code service fee not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Pin code service fee deleted successfully',
      pinCodeFee 
    });
  } catch (error) {
    console.error('Error deleting pin code service fee:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete pin code service fee', 
      error: error.message 
    });
  }
};

// Get all pin code service fees (admin)
const getAllPinCodeServiceFeesAdmin = async (req, res) => {
  try {
    const pinCodeFees = await PinCodeServiceFee.find()
      .sort({ startPinCode: 1 });
    
    res.status(200).json({ 
      success: true, 
      pinCodeFees 
    });
  } catch (error) {
    console.error('Error fetching pin code service fees:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pin code service fees', 
      error: error.message 
    });
  }
};

module.exports = {
  getAllPinCodeServiceFees,
  getPinCodeServiceFee,
  createPinCodeServiceFee,
  updatePinCodeServiceFee,
  deletePinCodeServiceFee,
  getAllPinCodeServiceFeesAdmin
};
