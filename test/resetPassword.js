// Usage: node test/resetPassword.js admin@test.com "new-password"
// Resets an admin's password. The old one is gone afterwards — passwords are
// stored bcrypt-hashed and cannot be read back, only replaced.
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

(async () => {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node test/resetPassword.js <email> <new-password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    console.error(`No admin found for "${email}"`);
    process.exit(1);
  }

  admin.password = password;        // re-hashed by the pre-save hook
  await admin.save();

  console.log(`Password reset for ${admin.email} (role: ${admin.role || 'brand'})`);
  process.exit(0);
})();
