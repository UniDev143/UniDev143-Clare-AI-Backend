// Usage: node test/generateSecrets.js
// Prints fresh cryptographically-random secrets for a production deploy.
// Paste them into the host's environment dashboard — do not write them to a
// file in the repo.
const crypto = require('crypto');

const secret = () => crypto.randomBytes(48).toString('base64url');

console.log(`
Production secrets — copy into your host's environment settings.
Generate a NEW set for each environment; never reuse the dev values.

JWT_SECRET=${secret()}
SETUP_SECRET=${secret()}

Reminders:
  - Rotating JWT_SECRET logs every admin out. That is intended when moving
    to production: tokens minted in dev must not work against live data.
  - SETUP_SECRET gates POST /api/auth/register. Brands are created from the
    super-admin portal, so this is a break-glass credential — store it
    somewhere you can find it and nowhere the app can read it.
  - MONGO_URI and ANTHROPIC_API_KEY are not generated here; use a separate
    production Atlas database, and consider a separate Anthropic key so
    production spend is measured on its own.
`);
