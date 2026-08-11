// Usage: node test/addCredits.js admin@test.com 100
// Adds credits to a brand for testing. Accepts either the Brand contact email
// or the Admin login email. A negative amount deducts (floored at 0) so you can
// drop a brand to zero and test the 402 path.
require('dotenv').config();
const mongoose = require('mongoose');
const Brand = require('../models/Brand');
const Admin = require('../models/Admin');

(async () => {
  const [email, rawAmount] = process.argv.slice(2);

  if (!email || rawAmount === undefined) {
    console.error('Usage: node test/addCredits.js <email> <amount>');
    process.exit(1);
  }

  const amount = Number(rawAmount);
  if (!Number.isInteger(amount)) {
    console.error(`Amount must be a whole number — got "${rawAmount}"`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  // Brand.email is contact info, Admin.email is the login — accept either.
  let brand = await Brand.findOne({ email: email.toLowerCase() });
  if (!brand) {
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (admin) brand = await Brand.findById(admin.brandId);
  }

  if (!brand) {
    console.error(`No brand found for "${email}" (tried Brand.email and Admin.email)`);
    process.exit(1);
  }

  const before = brand.credits;
  brand.credits = Math.max(0, before + amount);
  if (amount > 0) brand.totalCreditsEver += amount;
  await brand.save();

  console.log(`${brand.name} (${brand.email})`);
  console.log(`  credits:  ${before} → ${brand.credits}  (${amount >= 0 ? '+' : ''}${amount})`);
  console.log(`  lifetime: ${brand.totalCreditsEver}`);
  console.log(`  status:   ${brand.subscriptionStatus}, ${brand.creditsPerScan} credit(s)/scan`);
  console.log(`  apiKey:   ${brand.apiKey}`);
  process.exit(0);
})();