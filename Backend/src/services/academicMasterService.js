/**
-- ExamGuard - Academic Master Service (Module 21)
-- Provides dynamic college examination master catalogs:
-- Departments, Courses, Semesters, Patterns, Subjects, Units.
*/

const { supabase } = require('../config/supabase');

// Standard fallback catalogs if PostgreSQL migration has not yet been executed
const FALLBACK_ACADEMIC_DATA = {
  departments: [
    { id: 'dept-comp', code: 'COMP', name: 'Department of Computer Engineering' },
    { id: 'dept-it', code: 'IT', name: 'Department of Information Technology' },
    { id: 'dept-entc', code: 'ENTC', name: 'Department of Electronics & Telecommunication' },
    { id: 'dept-mech', code: 'MECH', name: 'Department of Mechanical Engineering' },
  ],
  courses: [
    { id: 'course-te-comp', departmentCode: 'COMP', code: 'TE_COMP', name: 'T.E. (Computer Engineering)', degree: 'B.E.' },
    { id: 'course-be-comp', departmentCode: 'COMP', code: 'BE_COMP', name: 'B.E. (Computer Engineering)', degree: 'B.E.' },
    { id: 'course-te-it', departmentCode: 'IT', code: 'TE_IT', name: 'T.E. (Information Technology)', degree: 'B.Tech' },
    { id: 'course-be-it', departmentCode: 'IT', code: 'BE_IT', name: 'B.E. (Information Technology)', degree: 'B.Tech' },
    { id: 'course-te-entc', departmentCode: 'ENTC', code: 'TE_ENTC', name: 'T.E. (E&TC Engineering)', degree: 'B.E.' },
  ],
  patterns: [
    { id: 'pat-2019', code: 'PAT_2019', name: '2019 Pattern', revisionYear: 2019 },
    { id: 'pat-2024', code: 'PAT_2024_NEP', name: '2024 NEP Pattern', revisionYear: 2024 },
    { id: 'pat-2015', code: 'PAT_2015', name: '2015 Pattern (Backlog)', revisionYear: 2015 },
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
      title: 'Web Technology',
      totalMarks: 70,
      durationHours: 2.5,
    },
    // COMP Sem 7
    {
      id: 'sub-daa',
      departmentCode: 'COMP',
      courseCode: 'BE_COMP',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 7',
      code: '410241',
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
      title: 'Operating Systems & System Architecture',
      totalMarks: 70,
      durationHours: 2.5,
    },
    // IT Sem 5
    {
      id: 'sub-it-os',
      departmentCode: 'IT',
      courseCode: 'TE_IT',
      patternCode: 'PAT_2019',
      patternName: '2019 Pattern',
      semester: 'Semester 5',
      code: '314443',
      title: 'Operating System and Virtualization',
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
};

async function getDepartments() {
  try {
    const { data, error } = await supabase
      .from('academic_departments')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name');
    if (!error && data && data.length > 0) return data;
  } catch (_) {}
  return FALLBACK_ACADEMIC_DATA.departments;
}

async function getCourses(departmentCode) {
  try {
    let query = supabase.from('academic_courses').select('id, code, name, degree, department_id').eq('is_active', true);
    const { data, error } = await query;
    if (!error && data && data.length > 0) return data;
  } catch (_) {}
  if (!departmentCode) return FALLBACK_ACADEMIC_DATA.courses;
  return FALLBACK_ACADEMIC_DATA.courses.filter(
    (c) => !departmentCode || c.departmentCode.toLowerCase() === departmentCode.toLowerCase()
  );
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
      }));
    }
  } catch (_) {}
  return FALLBACK_ACADEMIC_DATA.patterns;
}

async function getSemesters() {
  return FALLBACK_ACADEMIC_DATA.semesters;
}

async function getSubjects({ departmentCode, courseCode, patternCode, semester }) {
  try {
    const { data, error } = await supabase
      .from('academic_subjects')
      .select('id, code, title, semester_label, total_marks, duration_hours, department_id, course_id, pattern_id')
      .eq('is_active', true);
    if (!error && data && data.length > 0) {
      return data.map((s) => ({
        id: s.id,
        code: s.code,
        title: s.title,
        semester: s.semester_label,
        totalMarks: s.total_marks,
        durationHours: s.duration_hours,
      }));
    }
  } catch (_) {}

  // Filter fallback
  return FALLBACK_ACADEMIC_DATA.subjects.filter((s) => {
    if (departmentCode && s.departmentCode.toLowerCase() !== departmentCode.toLowerCase()) return false;
    if (courseCode && s.courseCode.toLowerCase() !== courseCode.toLowerCase()) return false;
    if (patternCode && s.patternCode.toLowerCase() !== patternCode.toLowerCase()) return false;
    if (semester && s.semester.toLowerCase() !== semester.toLowerCase()) return false;
    return true;
  });
}

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
    { unitNumber: 1, unitTitle: 'Unit 1: Fundamentals', targetMarks: 17 },
    { unitNumber: 2, unitTitle: 'Unit 2: Core Concepts', targetMarks: 17 },
    { unitNumber: 3, unitTitle: 'Unit 3: Advanced Architectures', targetMarks: 18 },
    { unitNumber: 4, unitTitle: 'Unit 4: Applications & Security', targetMarks: 18 },
  ];
}

module.exports = {
  getDepartments,
  getCourses,
  getPatterns,
  getSemesters,
  getSubjects,
  getUnitsForSubject,
};
