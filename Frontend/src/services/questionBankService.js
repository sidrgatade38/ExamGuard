import api from './api';

const questionBankService = {
  getQuestions: async (params = {}) => {
    const res = await api.get('/question-bank', { params });
    return res.data;
  },

  createQuestion: async (payload) => {
    const res = await api.post('/question-bank', payload);
    return res.data;
  },

  updateQuestion: async (id, payload) => {
    const res = await api.put(`/question-bank/${id}`, payload);
    return res.data;
  },

  seedSampleQuestions: async () => {
    const res = await api.post('/question-bank/seed-sample');
    return res.data;
  },
};

export default questionBankService;
