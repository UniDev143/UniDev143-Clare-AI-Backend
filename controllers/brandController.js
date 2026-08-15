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

// GET /api/brands/my/api-key — the brand's own scan key, for its dashboard.
//
// Deliberately its own endpoint rather than leaning on /brands/my returning the
// whole document: the key is the one credential a brand may need to read back
// after onboarding, so it is served explicitly and scoped to the caller's own
// brandId. A super-admin belongs to no brand and has nothing to return here.
const getMyApiKey = async (req, res) => {
  try {
    if (!req.admin.brandId) {
      return sendError(res, 'This account is not attached to a brand', 400);
    }

    const brand = await Brand.findById(req.admin.brandId).select('apiKey name');
    if (!brand) return sendError(res, 'Brand not found', 404);

    sendSuccess(res, { apiKey: brand.apiKey, brandName: brand.name });
  } catch (error) {
    sendError(res, 'Could not load your API key', 500);
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

    // The colour is injected into a CSS custom property in every customer's
    // browser, so it is validated here rather than trusted from the form.
    // Anything but a plain 6-digit hex is refused outright.
    if (widgetConfig?.primaryColor &&
        !/^#[0-9a-f]{6}$/i.test(widgetConfig.primaryColor)) {
      return sendError(res, 'Brand colour must be a hex value like #6B21A8', 400);
    }

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

module.exports = { getMyBrand, updateMyBrand, getWidgetBrand, getMyApiKey };