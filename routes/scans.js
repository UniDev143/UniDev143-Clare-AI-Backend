const express = require('express');
const router  = express.Router();
const {
  getScan, getAnalytics,
  uploadImage, updateQuestionnaire
} = require('../controllers/scanController');
const { protect } = require('../middleware/auth');
const { requireApiKey } = require('../middleware/apiKey');

// ── PUBLIC SCAN PORTAL ────────────────────────────────────
// Authenticated by the brand's API key. Brand identity comes from the key
// (req.brand), never from the request body.
router.post('/upload-image', requireApiKey, uploadImage);
router.patch('/:id/questionnaire', requireApiKey, updateQuestionnaire);

// ── BRAND ADMIN ───────────────────────────────────────────
router.get('/analytics/summary', protect, getAnalytics);

// ── CUSTOMER RESULTS ──────────────────────────────────────
// Deliberately public: the customer who just scanned has no login, and this
// is the link they land on. Protected only by the unguessable scan id.
router.get('/:id', getScan);

module.exports = router;
