require('dotenv').config();
const mongoose = require('mongoose');
const Scan = require('../models/Scan');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const r = await Scan.deleteOne({ _id: process.argv[2] });
  console.log(r.deletedCount ? 'deleted' : 'not found');
  process.exit(0);
})();