const express = require('express');
const router = express.Router();
const {
  createReview,
  getProductReviews,
  getUserReview,
  updateReview,
  deleteReview
} = require('../controllers/reviewController');

// All routes are public (no authentication required)
router.get('/product/:productId', getProductReviews);
router.get('/user/:productId', getUserReview);
router.post('/', createReview);
router.put('/:reviewId', updateReview);
router.delete('/:reviewId', deleteReview);

module.exports = router; 