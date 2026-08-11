// Live batched-explanation test against the real API. ~$0.01 per run.
require('dotenv').config();
const { generateExplanations } = require('../services/explanationService');

const productsById = {
  p1: { _id: 'p1', name: 'Niacinamide 10% Serum', category: 'serum',
        budgetTier: 'medium', keyIngredients: ['Niacinamide 10%', 'Zinc PCA'] },
  p2: { _id: 'p2', name: 'Clear Skin Salicylic Cleanser', category: 'cleanser',
        budgetTier: 'low', keyIngredients: ['Salicylic Acid 2%', 'Green Tea Extract'] },
  p3: { _id: 'p3', name: 'Eye Revive Cream', category: 'eye_cream',
        budgetTier: 'medium', keyIngredients: ['Caffeine', 'Peptides'] },
};

const analysis = {
  skinType: 'combination', confidence: 'high',
  conditions: {
    oiliness:     { severity: 'moderate', score: 55, areas: ['forehead', 'nose', 't_zone'] },
    acne:         { severity: 'mild',     score: 28, areas: ['chin', 'cheeks'] },
    dark_circles: { severity: 'mild',     score: 26, areas: ['under_eyes'] },
  },
};

const questionnaire = {
  skinSensitivity: 'slightly_sensitive', allergies: ['retinol'],
  currentRoutine: 'basic', budget: 'low', primaryConcern: 'dryness',
};

const picks = [
  { productId: 'p1', rank: 1, matchScore: 95,
    _breakdown: { contributions: [{ issue: 'oiliness' }, { issue: 'acne' }] } },
  { productId: 'p2', rank: 2, matchScore: 90,
    _breakdown: { contributions: [{ issue: 'oiliness' }, { issue: 'acne' }] } },
  { productId: 'p3', rank: 3, matchScore: 40,
    _breakdown: { contributions: [{ issue: 'dark_circles' }] } },
];

(async () => {
  const out = await generateExplanations({ picks, analysis, questionnaire, productsById });
  console.log('');
  for (const r of out) {
    const p = productsById[r.productId];
    console.log(`#${r.rank} ${p.name}  [${r.explanationSource}]`);
    console.log(`   ${r.explanation}\n`);
  }
  process.exit(0);
})();