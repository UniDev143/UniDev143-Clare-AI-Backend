const express = require('express');
const router = express.Router();
const {
  getMyBrand,
  updateMyBrand,
  getWidgetBrand,
} = require('../controllers/brandController');
const { protect } = require('../middleware/auth');
const { requireApiKey } = require('../middleware/apiKey');

// Public scan portal — authenticated by the brand's API key, not a login.
router.get('/widget', requireApiKey, getWidgetBrand);

// Brand-admin dashboard — authenticated by JWT.
router.get('/my', protect, getMyBrand);
router.put('/my', protect, updateMyBrand);

module.exports = router;
