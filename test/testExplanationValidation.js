// Pure validator tests — zero API cost.
// Each guards one line of defense from Design Decisions 2-4.
const { validateOne, BANNED } = require('../services/explanationService');

let passed = 0, failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { console.log(`  PASS  ${name}`); passed++; }
  else      { console.log(`  FAIL  ${name}  ${detail}`); failed++; }
};

const FACT   = { aboveBudget: false };
const FACT_B = { aboveBudget: true };

console.log('\n── Explanation Validator Tests ──\n');

// V1: good explanation passes untouched
{
  const good = 'The shine across your forehead and nose stood out in your scan, and the niacinamide here works on balancing exactly that while staying gentle on combination skin.';
  const r = validateOne(good, FACT);
  check('V1 clean text passes', r.ok && r.text === good);
}

// V2: medical language rejected
{
  const r = validateOne('This helps with your rosacea and calms the redness on your cheeks over time, morning and night.', FACT);
  check('V2 medical term rejected', !r.ok && r.reason === 'banned pattern');
}

// V3: outcome promises rejected
{
  const r = validateOne('Use this nightly and it will clear your blemishes within weeks, leaving your chin and cheeks smooth again.', FACT);
  check('V3 promise language rejected', !r.ok);
}

// V4: percentages rejected
{
  const r = validateOne('With salicylic acid known to reduce shine by 40% this cleanser suits your oily T-zone and busy routine well.', FACT);
  check('V4 percentage claim rejected', !r.ok);
}

// V5: too short rejected
{
  const r = validateOne('Great for oily skin.', FACT);
  check('V5 lazy short text rejected', !r.ok);
}

// V6: missing budget disclosure gets appended
{
  const r = validateOne('A caffeine eye cream that works on the mild darkness under your eyes, light enough for daily morning use before sunscreen.', FACT_B);
  check('V6 budget line auto-appended',
    r.ok && /above your budget/i.test(r.text) && r.patched === 'budget line appended');
}

// V7: unsolicited budget talk rejected
{
  const r = validateOne('This affordable toner keeps shine in check through the day and fits any budget while suiting combination skin nicely.', FACT);
  check('V7 unflagged budget mention rejected', !r.ok);
}

// V8: banned regex sanity — "helps" must NOT be banned
{
  check('V8 safe verbs survive the regex',
    !BANNED.test('helps target the shine and supports your skin barrier'));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);