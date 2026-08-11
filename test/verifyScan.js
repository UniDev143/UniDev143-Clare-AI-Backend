// Verifies a real scan's recommendations against the Day-15 guarantees.
// Usage: node test/verifyScan.js <scanId>
require('dotenv').config();
const mongoose = require('mongoose');
const Scan     = require('../models/Scan');
const Product  = require('../models/Product');

const BUDGET_ORDER = ['low', 'medium', 'high'];
const scanId = process.argv[2];

(async () => {
  if (!scanId) { console.log('Usage: node test/verifyScan.js <scanId>'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);

  const scan = await Scan.findById(scanId).lean();
  if (!scan) { console.log('Scan not found'); process.exit(1); }

  const recs = scan.recommendations || [];
  const products = await Product.find({ _id: { $in: recs.map(r => r.productId) } }).lean();
  const byId = Object.fromEntries(products.map(p => [String(p._id), p]));

  const P = (ok, name, detail = '') =>
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);

  console.log(`\n── Verify scan ${scanId} ──`);
  console.log(`questionnaire: budget=${scan.questionnaire.budget}, ` +
              `allergies=[${(scan.questionnaire.allergies || []).join(',')}], ` +
              `concern=${scan.questionnaire.primaryConcern}\n`);

  // The composition, human-readable
  for (const r of recs.sort((a, b) => a.rank - b.rank)) {
    const p = byId[String(r.productId)];
    console.log(`  #${r.rank} [${r.matchScore}%] ${p?.name} ` +
                `(${p?.category}, ${p?.budgetTier})`);
    console.log(`       ${r.explanation}`);
  }
  console.log('');

  // Check 1: count
  P(recs.length >= 3 && recs.length <= 4, `pick count is 3-4 (got ${recs.length})`);

  // Check 2: unique categories
  const cats = recs.map(r => byId[String(r.productId)]?.category);
  P(new Set(cats).size === cats.length, 'one product per category', cats.join(','));

  // Check 3: allergen wall
  const allergies = new Set(scan.questionnaire.allergies || []);
  const leaks = recs.filter(r =>
    (byId[String(r.productId)]?.tags?.containsAllergens || []).some(a => allergies.has(a)));
  P(leaks.length === 0, 'no allergen leaks',
    leaks.map(l => byId[String(l.productId)]?.name).join(','));

  // Check 4: budget honesty
  const userTier = BUDGET_ORDER.indexOf(scan.questionnaire.budget || 'medium');
  const dishonest = recs.filter(r => {
    const p = byId[String(r.productId)];
    return BUDGET_ORDER.indexOf(p?.budgetTier) > userTier &&
           !/above your budget/i.test(r.explanation);
  });
  P(dishonest.length === 0, 'above-budget picks carry the honest line',
    dishonest.map(d => byId[String(d.productId)]?.name).join(','));

  process.exit(0);
})();