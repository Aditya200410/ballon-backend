const Product = require('../models/Product');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

// Get products by section
const getProductsBySection = async (req, res) => {
  try {
    const { section } = req.params;
    let query = {};
    
    switch(section) {
      case 'bestsellers':
        query = { isBestSeller: true };
        break;
      case 'featured':
        query = { isFeatured: true };
        break;
      case 'mostloved':
        query = { isMostLoved: true };
        break;
      default:
        return res.status(400).json({ message: "Invalid section" });
    }
    
    const products = await Product.find(query);
    res.json(products);
  } catch (error) {
    console.error(`Error fetching ${section} products:`, error);
    res.status(500).json({ message: `Error fetching ${section} products`, error: error.message });
  }
};

// Get single product
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: "Error fetching product", error: error.message });
  }
};

// Create new product with file upload
const createProductWithFiles = async (req, res) => {
  try {
    console.log('=== Starting Product Creation ===');
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

    console.log('Creating new product with data:', {
      name: productData.name,
      category: productData.category,
      price: productData.price,
      images: imagePaths
    });

    const newProduct = new Product({
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
      isBestSeller: productData.isBestSeller === 'true' || productData.isBestSeller === true,
      isFeatured: productData.isFeatured === 'true' || productData.isFeatured === true,
      isMostLoved: productData.isMostLoved === 'true' || productData.isMostLoved === true,
      codAvailable: productData.codAvailable === 'false' ? false : true,
      stock: typeof productData.stock !== 'undefined' ? Number(productData.stock) : 0
    });
    
    console.log('Saving product to database...');
    const savedProduct = await newProduct.save();
    console.log('Product saved successfully:', savedProduct);
    
    res.status(201).json({ 
      message: "Product created successfully", 
      product: savedProduct,
      uploadedFiles: files
    });
  } catch (error) {
    console.error('=== Error creating product ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: "Error creating product", 
      error: error.message,
      details: error.stack
    });
  }
};

// Update product with file upload
const updateProductWithFiles = async (req, res) => {
  try {
    console.log('Updating product with files:', req.files);
    console.log('Update data:', req.body);

    const id = req.params.id;
    const files = req.files || {};
    const productData = req.body;
    
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
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
      image: imagePaths[0],
      images: imagePaths,
      inStock: productData.inStock !== undefined ? (productData.inStock === 'true' || productData.inStock === true) : existingProduct.inStock,
      isBestSeller: productData.isBestSeller !== undefined ? (productData.isBestSeller === 'true' || productData.isBestSeller === true) : existingProduct.isBestSeller,
      isFeatured: productData.isFeatured !== undefined ? (productData.isFeatured === 'true' || productData.isFeatured === true) : existingProduct.isFeatured,
      isMostLoved: productData.isMostLoved !== undefined ? (productData.isMostLoved === 'true' || productData.isMostLoved === true) : existingProduct.isMostLoved,
      codAvailable: productData.codAvailable === 'false' ? false : true,
      stock: typeof productData.stock !== 'undefined' ? Number(productData.stock) : existingProduct.stock
    };

    const result = await Product.findByIdAndUpdate(id, updatedProduct, { new: true });
    res.json({ message: "Product updated successfully", product: result });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: "Error updating product", error: error.message });
  }
};

// Update product section flags
const updateProductSections = async (req, res) => {
  try {
    console.log('=== Starting Section Update ===');
    console.log('Product ID:', req.params.id);
    console.log('Update data:', req.body);

    const { id } = req.params;
    const { isBestSeller, isFeatured, isMostLoved } = req.body;

    // Validate that at least one section flag is provided
    if (isBestSeller === undefined && isFeatured === undefined && isMostLoved === undefined) {
      console.log('Error: No section flags provided');
      return res.status(400).json({ message: "At least one section flag must be provided" });
    }

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      console.log('Error: Product not found');
      return res.status(404).json({ message: "Product not found" });
    }

    console.log('Current product sections:', {
      isBestSeller: product.isBestSeller,
      isFeatured: product.isFeatured,
      isMostLoved: product.isMostLoved
    });

    // Build update object with only the provided flags
    const updates = {};
    if (isBestSeller !== undefined) updates.isBestSeller = isBestSeller;
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;
    if (isMostLoved !== undefined) updates.isMostLoved = isMostLoved;

    console.log('Applying updates:', updates);

    // Update the product with new section flags
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    console.log('Updated product sections:', {
      isBestSeller: updatedProduct.isBestSeller,
      isFeatured: updatedProduct.isFeatured,
      isMostLoved: updatedProduct.isMostLoved
    });

    res.json({
      message: "Product sections updated successfully",
      product: updatedProduct
    });
  } catch (error) {
    console.error('=== Error Updating Sections ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: "Error updating product sections", 
      error: error.message,
      details: error.stack
    });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: "Error deleting product", error: error.message });
  }
};

module.exports = {
  getAllProducts,
  getProductsBySection,
  getProduct,
  createProductWithFiles,
  updateProductWithFiles,
  updateProductSections,
  deleteProduct
}; 