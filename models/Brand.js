const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  apiKey: {
    type: String,
    unique: true,
    index: true,
    default: () => 'ck_' + require('crypto').randomBytes(24).toString('hex'),
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  logo: {
    type: String,        // URL to logo image
    default: null
  },
  website: {
    type: String,
    default: null
  },
  // Embed config — each brand can customize the widget
  widgetConfig: {
    primaryColor: {
      type: String,
      default: '#6B21A8'   // default purple
    },
    welcomeMessage: {
      type: String,
      default: 'Discover your perfect skincare routine'
    },
    disclaimerText: {
      type: String,
      default: 'This is a cosmetic analysis only, not medical advice. Consult a dermatologist for skin concerns.'
    }
  },
  // Subscription — a scan spends credits from the brand that owns the API key
  credits: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCreditsEver: {
    type: Number,        // lifetime total ever granted, for stats
    default: 0,
    min: 0
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'suspended', 'trial'],
    default: 'trial'
  },
  creditsPerScan: {
    type: Number,        // what one scan costs this brand (premium tiers cost more)
    default: 1,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true    // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Brand', brandSchema);