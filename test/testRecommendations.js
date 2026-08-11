// Unit tests for the recommendation engine — pure fixtures, no DB.
// Each test guards one design decision from Day 15.
const {
  generateRecommendations, hardFilter, CONFIG
} = require('../services/recommendationService');

let passed = 0, failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); passed++; }
  else      { console.log(`  FAIL  ${name}  ${detail}`); failed++; }
};

// ── FIXTURES ───────────────────────────────────────────────
const P = (over) => ({
  _id: over._id, name: over.name || over._id, isActive: true,
  category: over.category || 'serum', price: over.price || 2000,
  budgetTier: over.budgetTier || 'medium', priorityScore: over.priorityScore || 5,
  tags: {
    targetsIssues: over.targets || [], suitableFor: over.suitable || ['all'],
    severity: over.severity || ['all'], containsAllergens: over.allergens || [],
  },
});

const CATALOG = [
  P({ _id: 'p_acne_cleanser', category: 'cleanser', budgetTier: 'low',
      targets: ['acne','oiliness'], suitable: ['oily','combination'],
      severity: ['mild','moderate'], allergens: ['aha_bha'], priorityScore: 7 }),
  P({ _id: 'p_niacinamide', category: 'serum', targets: ['oiliness','dark_spots','acne'],
      suitable: ['oily','combination'], severity: ['mild','moderate'],
      allergens: ['niacinamide'], priorityScore: 8 }),
  P({ _id: 'p_vitc_fragrance', category: 'serum', budgetTier: 'high',
      targets: ['dark_spots'], allergens: ['fragrance'], priorityScore: 9 }),
  P({ _id: 'p_spot_severe', category: 'spot_treatment', budgetTier: 'low',
      targets: ['acne'], suitable: ['oily','combination','normal'],
      severity: ['moderate','severe'], allergens: ['aha_bha'] }),
  P({ _id: 'p_moisturizer', category: 'moisturizer', targets: ['dryness','redness'],
      suitable: ['dry','sensitive','normal'] }),
  P({ _id: 'p_sunscreen', category: 'sunscreen', targets: ['dark_spots'],
      suitable: ['all'], priorityScore: 8 }),
  P({ _id: 'p_wrinkle_high', category: 'eye_cream', budgetTier: 'high',
      targets: ['wrinkles','dark_circles'] }),
];

const ANALYSIS = {
  skinType: 'combination', confidence: 'high',
  conditions: {
    acne:         { detected: true,  severity: 'moderate', score: 60 },
    oiliness:     { detected: true,  severity: 'moderate', score: 55 },
    dark_circles: { detected: true,  severity: 'mild',     score: 28 },
    dark_spots:   { detected: false, severity: 'none',     score: 8  },
    dryness:      { detected: false, severity: 'none',     score: 5  },
    redness:      { detected: false, severity: 'none',     score: 6  },
    wrinkles:     { detected: false, severity: 'none',     score: 4  },
  },
};

const Q = (over = {}) => ({
  skinSensitivity: 'not_sensitive', allergies: [],
  currentRoutine: 'moderate', budget: 'high', primaryConcern: 'acne', ...over,
});

const run = (q, catalog = CATALOG, analysis = ANALYSIS) =>
  generateRecommendations({ analysis, questionnaire: q }, catalog);

console.log('\n── Recommendation Engine Tests ──\n');

// T1: Allergen exclusion is absolute
{
  const r = run(Q({ allergies: ['aha_bha'] }));
  const ids = r.recommendations.map(x => x.productId);
  check('T1 allergen exclusion',
    !ids.includes('p_acne_cleanser') && !ids.includes('p_spot_severe'),
    `got ${ids.join(',')}`);
}

// T2: Budget ceiling + relaxation ladder
{
  const strict = run(Q({ budget: 'low' }));
  const ids = strict.recommendations.map(x => x.productId);
  check('T2a low budget excludes high tier',
    !ids.includes('p_vitc_fragrance') && !ids.includes('p_wrinkle_high'),
    `got ${ids.join(',')}`);

  const premiumOnly = [
    P({ _id: 'hi1', budgetTier: 'high', targets: ['acne'] }),
    P({ _id: 'hi2', budgetTier: 'high', targets: ['oiliness'], category: 'toner' }),
  ];
  const relaxed = run(Q({ budget: 'medium' }), premiumOnly);
  check('T2b relaxation ladder fires when catalog empty at tier',
    relaxed.meta.relaxedBudget === true && relaxed.recommendations.length > 0,
    JSON.stringify(relaxed.meta));
}

// T3: very_sensitive is a hard requirement
{
  const r = run(Q({ skinSensitivity: 'very_sensitive' }));
  const bad = r.recommendations.filter(x => {
    const p = CATALOG.find(c => c._id === x.productId);
    const s = p.tags.suitableFor;
    return !s.includes('sensitive') && !s.includes('all');
  });
  check('T3 very_sensitive only gets sensitive-safe products',
    bad.length === 0, `leaked: ${bad.map(b => b.productId).join(',')}`);
}

// T4: Category diversity — never two of the same slot
{
  const r = run(Q());
  const cats = r.recommendations.map(x =>
    CATALOG.find(c => c._id === x.productId).category);
  check('T4 max one product per category',
    new Set(cats).size === cats.length, cats.join(','));
}

// T5: primaryConcern reorders results
{
  const acneFirst  = run(Q({ primaryConcern: 'acne' }));
  const spotsFirst = run(Q({ primaryConcern: 'dark_spots' }));
  check('T5 concern changes ranking',
    acneFirst.recommendations[0].productId !== spotsFirst.recommendations[0].productId ||
    JSON.stringify(acneFirst.recommendations.map(r=>r.productId)) !==
    JSON.stringify(spotsFirst.recommendations.map(r=>r.productId)),
    'identical output for different concerns');
}

// T6: severity mismatch penalized (severe-only product vs moderate acne user
//     should lose to a matching-severity product with similar targeting)
{
  const r = run(Q());
  const spotRank = r.recommendations.findIndex(x => x.productId === 'p_spot_severe');
  const cleanRank = r.recommendations.findIndex(x => x.productId === 'p_acne_cleanser');
  check('T6 severity-matched product outranks mismatched one',
    cleanRank !== -1 && (spotRank === -1 || cleanRank < spotRank),
    `cleanser@${cleanRank} spot@${spotRank}`);
}

// T7: Deterministic — same input, same output
{
  const a = JSON.stringify(run(Q()).recommendations.map(r => r.productId));
  const b = JSON.stringify(run(Q()).recommendations.map(r => r.productId));
  check('T7 deterministic output', a === b);
}

// T8: Beginner foundation rule
{
  const activesOnly = Q({ currentRoutine: 'none', primaryConcern: 'dark_spots' });
  const r = run(activesOnly);
  const cats = r.recommendations.map(x =>
    CATALOG.find(c => c._id === x.productId).category);
  const FOUNDATION = ['cleanser','moisturizer','sunscreen'];
  check('T8 beginners get at least one foundation product',
    cats.some(c => FOUNDATION.includes(c)), cats.join(','));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
