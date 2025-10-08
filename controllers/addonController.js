const Addon = require('../models/Addon');

// Get all add-ons
exports.getAllAddons = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }
    
    const addons = await Addon.find(filter).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: addons.length,
      data: addons
    });
  } catch (error) {
    console.error('Error fetching add-ons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch add-ons',
      error: error.message
    });
  }
};

// Get single add-on by ID
exports.getAddonById = async (req, res) => {
  try {
    const addon = await Addon.findById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: addon
    });
  } catch (error) {
    console.error('Error fetching add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch add-on',
      error: error.message
    });
  }
};

// Create new add-on
exports.createAddon = async (req, res) => {
  try {
    const { name, price, image, isActive } = req.body;
    
    // Validation
    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and price'
      });
    }
    
    const addon = await Addon.create({
      name,
      price: parseFloat(price),
      image: image || '',
      isActive: isActive !== undefined ? isActive : true
    });
    
    res.status(201).json({
      success: true,
      message: 'Add-on created successfully',
      data: addon
    });
  } catch (error) {
    console.error('Error creating add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create add-on',
      error: error.message
    });
  }
};

// Update add-on
exports.updateAddon = async (req, res) => {
  try {
    const { name, price, image, isActive } = req.body;
    
    const addon = await Addon.findById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found'
      });
    }
    
    // Update fields
    if (name !== undefined) addon.name = name;
    if (price !== undefined) addon.price = parseFloat(price);
    if (image !== undefined) addon.image = image;
    if (isActive !== undefined) addon.isActive = isActive;
    
    await addon.save();
    
    res.status(200).json({
      success: true,
      message: 'Add-on updated successfully',
      data: addon
    });
  } catch (error) {
    console.error('Error updating add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update add-on',
      error: error.message
    });
  }
};

// Delete add-on
exports.deleteAddon = async (req, res) => {
  try {
    const addon = await Addon.findById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found'
      });
    }
    
    await Addon.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Add-on deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete add-on',
      error: error.message
    });
  }
};

// Toggle add-on active status
exports.toggleAddonStatus = async (req, res) => {
  try {
    const addon = await Addon.findById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({
        success: false,
        message: 'Add-on not found'
      });
    }
    
    addon.isActive = !addon.isActive;
    await addon.save();
    
    res.status(200).json({
      success: true,
      message: `Add-on ${addon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: addon
    });
  } catch (error) {
    console.error('Error toggling add-on status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle add-on status',
      error: error.message
    });
  }
};

