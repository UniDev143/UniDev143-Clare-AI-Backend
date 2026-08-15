require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const rateLimit = require('express-rate-limit');
const app = express();

// ── CONNECT DATABASE ───────────────────────────────────────
connectDB();

const Brand = require('./models/Brand');

// Behind Railway/Render/Nginx the client IP arrives in X-Forwarded-For. Without
// this every request looks like it came from the proxy, so the rate limiters
// would share ONE bucket across all users — the first few visitors would use up
// everyone's allowance. Env-driven because trusting the header blindly lets a
// direct-to-origin client spoof its IP and slip the limiter.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// Origins allowed on top of each brand's own allowedOrigins. Comma-separated,
// set per environment (the two subdomains in production).
// Dev default covers both apps: 5173 is the customer scan portal, 5174 the
// staff admin app. They are separate Vite projects since the frontend split.
const STATIC_ORIGINS = (
  process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

let originCache = { list: new Set(STATIC_ORIGINS), at: 0 };

const refreshOrigins = async () => {
  if (Date.now() - originCache.at < 60_000) return;        // 1-min cache
  const brands = await Brand.find({ isActive: true }, 'allowedOrigins').lean();
  originCache = {
    list: new Set([...STATIC_ORIGINS, ...brands.flatMap(b => b.allowedOrigins || [])]),
    at: Date.now(),
  };
};

app.use(cors({
  origin: async (origin, cb) => {
    if (!origin) return cb(null, true);                    // curl/Thunder/server-to-server
    await refreshOrigins();
    cb(null, originCache.list.has(origin));
  },
}));

// ── RATE LIMITS ───────────────────────────────────────────
// Registered AFTER cors on purpose. A limiter that runs first answers 429
// without any Access-Control-Allow-Origin header, so the browser reports a
// misleading CORS failure and the user never sees "too many attempts".
// skip OPTIONS as well — a preflight is not an attempt, and counting it
// halved the real allowance.
const skipPreflight = (req) => req.method === 'OPTIONS';

const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20,
  message: { success: false, message: 'Too many scans from this device — try again later.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipPreflight,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: 'Too many attempts — try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipPreflight,
});

app.use('/api/scans/upload-image', scanLimiter);   // protects your wallet
app.use('/api/auth', authLimiter);                 // protects against brute force

app.use(express.json({ limit: '10mb' }));       // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse form dat
// ── ROUTES ────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/brands',   require('./routes/brands'));
app.use('/api/products', require('./routes/products'));
app.use('/api/scans',    require('./routes/scans'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/super',    require('./routes/super'));

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'Claré AI',
    timestamp: new Date().toISOString()
  });
});

// ── 404 HANDLER ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── GLOBAL ERROR HANDLER ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Claré AI backend running on port ${PORT}`);
});