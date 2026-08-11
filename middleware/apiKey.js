const Brand = require('../models/Brand');
const { sendError } = require('../middleware/response');

const requireApiKey = async (req, res, next) => {
  try {
    const key = req.header('X-Api-Key');
    if (!key) return sendError(res, 'Missing API key', 401);
    const brand = await Brand.findOne({ apiKey: key, isActive: true }).lean();
    if (!brand) return sendError(res, 'Invalid API key', 401);
    req.brand = brand;                       // trusted identity for downstream
    next();
  } catch (err) {
    sendError(res, 'Auth failed', 500);
  }
};

module.exports = { requireApiKey };