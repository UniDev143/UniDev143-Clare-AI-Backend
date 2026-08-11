const { body, validationResult } = require('express-validator');
const { ALLERGENS, SKIN_ISSUES } = require('../config/vocabulary');

const handle = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  next();
};

const validateScanUpload = [
  body('imageData').isString().notEmpty().withMessage('Image is required')
    .isLength({ max: 15_000_000 }).withMessage('Image too large'),
  body('sessionId').isString().trim().isLength({ min: 8, max: 64 }),
  body('qualityScore').optional().isInt({ min: 0, max: 100 }),
  body('questionnaire.skinSensitivity').optional()
    .isIn(['not_sensitive', 'slightly_sensitive', 'very_sensitive']),
  body('questionnaire.allergies').optional().isArray({ max: ALLERGENS.length }),
  body('questionnaire.allergies.*').optional().isIn(ALLERGENS),
  body('questionnaire.currentRoutine').optional()
    .isIn(['none', 'basic', 'moderate', 'extensive']),
  body('questionnaire.budget').optional().isIn(['low', 'medium', 'high']),
  body('questionnaire.primaryConcern').optional()
    .isIn([...SKIN_ISSUES, 'general']),
  handle,
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 128 }),
  handle,
];

module.exports = { validateScanUpload, validateLogin };