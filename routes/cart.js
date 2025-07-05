const express = require('express');
const { body, validationResult } = require('express-validator');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images stock');

    if (!cart) {
      cart = await Cart.create({ user: req.user.id });
    }

    res.status(200).json({
      success: true,
      cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cart'
    });
  }
});

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
router.post('/items', protect, [
  // body('productId')
  //   .notEmpty()
  //   .withMessage('Product ID is required'),
  // body('quantity')
  //   .isInt({ min: 1 })
  //   .withMessage('Quantity must be at least 1'),
  // body('color')
  //   .optional()
  //   .isString(),
  // body('size')
  //   .optional()
  //   .isString()
], async (req, res) => {
  try {
    console.log('Add to cart request body:', req.body);
    console.log('Request headers:', req.headers);
    console.log('User:', req.user.id);
    
    // Manual validation since we commented out express-validator
    const { productId, quantity, color, size } = req.body;
    
    if (!productId) {
      console.log('Missing productId');
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    if (!quantity || quantity < 1) {
      console.log('Invalid quantity:', quantity);
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }
    
    console.log('Processing add to cart:', { productId, quantity, color, size });

    const product = await Product.findById(productId);
    if (!product) {
      console.log('Product not found:', productId);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    console.log('Product found:', product.name);

    if (!product.isActive) {
      console.log('Product not active:', product.name);
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    // Check stock
    // if (!product.isInStock(color, size)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Product is out of stock'
    //   });
    // }

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      console.log('Creating new cart for user:', req.user.id);
      cart = await Cart.create({ user: req.user.id });
    } else {
      console.log('Found existing cart for user:', req.user.id);
    }

    console.log('Adding item to cart:', { product: product.name, quantity, color, size });
    cart.addItem(product, quantity, color, size);
    await cart.save();
    console.log('Cart saved successfully');

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart'
    });
  }
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
router.put('/items/:itemId', protect, [
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.updateItemQuantity(req.params.itemId, quantity);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart item'
    });
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
router.delete('/items/:itemId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.removeItem(req.params.itemId);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      cart
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart'
    });
  }
});

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
router.delete('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.clearCart();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart'
    });
  }
});

// @desc    Apply coupon to cart
// @route   POST /api/cart/coupon
// @access  Private
router.post('/coupon', protect, [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Coupon code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { code } = req.body;

    // Mock coupon validation - in real app, you'd check against a coupon database
    const validCoupons = {
      'SAVE10': { discount: 10, type: 'percentage' },
      'SAVE20': { discount: 20, type: 'percentage' },
      'FREESHIP': { discount: 5.99, type: 'fixed' }
    };

    const coupon = validCoupons[code];
    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.applyCoupon(code, coupon.discount, coupon.type);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      cart
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying coupon'
    });
  }
});

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/coupon
// @access  Private
router.delete('/coupon', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.removeCoupon();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Coupon removed successfully',
      cart
    });
  } catch (error) {
    console.error('Remove coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing coupon'
    });
  }
});

// @desc    Update shipping address
// @route   PUT /api/cart/shipping
// @access  Private
router.put('/shipping', protect, [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('zipCode')
    .trim()
    .notEmpty()
    .withMessage('ZIP code is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.shippingAddress = req.body;
    cart.calculateTotals();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Shipping address updated successfully',
      cart
    });
  } catch (error) {
    console.error('Update shipping address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shipping address'
    });
  }
});

module.exports = router; 