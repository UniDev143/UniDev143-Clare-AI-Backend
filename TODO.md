# Claré AI — TODO

## Security debt (must fix Day 22, before any brand demo)
- [ ] Per-brand public API key for /api/scans/upload-image (currently anyone can POST)
- [ ] Remove or gate /api/auth/register (currently public)
- [ ] Dynamic CORS from Brand document (currently hardcoded localhost)
- [ ] Generic error messages in production (currently leaks internals)
- [ ] Rate limiting on /api/auth/login and /api/scans/upload-image
- [ ] express-validator on all POST/PUT routes
- [ ] Change JWT_SECRET before deploy

## Testing debt (before any brand demo)
- [ ] Deep skin tone retest with FULL RESOLUTION photo (thumbnail passed, not rigorous)
- [ ] me_warmbulb rerun on prompt v1.1 (expected fixed, unverified)

## Known limitations (be honest if brands ask)
- [ ] Screen-spoof detection is basic — v1.1 catches obvious moiré/bezels only, no real liveness detection
- [ ] Tiny/compressed uploads analyzed at medium confidence instead of rejected

## Product decisions pending
- [ ] Consent screen position: currently AFTER questionnaire — move before it? (Day 13)
- [ ] Multiple admins per brand? (schema change if yes)
- [ ] Min-resolution check on file upload fallback (Day 13)

## Post-MVP (v2)
- [ ] Makeup shade matching
- [ ] Real liveness/anti-spoofing
- [ ] Multi-language (Urdu)

## Vocabulary contract (breaking-change checklist)
- [ ] Any change to allergens/issues/budget MUST update: vocabulary.js,
      questions.ts, types/index.ts, and the analysis prompt together
      