const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');

// Create a new review (simple - just requires email and name)
const createReview = async (req, res) => {
  try {
    const { productId, stars, reviewTitle, reviewDescription, userEmail, userName } = req.body;

    // Validate required fields
    if (!productId || !stars || !reviewTitle || !reviewDescription || !userEmail || !userName) {
      return res.status(400).json({ 
        message: "All fields are required: productId, stars, reviewTitle, reviewDescription, userEmail, userName" 
      });
    }

    // Validate stars range
    if (stars < 1 || stars > 5) {
      return res.status(400).json({ 
        message: "Stars must be between 1 and 5" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ 
        message: "Please provide a valid email address" 
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Create the review
    const newReview = new Review({
      userEmail: userEmail.toLowerCase(),
      userName,
      product: productId,
      stars,
      reviewTitle,
      reviewDescription
    });

    const savedReview = await newReview.save();

    // Update product rating and review count
    await updateProductRating(productId);

    res.status(201).json({
      message: "Review created successfully",
      review: savedReview
    });

  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ 
      message: "Error creating review", 
      error: error.message 
    });
  }
};

// Get reviews for a product
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviews = await Review.find({ product: productId })
      .sort({ createdAt: -1 });

    res.json({
      reviews,
      totalReviews: reviews.length
    });

  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({ 
      message: "Error fetching product reviews", 
      error: error.message 
    });
  }
};

// Get user's review for a product (by email)
const getUserReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { userEmail } = req.query;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const review = await Review.findOne({ 
      userEmail: userEmail.toLowerCase(), 
      product: productId 
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json(review);

  } catch (error) {
    console.error('Error fetching user review:', error);
    res.status(500).json({ 
      message: "Error fetching user review", 
      error: error.message 
    });
  }
};

// Update user's review (by email)
const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { stars, reviewTitle, reviewDescription, userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    // Validate required fields
    if (!stars || !reviewTitle || !reviewDescription) {
      return res.status(400).json({ 
        message: "All fields are required: stars, reviewTitle, reviewDescription" 
      });
    }

    // Validate stars range
    if (stars < 1 || stars > 5) {
      return res.status(400).json({ 
        message: "Stars must be between 1 and 5" 
      });
    }

    // Find and update the review
    const review = await Review.findOneAndUpdate(
      { _id: reviewId, userEmail: userEmail.toLowerCase() },
      { stars, reviewTitle, reviewDescription },
      { new: true, runValidators: true }
    );

    if (!review) {
      return res.status(404).json({ 
        message: "Review not found or you don't have permission to update it" 
      });
    }

    // Update product rating
    await updateProductRating(review.product);

    res.json({
      message: "Review updated successfully",
      review
    });

  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ 
      message: "Error updating review", 
      error: error.message 
    });
  }
};

// Delete user's review (by email)
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const review = await Review.findOneAndDelete({ 
      _id: reviewId, 
      userEmail: userEmail.toLowerCase() 
    });

    if (!review) {
      return res.status(404).json({ 
        message: "Review not found or you don't have permission to delete it" 
      });
    }

    // Update product rating
    await updateProductRating(review.product);

    res.json({ message: "Review deleted successfully" });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ 
      message: "Error deleting review", 
      error: error.message 
    });
  }
};

// Helper function to update product rating and review count
const updateProductRating = async (productId) => {
  try {
    const reviews = await Review.find({ product: productId });
    
    if (reviews.length === 0) {
      // No reviews, reset to default values
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviews: 0
      });
      return;
    }

    const totalStars = reviews.reduce((sum, review) => sum + review.stars, 0);
    const averageRating = totalStars / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      reviews: reviews.length
    });

  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getUserReview,
  updateReview,
  deleteReview
}; 