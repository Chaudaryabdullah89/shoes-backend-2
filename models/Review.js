const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxLength: [1000, 'Comment cannot exceed 1000 characters']
  },
  images: [{
    public_id: {
      type: String
    },
    url: {
      type: String
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  helpful: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reported: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'fake', 'other']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Prevent user from submitting more than one review per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Calculate helpful count
reviewSchema.virtual('helpfulCount').get(function() {
  return this.helpful.length;
});

// Calculate reported count
reviewSchema.virtual('reportedCount').get(function() {
  return this.reported.length;
});

// Add helpful vote
reviewSchema.methods.addHelpful = function(userId) {
  const existingVote = this.helpful.find(vote => 
    vote.user.toString() === userId.toString()
  );
  
  if (!existingVote) {
    this.helpful.push({ user: userId });
  }
};

// Remove helpful vote
reviewSchema.methods.removeHelpful = function(userId) {
  this.helpful = this.helpful.filter(vote => 
    vote.user.toString() !== userId.toString()
  );
};

// Report review
reviewSchema.methods.report = function(userId, reason) {
  const existingReport = this.reported.find(report => 
    report.user.toString() === userId.toString()
  );
  
  if (!existingReport) {
    this.reported.push({ user: userId, reason });
  }
};

// Check if user has voted helpful
reviewSchema.methods.hasVotedHelpful = function(userId) {
  return this.helpful.some(vote => 
    vote.user.toString() === userId.toString()
  );
};

// Check if user has reported
reviewSchema.methods.hasReported = function(userId) {
  return this.reported.some(report => 
    report.user.toString() === userId.toString()
  );
};

module.exports = mongoose.model('Review', reviewSchema); 