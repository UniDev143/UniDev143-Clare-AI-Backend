const Brand = require('../models/Brand');
const { sendSuccess, sendError } = require('../middleware/response');

// GET /api/brands/my  — get current brand's info
const getMyBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.admin.brandId);
    if (!brand) return sendError(res, 'Brand not found', 404);
    sendSuccess(res, brand);
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// GET /api/brands/widget — public, authenticated by X-Api-Key only.
// Used by the scan portal to validate a key and brand the experience.
// Deliberately narrow: the customer's browser learns the brand's name and
// styling and NOTHING about its commercial standing. `available` says whether
// a scan can run; it never says why not, because the balance and the
// subscription state are the brand's business, not their customers'.
const getWidgetBrand = async (req, res) => {
  try {
    const brand = req.brand;   // set by requireApiKey
    const credits = brand.credits ?? 0;
    const creditsPerScan = brand.creditsPerScan ?? 1;
    const status = brand.subscriptionStatus ?? 'trial';

    sendSuccess(res, {
      name:         brand.name,
      logo:         brand.logo,
      website:      brand.website,
      widgetConfig: brand.widgetConfig,
      available:    status !== 'suspended' && credits >= creditsPerScan,
    });
  } catch (error) {
    sendError(res, 'Could not load brand', 500);
  }
};

// PUT /api/brands/my  — update brand info & widget config
const updateMyBrand = async (req, res) => {
  try {
    const { name, website, logo, widgetConfig } = req.body;

    const brand = await Brand.findByIdAndUpdate(
      req.admin.brandId,
      { name, website, logo, widgetConfig },
      { new: true, runValidators: true }
    );

    sendSuccess(res, brand, 'Brand updated');
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

module.exports = { getMyBrand, updateMyBrand, getWidgetBrand };