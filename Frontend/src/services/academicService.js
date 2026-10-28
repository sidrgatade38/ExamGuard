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
};

export default academicService;
