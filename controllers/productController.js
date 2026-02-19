const Product = require('../models/Product');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// Get all products (supports optional query filters: category (name or id), subCategory (name or id), limit, search, city, page)
const getAllProducts = async (req, res) => {
  try {
    const { category, subCategory, limit, search, city, page, adminView } = req.query;

    // Base query: only show products that are in stock and have stock > 0
    // Admin can see everything
    let query = (adminView === 'true' || adminView === true) ? {} : {
      inStock: true,
      stock: { $gt: 0 }
    };

    // If city provided, resolve it and filter
    let resolvedCityId = null;
    if (city && city !== 'null' && city !== 'undefined') {
      if (mongoose.Types.ObjectId.isValid(city)) {
        resolvedCityId = city;
      } else {
        const City = require('../models/City');
        const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, 'i') });
        if (cityDoc) {
          resolvedCityId = cityDoc._id;
        }
      }

      if (resolvedCityId) {
        query.cities = resolvedCityId;
      }
    }

    // Handle search
    if (search && search.trim()) {
      query.name = new RegExp(search.trim(), 'i');
    }

    // Handle category
    if (category) {
      const Category = require('../models/Category');
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const cat = await Category.findOne({ name: new RegExp(`^${category}$`, 'i') });
        if (cat) query.category = cat._id;
      }
    }

    // Handle subCategory
    if (subCategory) {
      if (mongoose.Types.ObjectId.isValid(subCategory)) {
        query.subCategory = subCategory;
      }
    }

    // Execute query with populate
    let productsQuery = Product.find(query)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ date: -1 });

    const totalCount = await Product.countDocuments(query);

    // Apply pagination
    if (page || limit) {
      const currentPage = parseInt(page) || 1;
      const productLimit = parseInt(limit) || 50;
      const skip = (currentPage - 1) * productLimit;
      productsQuery = productsQuery.skip(skip).limit(productLimit);
    }

    let products = await productsQuery.lean();

    // Adjust prices for city if selected
    if (resolvedCityId) {
      products = products.map(product => {
        if (product.cityPrices && Array.isArray(product.cityPrices)) {
          const cityPrice = product.cityPrices.find(cp => cp.city && cp.city.toString() === resolvedCityId.toString());
          if (cityPrice) {
            return {
              ...product,
              price: cityPrice.price,
              regularPrice: cityPrice.regularPrice
            };
          }
        }
        return product;
      });
    }

    res.json({
      success: true,
      products,
      total: totalCount,
      pagination: {
        total: totalCount,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || products.length,
        totalPages: Math.ceil(totalCount / (parseInt(limit) || 50))
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: "Error fetching products", error: error.message });
  }
};

// Get search suggestions with categories and products
const getSearchSuggestions = async (req, res) => {
  try {
    const { q: query, city, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ suggestions: [], categories: [], products: [] });
    }

    const searchTerm = query.trim();
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    const regexPatterns = searchWords.map(word =>
      new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    );

    // Base query for products
    const productQuery = {
      inStock: true,
      stock: { $gt: 0 }
    };

    // Add city filter if provided
    let resolvedCityId = null;
    if (city) {
      const City = require('../models/City');

      if (mongoose.Types.ObjectId.isValid(city)) {
        resolvedCityId = city;
      } else {
        const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, 'i') });
        if (cityDoc) {
          resolvedCityId = cityDoc._id;
        }
      }

      if (resolvedCityId) {
        productQuery.cities = resolvedCityId;
      }
    }

    // Search conditions for products
    const productSearchConditions = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { material: { $regex: searchTerm, $options: 'i' } },
      { colour: { $regex: searchTerm, $options: 'i' } },
      { utility: { $regex: searchTerm, $options: 'i' } },
      { size: { $regex: searchTerm, $options: 'i' } }
    ];

    productQuery.$or = productSearchConditions;

    // Get matching products with aggregation
    const productPipeline = [
      { $match: productQuery },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategory',
          foreignField: '_id',
          as: 'subCategoryInfo'
        }
      },
      {
        $addFields: {
          categoryName: { $arrayElemAt: ['$categoryInfo.name', 0] },
          subCategoryName: { $arrayElemAt: ['$subCategoryInfo.name', 0] }
        }
      },
      {
        $addFields: {
          relevanceScore: {
            $add: [
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: searchWords,
                        cond: { $regexMatch: { input: '$name', regex: { $concat: ['(?i)', '$$this'] } } }
                      }
                    }
                  },
                  10
                ]
              },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: searchWords,
                        cond: { $regexMatch: { input: '$categoryName', regex: { $concat: ['(?i)', '$$this'] } } }
                      }
                    }
                  },
                  8
                ]
              },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: searchWords,
                        cond: { $regexMatch: { input: '$subCategoryName', regex: { $concat: ['(?i)', '$$this'] } } }
                      }
                    }
                  },
                  6
                ]
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          image: 1,
          cityPrices: 1,
          category: { $arrayElemAt: ['$categoryInfo', 0] },
          subCategory: { $arrayElemAt: ['$subCategoryInfo', 0] },
          relevanceScore: 1
        }
      },
      { $sort: { relevanceScore: -1, date: -1 } },
      { $limit: parseInt(limit) }
    ];

    // Get matching categories
    const categoryQuery = { isActive: true };
    if (resolvedCityId) {
      categoryQuery.cities = resolvedCityId;
    }

    const categorySearchConditions = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ];

    categoryQuery.$or = categorySearchConditions;

    // Execute queries in parallel
    const [products, categories] = await Promise.all([
      Product.aggregate(productPipeline),
      Category.find(categoryQuery).select('name description image').limit(5)
    ]);

    // Create suggestions array
    const suggestions = [];

    // Add category suggestions
    categories.forEach(category => {
      suggestions.push({
        type: 'category',
        id: category._id,
        name: category.name,
        description: category.description,
        image: category.image
      });
    });

    // Add product suggestions
    products.forEach(product => {
      let displayPrice = product.price;
      if (resolvedCityId && product.cityPrices && Array.isArray(product.cityPrices)) {
        const cityPrice = product.cityPrices.find(cp => cp.city && cp.city.toString() === resolvedCityId.toString());
        if (cityPrice) displayPrice = cityPrice.price;
      }
      suggestions.push({
        type: 'product',
        id: product._id,
        name: product.name,
        price: displayPrice,
        image: product.image,
        category: product.category?.name,
        subCategory: product.subCategory?.name
      });
    });

    res.json({
      suggestions: suggestions.slice(0, parseInt(limit)),
      categories: categories,
      products: products
    });

  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({ message: "Error fetching search suggestions", error: error.message });
  }
};

// Get products by section
const getProductsBySection = async (req, res) => {
  try {
    const { section } = req.params;
    const { city } = req.query;

    let query = {
      // Only show in-stock products
      inStock: true,
      stock: { $gt: 0 }
    };

    // Add city filter if provided
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
        // Find ONLY products that have this city in their cities array
        query.cities = cityId;
      }
    }

    switch (section) {
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
    let products = await Product.find(query)
      .populate('category', 'name')
      .populate('subCategory', 'name');

    // If city is provided, adjust prices for each product based on cityPrices
    if (city) {
      // Find city ID if not already a valid ObjectId
      let cityId = city;
      if (!mongoose.Types.ObjectId.isValid(city)) {
        const City = require('../models/City');
        const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, 'i') });
        cityId = cityDoc ? cityDoc._id : null;
      }

      if (cityId) {
        products = products.map(product => {
          if (product.cityPrices && Array.isArray(product.cityPrices)) {
            const cityPrice = product.cityPrices.find(cp => cp.city.toString() === cityId.toString());
            if (cityPrice) {
              const productObj = product.toObject();
              return {
                ...productObj,
                price: cityPrice.price,
                regularPrice: cityPrice.regularPrice
              };
            }
          }
          return product;
        });
      }
    }

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

    // If city is provided, adjust prices
    const { city } = req.query;
    if (city) {
      let cityId = city;
      if (!mongoose.Types.ObjectId.isValid(city)) {
        const City = require('../models/City');
        const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, 'i') });
        cityId = cityDoc ? cityDoc._id : null;
      }

      if (cityId && product.cityPrices && Array.isArray(product.cityPrices)) {
        const cityPrice = product.cityPrices.find(cp => cp.city.toString() === cityId.toString());
        if (cityPrice) {
          const productObj = product.toObject();
          productObj.price = cityPrice.price;
          productObj.regularPrice = cityPrice.regularPrice;
          return res.json(productObj);
        }
      }
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
      "category", "utility", "price", "regularPrice"
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
    for (let i = 1; i <= 9; i++) {
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
      included: productData.included ? JSON.parse(productData.included) : [],
      excluded: productData.excluded ? JSON.parse(productData.excluded) : [],
      price: parseFloat(productData.price),
      regularPrice: parseFloat(productData.regularPrice),
      image: imagePaths[0],
      images: imagePaths,
      inStock: productData.inStock === 'true',
      isBestSeller: productData.isBestSeller === 'true',
      isTrending: productData.isTrending === 'true',
      isMostLoved: productData.isMostLoved === 'true',
      codAvailable: productData.codAvailable !== 'false',
      stock: Number(productData.stock) || 0,
      cities: productData.cities ? (typeof productData.cities === 'string' ? JSON.parse(productData.cities) : productData.cities) : [],
      cityPrices: productData.cityPrices ? (typeof productData.cityPrices === 'string' ? JSON.parse(productData.cityPrices) : productData.cityPrices) : []
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

    for (let i = 1; i <= 9; i++) {
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
      included: productData.included ? JSON.parse(productData.included) : existingProduct.included,
      excluded: productData.excluded ? JSON.parse(productData.excluded) : existingProduct.excluded,
      price: productData.price ? parseFloat(productData.price) : existingProduct.price,
      regularPrice: productData.regularPrice ? parseFloat(productData.regularPrice) : existingProduct.regularPrice,
      image: imagePaths[0],
      images: imagePaths,
      inStock: productData.inStock !== undefined ? (productData.inStock === 'true') : existingProduct.inStock,
      isBestSeller: productData.isBestSeller !== undefined ? (productData.isBestSeller === 'true') : existingProduct.isBestSeller,
      isTrending: productData.isTrending !== undefined ? (productData.isTrending === 'true') : existingProduct.isTrending,
      isMostLoved: productData.isMostLoved !== undefined ? (productData.isMostLoved === 'true') : existingProduct.isMostLoved,
      codAvailable: productData.codAvailable !== undefined ? (productData.codAvailable !== 'false') : existingProduct.codAvailable,
      stock: productData.stock !== undefined ? Number(productData.stock) : existingProduct.stock,
      cities: productData.cities ? (typeof productData.cities === 'string' ? JSON.parse(productData.cities) : productData.cities) : existingProduct.cities,
      cityPrices: productData.cityPrices ? (typeof productData.cityPrices === 'string' ? JSON.parse(productData.cityPrices) : productData.cityPrices) : existingProduct.cityPrices
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
  getSearchSuggestions,
  getProductsBySection,
  getProduct,
  createProductWithFiles,
  updateProductWithFiles,
  updateProductSections,
  deleteProduct
}; 