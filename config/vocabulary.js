// ═══════════════════════════════════════════════════════════
// CLARÉ AI — SHARED VOCABULARY (single source of truth)
// These enums bind analysis ↔ questionnaire ↔ product tags.
// NEVER change one side without the others + frontend types.
// ═══════════════════════════════════════════════════════════

const SKIN_ISSUES = [
  'acne', 'dark_spots', 'dark_circles',
  'oiliness', 'dryness', 'redness', 'wrinkles'
];

const SKIN_TYPES = ['oily', 'dry', 'combination', 'sensitive', 'normal', 'all'];

const SEVERITY_LEVELS = ['mild', 'moderate', 'severe', 'all'];

// Must mirror frontend/src/config/questions.ts allergies exactly
const ALLERGENS = ['fragrance', 'retinol', 'niacinamide', 'aha_bha', 'alcohol'];

// Must mirror questionnaire budget options exactly
const BUDGET_TIERS = ['low', 'medium', 'high'];

// Routine slots — engine enforces diversity across these
const PRODUCT_CATEGORIES = [
  'cleanser', 'toner', 'serum', 'moisturizer',
  'sunscreen', 'eye_cream', 'mask', 'spot_treatment'
];

module.exports = {
  SKIN_ISSUES, SKIN_TYPES, SEVERITY_LEVELS,
  ALLERGENS, BUDGET_TIERS, PRODUCT_CATEGORIES
};