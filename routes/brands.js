const express = require('express');
const router = express.Router();
const {
  getMyBrand,
  updateMyBrand,
  getWidgetBrand,
  getMyApiKey,
} = require('../controllers/brandController');
const { protect } = require('../middleware/auth');
const { requireApiKey } = require('../middleware/apiKey');

// Public scan portal — authenticated by the brand's API key, not a login.
router.get('/widget', requireApiKey, getWidgetBrand);

// Brand-admin dashboard — authenticated by JWT.
// `/my/api-key` is registered before `/my` for readability; Express matches
// them as distinct paths either way.
router.get('/my/api-key', protect, getMyApiKey);
router.get('/my', protect, getMyBrand);
router.put('/my', protect, updateMyBrand);

module.exports = router;
