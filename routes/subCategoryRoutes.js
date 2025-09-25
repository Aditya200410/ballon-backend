const express = require('express');
const router = express.Router();
const Category = require('../models/Category'); // Adjust path if necessary
const SubCategory = require('../models/SubCategory'); // The new model
const { handleSubCategoryImage } = require('../middleware/subCategoryUpload');

// Note: It's a good practice to protect these routes with authentication middleware.

// POST - Add a new sub-category to a specific category
router.post('/:categoryId/subcategories', handleSubCategoryImage, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, video, isActive, sortOrder } = req.body;

    // 1. Check if the parent category exists
    const parentCategory = await Category.findById(categoryId);
    if (!parentCategory) {
      return res.status(404).json({ message: 'Parent category not found' });
    }

    // 2. Handle image upload
    let imageUrl = '';
    if (req.file) {
      imageUrl = req.file.path; // Cloudinary URL
    }

    // 3. Create the new sub-category
    const newSubCategory = new SubCategory({
      name,
      description,
      image: imageUrl,
      video,
      isActive,
      sortOrder,
      parentCategory: categoryId // Link to the parent
    });

    await newSubCategory.save();
    res.status(201).json(newSubCategory);
  } catch (error) {
    res.status(500).json({ message: 'Error adding sub-category', error: error.message });
  }
});


// GET - List all sub-categories of a specific category
router.get('/:categoryId/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Check if the parent category exists to give a better error message
    const parentCategory = await Category.findById(categoryId);
    if (!parentCategory) {
      return res.status(404).json({ message: 'Parent category not found' });
    }

    const subCategories = await SubCategory.find({ parentCategory: categoryId });
    res.status(200).json(subCategories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sub-categories', error: error.message });
  }
});


// PUT - Update a specific sub-category by its ID
router.put('/subcategories/:subCategoryId', handleSubCategoryImage, async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    const updates = { ...req.body };

    // Handle image upload if file is provided
    if (req.file) {
      updates.image = req.file.path; // Cloudinary URL
    }

    // The { new: true } option returns the document after the update is applied.
    const updatedSubCategory = await SubCategory.findByIdAndUpdate(subCategoryId, updates, { new: true, runValidators: true });

    if (!updatedSubCategory) {
      return res.status(404).json({ message: 'Sub-category not found' });
    }

    res.status(200).json(updatedSubCategory);
  } catch (error) {
    res.status(500).json({ message: 'Error updating sub-category', error: error.message });
  }
});


// DELETE - Delete a specific sub-category by its ID
router.delete('/subcategories/:subCategoryId', async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    const deletedSubCategory = await SubCategory.findByIdAndDelete(subCategoryId);

    if (!deletedSubCategory) {
      return res.status(404).json({ message: 'Sub-category not found' });
    }

    res.status(200).json({ message: 'Sub-category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting sub-category', error: error.message });
  }
});


module.exports = router;