const Scan = require("../models/Scan");
const { sendSuccess, sendError } = require("../middleware/response");
const { analyseSkinWithRetry } = require("../services/skinAnalysisService");
const { REJECTION_MESSAGES } = require("../prompts/rejectionMessages");
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const { generateRecommendations } = require('../services/recommendationService');
const { generateExplanations } = require('../services/explanationService');

// NOTE: the old POST /api/scans stub was removed. It took brandId straight
// from the request body with no authentication, so anyone could inject scan
// records into any brand's analytics. The real flow is POST /upload-image,
// where the brand comes from the API key.

// GET /api/scans/:id  — get scan results
const getScan = async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.id).populate(
      "recommendations.productId",
    );

    if (!scan) return sendError(res, "Scan not found", 404);
    sendSuccess(res, scan);
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// GET /api/scans/analytics/summary  — dashboard analytics (admin only)
const getAnalytics = async (req, res) => {
  try {
    const brandId = req.admin.brandId;

    const totalScans = await Scan.countDocuments({ brandId });

    // Most common skin conditions detected
    const conditionStats = await Scan.aggregate([
      { $match: { brandId } },
      {
        $group: {
          _id: null,
          avgAcne: { $avg: "$analysis.conditions.acne.score" },
          avgDarkSpots: { $avg: "$analysis.conditions.dark_spots.score" },
          avgDarkCircles: { $avg: "$analysis.conditions.dark_circles.score" },
          avgOiliness: { $avg: "$analysis.conditions.oiliness.score" },
          avgRedness: { $avg: "$analysis.conditions.redness.score" },
          avgWrinkles: { $avg: "$analysis.conditions.wrinkles.score" },
        },
      },
    ]);

    // Scans per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentScans = await Scan.countDocuments({
      brandId,
      createdAt: { $gte: sevenDaysAgo },
    });

    sendSuccess(res, {
      totalScans,
      recentScans,
      conditionStats: conditionStats[0] || {},
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// POST /api/scans/upload-image
// Receives base64 image, processes it, deletes immediately

// POST /api/scans/upload-image
const uploadImage = async (req, res) => {
  try {
    const { imageData, sessionId, questionnaire, qualityScore } = req.body;
    const brandId = req.brand._id;   // identity from API key
    const mimeType = 'image/jpeg'; 
    if (!imageData) {
      return sendError(res, "imageData is required");
    }

   

    // Convert and validate image
    imageBuffer = Buffer.from(imageData, "base64");

    const isJpeg = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8;
    const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
    if (!isJpeg && !isPng) {
      return sendError(res, "Invalid image format — JPEG or PNG only");
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (imageBuffer.length > maxSize) {
      return sendError(res, "Image too large — maximum 5MB");
    }

    // ── CREDIT GATE ────────────────────────────────────
    // Checked before any AI work. req.brand is a lean snapshot from the API key,
    // so schema defaults are not applied — fall back explicitly.
    const creditsPerScan = req.brand.creditsPerScan ?? 1;
    const creditsAvailable = req.brand.credits ?? 0;
    const subscriptionStatus = req.brand.subscriptionStatus ?? 'trial';

    if (subscriptionStatus === 'suspended') {
      return sendError(res, 'This account is suspended.', 403);
    }
    if (creditsAvailable < creditsPerScan) {
      return sendError(res, 'No credits remaining. Please recharge.', 402);
    }

    // ── CREATE INITIAL SCAN ────────────────────────────
    const scan = await Scan.create({
      brandId,
      sessionId: sessionId || `auto_${Date.now()}`,
      imageQualityScore: qualityScore || 0,
      questionnaire: questionnaire || {
        skinSensitivity: "not_sensitive",
        currentRoutine: "none",
        budget: "medium",
        primaryConcern: "general",
      },
      analysis: {
        skinType: "normal",
        overallSkinHealth: 0,
        aiSummary: "Analysing...",
        rejected: false,
      },
      recommendations: [],
    });

    // ── CALL AI ANALYSIS ───────────────────────────────
    console.log(`[Upload] Starting analysis for scan ${scan._id}`);

    let analysisResult;
    try {
      analysisResult = await analyseSkinWithRetry(
        imageData,
        mimeType || "image/jpeg",
        questionnaire, // ← was null
      );
    } catch (aiError) {
      // AI call failed entirely — mark scan and return error
      await Scan.findByIdAndUpdate(scan._id, {
        "analysis.aiSummary": "Analysis failed — please try again",
        "analysis.confidence": "low",
      });
      return sendError(res, `Analysis failed: ${aiError.message}`, 500);
    }

    // ── IMAGE DELETED HERE ─────────────────────────────
    imageBuffer = null;

    // ── HANDLE REJECTION ──────────────────────────────
    if (analysisResult.rejected) {
      const reason = analysisResult.rejectionReason || "poor_quality";
      const message =
        REJECTION_MESSAGES[reason] || REJECTION_MESSAGES.poor_quality;

      await Scan.findByIdAndUpdate(scan._id, {
        "analysis.rejected": true,
        "analysis.rejectionReason": reason,
        "analysis.aiSummary": message,
        "analysis.overallSkinHealth": 0,
      });

      return sendSuccess(
        res,
        {
          scanId: scan._id,
          rejected: true,
          reason,
          message,
        },
        "Image rejected",
        200,
      );
    }

// ── SAVE REAL ANALYSIS ─────────────────────────────
    const { data } = analysisResult;

    await Scan.findByIdAndUpdate(scan._id, {
      'analysis.skinType':          data.skinType,
      'analysis.conditions':        data.conditions,
      'analysis.overallSkinHealth': data.overallSkinHealth,
      'analysis.aiSummary':         data.aiSummary,
      'analysis.confidence':        data.confidence,
      'analysis.rejected':          false,
      'analysis.promptVersion':     require('../prompts/skinAnalysisPrompt').PROMPT_VERSION,
    });

    console.log(`[Upload] Analysis complete for scan ${scan._id} — health: ${data.overallSkinHealth}`);

    // ── SPEND A CREDIT ─────────────────────────────────
    // Only now — the analysis succeeded. A rejected or failed scan is free.
    // Conditional $inc so concurrent scans can never drive the balance negative.
    const charged = await Brand.findOneAndUpdate(
      {
        _id: brandId,
        credits: { $gte: creditsPerScan },
        subscriptionStatus: { $ne: 'suspended' },
      },
      { $inc: { credits: -creditsPerScan } },
      { new: true }
    ).lean();

    if (charged) {
      console.log(`[Credits] brand ${brandId} charged ${creditsPerScan} — ${charged.credits} left`);
    } else {
      // Raced to zero (or suspended) between the gate and here. The AI work is
      // already done, so serve the result rather than failing the customer.
      console.warn(`[Credits] brand ${brandId} not charged for scan ${scan._id} — balance or status changed mid-scan`);
    }

    // ── GENERATE RECOMMENDATIONS ───────────────────────
    const catalog = await Product.find({ brandId, isActive: true }).lean();

    const { recommendations, meta } = generateRecommendations(
      {
        analysis: data,
        questionnaire: questionnaire || {
          skinSensitivity: 'not_sensitive', allergies: [],
          currentRoutine: 'none', budget: 'medium', primaryConcern: 'general',
        },
      },
      catalog
    );

    // Enrich with LLM explanations (falls back to templates internally)
    const productsById = Object.fromEntries(catalog.map(p => [String(p._id), p]));
    const enriched = await generateExplanations({
      picks: recommendations, analysis: data, questionnaire:
        questionnaire || {
          skinSensitivity: 'not_sensitive', allergies: [],
          currentRoutine: 'none', budget: 'medium', primaryConcern: 'general',
        },
      productsById,
    });

    // Strip in-memory fields before persisting
    const toSave = enriched.map(({ _raw, _breakdown, ...keep }) => keep);
    await Scan.findByIdAndUpdate(scan._id, { recommendations: toSave });

    console.log(
      `[Recs] scan ${scan._id}: ${toSave.length} picks ` +
      `(${meta.eligibleCount} eligible${meta.relaxedBudget ? ', budget relaxed' : ''})`
    );

    sendSuccess(res, {
      scanId:            scan._id,
      rejected:          false,
      overallSkinHealth: data.overallSkinHealth,
      skinType:          data.skinType,
      confidence:        data.confidence,
      recommendationCount: toSave.length,
    }, 'Analysis complete', 201);
  } catch (error) {
    imageBuffer = null;
    console.error("[Upload] Unexpected error:", error.message);
    sendError(res, error.message, 500);
  }
};

// PATCH /api/scans/:id/questionnaire
const updateQuestionnaire = async (req, res) => {
  try {
    const { questionnaire } = req.body;

    if (!questionnaire) {
      return sendError(res, "Questionnaire data is required");
    }

    // Scoped to the key's own brand — one brand must never be able to
    // rewrite another's scan by guessing an id.
    const scan = await Scan.findOneAndUpdate(
      { _id: req.params.id, brandId: req.brand._id },
      { questionnaire },
      { new: true, runValidators: true },
    );

    if (!scan) return sendError(res, "Scan not found", 404);

    sendSuccess(
      res,
      {
        scanId: scan._id,
        questionnaire: scan.questionnaire,
      },
      "Questionnaire saved",
    );
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

module.exports = {
  getScan,
  getAnalytics,
  uploadImage,
  updateQuestionnaire,
};


