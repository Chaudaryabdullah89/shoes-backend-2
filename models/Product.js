const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter product name'],
    trim: true,
    maxLength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please enter product description']
  },
  price: {
    type: Number,
    required: [true, 'Please enter product price'],
    maxLength: [5, 'Price cannot exceed 5 characters'],
    default: 0.0
  },
  compareAtPrice: {
    type: Number,
    default: 0.0
  },
  images: [{
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  }],
  category: {
    type: String,
    required: [true, 'Please select category for this product'],
    enum: {
      values: [
        'Watches',
        'Jewelry',
        'Accessories',
        'Clothing',
        'Shoes',
        'Bags',
        'Electronics',
        'Home & Garden',
        'Sports',
        'Books',
        'Other'
      ],
      message: 'Please select correct category'
    }
  },
  brand: {
    type: String,
    required: [true, 'Please enter product brand']
  },
  tags: [{
    type: String,
    trim: true
  }],
  size: [{
    type: String,
    trim: true
  }],
  colors: [{
    name: {
      type: String,
      required: true
    },
    hex: {
      type: String,
      required: true
    },
    inStock: {
      type: Boolean,
      default: true
    }
  }],
  sizes: [{
    name: {
      type: String,
      required: true
    },
    inStock: {
      type: Boolean,
      default: true
    }
  }],
  variants: [{
    color: String,
    size: String,
    sku: String,
    price: Number,
    compareAtPrice: Number,
    stock: Number,
    images: [{ public_id: String, url: String }]
  }],
  stock: {
    type: Number,
    required: [true, 'Please enter product stock'],
    maxLength: [5, 'Stock cannot exceed 5 characters'],
    default: 0
  },
  ratings: {
    type: Number,
    default: 0
  },
  numOfReviews: {
    type: Number,
    default: 0
  },
  reviews: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true
    },
    comment: {
      type: String,
      required: true
    },
    images: [{
      public_id: String,
      url: String
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  features: [{
    type: String,
    required: false

  }],
  specifications: {
    type: String,
    required: false
  },
  weight: {
    type: Number,
    default: 0,
    required: false

  },
  dimensions: {
    length: {
      type: Number,
      default: 0,
    required: false

    },
    width: {
      type: Number,
      default: 0,
    required: false

    },
    height: {
      type: Number,
      default: 0,
    required: false

    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNewProduct: {
    type: Boolean,
    default: false
  },
  isOnSale: {
    type: Boolean,
    default: false
  },
  salePercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  seoTitle: {
    type: String,
    maxLength: [60, 'SEO title cannot exceed 60 characters']
  },
  seoDescription: {
    type: String,
    maxLength: [160, 'SEO description cannot exceed 160 characters']
  },
  seoKeywords: [{
    type: String
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  soldCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search functionality
productSchema.index({
  name: 'text',
  description: 'text',
  category: 'text',
  brand: 'text',
  tags: 'text'
});

// Calculate average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.ratings = 0;
    this.numOfReviews = 0;
  } else {
    const totalRating = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.ratings = totalRating / this.reviews.length;
    this.numOfReviews = this.reviews.length;
  }
};

// Check if product is in stock
productSchema.methods.isInStock = function(color = null, size = null) {
  if (color && size) {
    const variant = this.variants.find(v => 
      v.color === color && v.size === size
    );
    return variant ? variant.stock > 0 : false;
  }
  return this.stock > 0;
};

// Get sale price
productSchema.methods.getSalePrice = function() {
  if (this.isOnSale && this.salePercentage > 0) {
    return this.price * (1 - this.salePercentage / 100);
  }
  return this.price;
};

// Update stock
productSchema.methods.updateStock = function(quantity, color = null, size = null) {
  if (color && size) {
    const variant = this.variants.find(v => 
      v.color === color && v.size === size
    );
    if (variant) {
      variant.stock -= quantity;
      if (variant.stock < 0) variant.stock = 0;
    }
  } else {
    this.stock -= quantity;
    if (this.stock < 0) this.stock = 0;
  }
};

module.exports = mongoose.model('Product', productSchema); 