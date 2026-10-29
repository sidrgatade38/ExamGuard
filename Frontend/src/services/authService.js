import api from './api';

export const authService = {
  /**
   * Submits credentials to POST /api/auth/login
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ success: boolean, token: string, user: Object }>}
   */
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Fetches the currently authenticated user identity from GET /api/auth/me
   * @returns {Promise<{ success: boolean, user: Object }>}
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Fetches the independent teacher profile from GET /api/auth/profile
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  async getProfile() {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  /**
   * Updates teacher profile details via PUT /api/auth/profile
   * @param {Object} profileData
   * @returns {Promise<{ success: boolean, data: Object }>}
   */
  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },
};

export default authService;
