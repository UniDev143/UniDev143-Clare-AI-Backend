# Claré AI — TODO

Last reviewed: 2026-08-12, after the 7-day subscription build.

## Before going live

- [ ] Replace the test accounts. `super@test.com` and `admin@test.com` have
      passwords that were shared in chat. Use `test/makeSuperAdmin.js` and
      `test/resetPassword.js` against the production database.
- [ ] Fresh `JWT_SECRET` and `SETUP_SECRET` (`node test/generateSecrets.js`).
- [ ] A separate production Atlas database. Do NOT copy the dev one over — it
      holds test brands, test scans and those accounts.
- [ ] `TRUST_PROXY=1` on the host, or all users share one rate-limit bucket.
- [ ] Add the login background video at `Admin/public/login-background.mp4`
      (muted H.264, audio stripped, ideally under ~8 MB — it downloads before
      anyone can sign in). Without it the login page falls back to an animated
      purple gradient, which looks intentional, so this is polish rather than a
      blocker.
- [ ] Full checklist lives in `DEPLOYMENT.md`.

## Product decisions pending

- [ ] **Deleting a brand orphans its scans.** They keep counting toward global
      totals with no way to attribute them. Soft-delete (`isActive: false`) is
      the likely answer — decide before any real brand is ever removed.
- [ ] Multiple admins per brand? `Admin.brandId` is currently unique, so this
      is a schema change.
- [ ] Self-service password reset. There is no endpoint — resets are the
      `test/resetPassword.js` script, so the login page deliberately shows no
      "forgot password?" link. Fine while every account is hand-created; needs
      an email-token flow before brands onboard themselves.
- [ ] Min-resolution check on the file-upload fallback.
- [ ] Automated payments. Recharge is manual from the super-admin portal,
      which is fine until it isn't.

## Known limitations (be honest if brands ask)

- [ ] Screen-spoof detection is basic — v1.1 catches obvious moiré/bezels
      only, no real liveness detection.
- [ ] Tiny/compressed uploads are analysed at medium confidence rather than
      rejected.
- [ ] `GET /api/scans/:id` is unauthenticated by design — the customer who
      just scanned has no login. Protected only by the unguessable ObjectId.
      Fine for cosmetic analysis; revisit if the payload ever carries more.

## Testing debt

- [ ] Deep skin tone retest with a FULL RESOLUTION photo (thumbnail passed,
      not rigorous).
- [ ] `me_warmbulb` rerun on prompt v1.1 (expected fixed, unverified).
- [ ] The Day 6 money-loop harness simulates credit consumption rather than
      running three real AI scans, because the harness has no face photo. The
      deduction path itself is verified — seven real scans through the UI.

## Performance

- [ ] Scan portal bundle is 462 KB (146 KB gzipped), dominated by MediaPipe.
      Lazy-loading the face-detection model is the remaining win; splitting
      the admin app out only took ~40 KB off.

## Post-MVP (v2)

- [ ] Embeddable widget — the real customer surface. Brands embed Claré on
      their own site; the standalone scan portal is a demo and a fallback.
- [ ] Deeper AI: more conditions (pores, texture, blackheads, dullness,
      under-eye puffiness), likely causes per condition, stronger vision model.
      Keep separate from business work. Cost per scan: ~$0.022 on Sonnet,
      ~$0.10–0.15 on Opus — `creditsPerScan` already supports a premium tier.
- [ ] Makeup shade matching.
- [ ] Real liveness / anti-spoofing.
- [ ] Multi-language (Urdu).

## Vocabulary contract (breaking-change checklist)

- [ ] Any change to allergens/issues/budget MUST update together:
      `Backend/config/vocabulary.js`, `Frontend/src/config/questions.ts`,
      `Frontend/src/types/index.ts`, `Admin/src/types/index.ts`, and the
      analysis prompt. **There are now two frontend type files, not one.**

## Done (kept so it is not re-litigated)

- [x] Per-brand API key on the public scan endpoint
- [x] Register route gated by a setup secret
- [x] Dynamic CORS from each brand's `allowedOrigins` plus `CORS_ORIGINS`
- [x] Rate limiting on login and scan, registered after `cors()` so a 429 does
      not surface as a misleading CORS error
- [x] express-validator on POST/PUT routes
- [x] Credit system, ledger, super-admin portal, scan-portal key entry
- [x] Consent screen moved before the questionnaire
