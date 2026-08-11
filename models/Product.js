const mongoose = require('mongoose');
const {
  SKIN_ISSUES, SKIN_TYPES, SEVERITY_LEVELS,
  ALLERGENS, BUDGET_TIERS, PRODUCT_CATEGORIES
} = require('../config/vocabulary');

const productSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
    index: true
  },
  name:        { type: String, required: true, trim: true },
  description: { type: String, required: true },

  // ── ROUTINE SLOT ───────────────────────────────────────
  category: {
    type: String,
    enum: PRODUCT_CATEGORIES,
    required: true
  },

  price:    { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'PKR' },

  // Brand-declared positioning — mirrors questionnaire budget
  budgetTier: {
    type: String,
    enum: BUDGET_TIERS,
    required: true
  },

  image:   { type: String, default: null },
  buyLink: { type: String, required: true },

  // For display + AI explanations (not used in filtering)
  keyIngredients: { type: [String], default: [] },

  // ── MATCHING TAGS ──────────────────────────────────────
  tags: {
    targetsIssues: {
      type: [String],
      enum: SKIN_ISSUES,
      default: []
    },
    suitableFor: {
      type: [String],
      enum: SKIN_TYPES,
      default: ['all']
    },
    severity: {
      type: [String],
      enum: SEVERITY_LEVELS,
      default: ['all']
    },
    containsAllergens: {
      type: [String],
      enum: ALLERGENS,
      default: []
      // HARD FILTER — mirrors questionnaire allergy values
    },
  },

  // Brand boost 1–10 — ranking tiebreaker, not a filter
  priorityScore: { type: Number, default: 5, min: 1, max: 10 },

  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

productSchema.index({ brandId: 1, isActive: 1 });
productSchema.index({ brandId: 1, category: 1, isActive: 1 });

module.exports = mongoose.model('Product', productSchema);