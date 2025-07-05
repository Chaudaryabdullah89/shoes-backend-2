const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Blog = require('../models/Blog');
const sendEmail = require('../utils/sendEmail');
const { protect, authorize } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Admin login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || user.role !== 'admin') return res.status(401).json({ success: false, message: 'Not authorized' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
    res.status(200).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error logging in' });
  }
});

// Middleware: admin only
const adminOnly = [protect, authorize('admin')];

// Dashboard stats
router.get('/dashboard', adminOnly, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const productCount = await Product.countDocuments();
    const orderCount = await Order.countDocuments();
    const sales = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]);
    const reviewCount = await Review.countDocuments();
    const blogCount = await Blog.countDocuments();
    res.status(200).json({
      success: true,
      stats: {
        users: userCount,
        products: productCount,
        orders: orderCount,
        sales: sales[0]?.total || 0,
        reviews: reviewCount,
        blogs: blogCount
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats', error: error.message });
  }
});

// User management
router.get('/users', adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});
router.put('/users/:id', adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});
router.delete('/users/:id', adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});
// PATCH user status (activate/deactivate)
router.patch('/users/:id/status', adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating user status' });
  }
});
router.get('/users/:id', adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
});

// Product management
router.get('/products', adminOnly, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});
router.post('/products', adminOnly, async (req, res) => {
  try {
    // Sanitize variants: only keep variants with a non-empty sku, or set to []
    if (!req.body.variants || !Array.isArray(req.body.variants) || req.body.variants.length === 0) {
      req.body.variants = [];
    } else {
      req.body.variants = req.body.variants.filter(
        v => v && v.sku && typeof v.sku === 'string' && v.sku.trim() !== ''
      );
    }
    const product = await Product.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Error creating product', error: error.message });
  }
});
router.put('/products/:id', adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});
router.delete('/products/:id', adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

// Order management
router.get('/orders', adminOnly, async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
});
router.put('/orders/:id', adminOnly, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating order' });
  }
});
router.put('/orders/:id/status', adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = req.body.status;
    order.statusHistory.push({ status: req.body.status, timestamp: new Date(), note: req.body.note });
    await order.save();
    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating order status' });
  }
});

// Order tracking
router.get('/orders/:id/tracking', adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.status(200).json({ success: true, tracking: order.statusHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching tracking' });
  }
});

// Review moderation
router.get('/reviews', adminOnly, async (req, res) => {
  try {
    const reviews = await Review.find().populate('user', 'name').populate('product', 'name');
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
});
router.delete('/reviews/:id', adminOnly, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting review' });
  }
});

// Blog management
router.get('/blogs', adminOnly, async (req, res) => {
  try {
    const blogs = await Blog.find().populate('author', 'name').sort({ createdAt: -1 });
    res.status(200).json({ success: true, blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching blogs' });
  }
});
router.post('/blogs', adminOnly, async (req, res) => {
  try {
    const blog = await Blog.create({ ...req.body, author: req.user.id });
    res.status(201).json({ success: true, blog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating blog' });
  }
});
router.put('/blogs/:id', adminOnly, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, blog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating blog' });
  }
});
router.delete('/blogs/:id', adminOnly, async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting blog' });
  }
});

// Send email to user(s)
router.post('/email', adminOnly, [
  body('to').notEmpty().withMessage('Recipient required'),
  body('subject').notEmpty().withMessage('Subject required'),
  body('message').notEmpty().withMessage('Message required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { to, subject, message } = req.body;
    await sendEmail({ email: to, subject, message });
    res.status(200).json({ success: true, message: 'Email sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error sending email' });
  }
});

// Image upload endpoint
router.post('/upload', adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const result = await cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
      if (error) return res.status(500).json({ success: false, message: 'Cloudinary upload failed', error });
      res.status(200).json({ success: true, url: result.secure_url, public_id: result.public_id });
    });
    result.end(req.file.buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error uploading image', error: error.message });
  }
});

module.exports = router; 