const notificationService = require('../services/notificationService');

/**
 * Handles GET /api/notifications
 * Retrieves notifications strictly scoped to authenticated user.
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const notifications = await notificationService.getUserNotifications(userId);

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles GET /api/notifications/unread-count
 * Returns number of unread notifications for authenticated user.
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await notificationService.getUnreadCount(userId);

    return res.status(200).json({
      success: true,
      data: result,
      count: result.count,
      unreadCount: result.unreadCount,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles PATCH /api/notifications/:id/read
 * Marks a notification as read. Fails with 404 if not found, 403 if foreign user.
 */
async function markNotificationRead(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const updated = await notificationService.markAsRead(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: updated,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles PATCH /api/notifications/:id/unread
 * Marks a notification as unread. Fails with 404 if not found, 403 if foreign user.
 */
async function markNotificationUnread(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const updated = await notificationService.markAsUnread(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as unread',
      data: updated,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles PATCH /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
async function markAllNotificationsRead(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await notificationService.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
      count: result.updatedCount,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
};
