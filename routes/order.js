const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// @desc    Create new order
// @route   POST /api/orders
// @access  Public (guest checkout allowed)
router.post('/', optionalAuth, async (req, res) => {
  try {
    console.log('Order route: POST /api/orders - Request received', req.body);
    const { items, shippingAddress, billingAddress, paymentInfo, orderNumber } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Calculate totals
    let itemsPrice = 0;
    const orderItems = [];

    for (const item of items) {
      console.log('Order route: Processing item:', item);
      if (!item || typeof item !== 'object' || !item.product || typeof item.quantity !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'One or more items are invalid or missing required fields.'
        });
      }
      // Validation for color and size
      if (!item.color || !item.size) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a color and size.'
        });
      }
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product} not found`
        });
      }
      console.log('Order route: Product lookup', item.product);

      const itemTotal = product.price * item.quantity;
      itemsPrice += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0]?.url || '',
        color: item.color,
        size: item.size
      });
    }

    const taxPrice = itemsPrice * 0.085;
    const shippingPrice = itemsPrice >= 50 ? 0 : 5.99;
    const totalPrice = itemsPrice + taxPrice + shippingPrice;

    const orderData = {
      orderNumber,
      items: orderItems,
      shippingAddress,
      billingAddress,
      paymentInfo,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice
    };
    if (req.user && req.user.id) {
      orderData.user = req.user.id;
    }
    const order = await Order.create(orderData);
    console.log('Order route: Order created', order._id);

    // Send order confirmation email
    const customerEmail = shippingAddress.email || billingAddress.email;
    if (customerEmail) {
      const orderSummary = orderItems.map(item => `- ${item.name} x${item.quantity} ($${item.price})`).join('\n');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const trackingLink = `${frontendUrl}/order-tracking/${orderNumber}`;
      const message = `Thank you for your order!\n\nOrder Number: ${orderNumber}\n\nOrder Summary:\n${orderSummary}\n\nTrack your order: ${trackingLink}\n\nShipping to:\n${shippingAddress.name}\n${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}, ${shippingAddress.country}\n\nWe will notify you when your order ships!`;
      await sendEmail({
        email: customerEmail,
        subject: `Order Confirmation - ${orderNumber}`,
        message
      });
      console.log('Order route: Confirmation email sent to', customerEmail);
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Order route: POST /api/orders - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order'
    });
  }
});

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    console.log('Order route: GET /api/orders - Request received', req.query);
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('items.product', 'name images');
    console.log('Order route: Orders fetched for user', req.user.id);

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Order route: GET /api/orders - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting orders'
    });
  }
});

// @desc    Get user orders for the current user
// @route   GET /api/orders/my-orders
// @access  Private
router.get('/my-orders', protect, async (req, res) => {
  try {
    console.log('Order route: GET /api/orders/my-orders - Request received', req.query);
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('items.product', 'name images');
    console.log('Order route: My orders fetched for user', req.user.id);
    res.status(200).json(orders);
  } catch (error) {
    console.error('Order route: GET /api/orders/my-orders - Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user orders' });
  }
});

// @desc    Get single order (Admin only)
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
router.get('/admin/orders/:id', protect, async (req, res) => {
  try {
    console.log('Order route: GET /api/admin/orders/:id - Request received', req.params.id);
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'name images description');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    console.log('Order route: Admin order fetched', req.params.id);
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Order route: GET /api/admin/orders/:id - Error:', error);
    res.status(500).json({ success: false, message: 'Error getting order' });
  }
});

// @desc    Get admin order by order number
// @route   GET /api/admin/orders/number/:orderNumber
// @access  Private/Admin
router.get('/admin/orders/number/:orderNumber', protect, async (req, res) => {
  try {
    // Only allow admin users
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Accept both numeric and string order numbers
    const orderNumber = req.params.orderNumber.trim();
    const order = await Order.findOne({
      orderNumber: { $regex: `^${orderNumber}$`, $options: 'i' }
    })
      .populate('user', 'name email')
      .populate('items.product', 'name images description');
 

    if (!order) {
      // Not found
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Success
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Order route: GET /api/admin/orders/number/:orderNumber - Error:', error);
    res.status(500).json({ success: false, message: 'Error getting order' });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    console.log('Order route: GET /api/orders/:id - Request received', req.params.id);
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images description');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.user) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Order route: GET /api/orders/:id - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting order'
    });
  }
});

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, async (req, res) => {
  try {
    console.log('Order route: PUT /api/orders/:id/status - Request received', req.params.id, req.body);
    const { status, note } = req.body;

    if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only admin can update status
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update order status'
      });
    }

    order.updateStatus(status, note);

    // Update shipping info for shipped status
    if (status === 'shipped') {
      order.shippingInfo.shippedAt = new Date();
      order.shippingInfo.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    }

    // Update delivery info for delivered status
    if (status === 'delivered') {
      order.shippingInfo.deliveredAt = new Date();
      order.actualDeliveryDate = new Date();
    }

    await order.save();
    console.log('Order route: Order status updated', req.params.id);

    // Send email to customer on status update
    const customerEmail = order.shippingAddress?.email || order.billingAddress?.email;
    if (customerEmail) {
      await sendEmail({
        email: customerEmail,
        subject: `Order Status Updated - ${order.orderNumber}`,
        message: `Your order status is now: ${order.status}. ${note ? '\nNote: ' + note : ''}`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Order route: PUT /api/orders/:id/status - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status'
    });
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    console.log('Order route: PUT /api/orders/:id/cancel - Request received', req.params.id);
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.updateStatus('cancelled', 'Cancelled by customer');

    // Restore product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        if (item.color && item.size) {
          const variant = product.variants.find(v => 
            v.color === item.color && v.size === item.size
          );
          if (variant) {
            variant.stock += item.quantity;
          }
        } else {
          product.stock += item.quantity;
        }
        await product.save();
      }
    }

    await order.save();
    console.log('Order route: Order cancelled', req.params.id);

    // Send email to customer on cancellation
    const cancelEmail = order.shippingAddress?.email || order.billingAddress?.email;
    if (cancelEmail) {
      await sendEmail({
        email: cancelEmail,
        subject: `Order Cancelled - ${order.orderNumber}`,
        message: `Your order has been cancelled. If you have questions, please contact support.`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Order route: PUT /api/orders/:id/cancel - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling order'
    });
  }
});

// @desc    Request refund
// @route   POST /api/orders/:id/refund
// @access  Private
router.post('/:id/refund', protect, [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Refund reason is required')
], async (req, res) => {
  try {
    console.log('Order route: POST /api/orders/:id/refund - Request received', req.params.id, req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { reason, amount } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to request refund for this order'
      });
    }

    // Check if order can be refunded
    if (!order.canBeRefunded()) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be refunded at this stage'
      });
    }

    // Check if refund already exists
    if (order.refundInfo && order.refundInfo.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Refund request already exists'
      });
    }

    order.refundInfo = {
      amount: amount || order.totalPrice,
      reason,
      status: 'pending'
    };

    await order.save();
    console.log('Order route: Refund request submitted', req.params.id);

    res.status(200).json({
      success: true,
      message: 'Refund request submitted successfully',
      order
    });
  } catch (error) {
    console.error('Order route: POST /api/orders/:id/refund - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting refund'
    });
  }
});

// @desc    Get order tracking
// @route   GET /api/orders/:id/tracking
// @access  Private
router.get('/:id/tracking', protect, async (req, res) => {
  try {
    console.log('Order route: GET /api/orders/:id/tracking - Request received', req.params.id);
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }

    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      shippingInfo: order.shippingInfo,
      estimatedDelivery: order.estimatedDeliveryDate,
      actualDelivery: order.actualDeliveryDate
    };

    res.status(200).json({
      success: true,
      trackingInfo
    });
  } catch (error) {
    console.error('Order route: GET /api/orders/:id/tracking - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tracking information'
    });
  }
});

// @desc    Delete order (customer)
// @route   DELETE /api/orders/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this order' });
    }
    if (!order.canBeCancelled()) {
      return res.status(400).json({ success: false, message: 'Order cannot be deleted at this stage' });
    }
    await order.deleteOne();
    res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting order' });
  }
});

// @desc    Get all orders (Admin only)
// @route   GET /api/orders/admin/all
// @access  Private/Admins
router.get('/admin/all', protect, async (req, res) => {
  try {
    console.log('Order route: GET /api/orders/admin/all - Request received', req.query);
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access all orders'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .populate('items.product', 'name');
    console.log('Order route: All orders fetched for admin', req.user.id);

    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages,
      currentPage: page,
      orders
    });
  } catch (error) {
    console.error('Order route: GET /api/orders/admin/all - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting all orders'
    });
  }
});

// @desc    Public order tracking by order number
// @route   GET /api/orders/track/:orderNumber
// @access  Public
router.get('/track/:orderNumber', async (req, res) => {
  try {
    console.log('Order route: GET /api/orders/track/:orderNumber - Request received', req.params.orderNumber);
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    console.log('Order route: Order found by order number', req.params.orderNumber);
    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      shippingInfo: order.shippingInfo,
      estimatedDelivery: order.estimatedDeliveryDate,
      actualDelivery: order.actualDeliveryDate
    };
    res.status(200).json({ success: true, trackingInfo });
  } catch (error) {
    console.error('Order route: GET /api/orders/track/:orderNumber - Error:', error);
    res.status(500).json({ success: false, message: 'Error getting tracking information' });
  }
});

module.exports = router;