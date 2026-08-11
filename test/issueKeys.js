require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const Brand = require('../models/Brand');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const brands = await Brand.find({ apiKey: { $exists: false } });
  for (const b of brands) {
    b.apiKey = 'ck_' + crypto.randomBytes(24).toString('hex');
    await b.save();
    console.log(`${b.name}: ${b.apiKey}`);
  }
  console.log(brands.length ? 'done — copy the key' : 'all brands already keyed');
  process.exit(0);
})();
