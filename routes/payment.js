const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// @desc    Create payment intent
// @route   POST /api/payment/create-payment-intent
// @access  Public (guest checkout allowed)
router.post('/create-payment-intent', async (req, res) => {
  try {
    console.log('Payment route: Create payment intent - Request received', req.body);
    const { amount, currency = 'usd' } = req.body;

    if (!amount || amount <= 0) {
      console.log('Payment route: Create payment intent - Validation failed: Invalid amount');
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        // userId: req.user.id // Remove userId for guest checkout
      }
    });
    console.log('Payment route: Create payment intent - Stripe PaymentIntent created', paymentIntent.id);

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Payment route: Create payment intent - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent'
    });
  }
});

// @desc    Add payment method
// @route   POST /api/payment/methods
// @access  Private
router.post('/methods', protect, async (req, res) => {
  try {
    console.log('Payment route: Add payment method - Request received', req.body);
    const { paymentMethodId, isDefault = false } = req.body;

    if (!paymentMethodId) {
      console.log('Payment route: Add payment method - Validation failed: Payment method ID is missing');
      return res.status(400).json({
        success: false,
        message: 'Payment method ID is required'
      });
    }

    // Attach payment method to customer
    const user = await User.findById(req.user.id);
    
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString()
        }
      });
      
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }
    console.log('Payment route: Stripe customer ID found or created', customerId);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    console.log('Payment route: Payment method attached', paymentMethodId);

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Add to user's payment methods
    if (isDefault) {
      user.paymentMethods.forEach(method => method.isDefault = false);
    }

    const newPaymentMethod = {
      type: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expiryMonth: paymentMethod.card.exp_month.toString(),
      expiryYear: paymentMethod.card.exp_year.toString(),
      isDefault: isDefault || user.paymentMethods.length === 0,
      stripePaymentMethodId: paymentMethodId
    };

    user.paymentMethods.push(newPaymentMethod);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      paymentMethod: newPaymentMethod
    });
  } catch (error) {
    console.error('Payment route: Add payment method - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding payment method'
    });
  }
});

// @desc    Get user payment methods
// @route   GET /api/payment/methods
// @access  Private
router.get('/methods', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      paymentMethods: user.paymentMethods
    });
  } catch (error) {
    console.error('Payment route: Get payment methods - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting payment methods'
    });
  }
});

// @desc    Delete payment method
// @route   DELETE /api/payment/methods/:id
// @access  Private
router.delete('/methods/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const paymentMethodIndex = user.paymentMethods.findIndex(
      method => method._id.toString() === req.params.id
    );

    if (paymentMethodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const paymentMethod = user.paymentMethods[paymentMethodIndex];

    // Detach from Stripe
    if (paymentMethod.stripePaymentMethodId) {
      try {
        await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      } catch (stripeError) {
        console.error('Payment route: Stripe detach error:', stripeError);
      }
    }

    // Remove from user
    user.paymentMethods.splice(paymentMethodIndex, 1);

    // If deleted method was default and there are other methods, set first as default
    if (paymentMethod.isDefault && user.paymentMethods.length > 0) {
      user.paymentMethods[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('Payment route: Delete payment method - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting payment method'
    });
  }
});

// @desc    Set default payment method
// @route   PUT /api/payment/methods/:id/default
// @access  Private
router.put('/methods/:id/default', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    user.paymentMethods.forEach(method => {
      method.isDefault = method._id.toString() === req.params.id;
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Default payment method updated successfully'
    });
  } catch (error) {
    console.error('Payment route: Set default payment method - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default payment method'
    });
  }
});

// @desc    Process payment
// @route   POST /api/payment/process
// @access  Private
router.post('/process', protect, async (req, res) => {
  try {
    console.log('Payment route: Process payment - Request received', req.body);
    const { paymentMethodId, amount, currency = 'usd', description } = req.body;

    if (!paymentMethodId || !amount) {
      console.log('Payment route: Process payment - Validation failed: Payment method ID or amount is missing');
      return res.status(400).json({
        success: false,
        message: 'Payment method ID and amount are required'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      payment_method: paymentMethodId,
      customer: user.stripeCustomerId,
      description,
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/payment-success`
    });
    console.log('Payment route: Stripe PaymentIntent created', paymentIntent.id);

    if (paymentIntent.status === 'succeeded') {
      res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        paymentIntent
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        paymentIntent
      });
    }
  } catch (error) {
    console.error('Payment route: Process payment - Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing payment'
    });
  }
});

// @desc    Webhook for Stripe events
// @route   POST /api/payment/webhook
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      // Handle successful payment
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      // Handle failed payment
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router; 