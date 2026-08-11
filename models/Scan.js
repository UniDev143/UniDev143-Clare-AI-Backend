const mongoose = require("mongoose");

// Severity score for each detected skin issue
const severitySchema = new mongoose.Schema(
  {
    areas: { type: [String], default: [] },
    detected: {
      type: Boolean,
      default: false,
    },
    severity: {
      type: String,
      enum: ["none", "mild", "moderate", "severe"],
      default: "none",
    },
    score: {
      type: Number, // 0–100 numeric score from AI
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: false },
); // no separate _id for subdocuments

// Each recommended product in results
const recommendationSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rank:       { type: Number, required: true },
  matchScore: { type: Number, required: true },
  explanation: { type: String, required: true },
  explanationSource: {                              // ← ADD THIS
    type: String,
    enum: ['llm', 'template'],
    default: 'template'
  },
}, { _id: false });

const scanSchema = new mongoose.Schema(
  {
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      index: true,
    },

    // ── QUESTIONNAIRE ANSWERS ──────────────────────────────────
    questionnaire: {
      skinSensitivity: {
        type: String,
        enum: ["not_sensitive", "slightly_sensitive", "very_sensitive"],
        required: true,
      },
      allergies: {
        type: [String],
        default: [],
        // e.g. ['fragrance', 'retinol', 'niacinamide']
      },
      currentRoutine: {
        type: String,
        enum: ["none", "basic", "moderate", "extensive"],
        required: true,
      },
      budget: {
        type: String,
        enum: ["low", "medium", "high"],
        required: true,
      },
      primaryConcern: {
        type: String,
        enum: [
          "acne",
          "dark_spots",
          "dark_circles",
          "oiliness",
          "dryness",
          "redness",
          "wrinkles",
          "general",
        ],
        required: true,
      },
    },

    // ── AI ANALYSIS RESULTS ────────────────────────────────────
    analysis: {
      confidence: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "medium",
      },
      skinType: {
        type: String,
        enum: ["oily", "dry", "combination", "sensitive", "normal"],
        default: "normal",
      },
      conditions: {
        acne: { type: severitySchema, default: () => ({}) },
        dark_spots: { type: severitySchema, default: () => ({}) },
        dark_circles: { type: severitySchema, default: () => ({}) },
        oiliness: { type: severitySchema, default: () => ({}) },
        dryness: { type: severitySchema, default: () => ({}) },
        redness: { type: severitySchema, default: () => ({}) },
        wrinkles: { type: severitySchema, default: () => ({}) },
      },
      overallSkinHealth: {
        type: Number, // 0–100 overall score
        min: 0,
        max: 100,
      },
      aiSummary: {
        type: String, // one paragraph AI-written summary of the skin
      },
      confidence: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "medium",
      }, // ← ADD
      rejected: { type: Boolean, default: false }, // ← ADD
      rejectionReason: { type: String, default: null },
      promptVersion: { type: String, default: null },
    },

    // ── RECOMMENDATIONS ────────────────────────────────────────
    recommendations: [recommendationSchema],

    // ── PRIVACY: NO IMAGE STORED ───────────────────────────────
    // image is processed in memory and deleted — never saved here
    // we only store analysis results and a quality score
    imageQualityScore: {
      type: Number, // 0–100, how good the input photo was
      default: null,
    },

    // Session tracking (no user account needed)
    sessionId: {
      type: String,
      index: true,
      // random UUID generated on frontend, for anonymous tracking
    },
  },
  {
    timestamps: true,
  },
);

// Analytics queries filter by brandId + date range constantly
scanSchema.index({ brandId: 1, createdAt: -1 });

module.exports = mongoose.model("Scan", scanSchema);
