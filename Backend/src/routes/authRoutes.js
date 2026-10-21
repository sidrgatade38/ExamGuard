const express = require('express');
const { login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { defaultLoginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/login (Rate-limited against brute force abuse)
router.post('/login', defaultLoginLimiter, login);

// GET /api/auth/me (Protected by authenticateToken middleware)
router.get('/me', authenticateToken, getMe);

module.exports = router;
