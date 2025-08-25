const Loved = require('../models/loved');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Get all loved products
const getAllLovedProducts = async (req, res) => {
  try {
    const products = await Loved.find();
    res.json({ products: products.map(product => ({
      ...product.toObject(),
      id: product._id
    }))});
  } catch (error) {
    console.error('Error fetching loved products:', error);
    res.status(500).json({ message: "Error fetching loved products", error: error.message });
  }
};

// Get single loved product
const getLovedProduct = async (req, res) => {
  try {
    const product = await Loved.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Loved product not found" });
    }
    const productObj = product.toObject();
    res.json({ 
      product: {
        ...productObj,
        id: productObj._id
      }
    });
  } catch (error) {
    console.error('Error fetching loved product:', error);
    res.status(500).json({ message: "Error fetching loved product", error: error.message });
  }
};

// Create new loved product with file upload
const createLovedProductWithFiles = async (req, res) => {
  try {
    console.log('=== Starting Loved Product Creation ===');
    console.log('Headers:', req.headers);
    console.log('Files received:', req.files);
    console.log('Body data:', req.body);
    console.log('Auth token:', req.headers.authorization);

    if (!req.files || !req.files.mainImage) {
      console.log('Error: Missing main image');
      return res.status(400).json({ 
        error: 'Main image is required. Make sure you are uploading as multipart/form-data and the main image field is named "mainImage".' 
      });
    }

    const files = req.files;
    const productData = req.body;
    
    // Validate required fields
    const requiredFields = [
      "name",
      "material",
      "description",
      "size",
      "colour",
      "category",
      "weight",
      "utility",
      "care",
      "price",
      "regularPrice"
    ];

    console.log('Validating required fields...');
    const missingFields = [];
    for (const field of requiredFields) {
      if (!productData[field]) {
        missingFields.push(field);
        console.log(`Missing required field: ${field}`);
      }
    }

    if (missingFields.length > 0) {
      console.log('Error: Missing required fields:', missingFields);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Process uploaded files
    console.log('Processing uploaded files...');
    const imagePaths = [];
    
    // Main image
    if (files.mainImage && files.mainImage[0]) {
      const mainImageUrl = files.mainImage[0].path; // Cloudinary URL
      imagePaths.push(mainImageUrl);
      console.log('Added main image:', mainImageUrl);
    }

    // Additional images
    for (let i = 1; i <= 3; i++) {
      if (files[`image${i}`] && files[`image${i}`][0]) {
        const imageUrl = files[`image${i}`][0].path; // Cloudinary URL
        imagePaths.push(imageUrl);
        console.log(`Added image${i}:`, imageUrl);
      }
    }

    console.log('Creating new loved product with data:', {
      name: productData.name,
      category: productData.category,
      price: productData.price,
      images: imagePaths
    });

    const newProduct = new Loved({
      name: productData.name,
      material: productData.material,
      description: productData.description,
      size: productData.size,
      colour: productData.colour,
      category: productData.category,
      weight: productData.weight,
      utility: productData.utility,
      care: productData.care,
      price: parseFloat(productData.price),
      regularPrice: parseFloat(productData.regularPrice),
      image: imagePaths[0], // Main image Cloudinary URL
      images: imagePaths, // All Cloudinary URLs
      inStock: productData.inStock === 'true' || productData.inStock === true,
      rating: 0,
      reviews: 0
    });
    
    console.log('Saving loved product to database...');
    const savedProduct = await newProduct.save();
    console.log('Loved product saved successfully:', savedProduct);
    
    res.status(201).json({ 
      message: "Loved product created successfully", 
      product: savedProduct,
      uploadedFiles: files
    });
  } catch (error) {
    console.error('=== Error creating loved product ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: "Error creating loved product", 
      error: error.message,
      details: error.stack
    });
  }
};

// Update loved product with file upload
const updateLovedProductWithFiles = async (req, res) => {
  try {
    console.log('Updating loved product with files:', req.files);
    console.log('Update data:', req.body);

    const id = req.params.id;
    const files = req.files || {};
    const productData = req.body;
    
    const existingProduct = await Loved.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Loved product not found" });
    }

    // Initialize imagePaths with existing images
    let imagePaths = existingProduct.images || [];
    if (!Array.isArray(imagePaths)) {
      // If images is not an array, initialize it with the main image if it exists
      imagePaths = existingProduct.image ? [existingProduct.image] : [];
    }

    // Handle main image update
    if (files.mainImage && files.mainImage[0]) {
      const mainImageUrl = files.mainImage[0].path;
      if (imagePaths.length === 0) {
        imagePaths.push(mainImageUrl);
      } else {
        imagePaths[0] = mainImageUrl;
      }
    }

    // Handle additional images
    for (let i = 1; i <= 3; i++) {
      if (files[`image${i}`] && files[`image${i}`][0]) {
        const imageUrl = files[`image${i}`][0].path;
        if (i < imagePaths.length) {
          imagePaths[i] = imageUrl;
        } else {
          imagePaths.push(imageUrl);
        }
      }
    }

    // Ensure we have at least one image
    if (imagePaths.length === 0 && existingProduct.image) {
      imagePaths.push(existingProduct.image);
    }

    // Update product object
    const updatedProduct = {
      name: productData.name || existingProduct.name,
      material: productData.material || existingProduct.material,
      description: productData.description || existingProduct.description,
      size: productData.size || existingProduct.size,
      colour: productData.colour || existingProduct.colour,
      category: productData.category || existingProduct.category,
      weight: productData.weight || existingProduct.weight,
      utility: productData.utility || existingProduct.utility,
      care: productData.care || existingProduct.care,
      price: productData.price ? parseFloat(productData.price) : existingProduct.price,
      regularPrice: productData.regularPrice ? parseFloat(productData.regularPrice) : existingProduct.regularPrice,
      image: imagePaths[0], // Always use first image as main image
      images: imagePaths,
      inStock: productData.inStock !== undefined ? (productData.inStock === 'true' || productData.inStock === true) : existingProduct.inStock
    };

    // Log the update operation
    console.log('Updating loved product with data:', {
      id,
      imagePaths,
      mainImage: updatedProduct.image,
      filesReceived: Object.keys(files)
    });

    const savedProduct = await Loved.findByIdAndUpdate(id, updatedProduct, { new: true });

    res.json({ 
      message: "Loved product updated successfully", 
      product: savedProduct,
      uploadedFiles: files
    });
  } catch (error) {
    console.error('Error updating loved product:', error);
    res.status(500).json({ message: "Error updating loved product", error: error.message });
  }
};

// Delete loved product
const deleteLovedProduct = async (req, res) => {
  try {
    const product = await Loved.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Loved product not found" });
    }
    res.json({ message: "Loved product deleted successfully" });
  } catch (error) {
    console.error('Error deleting loved product:', error);
    res.status(500).json({ message: "Error deleting loved product", error: error.message });
  }
};

module.exports = {
  getAllLovedProducts,
  getLovedProduct,
  createLovedProductWithFiles,
  updateLovedProductWithFiles,
  deleteLovedProduct
}; 