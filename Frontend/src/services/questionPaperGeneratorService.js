import api from './api';

const questionPaperGeneratorService = {
  generateSets: async (blueprintId) => {
    const res = await api.post('/question-paper-generator/generate', { blueprintId });
    return res.data;
  },

  getPaperSets: async (paperId) => {
    const res = await api.get(`/question-paper-generator/paper/${paperId}`);
    return res.data;
  },

  replaceQuestion: async (setId, oldQuestionId, newQuestionId) => {
    const res = await api.put(`/question-paper-generator/sets/${setId}/replace-question`, {
      oldQuestionId,
      newQuestionId,
    });
    return res.data;
  },

  approveAndSubmit: async (setId, payload) => {
    const res = await api.post(`/question-paper-generator/sets/${setId}/approve-and-submit`, payload);
    return res.data;
  },
};

export default questionPaperGeneratorService;
