const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: false
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
      min: 1
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
    }
  }],
  shippingAddress: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'USA'
    },
    phone: {
      type: String,
      required: true
    }
  },
  billingAddress: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'USA'
    }
  },
  paymentInfo: {
    id: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    method: {
      type: String,
      required: true
    },
    cardBrand: String,
    last4: String
  },
  paymentMethod: {
    type: mongoose.Schema.ObjectId,
    ref: 'PaymentMethod'
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  discountAmount: {
    type: Number,
    default: 0.0
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  shippingInfo: {
    carrier: {
      type: String,
      default: 'Standard Shipping'
    },
    trackingNumber: {
      type: String
    },
    trackingUrl: {
      type: String
    },
    estimatedDelivery: {
      type: Date
    },
    shippedAt: {
      type: Date
    },
    deliveredAt: {
      type: Date
    }
  },
  notes: {
    type: String
  },
  coupon: {
    code: {
      type: String
    },
    discount: {
      type: Number,
      default: 0
    }
  },
  loyaltyPointsEarned: {
    type: Number,
    default: 0
  },
  loyaltyPointsUsed: {
    type: Number,
    default: 0
  },
  isGift: {
    type: Boolean,
    default: false
  },
  giftMessage: {
    type: String
  },
  refundInfo: {
    amount: {
      type: Number,
      default: 0
    },
    reason: String,
    processedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending'
    }
  },
  estimatedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Get count of orders for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    this.orderNumber = `${year}${month}${day}${(count + 1).toString().padStart(3, '0')}`;
  }
  
  // Add status to history if status changed
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }
  
  next();
});

// Calculate total price
orderSchema.methods.calculateTotal = function() {
  this.itemsPrice = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  this.totalPrice = this.itemsPrice + this.taxPrice + this.shippingPrice - this.discountAmount;
};

// Update order status
orderSchema.methods.updateStatus = function(newStatus, note = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note
  });
  
  // Update shipping info based on status
  if (newStatus === 'shipped') {
    this.shippingInfo.shippedAt = new Date();
  } else if (newStatus === 'delivered') {
    this.shippingInfo.deliveredAt = new Date();
    this.actualDeliveryDate = new Date();
  }
};

// Check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'processing', 'shipped'].includes(this.status);
};

// Check if order can be refunded
orderSchema.methods.canBeRefunded = function() {
  return ['delivered', 'shipped'].includes(this.status);
};

// Get order summary
orderSchema.methods.getSummary = function() {
  return {
    orderNumber: this.orderNumber,
    totalItems: this.items.reduce((total, item) => total + item.quantity, 0),
    totalPrice: this.totalPrice,
    status: this.status,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Order', orderSchema); 