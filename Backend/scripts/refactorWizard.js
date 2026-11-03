const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../Frontend/src/components/QuestionPaperGeneratorWizard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update initial blueprint state
const oldBlueprintInit = `  // Blueprint State
  const [blueprint, setBlueprint] = useState(() => {
    if (initialDraft?.blueprint) {
      return {
        title: 'End Sem Exam',
        classYear: 'TE',
        totalMarks: 70,
        ...initialDraft.blueprint,
      };
    }
    return {
      title: 'End Sem Exam',
      subject: 'Systems Programming and Operating System',
      course: 'T.E. (Computer Engineering)',
      classYear: 'TE',
      semester: 'Semester 5',
      academicPattern: '2019',
      subjectCode: '310243',
      durationHours: 2.5,
      totalMarks: 70,
      instructions: [
        'Answer Q1 or Q2, Q3 or Q4, Q5 or Q6, Q7 or Q8.',
        'Neat diagrams must be drawn wherever necessary.',
        'Figures to the right indicate full marks.',
        'Assume suitable data if necessary.',
      ],
      numSets: 2,
      maxOverlapPercentage: 40,
      sections: [],
    };
  });`;

const newBlueprintInit = `  // In-wizard notification toast
  const [wizardNotification, setWizardNotification] = useState({ type: '', message: '' });
  const showNotification = (message, type = 'error') => {
    setWizardNotification({ type, message });
    setTimeout(() => setWizardNotification({ type: '', message: '' }), 6000);
  };

  // Blueprint State - Pristine Clean Initial State for New Paper
  const [blueprint, setBlueprint] = useState(() => {
    if (initialDraft?.blueprint || (initialDraft && initialDraft.subject)) {
      const bp = initialDraft.blueprint || initialDraft;
      return {
        title: bp.title || initialDraft.title || 'End Sem Exam',
        subject: bp.subject || initialDraft.subject || '',
        course: bp.course || initialDraft.course || 'B.E. (Computer Engineering)',
        classYear: bp.classYear || initialDraft.classYear || 'TE',
        semester: bp.semester || initialDraft.semester || 'Semester 5',
        academicPattern: bp.academicPattern || initialDraft.academicPattern || '2019',
        subjectCode: bp.subjectCode || initialDraft.subjectCode || '',
        durationHours: bp.durationHours ?? initialDraft.durationHours ?? 2.5,
        totalMarks: bp.totalMarks ?? initialDraft.totalMarks ?? 70,
        instructions: bp.instructions || initialDraft.instructions || [
          'Answer all compulsory questions or choose alternatives where specified.',
          'Neat diagrams must be drawn wherever necessary.',
          'Figures to the right indicate full marks.',
          'Assume suitable data if necessary.',
        ],
        numSets: bp.numSets ?? initialDraft.numSets ?? 2,
        maxOverlapPercentage: bp.maxOverlapPercentage ?? initialDraft.maxOverlapPercentage ?? 40,
        sections: bp.sections || initialDraft.sections || [],
      };
    }
    return {
      title: '',
      subject: '',
      course: 'B.E. (Computer Engineering)',
      classYear: '',
      semester: '',
      academicPattern: '',
      subjectCode: '',
      durationHours: 2.5,
      totalMarks: 70,
      instructions: [
        'Answer all compulsory questions or choose alternatives where specified.',
        'Neat diagrams must be drawn wherever necessary.',
        'Figures to the right indicate full marks.',
        'Assume suitable data if necessary.',
      ],
      numSets: 2,
      maxOverlapPercentage: 40,
      sections: [],
    };
  });`;

if (content.includes(oldBlueprintInit)) {
  content = content.replace(oldBlueprintInit, newBlueprintInit);
  console.log('1. Updated blueprint clean initialization!');
} else {
  console.warn('Could not find oldBlueprintInit');
}

// 2. Prevent auto-populating subject in loadAcademicCatalogs when initialDraft is null
const oldAutoPopulate = `        if (subsList.length > 0) {
          const firstSub = subsList[0];
          setBlueprint((prev) => ({
            ...prev,
            title: prev.title || '',
            subject: prev.subject || firstSub.title,
            subjectCode: prev.subjectCode || firstSub.code,
            semester: prev.semester || firstSub.semester || 'Semester 5',
            academicPattern: prev.academicPattern || firstSub.patternName || '2019 Pattern',
          }));

          const unitsRes = await academicService.getUnitsForSubject(firstSub.code).catch(() => ({ data: [] }));
          setSubjectUnits(unitsRes.data || []);
        }`;

const newAutoPopulate = `        if (initialDraft && subsList.length > 0) {
          const firstSub = subsList.find(s => s.title === initialDraft.subject || s.code === initialDraft.subjectCode) || subsList[0];
          setBlueprint((prev) => ({
            ...prev,
            title: prev.title || 'End Sem Exam',
            subject: prev.subject || firstSub.title,
            subjectCode: prev.subjectCode || firstSub.code,
            semester: prev.semester || firstSub.semester || 'Semester 5',
            academicPattern: prev.academicPattern || firstSub.patternName || '2019',
          }));

          const unitsRes = await academicService.getUnitsForSubject(firstSub.code).catch(() => ({ data: [] }));
          setSubjectUnits(unitsRes.data || []);
        }`;

if (content.includes(oldAutoPopulate)) {
  content = content.replace(oldAutoPopulate, newAutoPopulate);
  console.log('2. Removed unprompted subject auto-population!');
} else {
  console.warn('Could not find oldAutoPopulate');
}

// 3. Replace alert() calls
content = content.replace(
  "alert(err.response?.data?.message || err.message || 'Failed to save draft');",
  "showNotification(err.response?.data?.message || err.message || 'Failed to save draft', 'error');"
);

content = content.replace(
  "alert(err.response?.data?.message || err.message || 'Failed to save question');",
  "showNotification(err.response?.data?.message || err.message || 'Failed to save question', 'error');"
);

content = content.replace(
  "alert(err.response?.data?.message || err.message || 'Blueprint validation error');",
  "showNotification(err.response?.data?.message || err.message || 'Blueprint validation error', 'error');"
);

// Add validation check before handleProceedToBank
const oldHandleProceed = `  // Step 1 -> 2: Save / Create Blueprint
  const handleProceedToBank = async () => {
    try {
      const dynamicSections = getDynamicSections();
      const payload = {
        ...blueprint,
        sections: dynamicSections,
      };`;

const newHandleProceed = `  // Step 1 -> 2: Save / Create Blueprint
  const handleProceedToBank = async () => {
    if (!blueprint.title) {
      showNotification('Please select or specify an Examination Paper Title (e.g. End Sem Exam, CCE Exam, Open Book Test).', 'error');
      return;
    }
    if (!blueprint.classYear) {
      showNotification('Please select the Class / Year (FE, SE, TE, or BE).', 'error');
      return;
    }
    if (!blueprint.academicPattern) {
      showNotification('Please select the Academic Pattern (e.g. 2019, 2024, 2025).', 'error');
      return;
    }
    if (!blueprint.semester) {
      showNotification('Please select the Semester for this examination.', 'error');
      return;
    }
    if (!blueprint.subject) {
      showNotification('Please select the Subject for this question paper.', 'error');
      return;
    }
    if (!blueprint.totalMarks || blueprint.totalMarks <= 0) {
      showNotification('Please enter a valid positive whole-number for Total Examination Marks.', 'error');
      return;
    }
    try {
      const dynamicSections = getDynamicSections();
      const payload = {
        ...blueprint,
        sections: dynamicSections,
      };`;

if (content.includes(oldHandleProceed)) {
  content = content.replace(oldHandleProceed, newHandleProceed);
  console.log('3. Enhanced handleProceedToBank validation and notifications!');
}

// 4. Update getDynamicSections for arbitrary positive integers
const oldGetDynamicSections = `    // Default: 70 Marks (4 units, 17+17+18+18)
    return [
      {
        groupOrder: 1,
        groupLabel: \`Group 1 (\${units[0]?.unitTitle || 'Unit 1'})\`,
        primaryQuestionNumber: 1,
        alternativeQuestionNumber: 2,
        targetMarks: 17,
        targetUnit: 1,
        subquestionsConfig: [
          { subPart: 'a', marks: 8, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
          { subPart: 'b', marks: 9, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 1 },
        ],
      },
      {
        groupOrder: 2,
        groupLabel: \`Group 2 (\${units[1]?.unitTitle || 'Unit 2'})\`,
        primaryQuestionNumber: 3,
        alternativeQuestionNumber: 4,
        targetMarks: 17,
        targetUnit: 2,
        subquestionsConfig: [
          { subPart: 'a', marks: 8, difficulty: 'EASY', questionType: 'DESCRIPTIVE', unit: 2 },
          { subPart: 'b', marks: 9, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 2 },
        ],
      },
      {
        groupOrder: 3,
        groupLabel: \`Group 3 (\${units[2]?.unitTitle || 'Unit 3'})\`,
        primaryQuestionNumber: 5,
        alternativeQuestionNumber: 6,
        targetMarks: 18,
        targetUnit: 3,
        subquestionsConfig: [
          { subPart: 'a', marks: 9, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 3 },
          { subPart: 'b', marks: 9, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 3 },
        ],
      },
      {
        groupOrder: 4,
        groupLabel: \`Group 4 (\${units[3]?.unitTitle || 'Unit 4'})\`,
        primaryQuestionNumber: 7,
        alternativeQuestionNumber: 8,
        targetMarks: 18,
        targetUnit: 4,
        subquestionsConfig: [
          { subPart: 'a', marks: 9, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 4 },
          { subPart: 'b', marks: 9, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 4 },
        ],
      },
    ];
  };`;

const newGetDynamicSections = `    // Dynamic Generator for any positive integer total marks (e.g. 70, 40, 50, 80, 100, etc.)
    const numGroups = tm <= 30 ? 2 : 4;
    const baseGroupMarks = Math.floor(tm / numGroups);
    const remainder = tm % numGroups;

    const dynamicGroups = [];
    for (let g = 0; g < numGroups; g++) {
      const gMarks = baseGroupMarks + (g >= numGroups - remainder ? 1 : 0);
      const sub1 = Math.floor(gMarks / 2);
      const sub2 = gMarks - sub1;
      const uIndex = g % units.length;
      const uTitle = units[uIndex]?.unitTitle || \`Unit \${uIndex + 1}\`;

      dynamicGroups.push({
        groupOrder: g + 1,
        groupLabel: \`Group \${g + 1} (\${uTitle})\`,
        primaryQuestionNumber: g * 2 + 1,
        alternativeQuestionNumber: g * 2 + 2,
        targetMarks: gMarks,
        targetUnit: uIndex + 1,
        subquestionsConfig: [
          { subPart: 'a', marks: sub1 > 0 ? sub1 : 1, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: uIndex + 1 },
          { subPart: 'b', marks: sub2 > 0 ? sub2 : 1, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: uIndex + 1 },
        ],
      });
    }
    return dynamicGroups;
  };`;

if (content.includes(oldGetDynamicSections)) {
  content = content.replace(oldGetDynamicSections, newGetDynamicSections);
  console.log('4. Made getDynamicSections fully dynamic for all positive integer totals!');
}

// 5. Add wizard notification banner right below wizardHeader
const wizardNotificationBanner = `      {/* Notification Toast Alert */}
      {wizardNotification.message && (
        <div
          style={{
            margin: '0 1.5rem 1rem 1.5rem',
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: wizardNotification.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: \`1px solid \${wizardNotification.type === 'success' ? '#a7f3d0' : '#fecaca'}\`,
            color: wizardNotification.type === 'success' ? '#065f46' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {wizardNotification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{wizardNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setWizardNotification({ type: '', message: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}
`;

const wizardHeaderEnd = '      </div>\n\n      {/* --------------------------------------------------------------------- */}';
if (content.includes(wizardHeaderEnd)) {
  content = content.replace(wizardHeaderEnd, '      </div>\n\n' + wizardNotificationBanner + '      {/* --------------------------------------------------------------------- */}');
  console.log('5. Inserted top wizard notification toast banner!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('QuestionPaperGeneratorWizard.jsx successfully updated part 1!');
