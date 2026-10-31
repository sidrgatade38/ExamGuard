import api from './api';

const academicService = {
  getDepartments: async () => {
    const res = await api.get('/academic/departments');
    return res.data;
  },

  getCourses: async (departmentCode = '') => {
    const params = departmentCode ? { departmentCode } : {};
    const res = await api.get('/academic/courses', { params });
    return res.data;
  },

  getPatterns: async () => {
    const res = await api.get('/academic/patterns');
    return res.data;
  },

  getSemesters: async () => {
    const res = await api.get('/academic/semesters');
    return res.data;
  },

  getSubjects: async (filter = {}) => {
    const res = await api.get('/academic/subjects', { params: filter });
    return res.data;
  },

  getUnitsForSubject: async (subjectCode) => {
    const res = await api.get(`/academic/subjects/${encodeURIComponent(subjectCode)}/units`);
    return res.data;
  },

  getOutcomes: async () => {
    const res = await api.get('/academic/outcomes');
    return res.data;
  },

  getTeacherProfile: async () => {
    const res = await api.get('/academic/teacher-profile');
    return res.data;
  },

  // Paper Titles CRUD
  getPaperTitles: async () => {
    const res = await api.get('/academic/paper-titles');
    return res.data;
  },

  createPaperTitle: async (payload) => {
    const res = await api.post('/academic/paper-titles', payload);
    return res.data;
  },

  updatePaperTitle: async (id, payload) => {
    const res = await api.put(`/academic/paper-titles/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  deletePaperTitle: async (id) => {
    const res = await api.delete(`/academic/paper-titles/${encodeURIComponent(id)}`);
    return res.data;
  },

  // Patterns CRUD
  createPattern: async (payload) => {
    const res = await api.post('/academic/patterns', payload);
    return res.data;
  },

  updatePattern: async (id, payload) => {
    const res = await api.put(`/academic/patterns/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  deletePattern: async (id) => {
    const res = await api.delete(`/academic/patterns/${encodeURIComponent(id)}`);
    return res.data;
  },

  // Subjects CRUD
  createSubject: async (payload) => {
    const res = await api.post('/academic/subjects', payload);
    return res.data;
  },

  updateSubject: async (id, payload) => {
    const res = await api.put(`/academic/subjects/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  deleteSubject: async (id) => {
    const res = await api.delete(`/academic/subjects/${encodeURIComponent(id)}`);
    return res.data;
  },

  // Courses CRUD
  createCourse: async (payload) => {
    const res = await api.post('/academic/courses', payload);
    return res.data;
  },

  updateCourse: async (id, payload) => {
    const res = await api.put(`/academic/courses/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  deleteCourse: async (id) => {
    const res = await api.delete(`/academic/courses/${encodeURIComponent(id)}`);
    return res.data;
  },
};

export default academicService;
