const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting profile'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please enter a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer-not'])
    .withMessage('Please select a valid gender')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, phone, dateOfBirth, gender } = req.body;

    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// @desc    Update user avatar
// @route   PUT /api/users/avatar
// @access  Private
router.put('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const user = await User.findById(req.user.id);

    // Update avatar
    user.avatar = {
      public_id: req.file.filename,
      url: req.file.path
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating avatar'
    });
  }
});

// @desc    Change password
// @route   PUT /api/users/password
// @access  Private
router.put('/password', protect, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

// @desc    Get user addresses
// @route   GET /api/users/addresses
// @access  Private
router.get('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting addresses'
    });
  }
});

// @desc    Add new address
// @route   POST /api/users/addresses
// @access  Private
router.post('/addresses', protect, [
  body('type')
    .isIn(['home', 'office', 'other'])
    .withMessage('Please select a valid address type'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('zipCode')
    .trim()
    .notEmpty()
    .withMessage('ZIP code is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { type, name, address, city, state, zipCode, country, isDefault } = req.body;

    const user = await User.findById(req.user.id);

    // If this is the first address or isDefault is true, set it as default
    if (user.addresses.length === 0 || isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    const newAddress = {
      type,
      name,
      address,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || user.addresses.length === 0
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding address'
    });
  }
});

// @desc    Update address
// @route   PUT /api/user/addresses/:id
// @access  Private
router.put('/addresses/:id', protect, [
  body('type')
    .optional()
    .isIn(['home', 'office', 'other'])
    .withMessage('Please select a valid address type'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('address')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('city')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('state')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('zipCode')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('ZIP code is required'),
  body('country')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Country is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user.id);
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Update address fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'isDefault') {
        user.addresses[addressIndex][key] = req.body[key];
      }
    });

    // Handle default address
    if (req.body.isDefault) {
      user.addresses.forEach((addr, index) => {
        addr.isDefault = index === addressIndex;
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      address: user.addresses[addressIndex]
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating address'
    });
  }
});

// @desc    Delete address
// @route   DELETE /api/user/addresses/:id
// @access  Private
router.delete('/addresses/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const deletedAddress = user.addresses.splice(addressIndex, 1)[0];

    // If deleted address was default, set first remaining address as default
    if (deletedAddress.isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting address'
    });
  }
});

// @desc    Get user payment methods
// @route   GET /api/user/payment-methods
// @access  Private
router.get('/payment-methods', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      paymentMethods: user.paymentMethods
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting payment methods'
    });
  }
});

// @desc    Update user preferences
// @route   PUT /api/user/preferences
// @access  Private
router.put('/preferences', protect, async (req, res) => {
  try {
    const { notifications, privacy } = req.body;

    const user = await User.findById(req.user.id);

    if (notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...notifications
      };
    }

    if (privacy) {
      user.preferences.privacy = {
        ...user.preferences.privacy,
        ...privacy
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating preferences'
    });
  }
});

// @desc    Deactivate account
// @route   PUT /api/user/deactivate
// @access  Private
router.put('/deactivate', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating account'
    });
  }
});

module.exports = router; 