const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Brand = require('../models/Brand');
const { sendSuccess, sendError } = require('../middleware/response');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required');
    }

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Get brand info — a super-admin belongs to no brand
    const brand = admin.brandId ? await Brand.findById(admin.brandId) : null;

    sendSuccess(res, {
      token: generateToken(admin._id),
      admin: admin.toJSON(),
      brand
    }, 'Login successful');

  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const brand = req.admin.brandId
      ? await Brand.findById(req.admin.brandId)
      : null;
    sendSuccess(res, { admin: req.admin, brand });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// POST /api/auth/register (for seeding/testing only — remove in production)
const register = async (req, res) => {
  let createdBrand = null;

  try {
    const { brandName, brandEmail, adminName, adminEmail, password } = req.body;

    if (!brandName || !brandEmail || !adminName || !adminEmail || !password) {
      return sendError(res, 'All fields are required');
    }

    // Create brand first
    createdBrand = await Brand.create({
      name: brandName,
      email: brandEmail
    });

    // Create admin linked to brand
    const admin = await Admin.create({
      brandId: createdBrand._id,
      name: adminName,
      email: adminEmail,
      password
    });

    sendSuccess(res, {
      token: generateToken(admin._id),
      admin: admin.toJSON(),
      brand: createdBrand
    }, 'Registration successful', 201);

  } catch (error) {
    // Rollback — don't leave an orphaned brand behind
    if (createdBrand) {
      await Brand.findByIdAndDelete(createdBrand._id).catch(() => {});
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return sendError(res, `This ${field} is already registered`);
    }
    sendError(res, error.message, 500);
  }
};

module.exports = { login, getMe, register };