// Backend/makeAdmin.js
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const email = 'admin@example.com'; // Change to your admin email

async function makeAdmin() {
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const user = await User.findOne({ email });
  if (!user) {
    console.log('User not found. Register the user first.');
    process.exit(1);
  }
  user.role = 'admin';
  user.isActive = true;
  await user.save();
  console.log(`User ${email} is now an admin!`);
  process.exit(0);
}

makeAdmin();