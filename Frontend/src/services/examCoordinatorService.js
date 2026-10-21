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
   * Fetches all question papers assigned to the authenticated exam coordinator
   * @returns {Promise<Array>} List of question paper objects
   */
  async getAssignedQuestionPapers() {
    const response = await api.get('/exam-coordinator/question-papers');
    return response.data?.data || [];
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
