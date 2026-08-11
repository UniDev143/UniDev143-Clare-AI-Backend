// ═══════════════════════════════════════════════════════════
// CLARÉ AI — EXPLANATION SERVICE
// One batched LLM call per scan → validated, grounded,
// per-item fallback to templates. A scan never waits on prose.
// ═══════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const {
  EXPLANATION_SYSTEM_PROMPT,
  EXPLANATION_PROMPT_VERSION,
} = require('../prompts/explanationPrompt');
const {
  templateExplanation, ISSUE_DISPLAY, BUDGET_ORDER,
} = require('./recommendationService');

const client = new Anthropic({
  apiKey:     process.env.ANTHROPIC_API_KEY,
  maxRetries: 0,
});

const EXPLAIN_TIMEOUT_MS = 10_000;   // short leash: prose is a bonus

const AREA_DISPLAY = {
  forehead: 'forehead', t_zone: 'T-zone', nose: 'nose', cheeks: 'cheeks',
  chin: 'chin', under_eyes: 'under-eye area', jawline: 'jawline',
  temples: 'temples',
};

const CONCERN_DISPLAY = { ...ISSUE_DISPLAY, general: 'overall glow' };

// ── FACT SHEETS: the only reality the model gets ───────────
const buildFactSheets = (picks, analysis, questionnaire, productsById) => {
  const userTier = BUDGET_ORDER.indexOf(questionnaire.budget || 'medium');

  return picks.map((pick, i) => {
    const product = productsById[String(pick.productId)] || {};
    const contributions = pick._breakdown?.contributions || [];

    const targetsForUser = contributions.slice(0, 3).map(c => {
      const cond = analysis.conditions?.[c.issue] || {};
      const statedOnly = c.issue === questionnaire.primaryConcern && !cond.detected;
      return {
        concern:  ISSUE_DISPLAY[c.issue] || c.issue,
        severity: (cond.severity && cond.severity !== 'none') ? cond.severity : 'mild',
        areas:    (cond.areas || []).map(a => AREA_DISPLAY[a] || a).slice(0, 3),
        ...(statedOnly ? { source: 'stated_by_user_not_seen_in_scan' } : {}),
      };
    });

    return {
      slot: i + 1,
      category: (product.category || 'product').replace('_', ' '),
      keyIngredients: (product.keyIngredients || []).slice(0, 3),
      targetsForUser,
      ...(i === 0 ? {
        skinType: analysis.skinType,
        sensitiveSkin: questionnaire.skinSensitivity !== 'not_sensitive',
      } : {}),
      primaryConcern: CONCERN_DISPLAY[questionnaire.primaryConcern] || 'overall glow',
      aboveBudget: BUDGET_ORDER.indexOf(product.budgetTier) > userTier,
    };
  });
};

// ── VALIDATION: never trust, always verify ─────────────────
const BANNED = new RegExp(
  '\\b(cure[sd]?|heal[s]?|guarantee[d]?|clinically|dermatologist[- ]tested|' +
  'proven|miracle|best|perfect|flawless|' +
  'will\\s+(clear|fix|eliminate|remove|erase|cure)|' +
  'acne\\s+vulgaris|rosacea|eczema|dermatitis|melasma|psoriasis|' +
  'diagnos\\w*|prescri\\w*|treat(s|ment)?\\s+(your\\s+)?(condition|disease))\\b' +
  '|\\d{1,3}\\s?(%|percent)', 'i'
);

const validateOne = (text, fact) => {
  if (typeof text !== 'string') return { ok: false, reason: 'not a string' };
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).length;
  if (words < 12 || words > 70) return { ok: false, reason: `word count ${words}` };
  if (BANNED.test(trimmed))     return { ok: false, reason: 'banned pattern' };

  // Budget disclosure enforcement (Design Decision 4)
  if (fact.aboveBudget && !/above your budget/i.test(trimmed)) {
    return {
      ok: true,
      text: trimmed + ' It sits slightly above your budget, included for how well it matches.',
      patched: 'budget line appended',
    };
  }
  if (!fact.aboveBudget && /budget|price|afford/i.test(trimmed)) {
    return { ok: false, reason: 'mentioned budget when not flagged' };
  }

  return { ok: true, text: trimmed };
};

// ── MAIN: enrich picks with LLM explanations ───────────────
const generateExplanations = async ({ picks, analysis, questionnaire, productsById }) => {
  const facts = buildFactSheets(picks, analysis, questionnaire, productsById);
  const stats = { llm: 0, template: 0, patched: 0, ms: 0, version: EXPLANATION_PROMPT_VERSION };

  // Fallback map, ready before we even try
  const fallbackFor = (pick) => templateExplanation(
    { product: productsById[String(pick.productId)] || { category: 'product' },
      breakdown: pick._breakdown || { contributions: [] } },
    questionnaire
  );

  let parsed = null;
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      temperature: 0.7,          // prose wants some life; facts are locked anyway
      system: EXPLANATION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write one explanation per fact sheet:\n\n${JSON.stringify(facts, null, 2)}`,
      }],
    }, { timeout: EXPLAIN_TIMEOUT_MS });

    const raw = (response.content[0]?.text || '')
      .replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) parsed = null;
  } catch (err) {
    console.log(`[Explain] LLM call failed (${err.message}) — using templates`);
    parsed = null;
  }

  stats.ms = Date.now() - start;

  const enriched = picks.map((pick, i) => {
    const fact  = facts[i];
    const entry = parsed?.find(e => e.slot === i + 1);
    const check = entry ? validateOne(entry.explanation, fact) : { ok: false, reason: 'missing slot' };

    if (check.ok) {
      stats.llm++;
      if (check.patched) stats.patched++;
      return { ...pick, explanation: check.text, explanationSource: 'llm' };
    }

    if (entry) console.log(`[Explain] slot ${i + 1} rejected: ${check.reason}`);
    stats.template++;
    return { ...pick, explanation: fallbackFor(pick), explanationSource: 'template' };
  });

  console.log(
    `[Explain] ${stats.llm} llm / ${stats.template} template` +
    `${stats.patched ? ` (${stats.patched} patched)` : ''} in ${stats.ms}ms (v${stats.version})`
  );

  return enriched;
};

module.exports = { generateExplanations, validateOne, buildFactSheets, BANNED };