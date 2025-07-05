const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name'],
    maxLength: [50, 'Name cannot exceed 50 characters'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please enter your email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please enter your password'],
    minLength: [6, 'Password should be at least 6 characters'],
    select: false
  },
  avatar: {
    public_id: {
      type: String,
      default: ''
    },
    url: {
      type: String,
      default: 'https://randomuser.me/api/portraits/men/32.jpg'
    }
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin']
  },
  phone: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not'],
    default: 'prefer-not'
  },
  addresses: [{
    type: {
      type: String,
      required: true,
      enum: ['home', 'office', 'other']
    },
    name: {
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
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  paymentMethods: [{
    type: {
      type: String,
      required: true,
      enum: ['visa', 'mastercard', 'amex', 'discover']
    },
    last4: {
      type: String,
      required: true
    },
    expiryMonth: {
      type: String,
      required: true
    },
    expiryYear: {
      type: String,
      required: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    stripePaymentMethodId: {
      type: String
    }
  }],
  preferences: {
    notifications: {
      orderUpdates: {
        type: Boolean,
        default: true
      },
      promotionalEmails: {
        type: Boolean,
        default: true
      },
      newProducts: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      profileVisibility: {
        type: Boolean,
        default: false
      },
      dataSharing: {
        type: Boolean,
        default: true
      }
    }
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  memberTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare user password
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Return JWT token
userSchema.methods.getJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Update member tier based on total spent
userSchema.methods.updateMemberTier = function() {
  if (this.totalSpent >= 10000) {
    this.memberTier = 'Platinum';
  } else if (this.totalSpent >= 5000) {
    this.memberTier = 'Gold';
  } else if (this.totalSpent >= 1000) {
    this.memberTier = 'Silver';
  } else {
    this.memberTier = 'Bronze';
  }
};

// Add loyalty points
userSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;
  this.updateMemberTier();
};

// Update order statistics
userSchema.methods.updateOrderStats = function(orderTotal) {
  this.totalOrders += 1;
  this.totalSpent += orderTotal;
  this.updateMemberTier();
};

module.exports = mongoose.model('User', userSchema); 