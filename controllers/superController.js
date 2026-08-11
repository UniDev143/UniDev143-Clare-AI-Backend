const mongoose = require('mongoose');
const Brand = require('../models/Brand');
const Admin = require('../models/Admin');
const Scan = require('../models/Scan');
const CreditLog = require('../models/CreditLog');
const { sendSuccess, sendError } = require('../middleware/response');

const STATUSES = ['active', 'suspended', 'trial'];
const LOW_CREDIT_THRESHOLD = 10;

// GET /api/super/overview — the whole business at a glance
const getBusinessOverview = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [brandStats] = await Brand.aggregate([
      { $group: {
          _id: null,
          totalBrands:      { $sum: 1 },
          active:           { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'active'] }, 1, 0] } },
          suspended:        { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'suspended'] }, 1, 0] } },
          trial:            { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'trial'] }, 1, 0] } },
          // $ifNull — brands created before the credit fields have neither.
          creditsOutstanding: { $sum: { $ifNull: ['$credits', 0] } },
          creditsEverGranted: { $sum: { $ifNull: ['$totalCreditsEver', 0] } },
      } },
    ]);

    const [scanStats] = await Scan.aggregate([
      { $group: {
          _id: null,
          totalScans: { $sum: 1 },
          rejected:   { $sum: { $cond: ['$analysis.rejected', 1, 0] } },
      } },
    ]);

    const recentScans = await Scan.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Who is about to run dry — the list worth acting on before they call.
    const lowCredit = await Brand.find({
      subscriptionStatus: { $ne: 'suspended' },
      $or: [
        { credits: { $lt: LOW_CREDIT_THRESHOLD } },
        { credits: { $exists: false } },
      ],
    }, 'name email credits subscriptionStatus creditsPerScan')
      .sort({ credits: 1 })
      .limit(20)
      .lean();

    const recentTopUps = await CreditLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('brandId', 'name')
      .populate('addedBy', 'email')
      .lean();

    const creditsOutstanding = brandStats?.creditsOutstanding || 0;
    const creditsEverGranted = brandStats?.creditsEverGranted || 0;

    sendSuccess(res, {
      brands: {
        total:     brandStats?.totalBrands || 0,
        active:    brandStats?.active || 0,
        suspended: brandStats?.suspended || 0,
        trial:     brandStats?.trial || 0,
      },
      scans: {
        total:    scanStats?.totalScans || 0,
        rejected: scanStats?.rejected || 0,
        last7Days: recentScans,
      },
      credits: {
        outstanding:  creditsOutstanding,
        everGranted:  creditsEverGranted,
        consumed:     Math.max(0, creditsEverGranted - creditsOutstanding),
        lowThreshold: LOW_CREDIT_THRESHOLD,
      },
      lowCredit: lowCredit.map(b => ({
        _id:                b._id,
        name:               b.name,
        email:              b.email,
        credits:            b.credits ?? 0,
        subscriptionStatus: b.subscriptionStatus ?? 'trial',
        creditsPerScan:     b.creditsPerScan ?? 1,
      })),
      recentTopUps: recentTopUps.map(l => ({
        _id:       l._id,
        brandName: l.brandId?.name || 'deleted brand',
        amount:    l.amount,
        note:      l.note,
        addedBy:   l.addedBy?.email || null,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('[Super] getBusinessOverview:', err.message);
    sendError(res, 'Could not load overview', 500);
  }
};

// GET /api/super/brands — every brand, with credits, status and scan count
const listBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 }).lean();

    // One aggregate for all brands rather than a count query per brand.
    const counts = await Scan.aggregate([
      { $group: { _id: '$brandId', total: { $sum: 1 } } },
    ]);
    const countByBrand = Object.fromEntries(
      counts.map(c => [String(c._id), c.total])
    );

    // Admin.email is the login credential — surface it so the founder can
    // tell brands which account to use.
    // $ne:'super' rather than role:'brand' — admins created before the role
    // field exists have no role stored, so an equality match would miss them.
    const admins = await Admin.find(
      { role: { $ne: 'super' } }, 'brandId email lastLogin'
    ).lean();
    const adminByBrand = Object.fromEntries(
      admins.map(a => [String(a.brandId), a])
    );

    sendSuccess(res, brands.map(b => ({
      _id:                b._id,
      name:               b.name,
      email:              b.email,
      apiKey:             b.apiKey,
      credits:            b.credits ?? 0,
      totalCreditsEver:   b.totalCreditsEver ?? 0,
      subscriptionStatus: b.subscriptionStatus ?? 'trial',
      creditsPerScan:     b.creditsPerScan ?? 1,
      isActive:           b.isActive,
      totalScans:         countByBrand[String(b._id)] || 0,
      adminEmail:         adminByBrand[String(b._id)]?.email || null,
      lastLogin:          adminByBrand[String(b._id)]?.lastLogin || null,
      createdAt:          b.createdAt,
    })));
  } catch (err) {
    console.error('[Super] listBrands:', err.message);
    sendError(res, 'Could not load brands', 500);
  }
};

// POST /api/super/brands — register a brand plus its admin login
const createBrand = async (req, res) => {
  let createdBrand = null;

  try {
    const { brandName, brandEmail, adminName, adminEmail, password, credits } = req.body;

    if (!brandName || !brandEmail || !adminName || !adminEmail || !password) {
      return sendError(res, 'All fields are required');
    }
    if (String(password).length < 8) {
      return sendError(res, 'Password must be at least 8 characters');
    }

    // A brand with no credits cannot scan at all, so allow an opening balance.
    const openingCredits = Number.isFinite(Number(credits))
      ? Math.max(0, Math.floor(Number(credits)))
      : 0;

    createdBrand = await Brand.create({
      name:             brandName,
      email:            brandEmail,
      credits:          openingCredits,
      totalCreditsEver: openingCredits,
    });

    const admin = await Admin.create({
      brandId:  createdBrand._id,
      name:     adminName,
      email:    adminEmail,
      password,
      role:     'brand',
    });

    // The password is never echoed back — the founder typed it and it is
    // hashed by the pre-save hook. Only the key and login email go out.
    sendSuccess(res, {
      brand: {
        _id:                createdBrand._id,
        name:               createdBrand.name,
        email:              createdBrand.email,
        apiKey:             createdBrand.apiKey,
        credits:            createdBrand.credits,
        subscriptionStatus: createdBrand.subscriptionStatus,
      },
      adminEmail: admin.email,
    }, 'Brand created', 201);

  } catch (err) {
    // Rollback — never leave an orphaned brand behind
    if (createdBrand) {
      await Brand.findByIdAndDelete(createdBrand._id).catch(() => {});
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return sendError(res, `This ${field} is already registered`);
    }
    console.error('[Super] createBrand:', err.message);
    sendError(res, err.message, 500);
  }
};

// PATCH /api/super/brands/:id/status — activate / suspend / trial
const updateBrandStatus = async (req, res) => {
  try {
    const { subscriptionStatus } = req.body;

    if (!STATUSES.includes(subscriptionStatus)) {
      return sendError(res, `Status must be one of: ${STATUSES.join(', ')}`);
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 'Invalid brand id');
    }

    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { subscriptionStatus },
      { new: true, runValidators: true }
    ).select('name subscriptionStatus credits').lean();

    if (!brand) return sendError(res, 'Brand not found', 404);

    sendSuccess(res, brand, `${brand.name} is now ${subscriptionStatus}`);
  } catch (err) {
    console.error('[Super] updateBrandStatus:', err.message);
    sendError(res, 'Could not update status', 500);
  }
};

// POST /api/super/brands/:id/credits — recharge a brand
const rechargeCredits = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const add = Number(amount);

    if (!Number.isInteger(add) || add < 1) {
      return sendError(res, 'Amount must be a whole number of at least 1');
    }
    if (add > 100000) {
      return sendError(res, 'Amount looks wrong — 100000 credits is the ceiling');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 'Invalid brand id');
    }

    // $inc rather than read-modify-write so a scan landing at the same moment
    // cannot be lost.
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { $inc: { credits: add, totalCreditsEver: add } },
      { new: true }
    ).select('name credits totalCreditsEver subscriptionStatus').lean();

    if (!brand) return sendError(res, 'Brand not found', 404);

    await CreditLog.create({
      brandId:      req.params.id,
      amount:       add,
      balanceAfter: brand.credits,
      note:         note || null,
      addedBy:      req.admin._id,
    });

    console.log(`[Credits] ${brand.name} +${add} → ${brand.credits} (by ${req.admin.email})`);
    sendSuccess(res, brand, `Added ${add} credits to ${brand.name}`);
  } catch (err) {
    console.error('[Super] rechargeCredits:', err.message);
    sendError(res, 'Could not add credits', 500);
  }
};

// GET /api/super/brands/:id/credits — top-up history for one brand
const creditHistory = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendError(res, 'Invalid brand id');
    }
    const logs = await CreditLog.find({ brandId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('addedBy', 'email')
      .lean();

    sendSuccess(res, logs.map(l => ({
      _id:          l._id,
      amount:       l.amount,
      balanceAfter: l.balanceAfter,
      note:         l.note,
      addedBy:      l.addedBy?.email || null,
      createdAt:    l.createdAt,
    })));
  } catch (err) {
    console.error('[Super] creditHistory:', err.message);
    sendError(res, 'Could not load credit history', 500);
  }
};

module.exports = {
  getBusinessOverview,
  listBrands,
  createBrand,
  updateBrandStatus,
  rechargeCredits,
  creditHistory,
};
