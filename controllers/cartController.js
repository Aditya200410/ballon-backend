const Cart = require('../models/Cart');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const BestSeller = require('../models/bestSeller');
const Loved = require('../models/loved');
const FeaturedProduct = require('../models/FeaturedProduct');

// Helper function to get products from shop.json
const getProducts = () => {
  try {
    const productsPath = path.join(__dirname, '../data/shop.json');
    const productsData = fs.readFileSync(productsPath, 'utf8');
    return JSON.parse(productsData);
  } catch (error) {
    console.error('Error reading shop.json:', error);
    return [];
  }
};

// Helper function to find product across all collections
const findProductById = async (productId) => {
  // Try to find in regular products first
  let product = await Product.findById(productId);
  if (product) return product;

  // Try to find in best sellers
  product = await BestSeller.findById(productId);
  if (product) return product;

  // Try to find in loved products
  product = await Loved.findById(productId);
  if (product) return product;

  // Try to find in featured products
  product = await FeaturedProduct.findById(productId);
  if (product) return product;

  return null;
};

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.query.email;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    // Fetch latest codAvailable for each item
    const itemsWithCod = await Promise.all(
      cart.items.map(async (item) => {
        const product = await findProductById(item.productId);
        return {
          ...item.toObject(),
          codAvailable: product ? product.codAvailable : undefined
        };
      })
    );

    res.json({
      success: true,
      items: itemsWithCod,
      totalItems: itemsWithCod.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: itemsWithCod.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ success: false, message: 'Failed to get cart' });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.body.email;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const { productId, quantity = 1 } = req.body;
    
    // Find product in MongoDB
    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({ userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId.toString()
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        productId: productId.toString(),
        quantity,
        price: product.price,
        name: product.name,
        image: product.image,
        images: product.images || [],
        category: product.category
      });
    }

    await cart.save();
    res.json({
      success: true,
      message: 'Item added to cart',
      items: cart.items,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Failed to add item to cart' });
  }
};

// Update item quantity
const updateQuantity = async (req, res) => {
  try {
    const userId = req.body.email;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const { productId, quantity } = req.body;
    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }
    
    // Verify product exists across all collections
    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    const itemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId.toString()
    );
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
    cart.items[itemIndex].quantity = quantity;
    await cart.save();
    res.json({
      success: true,
      message: 'Cart updated',
      items: cart.items,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart' });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.body.email;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const { productId } = req.params;
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    cart.items = cart.items.filter(item => 
      item.productId.toString() !== productId.toString()
    );
    await cart.save();
    res.json({
      success: true,
      message: 'Item removed from cart',
      items: cart.items,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const userId = req.body.email;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }
    cart.items = [];
    await cart.save();
    res.json({
      success: true,
      message: 'Cart cleared',
      items: [],
      totalItems: 0,
      totalPrice: 0
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Failed to clear cart' });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart
}; 