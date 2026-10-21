import api from './api';

/**
 * Answer Key Service (Module 10)
 * Client-side API interactions for Answer Key Management:
 * - Teacher:
 *   - Fetches Answer Key status & submission window details
 *   - Uploads Answer Key PDF within post-exam submission window (0–4 days)
 *   - Securely downloads and verifies signature of author's own Answer Key
 * - Exam Coordinator:
 *   - Fetches assigned paper Answer Key details
 *   - Securely downloads decrypted Answer Key PDF
 *   - Verifies RSA-PSS digital signature and SHA-256 integrity
 */
export const answerKeyService = {
  // ==========================================
  // TEACHER METHODS
  // ==========================================

  /**
   * Fetches Answer Key metadata and submission window details for a teacher's paper
   * @param {string} questionPaperId - Question paper UUID
   * @returns {Promise<Object>} Answer Key details & submission window
   */
  async getTeacherAnswerKey(questionPaperId) {
    const response = await api.get(`/teacher/question-papers/${questionPaperId}/answer-key`);
    return response.data?.data;
  },

  /**
   * Uploads an Answer Key PDF for a question paper authored by the authenticated teacher
   * @param {string} questionPaperId - Question paper UUID
   * @param {File} file - Answer Key PDF file
   * @returns {Promise<Object>} Created answer key and signature details
   */
  async uploadTeacherAnswerKey(questionPaperId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(
      `/teacher/question-papers/${questionPaperId}/answer-key`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Downloads and decrypts the author's own Answer Key PDF
   * @param {string} questionPaperId - Question paper UUID
   * @param {string} [fallbackFileName] - Fallback filename
   */
  async downloadTeacherAnswerKey(questionPaperId, fallbackFileName = 'answer_key.pdf') {
    const response = await api.get(
      `/teacher/question-papers/${questionPaperId}/answer-key/download`,
      {
        responseType: 'blob',
      }
    );

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
   * Verifies RSA-PSS digital signature & integrity of the teacher's Answer Key
   * @param {string} questionPaperId - Question paper UUID
   * @returns {Promise<{ verified: boolean, algorithm: string, fileHash: string, storedHash: string, tamperDetected: boolean }>}
   */
  async verifyTeacherAnswerKeySignature(questionPaperId) {
    const response = await api.get(
      `/teacher/question-papers/${questionPaperId}/answer-key/verify-signature`
    );
    return response.data?.data;
  },

  // ==========================================
  // EXAM COORDINATOR METHODS
  // ==========================================

  /**
   * Fetches Answer Key details for an assigned question paper
   * @param {string} questionPaperId - Question paper UUID
   * @returns {Promise<Object>} Answer Key details
   */
  async getCoordinatorAnswerKey(questionPaperId) {
    const response = await api.get(
      `/exam-coordinator/question-papers/${questionPaperId}/answer-key`
    );
    return response.data?.data;
  },

  /**
   * Downloads and decrypts the Answer Key PDF for an assigned question paper
   * @param {string} questionPaperId - Question paper UUID
   * @param {string} [fallbackFileName] - Fallback filename
   */
  async downloadCoordinatorAnswerKey(questionPaperId, fallbackFileName = 'answer_key.pdf') {
    const response = await api.get(
      `/exam-coordinator/question-papers/${questionPaperId}/answer-key/download`,
      {
        responseType: 'blob',
      }
    );

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
   * Verifies RSA-PSS digital signature & integrity of the assigned Answer Key
   * @param {string} questionPaperId - Question paper UUID
   * @returns {Promise<{ verified: boolean, algorithm: string, fileHash: string, storedHash: string, tamperDetected: boolean }>}
   */
  async verifyCoordinatorAnswerKeySignature(questionPaperId) {
    const response = await api.get(
      `/exam-coordinator/question-papers/${questionPaperId}/answer-key/verify-signature`
    );
    return response.data?.data;
  },
};

export default answerKeyService;
