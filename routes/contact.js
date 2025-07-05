const express = require('express');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// @route   POST /api/contact
// @desc    Send contact form email
// @access  Public
router.post('/', async (req, res) => {
  const { name, email, phone, subject, message, hearAbout } = req.body;
  // File is available as req.file (if uploaded)
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  }
  try {
    await sendEmail({
      email: process.env.EMAIL_USER, // Send to your own inbox
      subject: subject ? `[Contact] ${subject}` : '[Contact Form] New Message',
      message: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || ''}\nHow did you hear about us: ${hearAbout || ''}\n\n${message}`
    });
    res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router; 