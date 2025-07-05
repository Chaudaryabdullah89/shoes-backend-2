const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isActive: true };

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Brand filter
    if (req.query.brand) {
      filter.brand = { $regex: req.query.brand, $options: 'i' };
    }

    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Color filter
    if (req.query.color) {
      filter['colors.name'] = { $regex: req.query.color, $options: 'i' };
    }

    // Size filter
    if (req.query.size) {
      filter['sizes.name'] = req.query.size;
    }

    // Stock filter
    if (req.query.inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    // Search filter
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Featured/New/Sale filters
    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    }
    if (req.query.new === 'true') {
      filter.isNew = true;
    }
    if (req.query.onSale === 'true') {
      filter.isOnSale = true;
    }

    // Build sort object
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price-asc':
          sort = { price: 1 };
          break;
        case 'price-desc':
          sort = { price: -1 };
          break;
        case 'name-asc':
          sort = { name: 1 };
          break;
        case 'name-desc':
          sort = { name: -1 };
          break;
        case 'rating-desc':
          sort = { ratings: -1 };
          break;
        case 'newest':
          sort = { createdAt: -1 };
          break;
        case 'popular':
          sort = { viewCount: -1 };
          break;
      }
    }

    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('reviews.user', 'name avatar');

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages,
      currentPage: page,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting products'
    });
  }
});

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting categories'
    });
  }
});

// @desc    Get product brands
// @route   GET /api/products/brands
// @access  Public
router.get('/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    res.status(200).json({
      success: true,
      brands
    });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting brands'
    });
  }
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .limit(8)
      .populate('reviews.user', 'name avatar');
    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting featured products'
    });
  }
});

// @desc    Get new products
// @route   GET /api/products/new
// @access  Public
router.get('/new', async (req, res) => {
  try {
    const products = await Product.find({ isNew: true, isActive: true })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('reviews.user', 'name avatar');
    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get new products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting new products'
    });
  }
});

// @desc    Get sale products
// @route   GET /api/products/sale
// @access  Public
router.get('/sale', async (req, res) => {
  try {
    const products = await Product.find({ isOnSale: true, isActive: true })
      .sort({ salePercentage: -1 })
      .limit(8)
      .populate('reviews.user', 'name avatar');
    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get sale products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting sale products'
    });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('reviews.user', 'name avatar')
      .populate('createdBy', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    product.viewCount += 1;
    await product.save();

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting product'
    });
  }
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
router.post('/', protect, authorize('admin'), upload.array('images', 10), [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Product name must be between 1 and 100 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .isIn(['Watches', 'Jewelry', 'Accessories', 'Clothing', 'Shoes', 'Bags', 'Electronics', 'Home & Garden', 'Sports', 'Books', 'Other'])
    .withMessage('Please select a valid category'),
  body('brand')
    .trim()
    .notEmpty()
    .withMessage('Brand is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      brand,
      tags,
      colors,
      sizes,
      variants,
      stock,
      features,
      specifications,
      weight,
      dimensions,
      isFeatured,
      isNew,
      isOnSale,
      salePercentage,
      seoTitle,
      seoDescription,
      seoKeywords
    } = req.body;

    // Handle images
    const images = req.files ? req.files.map(file => ({
      public_id: file.filename,
      url: file.path
    })) : [];

    const productData = {
      name,
      description,
      price: parseFloat(price),
      compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : 0,
      category,
      brand,
      images,
      createdBy: req.user.id
    };

    // Add optional fields if provided
    if (tags) productData.tags = JSON.parse(tags);
    if (colors) productData.colors = JSON.parse(colors);
    if (sizes) productData.sizes = JSON.parse(sizes);
    if (variants) productData.variants = JSON.parse(variants);
    if (stock) productData.stock = parseInt(stock);
    if (features) productData.features = JSON.parse(features);
    if (specifications) productData.specifications = JSON.parse(specifications);
    if (weight) productData.weight = parseFloat(weight);
    if (dimensions) productData.dimensions = JSON.parse(dimensions);
    if (isFeatured) productData.isFeatured = isFeatured === 'true';
    if (isNew) productData.isNew = isNew === 'true';
    if (isOnSale) productData.isOnSale = isOnSale === 'true';
    if (salePercentage) productData.salePercentage = parseFloat(salePercentage);
    if (seoTitle) productData.seoTitle = seoTitle;
    if (seoDescription) productData.seoDescription = seoDescription;
    if (seoKeywords) productData.seoKeywords = JSON.parse(seoKeywords);

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product'
    });
  }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Handle images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        public_id: file.filename,
        url: file.path
      }));
      product.images = [...product.images, ...newImages];
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'images') {
        if (typeof req.body[key] === 'string' && req.body[key].startsWith('[')) {
          try {
            product[key] = JSON.parse(req.body[key]);
          } catch {
            product[key] = req.body[key];
          }
        } else if (typeof req.body[key] === 'string' && req.body[key].startsWith('{')) {
          try {
            product[key] = JSON.parse(req.body[key]);
          } catch {
            product[key] = req.body[key];
          }
        } else {
          product[key] = req.body[key];
        }
      }
    });

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product'
    });
  }
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Soft delete - set isActive to false
    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
});

module.exports = router; 