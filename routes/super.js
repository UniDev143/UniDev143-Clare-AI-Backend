const express = require('express');
const router = express.Router();
const { protect, requireSuperAdmin } = require('../middleware/auth');
const {
  getBusinessOverview,
  listBrands,
  createBrand,
  updateBrandStatus,
  rechargeCredits,
  creditHistory,
} = require('../controllers/superController');

// Gate the WHOLE router, not each route. These endpoints are the master key
// to every brand's data — router-level means a new route cannot be added
// without the guard by forgetting to repeat it.
router.use(protect, requireSuperAdmin);

router.get('/overview', getBusinessOverview);
router.get('/brands', listBrands);
router.post('/brands', createBrand);
router.patch('/brands/:id/status', updateBrandStatus);
router.post('/brands/:id/credits', rechargeCredits);
router.get('/brands/:id/credits', creditHistory);

module.exports = router;
