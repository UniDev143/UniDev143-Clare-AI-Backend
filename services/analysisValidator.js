// Validates and sanitizes the AI's analysis response
// Never trust LLM output — always validate before saving to DB

const VALID_SKIN_TYPES  = ['oily', 'dry', 'combination', 'sensitive', 'normal'];
const VALID_SEVERITIES  = ['none', 'mild', 'moderate', 'severe'];
const VALID_CONFIDENCE  = ['high', 'medium', 'low'];
const VALID_AREAS       = ['forehead', 't_zone', 'nose', 'cheeks', 'chin',
                           'under_eyes', 'jawline', 'temples'];
const VALID_REJECTIONS  = ['no_face', 'multiple_faces', 'face_too_small',
                           'poor_quality', 'heavy_makeup', 'not_real_photo'];
const CONDITION_KEYS    = ['acne', 'dark_spots', 'dark_circles', 'oiliness',
                           'dryness', 'redness', 'wrinkles'];

// Severity ↔ score alignment — fix contradictions by trusting the score
const severityFromScore = (score) => {
  if (score < 10)  return 'none';
  if (score < 40)  return 'mild';
  if (score < 70)  return 'moderate';
  return 'severe';
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

const validateAnalysis = (raw) => {
  const errors = [];

  // ── Must be an object ────────────────────────────────
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not an object'], data: null };
  }

  // ── Rejection path ───────────────────────────────────
  if (raw.validImage === false) {
    const reason = VALID_REJECTIONS.includes(raw.rejectionReason)
      ? raw.rejectionReason
      : 'poor_quality';
    return {
      valid: true,
      rejected: true,
      rejectionReason: reason,
      data: null,
      errors: []
    };
  }

  // ── Build sanitized result ───────────────────────────
  const clean = {
    skinType: VALID_SKIN_TYPES.includes(raw.skinType) ? raw.skinType : 'normal',
    conditions: {},
    overallSkinHealth: clamp(raw.overallSkinHealth, 0, 100),
    aiSummary: typeof raw.aiSummary === 'string'
      ? raw.aiSummary.slice(0, 1000)   // cap length
      : '',
    confidence: VALID_CONFIDENCE.includes(raw.confidence) ? raw.confidence : 'medium',
  };

  // ── Validate each condition ──────────────────────────
  for (const key of CONDITION_KEYS) {
    const cond = raw.conditions?.[key];

    if (!cond || typeof cond !== 'object') {
      errors.push(`Missing condition: ${key}`);
      clean.conditions[key] = { detected: false, severity: 'none', score: 0, areas: [] };
      continue;
    }

    const score = clamp(cond.score, 0, 100);

    // Fix severity/score contradictions — score is source of truth
    const severity = severityFromScore(score);
    if (cond.severity !== severity) {
      errors.push(`${key}: severity "${cond.severity}" didn't match score ${score} — corrected to "${severity}"`);
    }

    clean.conditions[key] = {
      detected: score >= 10,
      severity,
      score,
      areas: Array.isArray(cond.areas)
        ? cond.areas.filter(a => VALID_AREAS.includes(a))
        : []
    };
  }

  // ── Sanity check aiSummary for medical terms ─────────
  const MEDICAL_TERMS = /\b(vulgaris|rosacea|eczema|dermatitis|melasma|psoriasis|diagnos|disease|disorder|condition requires|see a doctor immediately)\b/i;
  if (MEDICAL_TERMS.test(clean.aiSummary)) {
    errors.push('aiSummary contained medical language — flagged');
    clean.confidence = 'low';
  }

  return {
    valid: true,
    rejected: false,
    data: clean,
    errors    // non-fatal — logged for prompt tuning
  };
};

module.exports = { validateAnalysis, severityFromScore };