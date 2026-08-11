const mongoose = require('mongoose');
const Scan = require('../models/Scan');
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const { sendSuccess, sendError } = require('../middleware/response');

// GET /api/analytics/overview
const getOverview = async (req, res) => {
  try {
    // A super-admin has no brand — this endpoint is brand-scoped only.
    if (!req.admin.brandId) {
      return sendError(res, 'This account is not linked to a brand', 400);
    }
    const brandId = new mongoose.Types.ObjectId(String(req.admin.brandId));
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // ── totals ─────────────────────────────────────────
    const [totals] = await Scan.aggregate([
      { $match: { brandId } },
      { $group: {
          _id: null,
          total:    { $sum: 1 },
          rejected: { $sum: { $cond: ['$analysis.rejected', 1, 0] } },
          avgHealth: { $avg: {
            $cond: ['$analysis.rejected', null, '$analysis.overallSkinHealth'],
          } },
      } },
    ]);

    // ── skin type distribution (completed only) ────────
    const skinTypes = await Scan.aggregate([
      { $match: { brandId, 'analysis.rejected': false } },
      { $group: { _id: '$analysis.skinType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // ── per-condition detection + averages ─────────────
    const conditions = await Scan.aggregate([
      { $match: { brandId, 'analysis.rejected': false } },
      { $project: { conds: { $objectToArray: '$analysis.conditions' } } },
      { $unwind: '$conds' },
      { $group: {
          _id: '$conds.k',
          detected: { $sum: { $cond: ['$conds.v.detected', 1, 0] } },
          avgScore: { $avg: '$conds.v.score' },
          total:    { $sum: 1 },
      } },
      { $sort: { detected: -1, avgScore: -1 } },
    ]);

    // ── most recommended products ──────────────────────
// ── most recommended products ──────────────────────
    const topRaw = await Scan.aggregate([
      { $match: { brandId, 'recommendations.0': { $exists: true } } },
      { $unwind: '$recommendations' },
      { $group: {
          _id: '$recommendations.productId',
          count: { $sum: 1 },
          topPicks: { $sum: { $cond: [{ $eq: ['$recommendations.rank', 1] }, 1, 0] } },
      } },
      { $sort: { count: -1, topPicks: -1 } },
      { $limit: 12 },                             // over-fetch; some may be orphans
    ]);
    const prodDocs = await Product.find(
      { _id: { $in: topRaw.map(t => t._id) } }, 'name category'
    ).lean();
    const nameById = Object.fromEntries(prodDocs.map(p => [String(p._id), p]));
    const topProducts = topRaw
      .filter(t => nameById[String(t._id)])       // drop orphaned references
      .slice(0, 5)
      .map(t => ({
        name: nameById[String(t._id)].name,
        category: nameById[String(t._id)].category,
        count: t.count,
        topPicks: t.topPicks,
      }));

    // ── last 14 days ───────────────────────────────────
    const daily = await Scan.aggregate([
      { $match: { brandId, createdAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]);

    // ── credit balance ─────────────────────────────────
    // Scoped to the admin's own brand — an admin can only ever read their own.
    const brand = await Brand.findById(brandId)
      .select('credits subscriptionStatus creditsPerScan')
      .lean();

    sendSuccess(res, {
      totals: {
        total: totals?.total || 0,
        completed: (totals?.total || 0) - (totals?.rejected || 0),
        rejected: totals?.rejected || 0,
        avgHealth: totals?.avgHealth ? Math.round(totals.avgHealth) : null,
      },
      billing: {
        credits: brand?.credits ?? 0,
        subscriptionStatus: brand?.subscriptionStatus ?? 'trial',
        creditsPerScan: brand?.creditsPerScan ?? 1,
      },
      skinTypes, conditions, topProducts, daily,
    });
  } catch (err) {
    console.error('[Analytics]', err.message);
    sendError(res, 'Could not load analytics', 500);
  }
};

module.exports = { getOverview };