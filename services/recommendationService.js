// ═══════════════════════════════════════════════════════════
// CLARÉ AI — RECOMMENDATION ENGINE v1.0
// Pure functions: no DB, no side effects → trivially testable.
// Design rationale: see Day 15 notes. Weights live in CONFIG.
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  CONCERN_MULTIPLIER: 1.5,       // stated concern beats detected-only issues
  CONCERN_FLOOR: 30,             // trust the human even if photo disagrees
  CONCERN_FLOOR_LOW_CONF: 50,    // trust them MORE when analysis is unsure
  SEVERITY_MISMATCH_KEEP: 0.3,   // wrong-severity product keeps 30% of points
  TYPE_EXACT: 1.0,
  TYPE_COMBO_PARTIAL: 0.8,       // combination ~ half oily, half dry
  TYPE_MISMATCH: 0.5,
  SENSITIVE_BONUS: 5,            // slightly_sensitive prefers safe products
  ABSOLUTE_FLOOR: 15,            // below this: not a real match, drop it
  RELATIVE_FLOOR: 0.25,          // or under 25% of hero score
  MAX_RECS: 4,
  MIN_TARGET: 3,                 // fewer than this triggers budget relaxation
  HERO_DISPLAY: 95,              // top pick shows 95%, never claim 100
};

const BUDGET_ORDER = ['low', 'medium', 'high'];
const FOUNDATION_CATEGORIES = ['cleanser', 'moisturizer', 'sunscreen'];

const ISSUE_DISPLAY = {
  acne: 'blemishes', dark_spots: 'dark spots', dark_circles: 'dark circles',
  oiliness: 'excess shine', dryness: 'dryness', redness: 'redness',
  wrinkles: 'fine lines',
};

// ── LAYER 1: HARD FILTERS ──────────────────────────────────
// Allergens + very_sensitive are SAFETY: never relaxed.
// Budget is PREFERENCE: relaxable by exactly one tier.

const passesFilters = (product, questionnaire, budgetCeilingIdx) => {
  if (!product.isActive) return false;

  const allergies = new Set(questionnaire.allergies || []);
  const contains  = product.tags?.containsAllergens || [];
  if (contains.some(a => allergies.has(a))) return false;

  if (questionnaire.skinSensitivity === 'very_sensitive') {
    const suitable = product.tags?.suitableFor || [];
    if (!suitable.includes('sensitive') && !suitable.includes('all')) return false;
  }

  const tierIdx = BUDGET_ORDER.indexOf(product.budgetTier);
  if (tierIdx > budgetCeilingIdx) return false;

  return true;
};

const hardFilter = (products, questionnaire) => {
  const ceiling = Math.max(0, BUDGET_ORDER.indexOf(questionnaire.budget || 'medium'));

  let eligible = products.filter(p => passesFilters(p, questionnaire, ceiling));
  let relaxedBudget = false;

  // Relaxation ladder: one rung, budget only
  if (eligible.length < CONFIG.MIN_TARGET && ceiling < BUDGET_ORDER.length - 1) {
    const relaxed = products.filter(p => passesFilters(p, questionnaire, ceiling + 1));
    if (relaxed.length > eligible.length) {
      eligible = relaxed;
      relaxedBudget = true;
    }
  }

  return { eligible, relaxedBudget };
};

// ── LAYER 2: SCORING ───────────────────────────────────────

const severityFits = (product, userSeverity) => {
  const levels = product.tags?.severity || ['all'];
  return levels.includes('all') || levels.includes(userSeverity);
};

const typeFit = (product, skinType) => {
  const suitable = product.tags?.suitableFor || ['all'];
  if (suitable.includes('all') || suitable.includes(skinType)) return CONFIG.TYPE_EXACT;
  if (skinType === 'combination' &&
      (suitable.includes('oily') || suitable.includes('dry'))) return CONFIG.TYPE_COMBO_PARTIAL;
  return CONFIG.TYPE_MISMATCH;
};

const scoreProduct = (product, analysis, questionnaire) => {
  const concern = questionnaire.primaryConcern;
  const floor   = analysis.confidence === 'low'
    ? CONFIG.CONCERN_FLOOR_LOW_CONF
    : CONFIG.CONCERN_FLOOR;

  const contributions = [];
  let sum = 0;

  for (const issue of (product.tags?.targetsIssues || [])) {
    const cond = analysis.conditions?.[issue];
    let need = cond ? cond.score : 0;
    let effSeverity = cond?.severity || 'none';

    if (issue === concern) {
      // Human override: floor + multiplier (Design Decision 3)
      if (effSeverity === 'none') effSeverity = 'mild';  // floored concern acts as mild
      need = Math.max(need, floor) * CONFIG.CONCERN_MULTIPLIER;
    }

    if (need <= 0) continue;

    const sevOk  = severityFits(product, effSeverity);
    const factor = sevOk ? 1 : CONFIG.SEVERITY_MISMATCH_KEEP;
    const points = need * factor;

    sum += points;
    contributions.push({
      issue, need: Math.round(need), severityOk: sevOk, points: Math.round(points),
    });
  }

  const tFit = typeFit(product, analysis.skinType);
  let raw = sum * tFit;

  let sensitiveBonus = 0;
  if (questionnaire.skinSensitivity === 'slightly_sensitive') {
    const suitable = product.tags?.suitableFor || [];
    if (suitable.includes('sensitive') || suitable.includes('all')) {
      sensitiveBonus = CONFIG.SENSITIVE_BONUS;
    }
  }

  raw += sensitiveBonus + (product.priorityScore || 5);
  contributions.sort((a, b) => b.points - a.points);

  return {
    product, raw,
    breakdown: { contributions, typeFit: tFit, sensitiveBonus,
                 priority: product.priorityScore || 5 },
  };
};

// ── LAYER 3: COMPOSITION ───────────────────────────────────
// Routine, not leaderboard (Design Decision 6).

const compose = (scored, questionnaire) => {
  const ranked = [...scored].sort((a, b) =>
    b.raw - a.raw ||
    (b.product.priorityScore || 0) - (a.product.priorityScore || 0) ||
    (a.product.price || 0) - (b.product.price || 0) ||
    String(a.product._id).localeCompare(String(b.product._id))   // determinism
  );

  if (ranked.length === 0) return [];

  const heroRaw = ranked[0].raw;
  const viable  = ranked.filter(r =>
    r.raw >= CONFIG.ABSOLUTE_FLOOR && r.raw >= heroRaw * CONFIG.RELATIVE_FLOOR
  );

  // Greedy pick, max one per category
  const picks = [];
  const usedCategories = new Set();
  for (const r of viable) {
    if (picks.length >= CONFIG.MAX_RECS) break;
    if (usedCategories.has(r.product.category)) continue;
    picks.push(r);
    usedCategories.add(r.product.category);
  }

  // Beginner foundation rule
  const isBeginner = ['none', 'basic'].includes(questionnaire.currentRoutine);
  const hasFoundation = picks.some(p => FOUNDATION_CATEGORIES.includes(p.product.category));

  if (isBeginner && !hasFoundation && picks.length > 0) {
    const foundation = viable.find(r =>
      FOUNDATION_CATEGORIES.includes(r.product.category) &&
      !usedCategories.has(r.product.category)
    );
    if (foundation) {
      if (picks.length >= CONFIG.MAX_RECS) picks[picks.length - 1] = foundation;
      else picks.push(foundation);
    }
  }

  return picks;
};

// ── TEMPLATE EXPLANATIONS ──────────────────────────────────
// Placeholder until Day 16's LLM-generated versions.

const templateExplanation = (pick, questionnaire) => {
  const { product, breakdown } = pick;
  const category = product.category.replace('_', ' ');
  const article  = /^[aeiou]/i.test(category) ? 'an' : 'a';
  const top = breakdown.contributions[0];
  const ing = (product.keyIngredients || [])[0];

  const OPENERS = [
    `A ${category} chosen to help with your ${ISSUE_DISPLAY[top?.issue] || 'skin'}`,
    `This ${category} targets your ${ISSUE_DISPLAY[top?.issue] || 'skin'}`,
    `Matched to your ${ISSUE_DISPLAY[top?.issue] || 'skin'}, this ${category}`,
    `For your ${ISSUE_DISPLAY[top?.issue] || 'skin'}, ${article} ${category}`,
  ];

  let text;
  if (top) {
    const opener = OPENERS[pick.rank % OPENERS.length];
    text = ing
      ? `${opener}, with ${ing} among its key ingredients.`
      : `${opener}.`;
  } else {
    text = `A well-matched ${category} for your skin type.`;
  }

  const userTier = BUDGET_ORDER.indexOf(questionnaire.budget || 'medium');
  const prodTier = BUDGET_ORDER.indexOf(product.budgetTier);
  if (prodTier > userTier) {
    text += ' It sits slightly above your budget, included for its strong match.';
  }
  return text;
};

// ── ORCHESTRATOR ───────────────────────────────────────────

const generateRecommendations = (scanLike, products) => {
  const { analysis, questionnaire } = scanLike;

  const baseCeiling = Math.max(0, BUDGET_ORDER.indexOf(questionnaire.budget || 'medium'));

  const runAt = (ceiling) => {
    const eligible = products.filter(p => passesFilters(p, questionnaire, ceiling));
    const scored   = eligible.map(p => scoreProduct(p, analysis, questionnaire));
    const picks    = compose(scored, questionnaire);
    return { eligible, picks };
  };

  let { eligible, picks } = runAt(baseCeiling);
  let relaxedBudget = false;

  // Ladder now watches FINAL PICKS, not eligibility.
  // Still one rung. Allergens/sensitivity still never relax.
  if (picks.length < CONFIG.MIN_TARGET && baseCeiling < BUDGET_ORDER.length - 1) {
    const relaxed = runAt(baseCeiling + 1);
    if (relaxed.picks.length > picks.length) {
      ({ eligible, picks } = relaxed);
      relaxedBudget = true;
    }
  }

  if (picks.length === 0) {
    return { recommendations: [], meta: { eligibleCount: eligible.length, relaxedBudget } };
  }

  const heroRaw = picks.reduce((m, p) => Math.max(m, p.raw), 0);

  const recommendations = picks.map((pick, i) => ({
    productId:  pick.product._id,
    rank:       i + 1,
    matchScore: Math.max(1, Math.round(CONFIG.HERO_DISPLAY * pick.raw / heroRaw)),
    explanation: templateExplanation(pick, questionnaire),
    _raw:       pick.raw,
    _breakdown: pick.breakdown,
  }));

  return {
    recommendations,
    meta: { eligibleCount: eligible.length, relaxedBudget },
  };
};

module.exports = {
  generateRecommendations,
  // exported for unit tests:
  hardFilter, scoreProduct, compose, CONFIG,
  // exported for explanation service:
  templateExplanation, ISSUE_DISPLAY, BUDGET_ORDER,
};