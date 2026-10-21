import api from './api';

export const questionPaperService = {
  /**
   * Submits a question paper with multipart form data (PDF file + metadata)
   * @param {FormData} formData
   * @returns {Promise<Object>} Created paper and assignment details
   */
  async submitQuestionPaper(formData) {
    const response = await api.post('/question-papers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Fetches all question papers authored by the currently authenticated teacher
   * @returns {Promise<Array>} List of question papers
   */
  async getMyQuestionPapers() {
    const response = await api.get('/question-papers/my');
    return response.data?.data || [];
  },

  /**
   * Fetches all question papers assigned to the authenticated faculty member (Module 12 & 15)
   * @returns {Promise<Array>} List of assigned question papers with delivery gating metadata
   */
  async getAssignedQuestionPapers() {
    const response = await api.get('/question-papers/assigned');
    return response.data?.data || [];
  },

  /**
   * Fetches full metadata and assignment status for a specific question paper
   * @param {string} id - Question paper UUID
   * @returns {Promise<Object>} Question paper details
   */
  async getQuestionPaperDetails(id) {
    const response = await api.get(`/question-papers/${id}`);
    return response.data?.data;
  },

  /**
   * Downloads and triggers browser save of the decrypted question paper PDF (Module 6)
   * @param {string} id - Question paper UUID
   * @param {string} [fallbackFileName] - Fallback filename
   */
  async downloadQuestionPaper(id, fallbackFileName = 'question_paper.pdf') {
    const response = await api.get(`/question-papers/${id}/download`, {
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
   * Obtains a short-lived private signed URL for downloading the question paper PDF (legacy)
   * @param {string} id - Question paper UUID
   * @returns {Promise<{ downloadUrl: string, fileName: string, expiresIn: number }>}
   */
  async getQuestionPaperDownloadUrl(id) {
    const response = await api.get(`/question-papers/${id}/download`);
    return response.data?.data;
  },

  /**
   * Fetches active faculty members eligible to receive question paper assignments
   * @returns {Promise<Array<{ id: string, name: string, email: string }>>}
   */
  async getEligibleRecipients() {
    const response = await api.get('/question-papers/recipients');
    return response.data?.data || [];
  },

  /**
   * Verifies the digital signature and cryptographic integrity of a question paper (Module 7)
   * @param {string} id - Question paper UUID
   * @returns {Promise<{ verified: boolean, algorithm: string, fileHash: string, tamperDetected: boolean }>}
   */
  async verifySignature(id) {
    const response = await api.get(`/question-papers/${id}/verify-signature`);
    return response.data?.data;
  },
};

export default questionPaperService;
