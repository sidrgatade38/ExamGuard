/**
 * ExamGuard - Academic Master Service (Module 21 & 22)
 *
 * Provides dynamic college examination master catalogs:
 * Departments, Courses, Semesters, Patterns, Subjects, Units,
 * Outcomes (CO, PO, BT), and Teacher Subject Authorization.
 */

const { supabase } = require('../config/supabase');

// Standard fallback catalogs if PostgreSQL migration has not yet been executed
const FALLBACK_ACADEMIC_DATA = {
  departments: [
    { id: 'dept-comp', code: 'COMP', name: 'Department of Computer Engineering' },
  ],
  courses: [
    { id: 'course-te-comp', departmentCode: 'COMP', code: 'TE_COMP', name: 'T.E. (Computer Engineering)', degree: 'B.E.' },
    { id: 'course-be-comp', departmentCode: 'COMP', code: 'BE_COMP', name: 'B.E. (Computer Engineering)', degree: 'B.E.' },
  ],
  patterns: [
    { id: 'pat-2019', code: 'PAT_2019', name: '2019 Pattern', revisionYear: 2019, maxQuestions: 30 },
    { id: 'pat-2024', code: 'PAT_2024_NEP', name: '2024 NEP Pattern', revisionYear: 2024, maxQuestions: 30 },
    { id: 'pat-2015', code: 'PAT_2015', name: '2015 Pattern (Backlog)', revisionYear: 2015, maxQuestions: 30 },
  ],
  semesters: [
    { number: 1, label: 'Semester 1' },
    { number: 2, label: 'Semester 2' },
    { number: 3, label: 'Semester 3' },
    { number: 4, label: 'Semester 4' },
    { number: 5, label: 'Semester 5' },
    { number: 6, label: 'Semester 6' },
    { number: 7, label: 'Semester 7' },
    { number: 8, label: 'Semester 8' },
  ],
  subjects: [
    // COMP Sem 5
    {
      id: 'sub-spos',
      departmentCode: 'COMP',
      courseCode: 'TE_COMP',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 5',
      code: '310243',
      shortName: 'SPOS',
      title: 'Systems Programming and Operating System',
      totalMarks: 70,
      durationHours: 2.5,
    },
    {
      id: 'sub-dbms',
      departmentCode: 'COMP',
      courseCode: 'TE_COMP',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 5',
      code: '310241',
      shortName: 'DBMS',
      title: 'Database Management Systems',
      totalMarks: 70,
      durationHours: 2.5,
    },
    {
      id: 'sub-cns',
      departmentCode: 'COMP',
      courseCode: 'TE_COMP',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 5',
      code: '310242',
      shortName: 'CNS',
      title: 'Computer Networks and Security',
      totalMarks: 70,
      durationHours: 2.5,
    },
    // COMP Sem 6
    {
      id: 'sub-wt',
      departmentCode: 'COMP',
      courseCode: 'TE_COMP',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 6',
      code: '310252',
      shortName: 'WT',
      title: 'Web Technology',
      totalMarks: 70,
      durationHours: 2.5,
    },
    // COMP Sem 7 - DAA
    {
      id: 'sub-daa',
      departmentCode: 'COMP',
      courseCode: 'BE_COMP',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 7',
      code: '410241',
      shortName: 'DAA',
      title: 'Design and Analysis of Algorithms',
      totalMarks: 70,
      durationHours: 2.5,
    },
    // COMP 2024 NEP Pattern
    {
      id: 'sub-nep-os',
      departmentCode: 'COMP',
      courseCode: 'TE_COMP',
      patternCode: 'PAT_2024_NEP',
      patternName: '2024 NEP Pattern',
      semester: 'Semester 5',
      code: 'NEP-301',
      shortName: 'OSSA',
      title: 'Operating Systems & System Architecture',
      totalMarks: 70,
      durationHours: 2.5,
    },
  ],
  units: {
    '310243': [
      { unitNumber: 1, unitTitle: 'Loaders and Linkers', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'Compilers, Interpreters and Lexical Analysis', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Operating System Overview & Process Management', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'Memory Management', targetMarks: 18 },
    ],
    '310241': [
      { unitNumber: 1, unitTitle: 'ER Modeling and Relational Database Design', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'SQL, Relational Algebra, and Normalization', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Transaction Processing, Concurrency, and ACID', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'Query Processing, Indexing, and NoSQL', targetMarks: 18 },
    ],
    '310242': [
      { unitNumber: 1, unitTitle: 'Network Layer and IPv4/IPv6 Routing', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'Transport Layer Protocols (TCP/UDP)', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Application Layer Protocols (DNS, HTTP, TLS)', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'Network Security, Firewalls, and Cryptography', targetMarks: 18 },
    ],
    '310252': [
      { unitNumber: 1, unitTitle: 'Web Essentials, HTML5, CSS3 and Responsive UI', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'Client-side Scripting with JavaScript and DOM', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Server-side Frameworks and REST APIs', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'Web Security, Authentication and Deployment', targetMarks: 18 },
    ],
    '410241': [
      { unitNumber: 1, unitTitle: 'Algorithm Analysis and Recurrence Relations', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'Divide-and-Conquer and Dynamic Programming', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Greedy Techniques and Graph Algorithms', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'NP-Completeness and Approximation Algorithms', targetMarks: 18 },
    ],
    'NEP-301': [
      { unitNumber: 1, unitTitle: 'Modern Kernel Architecture and Subsystems', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'Thread Scheduling and Multicore Synchronization', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Virtual Memory and Hardware Paging Mechanisms', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'Storage, Distributed Filesystems and Security', targetMarks: 18 },
    ],
  },
  outcomes: {
    courseOutcomes: [
      { code: 'CO1', label: 'CO1 - Fundamentals & Core Concepts' },
      { code: 'CO2', label: 'CO2 - Methodologies & Principles' },
      { code: 'CO3', label: 'CO3 - Performance Analysis & Design' },
      { code: 'CO4', label: 'CO4 - Architecture & Implementation' },
      { code: 'CO5', label: 'CO5 - Synthesis & Evaluation' },
      { code: 'CO6', label: 'CO6 - Advanced Applications' },
    ],
    programOutcomes: [
      { code: 'PO1', label: 'PO1 - Engineering Knowledge' },
      { code: 'PO2', label: 'PO2 - Problem Analysis' },
      { code: 'PO3', label: 'PO3 - Design / Development of Solutions' },
      { code: 'PO4', label: 'PO4 - Complex Problem Investigation' },
      { code: 'PO5', label: 'PO5 - Modern Tool Usage' },
      { code: 'PO6', label: 'PO6 - Engineer and Society' },
      { code: 'PO7', label: 'PO7 - Environment and Sustainability' },
      { code: 'PO8', label: 'PO8 - Ethics & Professional Integrity' },
      { code: 'PO9', label: 'PO9 - Individual and Team Work' },
      { code: 'PO10', label: 'PO10 - Communication Skills' },
      { code: 'PO11', label: 'PO11 - Project Management and Finance' },
      { code: 'PO12', label: 'PO12 - Life-long Learning' },
      { code: 'PSO1', label: 'PSO1 - Systems Design & Engineering' },
      { code: 'PSO2', label: 'PSO2 - Software Architecture & Security' },
    ],
    bloomTaxonomyLevels: [
      { code: 'L1 - Remember', short: 'L1', label: 'L1 - Remember (Recall facts)' },
      { code: 'L2 - Understand', short: 'L2', label: 'L2 - Understand (Explain ideas)' },
      { code: 'L3 - Apply', short: 'L3', label: 'L3 - Apply (Use in new situations)' },
      { code: 'L4 - Analyze', short: 'L4', label: 'L4 - Analyze (Draw connections)' },
      { code: 'L5 - Evaluate', short: 'L5', label: 'L5 - Evaluate (Justify decisions)' },
      { code: 'L6 - Create', short: 'L6', label: 'L6 - Create (Synthesize new work)' },
    ],
  },
};

// Subject acronym lookup helper
const SHORT_NAME_MAP = {
  '310243': 'SPOS',
  '310241': 'DBMS',
  '310242': 'CNS',
  '310252': 'WT',
  '410241': 'DAA',
  'NEP-301': 'OSSA',
  '314443': 'OSV',
};

async function getDepartments() {
  try {
    const { data, error } = await supabase
      .from('academic_departments')
      .select('id, code, name')
      .eq('code', 'COMP')
      .eq('is_active', true)
      .order('name');
    if (!error && data && data.length > 0) return data;
  } catch (_) {}
  return FALLBACK_ACADEMIC_DATA.departments;
}

async function getCourses(departmentCode) {
  if (departmentCode && departmentCode.toUpperCase() !== 'COMP') {
    return [];
  }
  try {
    let query = supabase
      .from('academic_courses')
      .select('id, code, name, degree, department_id, academic_departments!inner(code)')
      .eq('academic_departments.code', 'COMP')
      .eq('is_active', true);
    const { data, error } = await query;
    if (!error && data && data.length > 0) return data;
  } catch (_) {}
  return FALLBACK_ACADEMIC_DATA.courses;
}

async function getPatterns() {
  try {
    const { data, error } = await supabase
      .from('academic_patterns')
      .select('id, code, name, revision_year')
      .eq('is_active', true)
      .order('revision_year', { ascending: false });
    if (!error && data && data.length > 0) {
      return data.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        revisionYear: d.revision_year,
        maxQuestions: 30,
      }));
    }
  } catch (_) {}
  return FALLBACK_ACADEMIC_DATA.patterns;
}

async function getSemesters() {
  return FALLBACK_ACADEMIC_DATA.semesters;
}

/**
 * Returns Course Outcomes, Program Outcomes, and Bloom's Taxonomy levels (Module 22)
 */
async function getOutcomes() {
  return FALLBACK_ACADEMIC_DATA.outcomes;
}

/**
 * Retrieves subjects with support for acronym search (e.g. DAA), codes, and teacher restrictions.
 */
async function getSubjects({ departmentCode, courseCode, patternCode, semester, search, teacherId } = {}) {
  let authorizedSubjectIds = null;

  // Check teacher_subjects authorization if teacherId provided
  if (teacherId) {
    try {
      const { data: userSubj } = await supabase
        .from('teacher_subjects')
        .select('subject_id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);
      if (userSubj && userSubj.length > 0) {
        authorizedSubjectIds = new Set(userSubj.map((us) => us.subject_id));
      }
    } catch (_) {}
  }

  try {
    const { data, error } = await supabase
      .from('academic_subjects')
      .select('id, code, title, semester_label, total_marks, duration_hours, department_id, course_id, pattern_id')
      .eq('is_active', true);

    if (!error && data && data.length > 0) {
      let mapped = data.map((s) => ({
        id: s.id,
        code: s.code,
        shortName: SHORT_NAME_MAP[s.code] || s.code,
        title: s.title,
        semester: s.semester_label,
        totalMarks: s.total_marks,
        durationHours: s.duration_hours,
      }));

      // Filter by teacher authorization if scoped
      if (authorizedSubjectIds) {
        mapped = mapped.filter((s) => authorizedSubjectIds.has(s.id));
      }

      // Filter by search term (handles full name, code, or short name like DAA)
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        mapped = mapped.filter((s) => {
          const matchTitle = s.title.toLowerCase().includes(term);
          const matchCode = s.code.toLowerCase().includes(term);
          const matchShort = (s.shortName || '').toLowerCase().includes(term);
          return matchTitle || matchCode || matchShort;
        });
      }

      if (semester) {
        mapped = mapped.filter((s) => s.semester.toLowerCase() === semester.trim().toLowerCase());
      }

      if (mapped.length > 0) {
        return mapped;
      }
    }
  } catch (_) {}

  // Filter fallback catalog
  return FALLBACK_ACADEMIC_DATA.subjects.filter((s) => {
    if (departmentCode && s.departmentCode.toLowerCase() !== departmentCode.toLowerCase()) return false;
    if (courseCode && s.courseCode.toLowerCase() !== courseCode.toLowerCase()) return false;
    if (patternCode && s.patternCode.toLowerCase() !== patternCode.toLowerCase()) return false;
    if (semester && s.semester.toLowerCase() !== semester.toLowerCase()) return false;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      const matchTitle = s.title.toLowerCase().includes(term);
      const matchCode = s.code.toLowerCase().includes(term);
      const matchShort = (s.shortName || '').toLowerCase().includes(term);
      if (!matchTitle && !matchCode && !matchShort) return false;
    }
    return true;
  });
}

/**
 * Returns units for a subject code (e.g. 410241 -> DAA units, 310243 -> SPOS units).
 */
async function getUnitsForSubject(subjectCode) {
  try {
    const { data: sub } = await supabase
      .from('academic_subjects')
      .select('id')
      .eq('code', subjectCode)
      .maybeSingle();
    if (sub?.id) {
      const { data: units, error } = await supabase
        .from('academic_units')
        .select('unit_number, unit_title, target_marks')
        .eq('subject_id', sub.id)
        .order('unit_number');
      if (!error && units && units.length > 0) {
        return units.map((u) => ({
          unitNumber: u.unit_number,
          unitTitle: u.unit_title,
          targetMarks: u.target_marks,
        }));
      }
    }
  } catch (_) {}

  return FALLBACK_ACADEMIC_DATA.units[subjectCode] || [
    { unitNumber: 1, unitTitle: 'Unit 1: Fundamentals and Core Algorithms', targetMarks: 17 },
    { unitNumber: 2, unitTitle: 'Unit 2: Design Strategies and Recurrences', targetMarks: 17 },
    { unitNumber: 3, unitTitle: 'Unit 3: Graph and Advanced Optimization', targetMarks: 18 },
    { unitNumber: 4, unitTitle: 'Unit 4: Complexity and Approximation', targetMarks: 18 },
  ];
}

/**
 * Retrieves teacher profile and their authorized subjects
 */
async function getTeacherProfileWithSubjects(userId) {
  let userRecord = null;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, is_active, role:roles(name)')
      .eq('id', userId)
      .maybeSingle();
    userRecord = user;
  } catch (_) {}

  const subjects = await getSubjects({ teacherId: userId });

  return {
    id: userRecord?.id || userId,
    name: userRecord?.name || 'Faculty Member',
    email: userRecord?.email,
    teacher: userRecord || { id: userId, name: 'Faculty Member' },
    authorizedSubjects: subjects,
    subjects: subjects,
  };
}

module.exports = {
  getDepartments,
  getCourses,
  getPatterns,
  getSemesters,
  getSubjects,
  getUnitsForSubject,
  getOutcomes,
  getTeacherProfileWithSubjects,
};
