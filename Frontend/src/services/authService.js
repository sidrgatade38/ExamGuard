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
};

export default authService;
