const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

const router = express.Router();

// Enforce authentication on all notification endpoints
router.use(authenticateToken);

// GET /api/notifications - List authenticated user's notifications
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get count of unread notifications
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/read-all - Mark all user's notifications as read
router.patch('/read-all', markAllNotificationsRead);

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', markNotificationRead);

// PATCH /api/notifications/:id/unread - Mark single notification as unread
router.patch('/:id/unread', markNotificationUnread);

module.exports = router;
