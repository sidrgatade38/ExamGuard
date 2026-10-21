import api from './api';

/**
 * Notification Service (Module 12)
 * Client-side API interactions for in-app notifications & delivery schedule tracking.
 */
export const notificationService = {
  /**
   * Retrieves all notifications for the authenticated user.
   * @returns {Promise<Array<Object>>}
   */
  async getNotifications() {
    const response = await api.get('/notifications');
    return response.data?.data || [];
  },

  /**
   * Retrieves unread notification count for the authenticated user.
   * @returns {Promise<{ unreadCount: number, count: number }>}
   */
  async getUnreadCount() {
    const response = await api.get('/notifications/unread-count');
    return response.data?.data || { unreadCount: response.data?.count || 0, count: response.data?.count || 0 };
  },

  /**
   * Marks a specific notification as read.
   * @param {string} id - Notification UUID
   * @returns {Promise<Object>}
   */
  async markAsRead(id) {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data?.data;
  },

  /**
   * Marks a specific notification as unread.
   * @param {string} id - Notification UUID
   * @returns {Promise<Object>}
   */
  async markAsUnread(id) {
    const response = await api.patch(`/notifications/${id}/unread`);
    return response.data?.data;
  },

  /**
   * Marks all notifications for the authenticated user as read.
   * @returns {Promise<{ updatedCount: number, message: string }>}
   */
  async markAllAsRead() {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },
};

export default notificationService;
