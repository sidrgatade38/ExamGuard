const express = require('express');
const { login, getMe, getProfile, updateProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { defaultLoginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/login (Rate-limited against brute force abuse)
router.post('/login', defaultLoginLimiter, login);

// GET /api/auth/me (Protected by authenticateToken middleware)
router.get('/me', authenticateToken, getMe);

// GET /api/auth/profile - Fetch independent teacher profile
router.get('/profile', authenticateToken, getProfile);

// PUT /api/auth/profile - Update independent teacher profile
router.put('/profile', authenticateToken, updateProfile);

module.exports = router;
