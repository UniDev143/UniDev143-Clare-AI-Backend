const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

const requireSetupSecret = (req, res, next) => {
  if (req.header('X-Setup-Secret') !== process.env.SETUP_SECRET) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  next();
};

router.post('/register', requireSetupSecret, register);   // ← replaces old register line
router.post('/login', login);

module.exports = router;