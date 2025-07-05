const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
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
    image: {
      type: String,
      required: true
    },
    inStock: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add item to wishlist
wishlistSchema.methods.addItem = function(product) {
  const existingItem = this.items.find(item => 
    item.product.toString() === product._id.toString()
  );
  
  if (!existingItem) {
    this.items.push({
      product: product._id,
      name: product.name,
      price: product.price,
      image: product.images[0]?.url || '',
      inStock: product.stock > 0
    });
    this.lastUpdated = new Date();
  }
};

// Remove item from wishlist
wishlistSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.product.toString() !== productId.toString()
  );
  this.lastUpdated = new Date();
};

// Check if item is in wishlist
wishlistSchema.methods.hasItem = function(productId) {
  return this.items.some(item => 
    item.product.toString() === productId.toString()
  );
};

// Clear wishlist
wishlistSchema.methods.clearWishlist = function() {
  this.items = [];
  this.lastUpdated = new Date();
};

// Get wishlist summary
wishlistSchema.methods.getSummary = function() {
  return {
    itemCount: this.items.length,
    totalValue: this.items.reduce((total, item) => total + item.price, 0)
  };
};

// Update stock status for all items
wishlistSchema.methods.updateStockStatus = function() {
  this.items.forEach(item => {
    // This would typically be updated when products are fetched
    // For now, we'll keep the existing logic
  });
};

module.exports = mongoose.model('Wishlist', wishlistSchema); 