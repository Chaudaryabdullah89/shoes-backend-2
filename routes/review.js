const express = require('express');
const { body, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @desc    Get product reviews
// @route   GET /api/reviews/product/:productId
// @access  Public
router.get('/product/:productId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ 
      product: req.params.productId,
      isActive: true 
    })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ 
      product: req.params.productId,
      isActive: true 
    });
    const totalPages = Math.ceil(total / limit);

    // Calculate average rating
    const product = await Product.findById(req.params.productId);
    const averageRating = product ? product.ratings : 0;

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      totalPages,
      currentPage: page,
      averageRating,
      reviews
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting reviews'
    });
  }
});

// @desc    Create product review
// @route   POST /api/reviews
// @access  Private
router.post('/', protect, upload.array('images', 5), [
  body('product')
    .notEmpty()
    .withMessage('Product ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { product: productId, rating, comment } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: req.user.id,
      product: productId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Handle images
    const images = req.files ? req.files.map(file => ({
      public_id: file.filename,
      url: file.path
    })) : [];

    // Create review
    const review = await Review.create({
      user: req.user.id,
      product: productId,
      name: req.user.name,
      rating: parseInt(rating),
      comment,
      images
    });

    // Update product rating
    product.reviews.push(review._id);
    product.calculateAverageRating();
    await product.save();

    // Populate user info
    await review.populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating review'
    });
  }
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
router.put('/:id', protect, upload.array('images', 5), [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Update fields
    if (req.body.rating) review.rating = parseInt(req.body.rating);
    if (req.body.comment) review.comment = req.body.comment;

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        public_id: file.filename,
        url: file.path
      }));
      review.images = [...review.images, ...newImages];
    }

    await review.save();

    // Update product rating
    const product = await Product.findById(review.product);
    if (product) {
      product.calculateAverageRating();
      await product.save();
    }

    await review.populate('user', 'name avatar');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating review'
    });
  }
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review or is admin
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    // Soft delete
    review.isActive = false;
    await review.save();

    // Update product rating
    const product = await Product.findById(review.product);
    if (product) {
      product.calculateAverageRating();
      await product.save();
    }

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review'
    });
  }
});

// @desc    Get user reviews
// @route   GET /api/reviews/user
// @access  Private
router.get('/user', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ 
      user: req.user.id,
      isActive: true 
    })
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ 
      user: req.user.id,
      isActive: true 
    });
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      totalPages,
      currentPage: page,
      reviews
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user reviews'
    });
  }
});

// @desc    Get review statistics
// @route   GET /api/reviews/stats/:productId
// @access  Public
router.get('/stats/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ 
      product: req.params.productId,
      isActive: true 
    });

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    // Rating distribution
    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };

    res.status(200).json({
      success: true,
      stats: {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution
      }
    });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting review statistics'
    });
  }
});

module.exports = router; 