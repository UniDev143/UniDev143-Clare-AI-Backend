const mongoose = require('mongoose');

// One row per top-up. Money moved, so it is recorded — the running balance on
// Brand tells you where a brand stands, this tells you how it got there.
const creditLogSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
    index: true
  },
  amount: {
    type: Number,        // credits added
    required: true
  },
  balanceAfter: {
    type: Number,        // balance once this top-up landed
    required: true
  },
  note: {
    type: String,        // e.g. invoice reference
    trim: true,
    default: null
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',        // which super-admin did it
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CreditLog', creditLogSchema);
