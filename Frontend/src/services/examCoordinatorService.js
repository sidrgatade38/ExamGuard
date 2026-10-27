import api from './api';

/**
 * Exam Coordinator Service (Module 9)
 * Client-side API interactions for the Exam Coordinator workspace:
 * - Fetches assigned question papers
 * - Fetches paper details (sanitized metadata)
 * - Triggers authenticated download of decrypted question papers
 * - Verifies digital signature & cryptographic integrity
 */
export const examCoordinatorService = {
  /**
   * Fetches data-driven KPI metrics for the Exam Coordinator dashboard
   * @returns {Promise<Object>} Statistics including totalAssigned, readyForAccess, awaitingDelivery, upcomingDeliveries, integrityStats
   */
  async getDashboardStats() {
    const response = await api.get('/exam-coordinator/dashboard-stats');
    return response.data?.data || {
      totalAssigned: 0,
      readyForAccess: 0,
      awaitingDelivery: 0,
      upcomingDeliveriesCount: 0,
      nextDelivery: null,
      integrityStats: { verified: 0, pending: 0, failed: 0, total: 0, verifiedRatePercent: 0 },
      statusCounts: { submitted: 0, scheduled: 0, available: 0, archived: 0 },
    };
  },

  /**
   * Fetches recent security and operational activity for the coordinator
   * @param {number} [limit=15]
   * @returns {Promise<Array>} List of activity items
   */
  async getRecentActivity(limit = 15) {
    const response = await api.get(`/exam-coordinator/recent-activity?limit=${limit}`);
    return response.data?.data || [];
  },

  /**
   * Fetches question papers assigned to the authenticated exam coordinator with optional filters
   * @param {Object} [params={}] - search, status, department, semester, page, limit
   * @returns {Promise<{ papers: Array, pagination: Object }>} List and pagination metadata
   */
  async getAssignedQuestionPapers(params = {}) {
    const response = await api.get('/exam-coordinator/question-papers', { params });
    const papers = Array.isArray(response.data?.data) ? response.data.data : [];
    const pagination = response.data?.pagination || {
      total: papers.length,
      page: 1,
      limit: papers.length,
      totalPages: 1,
    };
    return { papers, pagination };
  },

  /**
   * Fetches full safe metadata for a specific assigned question paper
   * @param {string} id - Question paper UUID
   * @returns {Promise<Object>} Question paper metadata
   */
  async getQuestionPaperDetails(id) {
    const response = await api.get(`/exam-coordinator/question-papers/${id}`);
    return response.data?.data;
  },

  /**
   * Downloads and triggers browser save of the decrypted question paper PDF (Module 9)
   * Streams authenticated decrypted PDF directly to client with attachment headers.
   * @param {string} id - Question paper UUID
   * @param {string} [fallbackFileName] - Fallback filename if Content-Disposition missing
   */
  async downloadQuestionPaper(id, fallbackFileName = 'question_paper.pdf') {
    const response = await api.get(`/exam-coordinator/question-papers/${id}/download`, {
      responseType: 'blob',
    });

    let fileName = fallbackFileName;
    const disposition = response.headers?.['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },

  /**
   * Verifies the digital signature and cryptographic integrity of a question paper (Module 7 & 9)
   * Evaluates RSA-PSS signature and SHA-256 hash over stored ciphertext without exposing secrets.
   * @param {string} id - Question paper UUID
   * @returns {Promise<{ verified: boolean, algorithm: string, fileHash: string, storedHash: string, tamperDetected: boolean }>}
   */
  async verifySignature(id) {
    const response = await api.get(`/exam-coordinator/question-papers/${id}/verify-signature`);
    return response.data?.data;
  },
};

export default examCoordinatorService;
