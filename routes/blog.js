const express = require('express');
const { body, validationResult } = require('express-validator');
const Blog = require('../models/Blog');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public: Get all published blogs (with search, filter, pagination)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = { status: 'published' };
    if (req.query.tag) filter.tags = req.query.tag;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.$text = { $search: req.query.search };
    const blogs = await Blog.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name');
    const total = await Blog.countDocuments(filter);
    res.status(200).json({ success: true, blogs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching blogs' });
  }
});

// Public: Get single blog (by id)
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('author', 'name')
      .populate('comments.user', 'name');
    if (!blog || blog.status !== 'published') return res.status(404).json({ success: false, message: 'Blog not found' });
    blog.views += 1;
    await blog.save();
    res.status(200).json({ success: true, blog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching blog' });
  }
});

// Add comment to a blog (logged-in users only)
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog || blog.status !== 'published') return res.status(404).json({ success: false, message: 'Blog not found' });
    if (!req.body.text || !req.body.text.trim()) return res.status(400).json({ success: false, message: 'Comment text is required.' });
    const comment = {
      user: req.user._id,
      text: req.body.text,
      createdAt: new Date()
    };
    blog.comments.push(comment);
    await blog.save();
    await blog.populate({ path: 'comments.user', select: 'name' });
    res.status(201).json({ success: true, comments: blog.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding comment' });
  }
});

// Admin: Create blog
router.post('/', protect, authorize('admin'), upload.array('images', 5), [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { title, content, tags, category, status, featured } = req.body;
    const images = req.files ? req.files.map(file => ({ public_id: file.filename, url: file.path })) : [];
    const blog = await Blog.create({
      title,
      content,
      author: req.user.id,
      tags: tags ? JSON.parse(tags) : [],
      category,
      images,
      status: status || 'draft',
      featured: featured === 'true',
      publishedAt: status === 'published' ? new Date() : null
    });
    res.status(201).json({ success: true, blog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating blog' });
  }
});

// Admin: Update blog
router.put('/:id', protect, authorize('admin'), upload.array('images', 5), async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    Object.keys(req.body).forEach(key => {
      if (key !== 'images') {
        if (typeof req.body[key] === 'string' && req.body[key].startsWith('[')) {
          try { blog[key] = JSON.parse(req.body[key]); } catch { blog[key] = req.body[key]; }
        } else {
          blog[key] = req.body[key];
        }
      }
    });
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({ public_id: file.filename, url: file.path }));
      blog.images = [...blog.images, ...newImages];
    }
    if (blog.status === 'published' && !blog.publishedAt) blog.publishedAt = new Date();
    await blog.save();
    res.status(200).json({ success: true, blog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating blog' });
  }
});

// Admin: Delete blog
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    await blog.deleteOne();
    res.status(200).json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting blog' });
  }
});

// Admin: List all blogs (any status)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const blogs = await Blog.find().populate('author', 'name').sort({ createdAt: -1 });
    res.status(200).json({ success: true, blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching blogs' });
  }
});

router.get('/user', protect, async (req, res) => {
  try {
    const blogs = await Blog.find({ author: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user blogs' });
  }
});

module.exports = router; 