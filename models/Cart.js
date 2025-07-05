const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    color: {
      type: String
    },
    size: {
      type: String
    },
    image: {
      type: String,
      required: true
    },
    sku: {
      type: String
    },
    inStock: {
      type: Boolean,
      default: true
    },
    maxQuantity: {
      type: Number,
      default: 10
    }
  }],
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  coupon: {
    code: {
      type: String
    },
    discount: {
      type: Number,
      default: 0
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    }
  },
  shippingAddress: {
    name: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'USA'
    },
    phone: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate cart totals
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Calculate tax (example: 8.5%)
  this.tax = this.subtotal * 0.085;
  
  // Calculate shipping (free over $50, otherwise $5.99)
  this.shipping = this.subtotal >= 50 ? 0 : 5.99;
  
  // Apply coupon discount
  let discountAmount = 0;
  if (this.coupon && this.coupon.discount > 0) {
    if (this.coupon.type === 'percentage') {
      discountAmount = this.subtotal * (this.coupon.discount / 100);
    } else {
      discountAmount = this.coupon.discount;
    }
    this.discount = Math.min(discountAmount, this.subtotal);
  }
  
  this.total = this.subtotal + this.tax + this.shipping - this.discount;
};

// Add item to cart
cartSchema.methods.addItem = function(product, quantity = 1, color = null, size = null) {
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === product._id.toString() &&
    item.color === color &&
    item.size === size
  );
  
  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
    if (this.items[existingItemIndex].quantity > this.items[existingItemIndex].maxQuantity) {
      this.items[existingItemIndex].quantity = this.items[existingItemIndex].maxQuantity;
    }
  } else {
    // Add new item
    this.items.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      color: color,
      size: size,
      image: product.images[0]?.url || '',
      sku: product.sku,
      inStock: product.stock > 0,
      maxQuantity: Math.min(product.stock, 10)
    });
  }
  
  this.calculateTotals();
  this.lastUpdated = new Date();
};

// Remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  this.calculateTotals();
  this.lastUpdated = new Date();
};

// Update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  if (item) {
    item.quantity = Math.min(Math.max(1, quantity), item.maxQuantity);
    this.calculateTotals();
    this.lastUpdated = new Date();
  }
};

// Clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.subtotal = 0;
  this.tax = 0;
  this.shipping = 0;
  this.discount = 0;
  this.total = 0;
  this.coupon = null;
  this.lastUpdated = new Date();
};

// Apply coupon
cartSchema.methods.applyCoupon = function(couponCode, discount, type = 'percentage') {
  this.coupon = {
    code: couponCode,
    discount: discount,
    type: type
  };
  this.calculateTotals();
  this.lastUpdated = new Date();
};

// Remove coupon
cartSchema.methods.removeCoupon = function() {
  this.coupon = null;
  this.calculateTotals();
  this.lastUpdated = new Date();
};

// Check if cart is empty
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

// Get cart summary
cartSchema.methods.getSummary = function() {
  return {
    itemCount: this.items.reduce((total, item) => total + item.quantity, 0),
    subtotal: this.subtotal,
    tax: this.tax,
    shipping: this.shipping,
    discount: this.discount,
    total: this.total
  };
};

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

module.exports = mongoose.model('Cart', cartSchema); 