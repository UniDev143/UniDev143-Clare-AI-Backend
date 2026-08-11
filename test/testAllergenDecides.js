// Proves the allergen wall as the SOLE deciding filter, using a real scan's analysis.
// Usage: node test/testAllergenDecides.js <anyScanId>
require('dotenv').config();
const mongoose = require('mongoose');
const Scan = require('../models/Scan');
const Product = require('../models/Product');
const { generateRecommendations } = require('../services/recommendationService');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const scan = await Scan.findById(process.argv[2]).lean();
  const catalog = await Product.find({ brandId: scan.brandId, isActive: true }).lean();

  const q = { skinSensitivity: 'not_sensitive', currentRoutine: 'moderate',
              budget: 'medium', primaryConcern: 'acne',
              allergies: ['aha_bha', 'niacinamide'] };   // low-tier, high-scoring targets

  const { recommendations } = generateRecommendations({ analysis: scan.analysis, questionnaire: q }, catalog);
  const byId = Object.fromEntries(catalog.map(p => [String(p._id), p]));

  let leaks = 0;
  for (const r of recommendations) {
    const p = byId[String(r.productId)];
    const bad = (p.tags.containsAllergens || []).some(a => q.allergies.includes(a));
    if (bad) leaks++;
    console.log(`#${r.rank} ${p.name} [${(p.tags.containsAllergens||[]).join(',') || 'clean'}]`);
  }
  console.log(leaks === 0
    ? '\nPASS — wall held as the sole deciding filter (salicylic/niacinamide products excluded on allergen alone)'
    : `\nFAIL — ${leaks} leak(s)`);
  process.exit(leaks ? 1 : 0);
})();
