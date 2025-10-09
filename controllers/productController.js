const Product = require('../models/Product');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Get all products (supports optional query filters: category (name or id), subCategory (name or id), limit, search, city)
const getAllProducts = async (req, res) => {
  try {
    const { category, subCategory, limit, search, city } = req.query;

    // Base query: only show products that are in stock and have stock > 0
    const query = {
      inStock: true,
      stock: { $gt: 0 }
    };

    // If city provided, filter by city (with backward compatibility)
    if (city) {
      const City = require('../models/City');
      let cityId = null;
      
      if (mongoose.Types.ObjectId.isValid(city)) {
        cityId = city;
      } else {
        // Try to find city by name
        const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, 'i') });
        if (cityDoc) {
          cityId = cityDoc._id;
        }
      }
      
      if (cityId) {
        // Find products that either:
        // 1. Have this city in their cities array, OR
        // 2. Have an empty cities array (backward compatibility)
        query.$or = [
          { cities: cityId },
          { cities: { $exists: false } },
          { cities: { $size: 0 } }
        ];
      }
    }

    // If category provided, try to handle both ObjectId and name (case-insensitive)
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        // First try to find category by name or slug
        const catDoc = await Category.findOne({ 
          $or: [
            { name: new RegExp(`^${category}$`, 'i') },
            { slug: category.toLowerCase() }
          ]
        });
        
        if (catDoc) {
          query.category = catDoc._id;
          // Note: We don't need to verify category-city match here because
          // the product query already handles city filtering with backward compatibility
        } else {
          // Category not found
          return res.json([]);
        }
      }
    }

    // If subCategory provided, support both id and name. subCategory is stored as ObjectId in Product.
    if (subCategory) {
      if (mongoose.Types.ObjectId.isValid(subCategory)) {
        query.subCategory = subCategory;
      } else {
        // try to find SubCategory by name — using SubCategory model if available
        // Fallback: attempt to match subCategory name stored as string (in case of legacy data)
        query['subCategory.name'] = new RegExp(`^${subCategory}$`, 'i');
      }
    }

    // Handle search with MongoDB text search (much faster with indexes)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      
      // Use MongoDB text search for better performance with indexes
      // Text search is much faster than regex for large datasets
      query.$text = { $search: searchTerm };
      
      // Note: When using $text, we need to handle existing filters differently
      // MongoDB doesn't support complex $and with $text, so we keep it simple
      if (category || subCategory) {
        // If there are other filters, they'll be combined naturally
        // as separate fields in the query object
      }
    }

    let dbQuery = Product.find(query)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug');
    
    // Sort by relevance if text search is used, otherwise by date
    if (search && search.trim()) {
      dbQuery = dbQuery.sort({ score: { $meta: 'textScore' }, date: -1 });
    } else {
      dbQuery = dbQuery.sort({ date: -1 });
    }

    // Apply limit - default to 1000 if not specified to accommodate all products (300+)
    // This ensures all products can be displayed in admin and shop
    const productLimit = limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 1000;
    dbQuery = dbQuery.limit(productLimit);

    const products = await dbQuery.exec();

    // Return in the older shape (array) so frontend code that expects array works
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
    let query = {
      // Only show in-stock products
      inStock: true,
      stock: { $gt: 0 }
    };
    
    switch(section) {
      case 'bestsellers':
        query.isBestSeller = true;
        break;
      case 'trending':
        query.isTrending = true;
        break;
      case 'mostloved':
        query.isMostLoved = true;
        break;
      default:
        return res.status(400).json({ message: "Invalid section" });
    }
    
    // UPDATED: Populate category and subCategory for section-based queries
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('subCategory', 'name');
    res.json(products);
  } catch (error) {
    console.error(`Error fetching ${section} products:`, error);
    res.status(500).json({ message: `Error fetching ${section} products`, error: error.message });
  }
};

// Get single product
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let product;
    
    // Try to find by MongoDB ID first
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id)
        .populate('category', 'name slug')
        .populate('subCategory', 'name slug');
    }
    
    // If not found by ID or ID is invalid, try to find by name (URL-decoded and slug-to-name conversion)
    if (!product) {
      // Convert slug back to searchable name (replace hyphens with spaces and make case-insensitive)
      const nameFromSlug = decodeURIComponent(id).replace(/-/g, ' ');
      product = await Product.findOne({ 
        name: new RegExp(`^${nameFromSlug}$`, 'i') 
      })
        .populate('category', 'name slug')
        .populate('subCategory', 'name slug');
    }
    
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
    console.log('=== Product Creation Request ===');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    console.log('Request headers:', req.headers);
    
    if (!req.files || !req.files.mainImage) {
      console.error('Main image missing - files:', req.files);
      return res.status(400).json({ 
        error: 'Main image is required.',
        message: 'Please upload a main image for the product'
      });
    }

    const files = req.files;
    const productData = req.body;
    
    const requiredFields = [
      "name", "material", "size", "colour", 
      "category", "utility", "care", "price", "regularPrice"
    ];

    const missingFields = requiredFields.filter(field => !productData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate price values
    const price = parseFloat(productData.price);
    const regularPrice = parseFloat(productData.regularPrice);
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }
    
    if (isNaN(regularPrice) || regularPrice < 0) {
      return res.status(400).json({ error: 'Invalid regular price value' });
    }
    
    if (price > regularPrice) {
      return res.status(400).json({ error: 'Price cannot be greater than regular price' });
    }

    // Validate stock value
    const stock = Number(productData.stock);
    if (isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: 'Invalid stock value' });
    }

    const imagePaths = [];
    if (files.mainImage && files.mainImage[0]) {
      imagePaths.push(files.mainImage[0].path);
    }
    for (let i = 1; i <= 3; i++) {
      if (files[`image${i}`] && files[`image${i}`][0]) {
        imagePaths.push(files[`image${i}`][0].path);
      }
    }

    console.log('=== Creating Product Object ===');
    const productObject = {
      name: productData.name,
      material: productData.material,
    
      size: productData.size,
      colour: productData.colour,
      category: productData.category,
      subCategory: productData.subCategory && productData.subCategory.trim() !== '' ? productData.subCategory : undefined,
    
      utility: productData.utility,
      care: productData.care,
      price: parseFloat(productData.price),
      regularPrice: parseFloat(productData.regularPrice),
      image: imagePaths[0],
      images: imagePaths,
      inStock: productData.inStock === 'true',
      isBestSeller: productData.isBestSeller === 'true',
      isTrending: productData.isTrending === 'true',
      isMostLoved: productData.isMostLoved === 'true',
      codAvailable: productData.codAvailable !== 'false',
      stock: Number(productData.stock) || 0
    };
    
    console.log('Product object to save:', productObject);
    
    const newProduct = new Product(productObject);
    console.log('Product instance created, attempting to save...');
    
    const savedProduct = await newProduct.save();
    console.log('Product saved successfully:', savedProduct._id);
    
    res.status(201).json({ 
      message: "Product created successfully", 
      product: savedProduct,
    });
  } catch (error) {
    console.error('=== Error creating product ===');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Request files:', req.files);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Validation Error", 
        error: "Please check the following fields: " + validationErrors.join(', '),
        details: validationErrors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: "Invalid Data Type", 
        error: `Invalid value for field: ${error.path}`,
        details: error.message
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Duplicate Entry", 
        error: "A product with this information already exists",
        details: error.message
      });
    }
    
    res.status(500).json({ 
      message: "Error creating product", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update product with file upload
const updateProductWithFiles = async (req, res) => {
  try {
    const id = req.params.id;
    const files = req.files || {};
    const productData = req.body;
    
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    let imagePaths = existingProduct.images || [];
    if (!Array.isArray(imagePaths)) {
      imagePaths = existingProduct.image ? [existingProduct.image] : [];
    }

    if (files.mainImage && files.mainImage[0]) {
      imagePaths[0] = files.mainImage[0].path;
    }

    for (let i = 1; i <= 3; i++) {
      if (files[`image${i}`] && files[`image${i}`][0]) {
        imagePaths[i] = files[`image${i}`][0].path;
      }
    }

    const updatedProductData = {
      name: productData.name || existingProduct.name,
      material: productData.material || existingProduct.material,
      size: productData.size || existingProduct.size,
      colour: productData.colour || existingProduct.colour,
      category: productData.category || existingProduct.category,
      subCategory: productData.subCategory && productData.subCategory.trim() !== '' ? productData.subCategory : (productData.subCategory === '' ? undefined : existingProduct.subCategory), // Handle empty string
   
      utility: productData.utility || existingProduct.utility,
      care: productData.care || existingProduct.care,
      price: productData.price ? parseFloat(productData.price) : existingProduct.price,
      regularPrice: productData.regularPrice ? parseFloat(productData.regularPrice) : existingProduct.regularPrice,
      image: imagePaths[0],
      images: imagePaths,
      inStock: productData.inStock !== undefined ? (productData.inStock === 'true') : existingProduct.inStock,
      isBestSeller: productData.isBestSeller !== undefined ? (productData.isBestSeller === 'true') : existingProduct.isBestSeller,
      isTrending: productData.isTrending !== undefined ? (productData.isTrending === 'true') : existingProduct.isTrending,
      isMostLoved: productData.isMostLoved !== undefined ? (productData.isMostLoved === 'true') : existingProduct.isMostLoved,
      codAvailable: productData.codAvailable !== undefined ? (productData.codAvailable !== 'false') : existingProduct.codAvailable,
      stock: productData.stock !== undefined ? Number(productData.stock) : existingProduct.stock
    };

    const result = await Product.findByIdAndUpdate(id, updatedProductData, { new: true });
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
    const { isBestSeller, isTrending, isMostLoved } = req.body;

    // Validate that at least one section flag is provided
    if (isBestSeller === undefined && isTrending === undefined && isMostLoved === undefined) {
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
      isTrending: product.isTrending,
      isMostLoved: product.isMostLoved
    });

    // Build update object with only the provided flags
    const updates = {};
    if (isBestSeller !== undefined) updates.isBestSeller = isBestSeller;
    if (isTrending !== undefined) updates.isTrending = isTrending;
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
      isTrending: updatedProduct.isTrending,
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