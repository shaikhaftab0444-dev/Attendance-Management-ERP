const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

const isProduction = process.env.NODE_ENV === 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 10 : 50, // 10 attempts in production, 50 in development
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    const resetTime = req.rateLimit?.resetTime || new Date(Date.now() + 15 * 60 * 1000);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    
    return res.status(429).json({
      message: `Too many login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      retryAfter: retryAfterSeconds,
      resetAt: resetTime.toISOString(),
    });
  },
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.getMe);

module.exports = router;
