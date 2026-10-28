import api from './api';

const blueprintService = {
  getDefaultSPOSBlueprint: async (params = {}) => {
    const res = await api.get('/exam-blueprints/default-spos', { params });
    return res.data;
  },

  getStandardBlueprint: async (params = {}) => {
    const res = await api.get('/exam-blueprints/default-spos', { params });
    return res.data;
  },

  createBlueprint: async (payload) => {
    const res = await api.post('/exam-blueprints', payload);
    return res.data;
  },

  getBlueprint: async (id) => {
    const res = await api.get(`/exam-blueprints/${id}`);
    return res.data;
  },

  checkFeasibility: async (id) => {
    const res = await api.get(`/exam-blueprints/${id}/feasibility`);
    return res.data;
  },

  getMarksStructure: async (totalMarks = 70) => {
    const res = await api.get('/exam-blueprints/marks-structure', { params: { totalMarks } });
    return res.data;
  },

  saveDraft: async (payload) => {
    const res = await api.post('/exam-blueprints/drafts', payload);
    return res.data;
  },

  listDrafts: async () => {
    const res = await api.get('/exam-blueprints/drafts');
    return res.data;
  },

  getDraft: async (id) => {
    const res = await api.get(`/exam-blueprints/drafts/${id}`);
    return res.data;
  },

  deleteDraft: async (id) => {
    const res = await api.delete(`/exam-blueprints/drafts/${id}`);
    return res.data;
  },
};

export default blueprintService;
