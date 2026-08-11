# Claré AI — Deployment (Day 7)

Covers both repos. Backend goes to a Node host (Railway or Render); the
frontend is a static Vite build served from a CDN host.

**Nothing here has been run against a live environment.** Everything below is
prepared and verified locally — the production build succeeds, CORS and rate
limiting are environment-driven, and secrets are generated rather than reused.
The steps that need your accounts, your domain and your DNS are marked
**[you]**.

---

## Before you start — decisions only you can make

1. **Host for the backend** — Railway and Render both work. Railway is quicker
   to set up; Render's free tier sleeps after inactivity, which means a cold
   first scan of ~30s.
2. **Host for the frontend** — Vercel, Netlify or Render Static. Config files
   for Vercel (`vercel.json`) and Netlify/Render (`public/_redirects`) are
   already committed.
3. **Your domain.** Two subdomains (see the next section for why not three):
   - `admin.yourdomain.com` — all staff: brand admins and super-admin
   - `scan.yourdomain.com` — customers

---

## Two frontends, not three

The plan originally called for three subdomains mirroring the three roles.
The code is now split into **two** apps instead, because the boundary that
matters is staff vs anonymous customer — brand admins and super admins share
a login, an auth mechanism and staff-grade trust, so separating those two
buys little.

| Repo | Deploys to | Serves |
|---|---|---|
| `Clare-AI-Admin` | `admin.yourdomain.com` | Brand dashboard (`/admin/*`) and super-admin (`/super/*`) |
| `Clare-AI-Frontend` | `scan.yourdomain.com` | Customer scan portal, and later the embed |

These are genuinely separate builds, so no admin code reaches a customer's
browser and the super-admin surface is not readable in the bundle a stranger
downloads. That is real separation, not a redirect.

Access control is unchanged and still entirely server-side: `requireSuperAdmin`
refuses every `/api/super/*` route regardless of which origin asked.

If you later want the super-admin portal isolated further, `admin.*` can go
behind Cloudflare Access or the host's password protection without touching
the customer portal.

---

## 1. Backend — [you] create the service

**Railway**
1. New Project → Deploy from GitHub → `UniDev143/Clare-AI-Backend`
2. Root directory: `/` · Start command: `node server.js`
3. Add the variables below, then deploy.

**Render**
1. New → Web Service → same repo
2. Build: `npm install` · Start: `node server.js`

### Environment variables

Generate fresh secrets first:

```
node test/generateSecrets.js
```

| Variable | Value |
|---|---|
| `MONGO_URI` | **A separate production Atlas database.** Not the dev one. |
| `JWT_SECRET` | Freshly generated. Never the dev value. |
| `SETUP_SECRET` | Freshly generated. |
| `ANTHROPIC_API_KEY` | Ideally a separate key so production spend is measured on its own. |
| `PORT` | Usually injected by the host — leave unset unless it complains. |
| `CORS_ORIGINS` | Comma-separated production origins, e.g. `https://admin.yourdomain.com,https://scan.yourdomain.com` |
| `TRUST_PROXY` | `1` |

`TRUST_PROXY=1` matters more than it looks. Railway and Render put one proxy
in front of your app, so without it every request appears to come from the
proxy's IP and **all users share a single rate-limit bucket** — the first few
visitors would exhaust everyone's allowance. It is env-driven rather than
always-on because trusting a forwarded IP with no proxy in front lets a client
spoof it and slip the limiter entirely.

**Atlas** — [you] add the host's egress IPs to the Network Access allowlist, or
allow `0.0.0.0/0` if the host has no static IPs (common on Railway).

Verify: `curl https://your-backend/api/health` → `{"status":"ok",...}`

---

## 2. Frontends — [you] create two sites

Both repos use the same build settings: build `npm run build`, publish
directory `dist`. Each is a separate deploy.

**Scan portal** (`Clare-AI-Frontend` → `scan.yourdomain.com`)

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend-host/api` — **including `/api`** |
| `VITE_CLARE_API_KEY` | Leave **unset**. The key-entry screen supplies it, and a pasted key takes precedence anyway. |

**Admin app** (`Clare-AI-Admin` → `admin.yourdomain.com`)

| Variable | Value |
|---|---|
| `VITE_API_URL` | Same backend URL, including `/api` |

Both must be listed in the backend's `CORS_ORIGINS`.

`VITE_*` variables are inlined at build time and visible to anyone who views
the site, so never put a real secret in one. Changing them requires a rebuild,
not just a restart.

If `VITE_API_URL` is unset, the build silently falls back to
`http://localhost:5000/api` and the deployed site will try to call the
visitor's own machine. Set it.

---

## 3. Production data — [you]

```
# Against the PRODUCTION MONGO_URI, not your local .env
node test/makeSuperAdmin.js you@yourdomain.com "a-strong-password" "Your Name"
```

Then from `/super/brands`, create your real brands. Each gets its own API key
and opening credit balance.

**Do not copy the dev database into production.** It holds test brands, test
scans and the accounts whose passwords were shared in chat.

---

## 4. Per-brand CORS

Each brand embedding Claré on its own site needs its origin in that brand's
`allowedOrigins` array — `CORS_ORIGINS` covers only your own portals. Origins
are cached for 60 seconds, so a new one takes up to a minute to take effect.

---

## 5. Live smoke test — the money loop

Run this once against production:

1. Super-admin logs in at your admin URL.
2. Register a real brand → copy its API key and login.
3. Add credits → balance updates immediately.
4. That brand logs into the dashboard → sees the same balance.
5. Open the scan portal, enter the brand key → branded landing page.
6. Complete a real scan → results appear, balance drops by exactly 1.
7. Spend to zero → the customer sees "temporarily unavailable", **not** a
   recharge prompt.
8. Recharge → scanning resumes.
9. Suspend the brand → scans refused. Reactivate.

Then confirm the isolation property that matters most: a **second** brand's key
spends the second brand's credits and leaves the first untouched.

---

## Deploy checklist

- [ ] Fresh `JWT_SECRET` and `SETUP_SECRET` — not the dev values
- [ ] Separate production Atlas database
- [ ] Atlas network access allows the backend host
- [ ] `TRUST_PROXY=1`
- [ ] `CORS_ORIGINS` lists every production origin
- [ ] `VITE_API_URL` set at build time for **both** frontend deploys
- [ ] `/api/health` responds
- [ ] Deep links work (`/admin/dashboard` refreshed directly, not just navigated to)
- [ ] Real super-admin created on production
- [ ] Test accounts (`super@test.com`, `admin@test.com`) do **not** exist in production
- [ ] Money loop passes live
- [ ] Two-brand isolation passes live

---

## Known gaps, deliberately not fixed

- **Deleting a brand orphans its scans.** They keep counting toward global
  totals with no way to attribute them. Consider soft-delete
  (`isActive: false`) before any brand is ever removed.
- **Scan results are readable by anyone with the scan id.** `GET /api/scans/:id`
  is unauthenticated by design — the customer who just scanned has no login.
  Ids are Mongo ObjectIds, not secrets. Acceptable for cosmetic analysis;
  revisit if the payload ever carries anything more sensitive.
- **Scan portal bundle is 462 KB** (146 KB gzipped) in one chunk; the admin app
  is 318 KB (100 KB). Splitting the apps apart only took ~40 KB off the
  customer bundle — MediaPipe dominates it, not app code. Lazy-loading the
  face-detection model is where the remaining win is, not further route
  splitting.
