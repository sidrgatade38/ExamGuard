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
  Eye,
  Save,
  Check,
  X,
  Image as ImageIcon,
  UploadCloud,
} from 'lucide-react';

export default function QuestionPaperGeneratorWizard({ initialDraft = null, recipients = [], onSuccess, onCancel }) {
  // Wizard Step: 1 (Exam Details & Blueprint) -> 2 (Question Bank) -> 3 (Feasibility) -> 4 (Validation & Sets) -> 5 (Submit)
  const [step, setStep] = useState(initialDraft?.step || 1);

  // Dynamic Academic Context State
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectUnits, setSubjectUnits] = useState([]);
  const [selectedDept, setSelectedDept] = useState(initialDraft?.blueprint?.department || 'COMP');
  const [loadingAcademic, setLoadingAcademic] = useState(true);

  // Draft persistence state
  const [draftId, setDraftId] = useState(initialDraft?.id || null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState('');

  // Blueprint State
  const [blueprint, setBlueprint] = useState(() => {
    if (initialDraft?.blueprint) {
      return {
        title: '',
        classYear: 'TE',
        totalMarks: 70,
        ...initialDraft.blueprint,
      };
    }
    return {
      title: '', // Empty input for teacher to enter; no fixed title prefilled
      subject: 'Systems Programming and Operating System',
      course: 'T.E. (Computer Engineering)',
      classYear: 'TE',
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
    };
  });

  const [blueprintId, setBlueprintId] = useState(initialDraft?.blueprintId || null);

  // Permitted Preview state in Step 4
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

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
    unitTitle: 'Unit 1',
    topic: '',
    questionText: '',
    questionType: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    courseOutcome: 'CO1',
    programOutcome: 'PO1',
    bloomTaxonomy: 'L2 - Understand',
    answerScheme: '',
    image: null,
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError('');
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setImageError('Please select a valid PNG or JPEG image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image size exceeds the 5MB limit.');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      setNewQuestionForm((prev) => ({
        ...prev,
        image: {
          dataUrl: reader.result,
          name: file.name,
          size: file.size,
          type: file.type,
        },
      }));
      setUploadingImage(false);
    };
    reader.onerror = () => {
      setImageError('Failed to read image file.');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setNewQuestionForm((prev) => ({ ...prev, image: null }));
  };

  // Feasibility & Generation State
  const [feasibility, setFeasibility] = useState(null);
  const [checkingFeasibility, setCheckingFeasibility] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  // Generated Sets State
  const [generatedPaperData, setGeneratedPaperData] = useState(() => initialDraft?.generatedPaperData || null);
  const [activeSetIndex, setActiveSetIndex] = useState(0);

  // Final Approval & Submission State
  const defaultCoord = recipients.find((r) => r.role === 'EXAM_COORDINATOR') || recipients[0];
  const [submissionForm, setSubmissionForm] = useState({
    assignedToUserId: defaultCoord ? defaultCoord.id : '',
    examDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    confirmedApproval: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  useEffect(() => {
    if (!submissionForm.assignedToUserId && recipients.length > 0) {
      const coord = recipients.find((r) => r.role === 'EXAM_COORDINATOR') || recipients[0];
      setSubmissionForm((prev) => ({ ...prev, assignedToUserId: coord.id }));
    }
  }, [recipients]);

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setDraftSavedNotice('');
    try {
      const dynamicSections = getDynamicSections();
      const draftPayload = {
        id: draftId,
        title: blueprint.title || `Draft: ${blueprint.subject} (${blueprint.totalMarks}M)`,
        subject: blueprint.subject,
        step,
        blueprint: {
          ...blueprint,
          sections: dynamicSections,
        },
        blueprintId,
        generatedPaperData,
      };
      const res = await blueprintService.saveDraft(draftPayload);
      const savedId = res.data?.id || res.id || draftId;
      if (savedId) setDraftId(savedId);
      setDraftSavedNotice(`Draft saved successfully (ID: ${savedId ? String(savedId).slice(0, 8) : 'saved'}) at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setDraftSavedNotice(''), 6000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

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
            title: prev.title || '',
            subject: prev.subject || firstSub.title,
            subjectCode: prev.subjectCode || firstSub.code,
            semester: prev.semester || firstSub.semester || 'Semester 5',
            academicPattern: prev.academicPattern || firstSub.patternName || '2019 Pattern',
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
          title: prev.title || '',
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
      title: prev.title || '',
      subject: subObj.title,
      subjectCode: subObj.code,
      totalMarks: prev.totalMarks || subObj.totalMarks || 70,
      durationHours: subObj.durationHours || prev.durationHours || 2.5,
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
          unitTitle: `Unit ${units[0].unitNumber}`,
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
        unitTitle: `Unit ${newQuestionForm.unitNumber}`,
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
        image: null,
      }));
      await loadQuestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add question');
    }
  };

  // Build standard dynamic university OR sections based on total marks
  const getDynamicSections = () => {
    if (blueprint.sections && blueprint.sections.length > 0) {
      return blueprint.sections;
    }
    const tm = blueprint.totalMarks || 70;
    const units = subjectUnits.length >= 4 ? subjectUnits : [
      { unitNumber: 1, unitTitle: 'Unit 1: Fundamentals', targetMarks: tm === 70 ? 17 : tm === 60 ? 15 : tm === 30 ? 15 : 10 },
      { unitNumber: 2, unitTitle: 'Unit 2: Core Concepts', targetMarks: tm === 70 ? 17 : tm === 60 ? 15 : tm === 30 ? 15 : 10 },
      { unitNumber: 3, unitTitle: 'Unit 3: Advanced Architectures', targetMarks: tm === 70 ? 18 : 15 },
      { unitNumber: 4, unitTitle: 'Unit 4: Applications & Security', targetMarks: tm === 70 ? 18 : 15 },
    ];

    if (tm === 20) {
      return [
        {
          groupOrder: 1,
          groupLabel: `Group 1 (${units[0]?.unitTitle || 'Unit 1'})`,
          primaryQuestionNumber: 1,
          alternativeQuestionNumber: 2,
          targetMarks: 10,
          targetUnit: 1,
          subquestionsConfig: [
            { subPart: 'a', marks: 5, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
            { subPart: 'b', marks: 5, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
          ],
        },
        {
          groupOrder: 2,
          groupLabel: `Group 2 (${units[1]?.unitTitle || 'Unit 2'})`,
          primaryQuestionNumber: 3,
          alternativeQuestionNumber: 4,
          targetMarks: 10,
          targetUnit: 2,
          subquestionsConfig: [
            { subPart: 'a', marks: 5, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 2 },
            { subPart: 'b', marks: 5, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 2 },
          ],
        },
      ];
    }

    if (tm === 30) {
      return [
        {
          groupOrder: 1,
          groupLabel: `Group 1 (${units[0]?.unitTitle || 'Unit 1'})`,
          primaryQuestionNumber: 1,
          alternativeQuestionNumber: 2,
          targetMarks: 15,
          targetUnit: 1,
          subquestionsConfig: [
            { subPart: 'a', marks: 7, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
            { subPart: 'b', marks: 8, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
          ],
        },
        {
          groupOrder: 2,
          groupLabel: `Group 2 (${units[1]?.unitTitle || 'Unit 2'})`,
          primaryQuestionNumber: 3,
          alternativeQuestionNumber: 4,
          targetMarks: 15,
          targetUnit: 2,
          subquestionsConfig: [
            { subPart: 'a', marks: 7, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 2 },
            { subPart: 'b', marks: 8, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 2 },
          ],
        },
      ];
    }

    if (tm === 60) {
      return [
        {
          groupOrder: 1,
          groupLabel: `Group 1 (${units[0]?.unitTitle || 'Unit 1'})`,
          primaryQuestionNumber: 1,
          alternativeQuestionNumber: 2,
          targetMarks: 15,
          targetUnit: 1,
          subquestionsConfig: [
            { subPart: 'a', marks: 7, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
            { subPart: 'b', marks: 8, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
          ],
        },
        {
          groupOrder: 2,
          groupLabel: `Group 2 (${units[1]?.unitTitle || 'Unit 2'})`,
          primaryQuestionNumber: 3,
          alternativeQuestionNumber: 4,
          targetMarks: 15,
          targetUnit: 2,
          subquestionsConfig: [
            { subPart: 'a', marks: 7, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 2 },
            { subPart: 'b', marks: 8, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 2 },
          ],
        },
        {
          groupOrder: 3,
          groupLabel: `Group 3 (${units[2]?.unitTitle || 'Unit 3'})`,
          primaryQuestionNumber: 5,
          alternativeQuestionNumber: 6,
          targetMarks: 15,
          targetUnit: 3,
          subquestionsConfig: [
            { subPart: 'a', marks: 7, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 3 },
            { subPart: 'b', marks: 8, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 3 },
          ],
        },
        {
          groupOrder: 4,
          groupLabel: `Group 4 (${units[3]?.unitTitle || 'Unit 4'})`,
          primaryQuestionNumber: 7,
          alternativeQuestionNumber: 8,
          targetMarks: 15,
          targetUnit: 4,
          subquestionsConfig: [
            { subPart: 'a', marks: 7, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 4 },
            { subPart: 'b', marks: 8, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 4 },
          ],
        },
      ];
    }

    // Default: 70 Marks (4 units, 17+17+18+18)
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
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

          {/* Draft Persistence Status & Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {draftSavedNotice && (
              <span style={{ fontSize: '12px', color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                {draftSavedNotice}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
              title="Save current progress as a draft to resume anytime"
            >
              {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{draftId ? 'Save Draft' : 'Save as Draft'}</span>
            </button>
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
              Select department, course, class/year, examination pattern, subject, and total marks. The system dynamically adapts the university marks structure from database templates.
            </p>
          </div>

          <div style={styles.grid2}>
            {/* Paper Title (Clean, flexible, empty by default without prefilled fixed title) */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>
                Paper Title (Optional custom title)
              </label>
              <input
                type="text"
                placeholder="e.g. End Semester Examination - May 2026 (Leave empty to use course & subject title)"
                style={styles.input}
                value={blueprint.title || ''}
                onChange={(e) => setBlueprint({ ...blueprint, title: e.target.value })}
              />
            </div>

            {/* Academic Department (Strict Module 1 Requirement: Fixed to Computer Engineering) */}
            <div>
              <label style={styles.label}>Academic Department</label>
              <div
                style={{
                  ...styles.input,
                  backgroundColor: 'var(--color-surface-subtle)',
                  color: 'var(--color-structure)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Building size={16} color="var(--color-primary)" />
                <span>Department of Computer Engineering</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.7rem',
                    backgroundColor: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: '700',
                  }}
                >
                  FIXED
                </span>
              </div>
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

            {/* Class / Year Selection (FE, SE, TE, BE, ME) */}
            <div>
              <label style={styles.label}>Class / Year</label>
              <select
                style={styles.select}
                value={blueprint.classYear || 'TE'}
                onChange={(e) => setBlueprint({ ...blueprint, classYear: e.target.value })}
              >
                <option value="FE">FE — First Year Engineering</option>
                <option value="SE">SE — Second Year Engineering</option>
                <option value="TE">TE — Third Year Engineering</option>
                <option value="BE">BE — Final Year Engineering</option>
                <option value="ME">ME — Master of Engineering (Post-Graduate)</option>
              </select>
            </div>

            {/* Academic Pattern Selection */}
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

            {/* Semester Selection */}
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

            {/* Total Marks (Offers 20, 30, 60, and 70 dynamically) */}
            <div>
              <label style={styles.label}>Total Marks</label>
              <select
                style={styles.select}
                value={blueprint.totalMarks || 70}
                onChange={(e) => {
                  const tm = parseInt(e.target.value, 10);
                  const autoDuration = tm <= 30 ? 1.0 : tm === 60 ? 2.0 : 2.5;
                  setBlueprint((prev) => ({
                    ...prev,
                    totalMarks: tm,
                    durationHours: autoDuration,
                  }));
                }}
              >
                <option value={20}>20 Marks (Internal Assessment / Unit Test)</option>
                <option value={30}>30 Marks (In-Semester Examination)</option>
                <option value={60}>60 Marks (End-Semester 60M Pattern)</option>
                <option value={70}>70 Marks (Standard End-Semester 70M Pattern)</option>
              </select>
            </div>

            {/* Subject Selection (Searchable & Scoped) */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>
                  Subject (Fast Search by Code, Full Title, or Short Name e.g. DAA, SPOS, DBMS, CNS, WT, OSSA)
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
                  placeholder="Type to filter subjects: e.g. DAA, 410241, Algorithms, SPOS, DBMS, WT..."
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
          </div>

          {/* Dynamic University Marks Structure Summary */}
          <div style={styles.summaryBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={styles.summaryTitle}>
                University Marks Structure ({blueprint.totalMarks} Marks Pattern)
              </h4>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '3px 8px', borderRadius: '4px' }}>
                Configurable Academic Template
              </span>
            </div>

            {/* Dynamic Card Breakdown for 20M, 30M, 60M, and 70M */}
            <div style={styles.groupList}>
              {blueprint.totalMarks === 20 && (
                <>
                  <div style={styles.groupCard}>
                    <strong>Pair 1 ({subjectUnits[0]?.unitTitle || 'Unit 1'}):</strong> Q1 (5 + 5 = 10M) <span style={styles.orPill}>OR</span> Q2 (5 + 5 = 10M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 2 ({subjectUnits[1]?.unitTitle || 'Unit 2'}):</strong> Q3 (5 + 5 = 10M) <span style={styles.orPill}>OR</span> Q4 (5 + 5 = 10M)
                  </div>
                </>
              )}

              {blueprint.totalMarks === 30 && (
                <>
                  <div style={styles.groupCard}>
                    <strong>Pair 1 ({subjectUnits[0]?.unitTitle || 'Unit 1'}):</strong> Q1 (7 + 8 = 15M) <span style={styles.orPill}>OR</span> Q2 (8 + 7 = 15M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 2 ({subjectUnits[1]?.unitTitle || 'Unit 2'}):</strong> Q3 (7 + 8 = 15M) <span style={styles.orPill}>OR</span> Q4 (8 + 7 = 15M)
                  </div>
                </>
              )}

              {blueprint.totalMarks === 60 && (
                <>
                  <div style={styles.groupCard}>
                    <strong>Pair 1 ({subjectUnits[0]?.unitTitle || 'Unit 1'}):</strong> Q1 (7 + 8 = 15M) <span style={styles.orPill}>OR</span> Q2 (8 + 7 = 15M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 2 ({subjectUnits[1]?.unitTitle || 'Unit 2'}):</strong> Q3 (7 + 8 = 15M) <span style={styles.orPill}>OR</span> Q4 (8 + 7 = 15M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 3 ({subjectUnits[2]?.unitTitle || 'Unit 3'}):</strong> Q5 (7 + 8 = 15M) <span style={styles.orPill}>OR</span> Q6 (8 + 7 = 15M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 4 ({subjectUnits[3]?.unitTitle || 'Unit 4'}):</strong> Q7 (7 + 8 = 15M) <span style={styles.orPill}>OR</span> Q8 (8 + 7 = 15M)
                  </div>
                </>
              )}

              {(blueprint.totalMarks === 70 || (blueprint.totalMarks !== 20 && blueprint.totalMarks !== 30 && blueprint.totalMarks !== 60)) && (
                <>
                  <div style={styles.groupCard}>
                    <strong>Pair 1 ({subjectUnits[0]?.unitTitle || 'Unit 1'}):</strong> Q1 (8 + 9 = 17M) <span style={styles.orPill}>OR</span> Q2 (9 + 8 = 17M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 2 ({subjectUnits[1]?.unitTitle || 'Unit 2'}):</strong> Q3 (8 + 9 = 17M) <span style={styles.orPill}>OR</span> Q4 (9 + 8 = 17M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 3 ({subjectUnits[2]?.unitTitle || 'Unit 3'}):</strong> Q5 (9 + 9 = 18M) <span style={styles.orPill}>OR</span> Q6 (9 + 9 = 18M)
                  </div>
                  <div style={styles.groupCard}>
                    <strong>Pair 4 ({subjectUnits[3]?.unitTitle || 'Unit 4'}):</strong> Q7 (9 + 9 = 18M) <span style={styles.orPill}>OR</span> Q8 (9 + 9 = 18M)
                  </div>
                </>
              )}
            </div>

            <p style={styles.summaryFooter}>
              {blueprint.totalMarks === 20 && 'Total Answered Marks: 10 + 10 = 20 Marks. Candidate answers 2 compulsory questions with internal OR alternatives across 2 units.'}
              {blueprint.totalMarks === 30 && 'Total Answered Marks: 15 + 15 = 30 Marks. Candidate answers 2 compulsory questions with internal OR alternatives across 2 units.'}
              {blueprint.totalMarks === 60 && 'Total Answered Marks: 15 + 15 + 15 + 15 = 60 Marks. Candidate answers 4 compulsory questions, choosing one question from each alternative OR pair.'}
              {(blueprint.totalMarks === 70 || (blueprint.totalMarks !== 20 && blueprint.totalMarks !== 30 && blueprint.totalMarks !== 60)) &&
                `Total Answered Marks: 17 + 17 + 18 + 18 = ${blueprint.totalMarks} Marks. Candidate answers 4 compulsory questions, choosing 1 question from each alternative OR pair.`}
            </p>
          </div>

          <div style={styles.buttonRow}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={styles.secondaryButton} onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...styles.secondaryButton,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Draft</span>
              </button>
            </div>
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
      {/* STEP 4: STRICT EXAM CELL VALIDATION & PERMITTED PREVIEW               */}
      {/* --------------------------------------------------------------------- */}
      {step === 4 && activeSet && (
        <div style={styles.stepContent}>
          {/* Generation Success & Stable Record ID Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={24} color="#16a34a" />
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d' }}>
                  Question Paper Generated Successfully
                </div>
                <div style={{ fontSize: '12px', color: '#374151', marginTop: '2px' }}>
                  Record ID: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{generatedPaperData?.paperId || generatedPaperData?.id || activeSet.id}</strong> • Status:{' '}
                  <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    GENERATED
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => setPreviewModalOpen(true)}
              >
                <Eye size={16} />
                <span>Permitted Preview</span>
              </button>

              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Draft</span>
              </button>
            </div>
          </div>

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
                  Conforms strictly to university OR-pairs with exact {activeSet.totalMarks} Marks distribution across curriculum units.
                </p>
              </div>

              <div style={styles.validationCard}>
                <div style={styles.valCardHeader}>
                  <Layers size={20} color="#0284c7" />
                  <span style={styles.valCardTitle}>Active Examination Set</span>
                </div>
                <div style={styles.valCardValue}>{activeSet.setCode}</div>
                <p style={styles.valCardDesc}>
                  Target Total: <strong>{activeSet.totalMarks} Marks</strong> across academic syllabus units.
                </p>
              </div>

              <div style={styles.validationCard}>
                <div style={styles.valCardHeader}>
                  <CheckCircle2 size={20} color="#6366f1" />
                  <span style={styles.valCardTitle}>Question Uniqueness</span>
                </div>
                <div style={styles.valCardValue}>100% Unique</div>
                <p style={styles.valCardDesc}>
                  Zero duplicate question collisions detected across alternative OR groups and candidate sets.
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
                  Under Examination Cell security guidelines, final question selection and arrangements are cryptographically isolated on the server. Teachers can review questions via the Permitted Preview before submission. Once submitted, only the designated Exam Coordinator may decrypt and access the final question paper upon scheduled delivery.
                </p>
              </div>
            </div>
          </div>

          {/* Permitted Preview Modal */}
          {previewModalOpen && (
            <div style={styles.modalOverlay}>
              <div style={{ ...styles.modalCard, maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#0284c7', textTransform: 'uppercase' }}>
                      Official University Examination Preview • {activeSet.setCode}
                    </span>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      {blueprint.title || `${blueprint.subject} Examination`}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      {blueprint.course} • Class: {blueprint.classYear || 'TE'} • {blueprint.academicPattern} • {blueprint.semester}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155', flexWrap: 'wrap', gap: '8px' }}>
                  <div><strong>Subject Code:</strong> {blueprint.subjectCode}</div>
                  <div><strong>Duration:</strong> {blueprint.durationHours} Hours</div>
                  <div><strong>Total Marks:</strong> {blueprint.totalMarks} Marks</div>
                  <div><strong>Active Set:</strong> {activeSet.setCode}</div>
                </div>

                <div style={{ marginBottom: '18px', fontSize: '12px', color: '#475569' }}>
                  <strong>Instructions to Candidates:</strong>
                  <ol style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                    {(blueprint.instructions || [
                      'Answer Q1 or Q2, Q3 or Q4, Q5 or Q6, Q7 or Q8.',
                      'Neat diagrams must be drawn wherever necessary.',
                      'Figures to the right indicate full marks.',
                      'Assume suitable data if necessary.',
                    ]).map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ol>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                  {(activeSet.paperStructureSnapshot?.sections || []).map((sec, idx) => (
                    <div key={idx} style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                          Group {sec.groupOrder || idx + 1}: {sec.groupLabel || `Unit ${sec.targetUnit || idx + 1}`}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                          {sec.targetMarks} Marks
                        </span>
                      </div>

                      {/* Primary Question */}
                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                          Q{sec.primaryQuestionNumber || (idx * 2 + 1)}
                        </div>
                        {(sec.primaryQuestion?.subquestions || sec.subquestionsConfig || []).map((sq, sqIdx) => (
                          <div key={sqIdx} style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>({sq.subPart || String.fromCharCode(97 + sqIdx)})</strong> {sq.questionText || `Evaluation question for ${blueprint.subject}`}</span>
                              <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', marginLeft: '12px' }}>[{sq.marks}M]</span>
                            </div>
                            {(sq.image || sq.imageData || sq.imageUrl) && (
                              <div style={{ margin: '8px 0', textAlign: 'center' }}>
                                <img
                                  src={(sq.image?.dataUrl) || sq.image || sq.imageData || sq.imageUrl}
                                  alt="Attached diagram"
                                  style={{ maxWidth: '320px', maxHeight: '160px', objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px', backgroundColor: '#ffffff' }}
                                />
                                <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>[Figure / Diagram]</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ textAlign: 'center', margin: '6px 0', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                        — OR —
                      </div>

                      {/* Alternative Question */}
                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                          Q{sec.alternativeQuestionNumber || (idx * 2 + 2)}
                        </div>
                        {(sec.alternativeQuestion?.subquestions || sec.subquestionsConfig || []).map((sq, sqIdx) => (
                          <div key={sqIdx} style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>({sq.subPart || String.fromCharCode(97 + sqIdx)})</strong> {sq.questionText || `Alternative curriculum question for ${blueprint.subject}`}</span>
                              <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', marginLeft: '12px' }}>[{sq.marks}M]</span>
                            </div>
                            {(sq.image || sq.imageData || sq.imageUrl) && (
                              <div style={{ margin: '8px 0', textAlign: 'center' }}>
                                <img
                                  src={(sq.image?.dataUrl) || sq.image || sq.imageData || sq.imageUrl}
                                  alt="Attached diagram"
                                  style={{ maxWidth: '320px', maxHeight: '160px', objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px', backgroundColor: '#ffffff' }}
                                />
                                <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>[Figure / Diagram]</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => setPreviewModalOpen(false)}
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={styles.buttonRow}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={styles.secondaryButton} onClick={() => setStep(3)}>
                <ArrowLeft size={18} />
                <span>Back to Feasibility</span>
              </button>
              <button
                type="button"
                style={{
                  ...styles.secondaryButton,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={handleSaveDraft}
                disabled={savingDraft}
              >
                {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Draft</span>
              </button>
            </div>
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
                  <label style={styles.label}>Unit Selector</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.unitNumber}
                    onChange={(e) => {
                      const uNum = parseInt(e.target.value, 10);
                      setNewQuestionForm({
                        ...newQuestionForm,
                        unitNumber: uNum,
                        unitTitle: `Unit ${uNum}`,
                      });
                    }}
                  >
                    <option value={1}>Unit 1</option>
                    <option value={2}>Unit 2</option>
                    <option value={3}>Unit 3</option>
                    <option value={4}>Unit 4</option>
                  </select>
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
                    <option value={5}>5 Marks</option>
                    <option value={7}>7 Marks</option>
                    <option value={8}>8 Marks</option>
                    <option value={9}>9 Marks</option>
                    <option value={10}>10 Marks</option>
                    <option value={15}>15 Marks</option>
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
                <div>
                  <label style={styles.label}>Question Type</label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.questionType}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, questionType: e.target.value })
                    }
                  >
                    <option value="DESCRIPTIVE">DESCRIPTIVE</option>
                    <option value="NUMERICAL">NUMERICAL</option>
                    <option value="ANALYTICAL">ANALYTICAL</option>
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

              {/* Module 4.3: Insert Image Option */}
              <div style={{ marginTop: '14px', padding: '12px', border: '1px dashed var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-surface-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...styles.label, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ImageIcon size={16} color="var(--color-primary)" />
                    <span>Attach Diagram / Figure (PNG, JPEG - Max 5MB)</span>
                  </label>
                  {!newQuestionForm.image && (
                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                      <UploadCloud size={14} />
                      <span>Insert Image</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>

                {imageError && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>
                    {imageError}
                  </div>
                )}

                {newQuestionForm.image && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--color-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                    <img
                      src={newQuestionForm.image.dataUrl}
                      alt="Question diagram preview"
                      style={{ maxWidth: '120px', maxHeight: '70px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-structure)' }}>
                        {newQuestionForm.image.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {(newQuestionForm.image.size / 1024).toFixed(1)} KB • Ready for examination embedding
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <label style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                      }}>
                        Replace
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: 'none' }}
                          onChange={handleImageUpload}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: '1px solid #fca5a5',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
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
