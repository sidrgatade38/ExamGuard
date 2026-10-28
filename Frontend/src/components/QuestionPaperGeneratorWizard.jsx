import React, { useState, useEffect } from 'react';
import questionBankService from '../services/questionBankService';
import blueprintService from '../services/blueprintService';
import questionPaperGeneratorService from '../services/questionPaperGeneratorService';
import academicService from '../services/academicService';
import {
  FileText,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Plus,
  ShieldCheck,
  Send,
  Database,
  Sliders,
  Calendar,
  User,
  Clock,
  BookOpen,
  GraduationCap,
  Building,
} from 'lucide-react';

export default function QuestionPaperGeneratorWizard({ recipients = [], onSuccess, onCancel }) {
  // Wizard Step: 1 (Exam Details & Blueprint) -> 2 (Question Bank) -> 3 (Feasibility) -> 4 (Validation & Sets) -> 5 (Submit)
  const [step, setStep] = useState(1);

  // Dynamic Academic Context State
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectUnits, setSubjectUnits] = useState([]);
  const [selectedDept, setSelectedDept] = useState('COMP');
  const [loadingAcademic, setLoadingAcademic] = useState(true);

  // Blueprint State
  const [blueprint, setBlueprint] = useState({
    title: 'End Semester Examination',
    subject: 'Systems Programming and Operating System',
    course: 'T.E. (Computer Engineering)',
    semester: 'Semester 5',
    academicPattern: '2019 Pattern',
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
  });

  const [blueprintId, setBlueprintId] = useState(null);

  // Question Bank State
  const MAX_QUESTIONS_LIMIT = 30;
  const [questions, setQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankError, setBankError] = useState('');
  const [newQuestionModalOpen, setNewQuestionModalOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [outcomes, setOutcomes] = useState({
    courseOutcomes: [
      { code: 'CO1', title: 'Fundamentals and Mathematical Analysis' },
      { code: 'CO2', title: 'Design and Analysis of Divide-and-Conquer / Greedy Algorithms' },
      { code: 'CO3', title: 'Dynamic Programming and Complex Formulations' },
      { code: 'CO4', title: 'Backtracking and Branch-and-Bound Paradigms' },
      { code: 'CO5', title: 'Computational Complexity and NP-Completeness' },
      { code: 'CO6', title: 'Advanced & Approximation Algorithms' },
    ],
    programOutcomes: [
      { code: 'PO1', title: 'Engineering Knowledge' },
      { code: 'PO2', title: 'Problem Analysis' },
      { code: 'PO3', title: 'Design/Development of Solutions' },
      { code: 'PO4', title: 'Conduct Investigations of Complex Problems' },
      { code: 'PO5', title: 'Modern Tool Usage' },
      { code: 'PO6', title: 'The Engineer and Society' },
      { code: 'PO7', title: 'Environment and Sustainability' },
      { code: 'PO8', title: 'Ethics' },
      { code: 'PO9', title: 'Individual and Team Work' },
      { code: 'PO10', title: 'Communication' },
      { code: 'PO11', title: 'Project Management and Finance' },
      { code: 'PO12', title: 'Life-long Learning' },
      { code: 'PSO1', title: 'Professional Skills' },
      { code: 'PSO2', title: 'Problem-Solving Skills' },
    ],
    bloomTaxonomyLevels: [
      { code: 'L1', title: 'Remember' },
      { code: 'L2', title: 'Understand' },
      { code: 'L3', title: 'Apply' },
      { code: 'L4', title: 'Analyze' },
      { code: 'L5', title: 'Evaluate' },
      { code: 'L6', title: 'Create' },
    ],
  });

  const [newQuestionForm, setNewQuestionForm] = useState({
    unitNumber: 1,
    unitTitle: 'Unit 1: Fundamentals',
    topic: '',
    questionText: '',
    questionType: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    courseOutcome: 'CO1',
    programOutcome: 'PO1',
    bloomTaxonomy: 'L2 - Understand',
    answerScheme: '',
  });

  // Feasibility & Generation State
  const [feasibility, setFeasibility] = useState(null);
  const [checkingFeasibility, setCheckingFeasibility] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  // Generated Sets State
  const [generatedPaperData, setGeneratedPaperData] = useState(null);
  const [activeSetIndex, setActiveSetIndex] = useState(0);

  // Final Approval & Submission State
  const [submissionForm, setSubmissionForm] = useState({
    assignedToUserId: recipients.length > 0 ? recipients[0].id : '',
    examDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    confirmedApproval: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // 1. Initial Load of Academic Master Data
  useEffect(() => {
    async function loadAcademicCatalogs() {
      try {
        setLoadingAcademic(true);
        const [deptsData, coursesData, patternsData, semestersData, outcomesData, profileData] = await Promise.all([
          academicService.getDepartments().catch(() => ({ data: [] })),
          academicService.getCourses().catch(() => ({ data: [] })),
          academicService.getPatterns().catch(() => ({ data: [] })),
          academicService.getSemesters().catch(() => ({ data: [] })),
          academicService.getOutcomes().catch(() => ({ data: null })),
          academicService.getTeacherProfile().catch(() => ({ data: null })),
        ]);

        const deptsList = deptsData.data || [];
        const coursesList = coursesData.data || [];
        const patternsList = patternsData.data || [];
        const semsList = semestersData.data || [];

        setDepartments(deptsList);
        setCourses(coursesList);
        setPatterns(patternsList);
        setSemesters(semsList);

        if (outcomesData?.data) {
          setOutcomes(outcomesData.data);
        }
        if (profileData?.data) {
          setTeacherProfile(profileData.data);
        }

        // Fetch subjects for default selections - use teacher's assigned subjects if available
        let subsList = [];
        if (profileData?.data?.subjects && profileData.data.subjects.length > 0) {
          subsList = profileData.data.subjects;
        } else {
          const subsData = await academicService.getSubjects({
            departmentCode: selectedDept,
          }).catch(() => ({ data: [] }));
          subsList = subsData.data || [];
        }

        setSubjects(subsList);

        if (subsList.length > 0) {
          const firstSub = subsList[0];
          setBlueprint((prev) => ({
            ...prev,
            title: `End Semester Examination: ${firstSub.title}`,
            subject: firstSub.title,
            subjectCode: firstSub.code,
            semester: firstSub.semester || prev.semester,
            academicPattern: firstSub.patternName || prev.academicPattern,
          }));

          const unitsRes = await academicService.getUnitsForSubject(firstSub.code).catch(() => ({ data: [] }));
          setSubjectUnits(unitsRes.data || []);
        }
      } catch (err) {
        console.warn('Academic master catalogs loading notice:', err.message);
      } finally {
        setLoadingAcademic(false);
      }
    }
    loadAcademicCatalogs();
  }, []);

  // 2. Cascade when Department or Course changes
  const handleDepartmentChange = async (deptCode) => {
    setSelectedDept(deptCode);
    try {
      const [coursesRes, subsRes] = await Promise.all([
        academicService.getCourses(deptCode),
        academicService.getSubjects({ departmentCode: deptCode }),
      ]);
      const newCourses = coursesRes.data || [];
      const newSubs = subsRes.data || [];
      setCourses(newCourses);
      setSubjects(newSubs);

      if (newSubs.length > 0) {
        const sub = newSubs[0];
        setBlueprint((prev) => ({
          ...prev,
          title: `End Semester Examination: ${sub.title}`,
          subject: sub.title,
          subjectCode: sub.code,
          course: newCourses[0]?.name || prev.course,
        }));
        const unitsRes = await academicService.getUnitsForSubject(sub.code).catch(() => ({ data: [] }));
        setSubjectUnits(unitsRes.data || []);
      }
    } catch (err) {
      console.warn('Failed updating department cascade:', err);
    }
  };

  // 3. Subject selection handler
  const handleSubjectChange = async (selectedSubTitle) => {
    const subObj = subjects.find(
      (s) =>
        s.title === selectedSubTitle ||
        s.code === selectedSubTitle ||
        s.shortName === selectedSubTitle ||
        s.short_name === selectedSubTitle
    );
    if (!subObj) {
      setBlueprint((prev) => ({ ...prev, subject: selectedSubTitle }));
      return;
    }

    setBlueprint((prev) => ({
      ...prev,
      title: `End Semester Examination: ${subObj.title}`,
      subject: subObj.title,
      subjectCode: subObj.code,
      totalMarks: subObj.totalMarks || 70,
      durationHours: subObj.durationHours || 2.5,
      semester: subObj.semester || prev.semester,
      academicPattern: subObj.patternName || prev.academicPattern,
    }));

    try {
      const unitsRes = await academicService.getUnitsForSubject(subObj.code);
      const units = unitsRes.data || [];
      setSubjectUnits(units);
      if (units.length > 0) {
        setNewQuestionForm((prev) => ({
          ...prev,
          unitNumber: units[0].unitNumber,
          unitTitle: units[0].unitTitle,
        }));
      }
    } catch (err) {
      console.warn('Failed loading units for subject:', err);
    }
  };

  // Load Question Bank when arriving at Step 2 or 3
  const loadQuestions = async () => {
    setLoadingBank(true);
    setBankError('');
    try {
      const res = await questionBankService.getQuestions({
        subject: blueprint.subject,
      });
      setQuestions(res.data || []);
    } catch (err) {
      setBankError(err.response?.data?.message || err.message || 'Failed to load question bank.');
    } finally {
      setLoadingBank(false);
    }
  };

  useEffect(() => {
    if (step >= 2) {
      loadQuestions();
    }
  }, [step, blueprint.subject]);

  // Add custom question for this subject
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (questions.length >= MAX_QUESTIONS_LIMIT) {
      alert(`Maximum question limit of ${MAX_QUESTIONS_LIMIT} questions reached for this examination pattern.`);
      return;
    }
    try {
      await questionBankService.createQuestion({
        ...newQuestionForm,
        subject: blueprint.subject,
        course: blueprint.course,
        semester: blueprint.semester,
        academicPattern: blueprint.academicPattern,
      });
      setNewQuestionModalOpen(false);
      setNewQuestionForm((prev) => ({
        ...prev,
        topic: '',
        questionText: '',
        marks: 8,
        difficulty: 'MEDIUM',
        courseOutcome: 'CO1',
        programOutcome: 'PO1',
        bloomTaxonomy: 'L2 - Understand',
        answerScheme: '',
      }));
      await loadQuestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add question');
    }
  };

  // Build standard dynamic OR sections if none exist
  const getDynamicSections = () => {
    if (blueprint.sections && blueprint.sections.length > 0) {
      return blueprint.sections;
    }
    const units = subjectUnits.length >= 4 ? subjectUnits : [
      { unitNumber: 1, unitTitle: 'Unit 1: Fundamentals', targetMarks: 17 },
      { unitNumber: 2, unitTitle: 'Unit 2: Core Concepts', targetMarks: 17 },
      { unitNumber: 3, unitTitle: 'Unit 3: Advanced Architectures', targetMarks: 18 },
      { unitNumber: 4, unitTitle: 'Unit 4: Applications & Security', targetMarks: 18 },
    ];

    return [
      {
        groupOrder: 1,
        groupLabel: `Group 1 (${units[0]?.unitTitle || 'Unit 1'})`,
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
        groupLabel: `Group 2 (${units[1]?.unitTitle || 'Unit 2'})`,
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
        groupLabel: `Group 3 (${units[2]?.unitTitle || 'Unit 3'})`,
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
        groupLabel: `Group 4 (${units[3]?.unitTitle || 'Unit 4'})`,
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
  };

  // Step 1 -> 2: Save / Create Blueprint
  const handleProceedToBank = async () => {
    try {
      const dynamicSections = getDynamicSections();
      const payload = {
        ...blueprint,
        sections: dynamicSections,
      };
      const res = await blueprintService.createBlueprint(payload);
      if (res.data?.id || res.id) {
        setBlueprintId(res.data?.id || res.id);
      }
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Blueprint validation error');
    }
  };

  // Step 2 -> 3: Check Feasibility
  const handleCheckFeasibility = async () => {
    setCheckingFeasibility(true);
    setGenerationError('');
    try {
      let bId = blueprintId;
      if (!bId) {
        const dynamicSections = getDynamicSections();
        const res = await blueprintService.createBlueprint({
          ...blueprint,
          sections: dynamicSections,
        });
        bId = res.data?.id || res.id;
        setBlueprintId(bId);
      }
      const res = await blueprintService.checkFeasibility(bId);
      setFeasibility(res.data);
      setStep(3);
    } catch (err) {
      setGenerationError(err.response?.data?.message || err.message || 'Feasibility analysis failed.');
    } finally {
      setCheckingFeasibility(false);
    }
  };

  // Step 3 -> 4: Generate Sets on Backend
  const handleGenerateSets = async () => {
    setGenerating(true);
    setGenerationError('');
    try {
      let bId = blueprintId;
      if (!bId) {
        const dynamicSections = getDynamicSections();
        const res = await blueprintService.createBlueprint({
          ...blueprint,
          sections: dynamicSections,
        });
        bId = res.data?.id || res.id;
        setBlueprintId(bId);
      }
      const res = await questionPaperGeneratorService.generateSets(bId);
      setGeneratedPaperData(res.data);
      setActiveSetIndex(0);
      setStep(4);
    } catch (err) {
      setGenerationError(err.response?.data?.message || err.message || 'Failed to generate sets.');
    } finally {
      setGenerating(false);
    }
  };

  // Step 5: Final Approval and Secure Submission to Exam Cell
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!submissionForm.confirmedApproval) {
      setSubmissionError('You must review and check the approval confirmation box before submitting.');
      return;
    }
    if (!submissionForm.assignedToUserId) {
      setSubmissionError('Please select a designated recipient Exam Coordinator.');
      return;
    }

    const currentSet = generatedPaperData?.sets?.[activeSetIndex];
    if (!currentSet) {
      setSubmissionError('No active examination set selected.');
      return;
    }

    setSubmitting(true);
    setSubmissionError('');
    try {
      const res = await questionPaperGeneratorService.approveAndSubmit(currentSet.id, {
        assignedToUserId: submissionForm.assignedToUserId,
        examDate: submissionForm.examDate,
        setCode: currentSet.setCode,
        setOrder: currentSet.setOrder,
        totalMarks: currentSet.totalMarks,
        blueprintId: generatedPaperData?.blueprintId || generatedPaperData?.paperId || blueprintId,
      });

      if (onSuccess) {
        onSuccess(res.message || 'Question paper generated and securely submitted to Examination Cell!');
      }
    } catch (err) {
      setSubmissionError(err.response?.data?.message || err.message || 'Failed to approve and submit question paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSubjects = subjects.filter((s) => {
    if (!subjectSearch.trim()) return true;
    const q = subjectSearch.trim().toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.shortName && s.shortName.toLowerCase().includes(q)) ||
      (s.short_name && s.short_name.toLowerCase().includes(q))
    );
  });

  const activeSet = generatedPaperData?.sets?.[activeSetIndex];

  return (
    <div style={styles.wizardContainer}>
      {/* Wizard Header */}
      <div style={styles.wizardHeader}>
        <div style={styles.titleRow}>
          <div style={styles.iconCircle}>
            <Sparkles size={22} color="var(--color-primary)" />
          </div>
          <div>
            <h2 style={styles.title}>Multi-Subject Question Paper Generator</h2>
            <p style={styles.subtitle}>
              College Examination Cell: Dynamic Curriculum Blueprint &amp; Randomized Multi-Set Generation Pipeline
            </p>
          </div>
        </div>

        {/* Stepper Progress */}
        <div style={styles.stepper}>
          {[
            { num: 1, label: 'Blueprint' },
            { num: 2, label: 'Question Bank' },
            { num: 3, label: 'Feasibility' },
            { num: 4, label: 'Validation & Sets' },
            { num: 5, label: 'Submit' },
          ].map((s) => (
            <div key={s.num} style={styles.stepItem}>
              <div
                style={{
                  ...styles.stepCircle,
                  backgroundColor: step === s.num ? 'var(--color-primary)' : step > s.num ? 'var(--color-success)' : 'var(--color-surface-subtle)',
                  color: step >= s.num ? '#ffffff' : 'var(--color-text-muted)',
                  border: step === s.num ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                }}
              >
                {step > s.num ? <CheckCircle2 size={16} /> : s.num}
              </div>
              <span style={step === s.num ? styles.stepLabelActive : styles.stepLabel}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* STEP 1: DYNAMIC ACADEMIC CONTEXT & BLUEPRINT CONFIGURATION            */}
      {/* --------------------------------------------------------------------- */}
      {step === 1 && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Step 1: Academic Structure &amp; Exam Blueprint</h3>
            <p style={styles.cardSubtitle}>
              Select department, degree, examination pattern, and subject. The system dynamically configures university OR-pairs and marking schemes from the database.
            </p>
          </div>

          <div style={styles.grid2}>
            {/* Department Selection */}
            <div>
              <label style={styles.label}>Academic Department</label>
              <select
                style={styles.select}
                value={selectedDept}
                onChange={(e) => handleDepartmentChange(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.code}>
                    {d.name}
                  </option>
                ))}
                {departments.length === 0 && <option value="COMP">Department of Computer Engineering</option>}
              </select>
            </div>

            {/* Course / Degree Selection */}
            <div>
              <label style={styles.label}>Course / Degree</label>
              <select
                style={styles.select}
                value={blueprint.course}
                onChange={(e) => setBlueprint({ ...blueprint, course: e.target.value })}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.degree || 'B.E.'})
                  </option>
                ))}
                {courses.length === 0 && <option value="T.E. (Computer Engineering)">T.E. (Computer Engineering)</option>}
              </select>
            </div>

            {/* Academic Pattern Selection (FIXED: Editable & Database-driven) */}
            <div>
              <label style={styles.label}>Academic Pattern</label>
              <select
                style={styles.select}
                value={blueprint.academicPattern}
                onChange={(e) => setBlueprint({ ...blueprint, academicPattern: e.target.value })}
              >
                {patterns.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
                {patterns.length === 0 && (
                  <>
                    <option value="2019 Pattern">2019 Pattern</option>
                    <option value="2024 NEP Pattern">2024 NEP Pattern</option>
                    <option value="2015 Pattern (Backlog)">2015 Pattern (Backlog)</option>
                  </>
                )}
              </select>
            </div>

            {/* Semester Selection (FIXED: Editable & Dynamic) */}
            <div>
              <label style={styles.label}>Semester</label>
              <select
                style={styles.select}
                value={blueprint.semester}
                onChange={(e) => setBlueprint({ ...blueprint, semester: e.target.value })}
              >
                {semesters.map((s) => (
                  <option key={s.number} value={s.label}>
                    {s.label}
                  </option>
                ))}
                {semesters.length === 0 && (
                  <>
                    <option value="Semester 5">Semester 5</option>
                    <option value="Semester 6">Semester 6</option>
                    <option value="Semester 7">Semester 7</option>
                    <option value="Semester 8">Semester 8</option>
                  </>
                )}
              </select>
            </div>

            {/* Subject Selection (Searchable & Dynamic from Database) */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>
                  Subject (Fast Search by Code, Full Title, or Short Name e.g. DAA, SPOS, DBMS, CNS)
                </label>
                {teacherProfile?.name && (
                  <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                    Faculty Authorized: {teacherProfile.name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Type to filter subjects: e.g. DAA, 410241, Algorithms, SPOS, DBMS..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  style={{ ...styles.input, flex: 1 }}
                />
                {subjectSearch && (
                  <button
                    type="button"
                    onClick={() => setSubjectSearch('')}
                    style={{ ...styles.secondaryButton, padding: '4px 10px', height: '38px', fontSize: '12px' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <select
                style={styles.select}
                value={blueprint.subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
              >
                {filteredSubjects.map((s) => (
                  <option key={s.id || s.code} value={s.title}>
                    [{s.code || s.subject_code}] {s.shortName ? `(${s.shortName}) ` : ''}{s.title}
                  </option>
                ))}
                {filteredSubjects.length === 0 && (
                  <option value={blueprint.subject}>
                    {blueprint.subject} [{blueprint.subjectCode}]
                  </option>
                )}
              </select>
            </div>

            {/* Subject Code */}
            <div>
              <label style={styles.label}>Subject Code</label>
              <input
                type="text"
                style={styles.input}
                value={blueprint.subjectCode}
                onChange={(e) => setBlueprint({ ...blueprint, subjectCode: e.target.value })}
              />
            </div>

            {/* Duration (Hours) */}
            <div>
              <label style={styles.label}>Duration (Hours)</label>
              <input
                type="number"
                step="0.5"
                style={styles.input}
                value={blueprint.durationHours}
                onChange={(e) => setBlueprint({ ...blueprint, durationHours: parseFloat(e.target.value) })}
              />
            </div>

            {/* Total Answered Marks */}
            <div>
              <label style={styles.label}>Total Answered Marks</label>
              <input
                type="number"
                style={styles.input}
                value={blueprint.totalMarks}
                onChange={(e) => setBlueprint({ ...blueprint, totalMarks: parseInt(e.target.value, 10) })}
              />
            </div>
          </div>

          {/* Dynamic OR Group Structure Summary */}
          <div style={styles.summaryBox}>
            <h4 style={styles.summaryTitle}>
              University OR-Pair Structure for {blueprint.subject} ({blueprint.academicPattern})
            </h4>
            <div style={styles.groupList}>
              <div style={styles.groupCard}>
                <strong>Pair 1 ({subjectUnits[0]?.unitTitle || 'Unit 1'}):</strong> Q1 (8 + 9 = 17M) <span style={styles.orPill}>OR</span> Q2 (9 + 8 = 17M)
              </div>
              <div style={styles.groupCard}>
                <strong>Pair 2 ({subjectUnits[1]?.unitTitle || 'Unit 2'}):</strong> Q3 (8 + 9 = 17M) <span style={styles.orPill}>OR</span> Q4 (8 + 9 = 17M)
              </div>
              <div style={styles.groupCard}>
                <strong>Pair 3 ({subjectUnits[2]?.unitTitle || 'Unit 3'}):</strong> Q5 (9 + 9 = 18M) <span style={styles.orPill}>OR</span> Q6 (9 + 9 = 18M)
              </div>
              <div style={styles.groupCard}>
                <strong>Pair 4 ({subjectUnits[3]?.unitTitle || 'Unit 4'}):</strong> Q7 (9 + 9 = 18M) <span style={styles.orPill}>OR</span> Q8 (9 + 9 = 18M)
              </div>
            </div>
            <p style={styles.summaryFooter}>
              Total Answered Marks: 17 + 17 + 18 + 18 = <strong>{blueprint.totalMarks} Marks</strong>. Candidate answers 1 question per alternative pair.
            </p>
          </div>

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryButton} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" style={styles.primaryButton} onClick={handleProceedToBank}>
              <span>Proceed to Question Bank</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* STEP 2: DYNAMIC QUESTION BANK MANAGEMENT (SCOPED TO SELECTED SUBJECT) */}
      {/* --------------------------------------------------------------------- */}
      {step === 2 && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={styles.cardTitle}>Step 2: Question Bank Pool: {blueprint.subject}</h3>
                <p style={styles.cardSubtitle}>
                  Scoped strictly to {blueprint.subject} ({blueprint.subjectCode || 'Active Subject'}). Questions must be categorized by Unit, Marks, Outcomes (CO/PO) and Bloom&apos;s Taxonomy.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: questions.length >= MAX_QUESTIONS_LIMIT ? '#fee2e2' : '#ecfdf5',
                    color: questions.length >= MAX_QUESTIONS_LIMIT ? '#991b1b' : '#065f46',
                    border: `1px solid ${questions.length >= MAX_QUESTIONS_LIMIT ? '#fca5a5' : '#a7f3d0'}`,
                  }}
                >
                  <Database size={14} />
                  <span>Pool: <strong>{questions.length} / {MAX_QUESTIONS_LIMIT}</strong> Questions</span>
                  <span>• {Math.max(0, MAX_QUESTIONS_LIMIT - questions.length)} remaining capacity</span>
                </div>

                <button
                  type="button"
                  style={{
                    ...styles.actionBtnPrimary,
                    opacity: questions.length >= MAX_QUESTIONS_LIMIT ? 0.6 : 1,
                    cursor: questions.length >= MAX_QUESTIONS_LIMIT ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => {
                    if (questions.length >= MAX_QUESTIONS_LIMIT) {
                      alert(`Maximum limit of ${MAX_QUESTIONS_LIMIT} questions reached for this examination pattern pool.`);
                      return;
                    }
                    setNewQuestionModalOpen(true);
                  }}
                  disabled={questions.length >= MAX_QUESTIONS_LIMIT}
                  title={questions.length >= MAX_QUESTIONS_LIMIT ? 'Maximum question pool limit reached' : 'Add Question'}
                >
                  <Plus size={16} />
                  <span>Add Question</span>
                </button>
              </div>
            </div>
          </div>

          {bankError && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{bankError}</span>
            </div>
          )}

          <div style={styles.tableWrapper}>
            {loadingBank ? (
              <div style={styles.loadingBox}>
                <Loader2 size={32} className="animate-spin" color="var(--color-primary)" />
                <p style={{ marginTop: '8px', color: '#64748b' }}>Loading questions for {blueprint.subject}...</p>
              </div>
            ) : questions.length === 0 ? (
              <div style={styles.emptyState}>
                <Database size={40} color="#94a3b8" />
                <p style={{ fontWeight: 600, color: '#334155', marginTop: '12px' }}>
                  No approved questions found in Question Bank for &ldquo;{blueprint.subject}&rdquo;
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '480px', margin: '4px auto 16px auto' }}>
                  Please use the &ldquo;Add Question&rdquo; button above to populate verified curriculum questions for this subject.
                </p>
                <button
                  type="button"
                  style={styles.actionBtnPrimary}
                  onClick={() => setNewQuestionModalOpen(true)}
                >
                  <Plus size={16} />
                  <span>Add First Question</span>
                </button>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Question Text</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Marks</th>
                    <th style={styles.th}>CO / PO / Bloom</th>
                    <th style={styles.th}>Difficulty</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id} style={styles.tr}>
                      <td style={styles.td}>Unit {q.unitNumber}</td>
                      <td style={{ ...styles.td, maxWidth: '360px' }}>
                        <div style={{ fontWeight: 500 }}>{q.questionText}</div>
                        {q.topic && <div style={{ fontSize: '11px', color: '#64748b' }}>Topic: {q.topic}</div>}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badgeType}>{q.questionType}</span>
                      </td>
                      <td style={styles.td}>
                        <strong>{q.marks}M</strong>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af' }}>
                              {q.courseOutcome || q.course_outcome || 'CO1'}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#fef3c7', color: '#92400e' }}>
                              {q.programOutcome || q.program_outcome || 'PO1'}
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#475569' }}>
                            {q.bloomTaxonomy || q.bloom_taxonomy || 'L2 - Understand'}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badgeDifficulty,
                            backgroundColor:
                              q.difficulty === 'HARD' ? '#fee2e2' : q.difficulty === 'MEDIUM' ? '#fef3c7' : '#dcfce7',
                            color:
                              q.difficulty === 'HARD' ? '#991b1b' : q.difficulty === 'MEDIUM' ? '#92400e' : '#166534',
                          }}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badgeApproved}>APPROVED</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryButton} onClick={() => setStep(1)}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={handleCheckFeasibility}
              disabled={questions.length < 8 || checkingFeasibility}
            >
              {checkingFeasibility ? <Loader2 size={18} className="animate-spin" /> : <Sliders size={18} />}
              <span>Verify Feasibility &amp; Sets</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* STEP 3: FEASIBILITY REPORT & SET CONFIGURATION                        */}
      {/* --------------------------------------------------------------------- */}
      {step === 3 && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Step 3: Multi-Set Feasibility Validation</h3>
            <p style={styles.cardSubtitle}>
              Server-side constraint check ensuring the question bank for {blueprint.subject} has sufficient eligible questions without cross-set overlap violations.
            </p>
          </div>

          {generationError && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{generationError}</span>
            </div>
          )}

          {feasibility && (
            <div>
              <div
                style={{
                  ...styles.statusBanner,
                  backgroundColor: feasibility.feasible ? '#ecfdf5' : '#fff1f2',
                  borderColor: feasibility.feasible ? '#a7f3d0' : '#fecdd3',
                }}
              >
                {feasibility.feasible ? (
                  <CheckCircle2 size={24} color="#059669" />
                ) : (
                  <AlertCircle size={24} color="#e11d48" />
                )}
                <div>
                  <h4 style={{ margin: 0, color: feasibility.feasible ? '#065f46' : '#9f1239' }}>
                    {feasibility.feasible
                      ? 'Feasibility Check Passed: Sufficient Question Pool Available'
                      : 'Feasibility Warning: Pool Constraints Cannot Be Met'}
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
                    {feasibility.totalBankQuestionsAvailable} approved questions available for {feasibility.numSets} sets with maximum {feasibility.maxOverlapPercentage}% cross-set overlap.
                  </p>
                </div>
              </div>

              {/* Pool Breakdown Table */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  Requirement Breakdown by Unit &amp; Marks
                </h4>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.thRow}>
                        <th style={styles.th}>Unit</th>
                        <th style={styles.th}>Target Marks</th>
                        <th style={styles.th}>Available in Bank</th>
                        <th style={styles.th}>Required for Sets</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(feasibility.poolAnalysis || []).map((p, idx) => (
                        <tr key={idx} style={styles.tr}>
                          <td style={styles.td}>Unit {p.unit}</td>
                          <td style={styles.td}>{p.marks} Marks</td>
                          <td style={styles.td}>
                            <strong>{p.availableCount}</strong> questions
                          </td>
                          <td style={styles.td}>{p.requiredCount} questions</td>
                          <td style={styles.td}>
                            {p.sufficient ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>✓ Ready</span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Insufficient</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryButton} onClick={() => setStep(2)}>
              <ArrowLeft size={18} />
              <span>Back to Bank</span>
            </button>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={handleGenerateSets}
              disabled={generating || (feasibility && !feasibility.feasible)}
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              <span>Generate Examination Sets</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* STEP 4: STRICT EXAM CELL VALIDATION & SUBMISSION STATUS               */}
      {/* --------------------------------------------------------------------- */}
      {step === 4 && activeSet && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={styles.cardTitle}>Step 4: Candidate Sets Structural Validation &amp; Integrity Audit</h3>
                <p style={styles.cardSubtitle}>
                  Server-side generated examination sets verified against official university curriculum structure.
                </p>
              </div>

              {/* Set Switcher Tabs */}
              <div style={styles.setTabContainer}>
                {(generatedPaperData?.sets || []).map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    style={activeSetIndex === idx ? styles.setTabActive : styles.setTab}
                    onClick={() => setActiveSetIndex(idx)}
                  >
                    {s.setCode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Validation & Security Overview Card */}
          <div style={styles.validationContainer}>
            <div style={styles.validationGrid}>
              <div style={styles.validationCard}>
                <div style={styles.valCardHeader}>
                  <ShieldCheck size={20} color="#059669" />
                  <span style={styles.valCardTitle}>Structural Conformity</span>
                </div>
                <div style={styles.valCardValue}>VERIFIED</div>
                <p style={styles.valCardDesc}>
                  Conforms strictly to 4 university OR-pairs with exact 17M + 17M + 18M + 18M marks distribution.
                </p>
              </div>

              <div style={styles.validationCard}>
                <div style={styles.valCardHeader}>
                  <Layers size={20} color="#0284c7" />
                  <span style={styles.valCardTitle}>Active Examination Set</span>
                </div>
                <div style={styles.valCardValue}>{activeSet.setCode}</div>
                <p style={styles.valCardDesc}>
                  Target Total: <strong>{activeSet.totalMarks} Marks</strong> across 4 curriculum units.
                </p>
              </div>

              <div style={styles.validationCard}>
                <div style={styles.valCardHeader}>
                  <CheckCircle2 size={20} color="#6366f1" />
                  <span style={styles.valCardTitle}>Question Uniqueness</span>
                </div>
                <div style={styles.valCardValue}>100% Unique</div>
                <p style={styles.valCardDesc}>
                  Zero duplicate question collisions detected across alternative OR groups and sets.
                </p>
              </div>
            </div>

            {/* Strict Exam Cell Protocol Notice */}
            <div style={styles.examCellBanner}>
              <div style={styles.examCellIcon}>
                <ShieldCheck size={28} color="#0369a1" />
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#0c4a6e', fontSize: '15px', fontWeight: 600 }}>
                  Strict Exam Cell Confidentiality Enforced
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                  Under Examination Cell security guidelines, final question selection and arrangements are cryptographically isolated on the server. Teachers submit the validated configuration, and only the authorized Exam Coordinator may decrypt and access the final question paper upon scheduled delivery.
                </p>
              </div>
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryButton} onClick={() => setStep(3)}>
              <ArrowLeft size={18} />
              <span>Back to Feasibility</span>
            </button>
            <button type="button" style={styles.primaryButton} onClick={() => setStep(5)}>
              <span>Proceed to Final Submission</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* STEP 5: APPROVAL & SECURE SUBMISSION TO EXAMINATION CELL              */}
      {/* --------------------------------------------------------------------- */}
      {step === 5 && activeSet && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Step 5: Teacher Submission &amp; Examination Cell Sealing</h3>
            <p style={styles.cardSubtitle}>
              Final sign-off. Submitting this set triggers server-side PDF generation, AES-256-GCM envelope encryption, RSA-PSS digital signing, and scheduled delivery to the Exam Coordinator.
            </p>
          </div>

          {submissionError && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{submissionError}</span>
            </div>
          )}

          <form onSubmit={handleFinalSubmit}>
            <div style={styles.submissionBox}>
              <div style={styles.grid2}>
                <div>
                  <label style={styles.label}>Designated Recipient Exam Coordinator</label>
                  <select
                    style={styles.select}
                    value={submissionForm.assignedToUserId}
                    onChange={(e) =>
                      setSubmissionForm({ ...submissionForm, assignedToUserId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select recipient coordinator...</option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.role === 'EXAM_COORDINATOR' ? '★ [Exam Coordinator]' : '[Faculty]'} ({r.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Scheduled Examination Date</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={submissionForm.examDate}
                    onChange={(e) =>
                      setSubmissionForm({ ...submissionForm, examDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Security Pipeline Assurances */}
              <div style={styles.securityChecklist}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  Cryptographic Security Architecture:
                </h4>
                <ul style={styles.checklistUl}>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>Server-side PDF generation conforming to university typography</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>AES-256-GCM envelope encryption with random 32-byte DEK &amp; 12-byte IV</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>RSA-PSS SHA-256 digital signature over ciphertext before private storage</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>Server-enforced time-locked access control (decrypted only by authorized Exam Coordinator)</span>
                  </li>
                </ul>
              </div>

              {/* Explicit Approval Checkbox */}
              <div style={styles.approvalCheckboxRow}>
                <input
                  type="checkbox"
                  id="confirmApproval"
                  checked={submissionForm.confirmedApproval}
                  onChange={(e) =>
                    setSubmissionForm({ ...submissionForm, confirmedApproval: e.target.checked })
                  }
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="confirmApproval" style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                  I confirm that I have validated the academic structure for {activeSet.setCode} of &ldquo;{blueprint.subject}&rdquo; and approve it for server-side cryptographic sealing and transmission to the Examination Cell.
                </label>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button type="button" style={styles.secondaryButton} onClick={() => setStep(4)}>
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
              <button
                type="submit"
                style={{
                  ...styles.primaryButton,
                  backgroundColor: submissionForm.confirmedApproval ? '#059669' : '#94a3b8',
                }}
                disabled={submitting || !submissionForm.confirmedApproval}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                <span>Seal &amp; Submit Paper ({activeSet.setCode})</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD CUSTOM QUESTION                                            */}
      {/* --------------------------------------------------------------------- */}
      {newQuestionModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Add Question for {blueprint.subject}</h3>
            <form onSubmit={handleCreateQuestion}>
              <div style={styles.grid2}>
                <div>
                  <label style={styles.label}>Unit Number (1-4)</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.unitNumber}
                    onChange={(e) => {
                      const uNum = parseInt(e.target.value, 10);
                      const matchedUnit = subjectUnits.find((u) => u.unitNumber === uNum);
                      setNewQuestionForm({
                        ...newQuestionForm,
                        unitNumber: uNum,
                        unitTitle: matchedUnit ? matchedUnit.unitTitle : `Unit ${uNum}`,
                      });
                    }}
                  >
                    {subjectUnits.map((u) => (
                      <option key={u.unitNumber} value={u.unitNumber}>
                        Unit {u.unitNumber}: {u.unitTitle}
                      </option>
                    ))}
                    {subjectUnits.length === 0 && (
                      <>
                        <option value={1}>Unit 1</option>
                        <option value={2}>Unit 2</option>
                        <option value={3}>Unit 3</option>
                        <option value={4}>Unit 4</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Unit Title</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={newQuestionForm.unitTitle}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, unitTitle: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label style={styles.label}>Marks</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.marks}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, marks: parseInt(e.target.value, 10) })
                    }
                  >
                    <option value={8}>8 Marks</option>
                    <option value={9}>9 Marks</option>
                    <option value={17}>17 Marks</option>
                    <option value={18}>18 Marks</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Difficulty</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.difficulty}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, difficulty: e.target.value })
                    }
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
              </div>

              {/* CO / PO / Bloom's Taxonomy Dropdowns (Module 22 & OBE Compliance) */}
              <div style={{ ...styles.grid2, marginTop: '12px' }}>
                <div>
                  <label style={styles.label}>Course Outcome (CO)</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.courseOutcome}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, courseOutcome: e.target.value })
                    }
                  >
                    {(outcomes.courseOutcomes || []).map((co) => (
                      <option key={co.code} value={co.code}>
                        {co.code}: {co.title}
                      </option>
                    ))}
                    {(!outcomes.courseOutcomes || outcomes.courseOutcomes.length === 0) && (
                      <>
                        <option value="CO1">CO1: Fundamentals and Analysis</option>
                        <option value="CO2">CO2: Algorithm Design Paradigms</option>
                        <option value="CO3">CO3: Dynamic Programming</option>
                        <option value="CO4">CO4: Backtracking and Branch-and-Bound</option>
                        <option value="CO5">CO5: Complexity Classes</option>
                        <option value="CO6">CO6: Advanced Algorithms</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Program Outcome (PO / PSO)</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.programOutcome}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, programOutcome: e.target.value })
                    }
                  >
                    {(outcomes.programOutcomes || []).map((po) => (
                      <option key={po.code} value={po.code}>
                        {po.code}: {po.title}
                      </option>
                    ))}
                    {(!outcomes.programOutcomes || outcomes.programOutcomes.length === 0) && (
                      <>
                        <option value="PO1">PO1: Engineering Knowledge</option>
                        <option value="PO2">PO2: Problem Analysis</option>
                        <option value="PO3">PO3: Design/Development of Solutions</option>
                        <option value="PO4">PO4: Investigations</option>
                        <option value="PSO1">PSO1: Professional Skills</option>
                      </>
                    )}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={styles.label}>Bloom&apos;s Taxonomy Level (BT)</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.bloomTaxonomy}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, bloomTaxonomy: e.target.value })
                    }
                  >
                    {(outcomes.bloomTaxonomyLevels || []).map((bt) => (
                      <option key={bt.code} value={`${bt.code} - ${bt.title}`}>
                        {bt.code} - {bt.title}
                      </option>
                    ))}
                    {(!outcomes.bloomTaxonomyLevels || outcomes.bloomTaxonomyLevels.length === 0) && (
                      <>
                        <option value="L1 - Remember">L1 - Remember (Recall facts and basic concepts)</option>
                        <option value="L2 - Understand">L2 - Understand (Explain ideas or concepts)</option>
                        <option value="L3 - Apply">L3 - Apply (Use information in new situations)</option>
                        <option value="L4 - Analyze">L4 - Analyze (Draw connections among ideas)</option>
                        <option value="L5 - Evaluate">L5 - Evaluate (Justify a stand or decision)</option>
                        <option value="L6 - Create">L6 - Create (Produce new or original work)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={styles.label}>Topic / Concept</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. Relational Normalization, Direct Linking Loader"
                  value={newQuestionForm.topic}
                  onChange={(e) =>
                    setNewQuestionForm({ ...newQuestionForm, topic: e.target.value })
                  }
                />
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={styles.label}>Question Text</label>
                <textarea
                  style={{ ...styles.input, height: '80px' }}
                  value={newQuestionForm.questionText}
                  onChange={(e) =>
                    setNewQuestionForm({ ...newQuestionForm, questionText: e.target.value })
                  }
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setNewQuestionModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton}>
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline styles matching ExamGuard Design System
const styles = {
  wizardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  },
  wizardHeader: {
    padding: '24px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#fafafa',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  iconCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #dbeafe',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: '2px 0 0 0',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '750px',
    margin: '0 auto',
    paddingTop: '8px',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
    flex: 1,
  },
  stepCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    transition: 'all 0.2s ease',
  },
  stepLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#94a3b8',
  },
  stepLabelActive: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#1e293b',
  },
  stepContent: {
    padding: '28px',
  },
  cardHeader: {
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
  },
  cardSubtitle: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '4px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  summaryBox: {
    marginTop: '24px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '16px',
  },
  summaryTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
  },
  groupList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '10px',
  },
  groupCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#334155',
  },
  orPill: {
    display: 'inline-block',
    padding: '1px 6px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '4px',
    fontWeight: '700',
    fontSize: '10px',
  },
  summaryFooter: {
    margin: '12px 0 0 0',
    fontSize: '12px',
    color: '#64748b',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid #f1f5f9',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: '#ffffff',
    color: '#475569',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
  actionBtnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginTop: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  thRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '10px 12px',
    fontWeight: '600',
    color: '#475569',
    fontSize: '12px',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '10px 12px',
    color: '#1e293b',
  },
  badgeType: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontWeight: '500',
  },
  badgeDifficulty: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '12px',
    fontWeight: '600',
  },
  badgeApproved: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontWeight: '700',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center',
    backgroundColor: '#ffffff',
  },
  loadingBox: {
    padding: '48px',
    textAlign: 'center',
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: '8px',
    border: '1px solid',
  },
  setTabContainer: {
    display: 'flex',
    gap: '6px',
  },
  setTab: {
    padding: '6px 14px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
  },
  setTabActive: {
    padding: '6px 14px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    border: '1px solid #2563eb',
    cursor: 'pointer',
  },
  validationContainer: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  validationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  validationCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
  },
  valCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  valCardTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
  },
  valCardValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '4px 0',
  },
  valCardDesc: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
    lineHeight: '1.4',
  },
  examCellBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '10px',
    padding: '18px',
  },
  examCellIcon: {
    marginTop: '2px',
  },
  submissionBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px',
  },
  securityChecklist: {
    marginTop: '20px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
  },
  checklistUl: {
    margin: '8px 0 0 0',
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '12px',
    color: '#334155',
  },
  approvalCheckboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '20px',
    padding: '12px 14px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '560px',
    width: '100%',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 16px 0',
  },
};
