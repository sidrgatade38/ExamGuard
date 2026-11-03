require('dotenv').config();
const { supabase } = require('../src/config/supabase');

const tables = [
  'academic_courses',
  'academic_departments',
  'academic_paper_titles',
  'academic_patterns',
  'academic_subjects',
  'academic_units',
  'activity_logs',
  'answer_keys',
  'digital_signatures',
  'exam_blueprint_sections',
  'exam_blueprints',
  'exam_paper_drafts',
  'generated_exam_papers',
  'generated_exam_sets',
  'notifications',
  'paper_keys',
  'paper_verifications',
  'question_bank',
  'question_paper_assignments',
  'question_papers',
  'roles',
  'teacher_profiles',
  'teacher_subjects',
  'users'
];

async function check() {
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      if (error) {
        console.log(`FAIL [${t}]: ${error.message}`);
      } else {
        const cols = data && data.length > 0 ? Object.keys(data[0]) : '(empty table)';
        console.log(`OK   [${t}]: count=${data ? data.length : 0}, cols=${JSON.stringify(cols)}`);
      }
    } catch (err) {
      console.log(`EXC  [${t}]: ${err.message}`);
    }
  }
}

check();
