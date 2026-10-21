/**
 * ExamGuard - Admin Management Frontend Service (Module 14)
 *
 * Provides API client functions for administrative user management:
 * - Listing and filtering registered users
 * - Fetching user profiles
 * - Creating new users
 * - Activating / deactivating accounts
 * - Updating user roles
 * - Resetting user passwords
 * - Fetching supported system roles
 */

import api from './api';

const adminService = {
  /**
   * Retrieves paginated users list with optional search and filters.
   *
   * @param {Object} params - Query parameters: { search, role, status, page, limit, sortBy, sortOrder }
   * @returns {Promise<{ users: Array, pagination: Object }>}
   */
  async getUsers(params = {}) {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  /**
   * Retrieves single user details by ID.
   *
   * @param {string} id - User UUID
   * @returns {Promise<Object>}
   */
  async getUserById(id) {
    const response = await api.get(`/admin/users/${id}`);
    return response.data.user;
  },

  /**
   * Creates a new user with specified role and credentials.
   *
   * @param {Object} userData - { name, email, password, role }
   * @returns {Promise<{ message: string, user: Object }>}
   */
  async createUser(userData) {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },

  /**
   * Updates user account active status.
   *
   * @param {string} id - User UUID
   * @param {boolean} isActive - New status
   * @returns {Promise<{ message: string, user: Object }>}
   */
  async updateUserStatus(id, isActive) {
    const response = await api.patch(`/admin/users/${id}/status`, { isActive });
    return response.data;
  },

  /**
   * Updates user assigned role.
   *
   * @param {string} id - User UUID
   * @param {string} role - Role name ('ADMIN', 'TEACHER', 'EXAM_COORDINATOR')
   * @returns {Promise<{ message: string, user: Object }>}
   */
  async updateUserRole(id, role) {
    const response = await api.patch(`/admin/users/${id}/role`, { role });
    return response.data;
  },

  /**
   * Initiates an administrator-assisted password reset.
   *
   * @param {string} id - User UUID
   * @param {string} newPassword - New plaintext password (hashed server-side)
   * @returns {Promise<{ message: string }>}
   */
  async resetPassword(id, newPassword) {
    const response = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  /**
   * Lists available system roles.
   *
   * @returns {Promise<Array<{ id: string, name: string, description: string }>>}
   */
  async getRoles() {
    const response = await api.get('/admin/roles');
    return response.data.roles;
  },
};

export default adminService;
