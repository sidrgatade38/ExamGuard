import api from './api';

const blueprintService = {
  getDefaultSPOSBlueprint: async () => {
    const res = await api.get('/exam-blueprints/default-spos');
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
};

export default blueprintService;
