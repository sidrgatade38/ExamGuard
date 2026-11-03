require('dotenv').config();
const { supabase } = require('../src/config/supabase');

async function syncAcademicData() {
  console.log('--- Syncing Academic Master Data for Department of Computer Engineering ---');

  // 1. Ensure COMP Department is active and non-COMP are deactivated
  const { data: compDept, error: compErr } = await supabase
    .from('academic_departments')
    .select('id, code, name')
    .eq('code', 'COMP')
    .maybeSingle();

  if (compErr || !compDept) {
    console.error('Failed to find COMP department:', compErr);
    return;
  }

  const compDeptId = compDept.id;
  console.log('COMP Department ID:', compDeptId);

  // Deactivate non-COMP departments
  await supabase
    .from('academic_departments')
    .update({ is_active: false })
    .neq('code', 'COMP');

  // 2. Courses for FE, SE, TE, BE
  const coursesData = [
    { code: 'FE_COMP', name: 'F.E. (Computer Engineering)', degree: 'B.E.', duration_years: 4, is_active: true, department_id: compDeptId },
    { code: 'SE_COMP', name: 'S.E. (Computer Engineering)', degree: 'B.E.', duration_years: 4, is_active: true, department_id: compDeptId },
    { code: 'TE_COMP', name: 'T.E. (Computer Engineering)', degree: 'B.E.', duration_years: 4, is_active: true, department_id: compDeptId },
    { code: 'BE_COMP', name: 'B.E. (Computer Engineering)', degree: 'B.E.', duration_years: 4, is_active: true, department_id: compDeptId },
  ];

  for (const c of coursesData) {
    const { data: existing } = await supabase.from('academic_courses').select('id').eq('code', c.code).maybeSingle();
    if (existing) {
      await supabase.from('academic_courses').update(c).eq('id', existing.id);
      console.log(`Updated course ${c.code}`);
    } else {
      await supabase.from('academic_courses').insert([c]);
      console.log(`Inserted course ${c.code}`);
    }
  }

  // Deactivate non-COMP courses
  await supabase
    .from('academic_courses')
    .update({ is_active: false })
    .neq('department_id', compDeptId);

  // 3. Patterns: 2019, 2024, 2025
  const patternsData = [
    { code: 'PAT_2019', name: '2019 Pattern', revision_year: 2019, is_active: true },
    { code: 'PAT_2024_NEP', name: '2024 NEP Pattern', revision_year: 2024, is_active: true },
    { code: 'PAT_2025', name: '2025 Pattern', revision_year: 2025, is_active: true },
  ];

  for (const p of patternsData) {
    const { data: existing } = await supabase.from('academic_patterns').select('id').eq('code', p.code).maybeSingle();
    if (existing) {
      await supabase.from('academic_patterns').update(p).eq('id', existing.id);
      console.log(`Updated pattern ${p.code}`);
    } else {
      await supabase.from('academic_patterns').insert([p]);
      console.log(`Inserted pattern ${p.code}`);
    }
  }

  // Deactivate old patterns (like 2015)
  await supabase
    .from('academic_patterns')
    .update({ is_active: false })
    .not('code', 'in', '("PAT_2019","PAT_2024_NEP","PAT_2025")');

  // Fetch updated pattern IDs
  const { data: pats } = await supabase.from('academic_patterns').select('id, code');
  const patMap = {};
  pats.forEach(p => patMap[p.code] = p.id);

  // Fetch course IDs
  const { data: crs } = await supabase.from('academic_courses').select('id, code');
  const courseMap = {};
  crs.forEach(c => courseMap[c.code] = c.id);

  // 4. Subjects across FE, SE, TE, BE
  const subjectsToSync = [
    // FE Sem 1
    { code: '107001', short_name: 'M1', title: 'Engineering Mathematics-I', semester_label: 'Semester 1', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '107002', short_name: 'PHY', title: 'Engineering Physics', semester_label: 'Semester 1', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '104010', short_name: 'BXEE', title: 'Basic Electronics Engineering', semester_label: 'Semester 1', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '110005', short_name: 'PPS', title: 'Programming and Problem Solving', semester_label: 'Semester 1', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    // FE Sem 2
    { code: '107008', short_name: 'M2', title: 'Engineering Mathematics-II', semester_label: 'Semester 2', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '107009', short_name: 'CHEM', title: 'Engineering Chemistry', semester_label: 'Semester 2', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '101011', short_name: 'EM', title: 'Engineering Mechanics', semester_label: 'Semester 2', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '103004', short_name: 'BEEE', title: 'Basic Electrical Engineering', semester_label: 'Semester 2', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '110013', short_name: 'BCE', title: 'Basic Computer Engineering', semester_label: 'Semester 2', course_code: 'FE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    // SE Sem 3
    { code: '210241', short_name: 'DM', title: 'Discrete Mathematics', semester_label: 'Semester 3', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210242', short_name: 'FDS', title: 'Fundamentals of Data Structures', semester_label: 'Semester 3', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210243', short_name: 'OOP', title: 'Object Oriented Programming', semester_label: 'Semester 3', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210244', short_name: 'CG', title: 'Computer Graphics', semester_label: 'Semester 3', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210245', short_name: 'DELD', title: 'Digital Electronics and Logic Design', semester_label: 'Semester 3', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    // SE Sem 4
    { code: '207003', short_name: 'M3', title: 'Engineering Mathematics-III', semester_label: 'Semester 4', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210252', short_name: 'DSA', title: 'Data Structures and Algorithms', semester_label: 'Semester 4', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210253', short_name: 'SE', title: 'Software Engineering', semester_label: 'Semester 4', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210254', short_name: 'MP', title: 'Microprocessor', semester_label: 'Semester 4', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '210255', short_name: 'PPL', title: 'Principles of Programming Languages', semester_label: 'Semester 4', course_code: 'SE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    // TE Sem 5
    { code: '310243', short_name: 'SPOS', title: 'Systems Programming and Operating System', semester_label: 'Semester 5', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '310241', short_name: 'DBMS', title: 'Database Management Systems', semester_label: 'Semester 5', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '310242', short_name: 'CNS', title: 'Computer Networks and Security', semester_label: 'Semester 5', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '310244', short_name: 'TOC', title: 'Theory of Computation', semester_label: 'Semester 5', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: 'NEP-301', short_name: 'OSSA', title: 'Operating Systems & System Architecture', semester_label: 'Semester 5', course_code: 'TE_COMP', pattern_code: 'PAT_2024_NEP', total_marks: 70, duration_hours: 2.5 },
    // TE Sem 6
    { code: '310251', short_name: 'DSBDA', title: 'Data Science and Big Data Analytics', semester_label: 'Semester 6', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '310252', short_name: 'WT', title: 'Web Technology', semester_label: 'Semester 6', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '310253', short_name: 'AI', title: 'Artificial Intelligence', semester_label: 'Semester 6', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '310254', short_name: 'IS', title: 'Information Security', semester_label: 'Semester 6', course_code: 'TE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    // BE Sem 7
    { code: '410241', short_name: 'DAA', title: 'Design and Analysis of Algorithms', semester_label: 'Semester 7', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '410242', short_name: 'ML', title: 'Machine Learning', semester_label: 'Semester 7', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '410243', short_name: 'BT', title: 'Blockchain Technology', semester_label: 'Semester 7', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '410244', short_name: 'HPC', title: 'High Performance Computing', semester_label: 'Semester 7', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    // BE Sem 8
    { code: '410251', short_name: 'DL', title: 'Deep Learning', semester_label: 'Semester 8', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '410252', short_name: 'NLP', title: 'Natural Language Processing', semester_label: 'Semester 8', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
    { code: '410253', short_name: 'CC', title: 'Cloud Computing', semester_label: 'Semester 8', course_code: 'BE_COMP', pattern_code: 'PAT_2019', total_marks: 70, duration_hours: 2.5 },
  ];

  for (const s of subjectsToSync) {
    const courseId = courseMap[s.course_code];
    const patternId = patMap[s.pattern_code];
    if (!courseId || !patternId) {
      console.warn(`Skipping ${s.code}: course ${s.course_code} or pattern ${s.pattern_code} not found`);
      continue;
    }

    const payload = {
      department_id: compDeptId,
      course_id: courseId,
      pattern_id: patternId,
      code: s.code,
      title: s.title,
      short_name: s.short_name,
      semester_label: s.semester_label,
      total_marks: s.total_marks,
      duration_hours: s.duration_hours,
      is_active: true,
    };

    const { data: existing } = await supabase
      .from('academic_subjects')
      .select('id')
      .eq('code', s.code)
      .eq('pattern_id', patternId)
      .maybeSingle();

    if (existing) {
      await supabase.from('academic_subjects').update(payload).eq('id', existing.id);
      console.log(`Updated subject ${s.code} - ${s.short_name}`);
    } else {
      await supabase.from('academic_subjects').insert([payload]);
      console.log(`Inserted subject ${s.code} - ${s.short_name}`);
    }
  }

  console.log('--- Academic master sync completed successfully ---');
}

syncAcademicData().catch(console.error);
