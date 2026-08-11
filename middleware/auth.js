const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  try {
    // Get token from header
    
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized — no token'
      });
    }
    const token = authHeader.split(' ')[1];
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach admin to request
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized — admin not found'
      });
    }
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — invalid token'
    });
  }
};
// Founder-only. Must run AFTER protect, which sets req.admin.
// These routes are the master key to every brand's data — gate every one.
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'super') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden'
    });
  }
  next();
};

module.exports = { protect, requireSuperAdmin };