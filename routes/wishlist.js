const express = require('express');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id })
      .populate('items.product', 'name price images stock isActive');

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id });
    }

    // Filter out inactive products
    wishlist.items = wishlist.items.filter(item => 
      item.product && item.product.isActive
    );

    res.status(200).json({
      success: true,
      wishlist
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting wishlist'
    });
  }
});

// @desc    Add item to wishlist
// @route   POST /api/wishlist/items
// @access  Private
router.post('/items', protect, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    let wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.id });
    }

    // Check if item already exists
    if (wishlist.hasItem(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Item already in wishlist'
      });
    }

    wishlist.addItem(product);
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Item added to wishlist successfully',
      wishlist
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to wishlist'
    });
  }
});

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/items/:productId
// @access  Private
router.delete('/items/:productId', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.removeItem(req.params.productId);
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist successfully',
      wishlist
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from wishlist'
    });
  }
});

// @desc    Clear wishlist
// @route   DELETE /api/wishlist
// @access  Private
router.delete('/', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.clearWishlist();
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully',
      wishlist
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing wishlist'
    });
  }
});

// @desc    Check if item is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
router.get('/check/:productId', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    
    if (!wishlist) {
      return res.status(200).json({
        success: true,
        inWishlist: false
      });
    }

    const inWishlist = wishlist.hasItem(req.params.productId);

    res.status(200).json({
      success: true,
      inWishlist
    });
  } catch (error) {
    console.error('Check wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking wishlist'
    });
  }
});

// @desc    Get wishlist summary
// @route   GET /api/wishlist/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id });
    
    if (!wishlist) {
      return res.status(200).json({
        success: true,
        summary: {
          itemCount: 0,
          totalValue: 0
        }
      });
    }

    const summary = wishlist.getSummary();

    res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Get wishlist summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting wishlist summary'
    });
  }
});

module.exports = router; 