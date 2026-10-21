import api from './api';

/**
 * Audit Log Service (Module 13)
 * Client-side API interactions for administrator security activity tracking.
 */
export const auditLogService = {
  /**
   * Retrieves paginated audit logs with search and filter parameters.
   * @param {Object} [params] - Query options (page, limit, action, outcome, userId, startDate, endDate)
   * @returns {Promise<{ logs: Array<Object>, pagination: Object }>}
   */
  async getAuditLogs(params = {}) {
    const response = await api.get('/audit-logs', { params });
    return {
      logs: response.data?.data || [],
      pagination: response.data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
    };
  },

  /**
   * Retrieves aggregate summary metrics of security events.
   * @param {Object} [params] - Optional date filters (startDate, endDate)
   * @returns {Promise<Object>}
   */
  async getAuditSummary(params = {}) {
    const response = await api.get('/audit-logs/summary', { params });
    return response.data?.data || { totalEvents: 0, successCount: 0, failureCount: 0, deniedCount: 0 };
  },

  /**
   * Retrieves detailed attributes for a single audit log by ID.
   * @param {string} id - Audit log UUID
   * @returns {Promise<Object>}
   */
  async getAuditLogById(id) {
    const response = await api.get(`/audit-logs/${id}`);
    return response.data?.data;
  },
};

export default auditLogService;
