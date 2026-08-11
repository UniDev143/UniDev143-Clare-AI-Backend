// Usage: node test/makeSuperAdmin.js founder@example.com "a-strong-password" "Your Name"
// Creates the founder's super-admin account, or promotes an existing admin.
// A super-admin belongs to no brand and can reach every brand's data —
// there should be exactly one, and its password should not be reused.
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

(async () => {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node test/makeSuperAdmin.js <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Admin.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.role = 'super';
    existing.password = password;          // re-hashed by the pre-save hook
    await existing.save();
    console.log(`Promoted existing admin to super: ${existing.email}`);
  } else {
    const admin = await Admin.create({
      email: email.toLowerCase(),
      password,
      name: name || 'Founder',
      role: 'super',
      // no brandId — a super-admin belongs to no brand
    });
    console.log(`Created super-admin: ${admin.email}`);
  }

  const supers = await Admin.find({ role: 'super' }, 'email').lean();
  console.log(`super-admins now: ${supers.map(s => s.email).join(', ')}`);
  process.exit(0);
})();
