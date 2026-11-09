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
  Edit3,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  Repeat,
  Settings,
  RotateCcw,
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

  // In-wizard notification toast
  const [wizardNotification, setWizardNotification] = useState({ type: '', message: '' });
  const showNotification = (message, type = 'error') => {
    setWizardNotification({ type, message });
    setTimeout(() => setWizardNotification({ type: '', message: '' }), 6000);
  };

  // Blueprint State - Pristine Clean Initial State for New Paper (Zero pre-filled values)
  const [blueprint, setBlueprint] = useState(() => {
    if (initialDraft?.blueprint || (initialDraft && initialDraft.subject)) {
      const bp = initialDraft.blueprint || initialDraft;
      return {
        title: bp.title || initialDraft.title || '',
        subject: bp.subject || initialDraft.subject || '',
        course: bp.course || initialDraft.course || '',
        classYear: bp.classYear || initialDraft.classYear || '',
        semester: bp.semester || initialDraft.semester || '',
        academicPattern: bp.academicPattern || initialDraft.academicPattern || '',
        subjectCode: bp.subjectCode || initialDraft.subjectCode || '',
        durationHours: bp.durationHours ?? initialDraft.durationHours ?? '',
        totalMarks: bp.totalMarks ?? initialDraft.totalMarks ?? '',
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
      course: '',
      classYear: '',
      semester: '',
      academicPattern: '',
      subjectCode: '',
      durationHours: '',
      totalMarks: '',
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
  });

  const [blueprintId, setBlueprintId] = useState(initialDraft?.blueprintId || null);

  // Custom Field Toggle States for Step 1
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [isCustomCourse, setIsCustomCourse] = useState(false);
  const [isCustomClassYear, setIsCustomClassYear] = useState(false);
  const [isCustomPattern, setIsCustomPattern] = useState(false);
  const [isCustomSemester, setIsCustomSemester] = useState(false);
  const [isCustomMarks, setIsCustomMarks] = useState(false);

  // Marks Structure Customization State
  const [customStructureModalOpen, setCustomStructureModalOpen] = useState(false);
  const [customSectionsDraft, setCustomSectionsDraft] = useState([]);
  const [isStructureCustomized, setIsStructureCustomized] = useState(Boolean(initialDraft?.blueprint?.sections?.length));

  // Add Subject Modal State
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [newSubjectForm, setNewSubjectForm] = useState({
    title: '',
    code: '',
    shortName: '',
    classYear: 'TE',
    semester: 'Semester 5',
    patternName: '2019',
    totalMarks: 70,
    durationHours: 2.5,
  });
  const [savingSubject, setSavingSubject] = useState(false);

  // Permitted Preview state in Step 4
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Question Bank State
  const [questions, setQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankError, setBankError] = useState('');
  const [newQuestionModalOpen, setNewQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [paperTitlesList, setPaperTitlesList] = useState([
    { id: 'obt', title: 'Open Book Test' },
    { id: 'cce', title: 'CCE Exam' },
    { id: 'endsem', title: 'End Sem Exam' },
    { id: 'insem', title: 'In-Sem Exam' },
    { id: 'ut1', title: 'Unit Test 1' },
    { id: 'ut2', title: 'Unit Test 2' },
    { id: 'prelim', title: 'Preliminary Exam' },
    { id: 'reexam', title: 'Re-Examination' },
  ]);
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

  // Clean initial state for question creation (No pre-selected values)
  const [newQuestionForm, setNewQuestionForm] = useState({
    unitNumber: '',
    unitTitle: '',
    topic: '',
    questionText: '',
    questionType: 'DESCRIPTIVE',
    marks: '',
    difficulty: '',
    courseOutcome: '',
    programOutcome: '',
    bloomTaxonomy: '',
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

  // Step 4 Question Editing & Shared Pool Replacement State (Sprint Section 6 & 7)
  const [replacingTarget, setReplacingTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [editingQuestionForm, setEditingQuestionForm] = useState({
    questionText: '',
    marks: 8,
    difficulty: 'MEDIUM',
    bloomTaxonomy: 'L2 - Understand',
    subquestions: [],
  });
  const [poolFilter, setPoolFilter] = useState({ unit: '', difficulty: '', search: '' });

  // Recalculate numbering and marks for a set
  const recalculateSetStructure = (setObj) => {
    let runningNum = 1;
    let totalMarks = 0;
    const sections = (setObj.paperStructureSnapshot?.sections || []).map((sec, idx) => {
      const primaryNum = runningNum++;
      let altNum = null;
      let secMarks = 0;

      const pSubs = sec.primaryQuestion?.subquestions || sec.subquestionsConfig || [];
      let pMarks = 0;
      if (pSubs.length > 0) {
        pMarks = pSubs.reduce((acc, sq) => acc + (Number(sq.marks) || 0), 0);
      } else {
        pMarks = Number(sec.primaryQuestion?.marks) || Number(sec.targetMarks) || 8;
      }
      secMarks = pMarks;

      if (sec.alternativeQuestion) {
        altNum = runningNum++;
        const aSubs = sec.alternativeQuestion?.subquestions || sec.subquestionsConfig || [];
        let aMarks = 0;
        if (aSubs.length > 0) {
          aMarks = aSubs.reduce((acc, sq) => acc + (Number(sq.marks) || 0), 0);
        } else {
          aMarks = Number(sec.alternativeQuestion?.marks) || Number(sec.targetMarks) || pMarks;
        }
        secMarks = Math.max(pMarks, aMarks);
      }

      totalMarks += secMarks;
      return {
        ...sec,
        groupOrder: idx + 1,
        primaryQuestionNumber: primaryNum,
        alternativeQuestionNumber: altNum,
        targetMarks: secMarks,
      };
    });

    return {
      ...setObj,
      totalMarks,
      paperStructureSnapshot: {
        ...setObj.paperStructureSnapshot,
        sections,
      },
    };
  };

  const updateActiveSet = (updater) => {
    setGeneratedPaperData((prev) => {
      if (!prev || !prev.sets) return prev;
      const newSets = [...prev.sets];
      const curSet = newSets[activeSetIndex];
      if (!curSet) return prev;

      const updatedSet = updater(curSet);
      newSets[activeSetIndex] = recalculateSetStructure(updatedSet);
      return {
        ...prev,
        sets: newSets,
      };
    });
  };

  const handleSelectReplacement = (repQ) => {
    if (!replacingTarget) return;
    const { sectionIndex, questionRole } = replacingTarget;
    updateActiveSet((curSet) => {
      const sections = [...(curSet.paperStructureSnapshot?.sections || [])];
      const sec = { ...sections[sectionIndex] };
      const newQObj = {
        id: repQ.id,
        questionText: repQ.questionText,
        marks: repQ.marks,
        difficulty: repQ.difficulty,
        courseOutcome: repQ.courseOutcome || repQ.course_outcome || 'CO1',
        programOutcome: repQ.programOutcome || repQ.program_outcome || 'PO1',
        bloomTaxonomy: repQ.bloomTaxonomy || repQ.bloom_taxonomy || 'L2 - Understand',
        sourceSet: repQ.source_set || repQ.sourceSet || curSet.setCode,
        authorName: repQ.author_name || repQ.authorName || 'Computer Engineering Faculty',
        image: repQ.image || repQ.imageData || repQ.imageUrl,
        subquestions: repQ.subquestions || [
          { subPart: 'a', questionText: repQ.questionText, marks: repQ.marks, image: repQ.image }
        ],
      };
      if (questionRole === 'primary') {
        sec.primaryQuestion = newQObj;
      } else {
        sec.alternativeQuestion = newQObj;
      }
      sections[sectionIndex] = sec;
      return {
        ...curSet,
        paperStructureSnapshot: {
          ...curSet.paperStructureSnapshot,
          sections,
        },
      };
    });
    setReplacingTarget(null);
    showNotification('Question successfully replaced from shared question pool. Marks and numbering recalculated.', 'success');
  };

  const handleOpenEditSetQuestion = (sectionIndex, questionRole, qData) => {
    const subs = qData.subquestions && qData.subquestions.length > 0
      ? qData.subquestions
      : [{ subPart: 'a', questionText: qData.questionText || '', marks: qData.marks || 8 }];
    setEditingQuestionForm({
      questionText: qData.questionText || '',
      marks: qData.marks || 8,
      difficulty: qData.difficulty || 'MEDIUM',
      bloomTaxonomy: qData.bloomTaxonomy || 'L2 - Understand',
      subquestions: subs,
    });
    setEditingTarget({ sectionIndex, questionRole, questionData: qData });
  };

  const handleSaveEditedQuestion = (e) => {
    e.preventDefault();
    if (!editingTarget) return;
    const { sectionIndex, questionRole } = editingTarget;
    updateActiveSet((curSet) => {
      const sections = [...(curSet.paperStructureSnapshot?.sections || [])];
      const sec = { ...sections[sectionIndex] };
      const totalSubMarks = editingQuestionForm.subquestions.reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
      const effectiveMarks = totalSubMarks > 0 ? totalSubMarks : Number(editingQuestionForm.marks) || 8;
      const updatedQ = {
        questionText: editingQuestionForm.questionText,
        marks: effectiveMarks,
        difficulty: editingQuestionForm.difficulty,
        bloomTaxonomy: editingQuestionForm.bloomTaxonomy,
        subquestions: editingQuestionForm.subquestions,
      };

      if (questionRole === 'primary') {
        sec.primaryQuestion = {
          ...sec.primaryQuestion,
          ...updatedQ,
        };
      } else {
        sec.alternativeQuestion = {
          ...sec.alternativeQuestion,
          ...updatedQ,
        };
      }
      sections[sectionIndex] = sec;
      return {
        ...curSet,
        paperStructureSnapshot: {
          ...curSet.paperStructureSnapshot,
          sections,
        },
      };
    });
    setEditingTarget(null);
    showNotification('Question updated successfully. Total marks recalculated.', 'success');
  };

  const handleRemoveSetQuestion = (sectionIndex, questionRole) => {
    updateActiveSet((curSet) => {
      let sections = [...(curSet.paperStructureSnapshot?.sections || [])];
      if (questionRole === 'alternative') {
        sections[sectionIndex] = {
          ...sections[sectionIndex],
          alternativeQuestion: null,
          alternativeQuestionNumber: null,
        };
      } else {
        if (sections[sectionIndex].alternativeQuestion) {
          sections[sectionIndex] = {
            ...sections[sectionIndex],
            primaryQuestion: sections[sectionIndex].alternativeQuestion,
            alternativeQuestion: null,
            alternativeQuestionNumber: null,
          };
        } else {
          sections.splice(sectionIndex, 1);
        }
      }
      return {
        ...curSet,
        paperStructureSnapshot: {
          ...curSet.paperStructureSnapshot,
          sections,
        },
      };
    });
    showNotification('Question removed. Marks and numbering recalculated.', 'success');
  };

  const handleMoveSection = (sectionIndex, direction) => {
    updateActiveSet((curSet) => {
      const sections = [...(curSet.paperStructureSnapshot?.sections || [])];
      const targetIdx = sectionIndex + direction;
      if (targetIdx < 0 || targetIdx >= sections.length) return curSet;
      const temp = sections[sectionIndex];
      sections[sectionIndex] = sections[targetIdx];
      sections[targetIdx] = temp;
      return {
        ...curSet,
        paperStructureSnapshot: {
          ...curSet.paperStructureSnapshot,
          sections,
        },
      };
    });
  };

  const handleAddNewSectionToSet = () => {
    updateActiveSet((curSet) => {
      const sections = [...(curSet.paperStructureSnapshot?.sections || [])];
      const newSecIdx = sections.length + 1;
      const newSec = {
        groupOrder: newSecIdx,
        groupLabel: `Unit ${((newSecIdx - 1) % 6) + 1}`,
        targetUnit: ((newSecIdx - 1) % 6) + 1,
        targetMarks: 8,
        primaryQuestionNumber: 0,
        primaryQuestion: {
          id: 'manual-' + Date.now(),
          questionText: `Evaluation Question for ${blueprint.subject}`,
          marks: 8,
          difficulty: 'MEDIUM',
          courseOutcome: 'CO1',
          programOutcome: 'PO1',
          bloomTaxonomy: 'L2 - Understand',
          authorName: teacherProfile?.name || 'Faculty Member',
          sourceSet: curSet.setCode,
          subquestions: [
            { subPart: 'a', questionText: `Evaluation Question for ${blueprint.subject}`, marks: 8 }
          ],
        },
      };
      sections.push(newSec);
      return {
        ...curSet,
        paperStructureSnapshot: {
          ...curSet.paperStructureSnapshot,
          sections,
        },
      };
    });
    showNotification('New question section added. Marks and numbering recalculated.', 'success');
  };

  // Final Approval & Submission State (Clean initial state)
  const defaultCoord = recipients.find((r) => r.role === 'EXAM_COORDINATOR') || recipients[0];
  const [submissionForm, setSubmissionForm] = useState({
    assignedToUserId: defaultCoord ? defaultCoord.id : '',
    examDate: '',
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
      showNotification(err.response?.data?.message || err.message || 'Failed to save draft', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  // 1. Initial Load of Academic Master Data (Pristine catalog load without auto-populating fields)
  useEffect(() => {
    async function loadAcademicCatalogs() {
      try {
        setLoadingAcademic(true);
        const [deptsData, coursesData, patternsData, semestersData, outcomesData, profileData, titlesData] = await Promise.all([
          academicService.getDepartments().catch(() => ({ data: [] })),
          academicService.getCourses().catch(() => ({ data: [] })),
          academicService.getPatterns().catch(() => ({ data: [] })),
          academicService.getSemesters().catch(() => ({ data: [] })),
          academicService.getOutcomes().catch(() => ({ data: null })),
          academicService.getTeacherProfile().catch(() => ({ data: null })),
          academicService.getPaperTitles().catch(() => ({ data: [] })),
        ]);

        const deptsList = deptsData.data || [];
        const coursesList = coursesData.data || [];

        // Canonical Academic Patterns strictly: 2019, 2024, 2025 (Section 6)
        const canonicalPatterns = [
          { id: 'pat_2019', name: '2019' },
          { id: 'pat_2024', name: '2024' },
          { id: 'pat_2025', name: '2025' },
        ];
        const patternsList = canonicalPatterns;

        const semsList = semestersData.data || [];

        // Canonical Paper Titles strictly: Open Book Test, CCE Exam, End Sem Exam, plus standard exams
        const titlesList = [
          { id: 'obt', title: 'Open Book Test' },
          { id: 'cce', title: 'CCE Exam' },
          { id: 'endsem', title: 'End Sem Exam' },
          { id: 'insem', title: 'In-Sem Exam' },
          { id: 'ut1', title: 'Unit Test 1' },
          { id: 'ut2', title: 'Unit Test 2' },
          { id: 'prelim', title: 'Preliminary Exam' },
          { id: 'reexam', title: 'Re-Examination' },
        ];

        setDepartments(deptsList);
        setCourses(coursesList);
        setPatterns(patternsList);
        setSemesters(semsList);
        setPaperTitlesList(titlesList);

        if (outcomesData?.data) {
          setOutcomes(outcomesData.data);
        }
        if (profileData?.data) {
          setTeacherProfile(profileData.data);
        }

        // Fetch ALL subjects for the Computer Engineering Department so the dropdown contains the complete curriculum (35+ subjects)
        const subsData = await academicService.getSubjects({
          departmentCode: selectedDept || 'COMP',
        }).catch(() => ({ data: [] }));
        const subsList = subsData.data || [];

        setSubjects(subsList);

        // If resuming an existing draft, populate matching subject and units
        if (initialDraft && subsList.length > 0) {
          const matchedSub = subsList.find(s => s.title === initialDraft.subject || s.code === initialDraft.subjectCode);
          if (matchedSub) {
            const unitsRes = await academicService.getUnitsForSubject(matchedSub.code).catch(() => ({ data: [] }));
            setSubjectUnits(unitsRes.data || []);
          }
        }
      } catch (err) {
        console.warn('Academic master catalogs loading notice:', err.message);
      } finally {
        setLoadingAcademic(false);
      }
    }
    loadAcademicCatalogs();
  }, []);

  // 2. Cascade when Department or Course changes (Does not force unwanted prefilled data)
  const handleDepartmentChange = async (deptCode) => {
    setSelectedDept(deptCode);
    try {
      const [coursesRes, subsRes] = await Promise.all([
        academicService.getCourses(deptCode),
        academicService.getSubjects({ departmentCode: deptCode }),
      ]);
      setCourses(coursesRes.data || []);
      setSubjects(subsRes.data || []);
    } catch (err) {
      console.warn('Failed updating department cascade:', err);
    }
  };

  // 3. Subject selection handler
  const handleSubjectChange = async (selectedSubTitle) => {
    if (selectedSubTitle === '__NEW_SUBJECT__') {
      setAddSubjectModalOpen(true);
      return;
    }
    if (!selectedSubTitle) {
      setBlueprint((prev) => ({ ...prev, subject: '', subjectCode: '' }));
      setSubjectUnits([]);
      return;
    }

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
      subject: subObj.title,
      subjectCode: subObj.code,
      totalMarks: prev.totalMarks || subObj.totalMarks || '',
      durationHours: prev.durationHours || subObj.durationHours || (prev.totalMarks ? (prev.totalMarks <= 30 ? 1.0 : prev.totalMarks <= 60 ? 2.0 : 2.5) : ''),
      semester: prev.semester || subObj.semester || '',
      academicPattern: prev.academicPattern || subObj.patternName || '',
    }));

    try {
      const unitsRes = await academicService.getUnitsForSubject(subObj.code);
      const units = unitsRes.data || [];
      setSubjectUnits(units);
    } catch (err) {
      console.warn('Failed loading units for subject:', err);
    }
  };

  // 4. Create Subject Handler for "+ Add Subject" modal
  const handleCreateSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!newSubjectForm.title.trim() || !newSubjectForm.code.trim()) {
      showNotification('Please enter both subject title and subject code.', 'error');
      return;
    }
    setSavingSubject(true);
    try {
      const payload = {
        title: newSubjectForm.title.trim(),
        code: newSubjectForm.code.trim().toUpperCase(),
        shortName: (newSubjectForm.shortName.trim() || newSubjectForm.code.trim()).toUpperCase(),
        semester: newSubjectForm.semester || 'Semester 5',
        patternName: newSubjectForm.patternName || '2019',
        courseCode: 'COMP',
        totalMarks: Number(newSubjectForm.totalMarks) || 70,
        durationHours: Number(newSubjectForm.durationHours) || 2.5,
      };
      const res = await academicService.createSubject(payload);
      const created = res.data || res;
      setSubjects((prev) => [created, ...prev]);
      setBlueprint((prev) => ({
        ...prev,
        subject: created.title,
        subjectCode: created.code,
        semester: created.semester || prev.semester,
        academicPattern: created.patternName || prev.academicPattern,
        totalMarks: created.totalMarks || prev.totalMarks,
        durationHours: created.durationHours || prev.durationHours,
      }));
      setSubjectUnits([
        { unitNumber: 1, unitTitle: 'Unit 1: Fundamentals & Theory' },
        { unitNumber: 2, unitTitle: 'Unit 2: Architecture & Algorithms' },
        { unitNumber: 3, unitTitle: 'Unit 3: Implementation & Analysis' },
        { unitNumber: 4, unitTitle: 'Unit 4: Applications & Security' },
      ]);
      setAddSubjectModalOpen(false);
      setNewSubjectForm({
        title: '',
        code: '',
        shortName: '',
        classYear: 'TE',
        semester: 'Semester 5',
        patternName: '2019',
        totalMarks: 70,
        durationHours: 2.5,
      });
      showNotification(`Subject "${created.title}" successfully created and selected for this question paper!`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to add subject', 'error');
    } finally {
      setSavingSubject(false);
    }
  };

  // 5. Customize Structure Handlers
  const handleOpenCustomizeStructure = () => {
    const sectionsToEdit = (blueprint.sections && blueprint.sections.length > 0)
      ? JSON.parse(JSON.stringify(blueprint.sections))
      : JSON.parse(JSON.stringify(getDynamicSections()));
    setCustomSectionsDraft(sectionsToEdit);
    setCustomStructureModalOpen(true);
  };

  const handleResetStructure = () => {
    setBlueprint((prev) => ({ ...prev, sections: [] }));
    setIsStructureCustomized(false);
    showNotification('Marks structure reset to standard university template.', 'success');
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

  // Add or Edit custom question for this subject
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    try {
      if (editingQuestionId) {
        // Update existing question
        await questionBankService.updateQuestion(editingQuestionId, {
          ...newQuestionForm,
          unitTitle: `Unit ${newQuestionForm.unitNumber}`,
          subject: blueprint.subject,
          course: blueprint.course,
          semester: blueprint.semester,
          academicPattern: blueprint.academicPattern,
        });
      } else {
        // Create new question
        await questionBankService.createQuestion({
          ...newQuestionForm,
          unitTitle: `Unit ${newQuestionForm.unitNumber}`,
          subject: blueprint.subject,
          course: blueprint.course,
          semester: blueprint.semester,
          academicPattern: blueprint.academicPattern,
        });
      }
      setNewQuestionModalOpen(false);
      setEditingQuestionId(null);
      setNewQuestionForm({
        unitNumber: '',
        unitTitle: '',
        topic: '',
        questionText: '',
        questionType: 'DESCRIPTIVE',
        marks: '',
        difficulty: '',
        courseOutcome: '',
        programOutcome: '',
        bloomTaxonomy: '',
        answerScheme: '',
        image: null,
      });
      await loadQuestions();
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Failed to save question', 'error');
    }
  };

  const handleOpenEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    setNewQuestionForm({
      unitNumber: q.unitNumber || '',
      unitTitle: q.unitTitle || (q.unitNumber ? `Unit ${q.unitNumber}` : ''),
      topic: q.topic || '',
      questionText: q.questionText || q.text || '',
      questionType: q.questionType || 'DESCRIPTIVE',
      marks: q.marks || '',
      difficulty: q.difficulty || '',
      courseOutcome: q.courseOutcome || q.course_outcome || '',
      programOutcome: q.programOutcome || q.program_outcome || '',
      bloomTaxonomy: q.bloomTaxonomy || q.bloom_taxonomy || '',
      answerScheme: q.answerScheme || '',
      image: q.image ? (typeof q.image === 'string' ? { dataUrl: q.image, name: 'Attached Diagram' } : q.image) : null,
    });
    setNewQuestionModalOpen(true);
  };

  const handleOpenCreateQuestion = () => {
    setEditingQuestionId(null);
    setNewQuestionForm({
      unitNumber: '',
      unitTitle: '',
      topic: '',
      questionText: '',
      questionType: 'DESCRIPTIVE',
      marks: '',
      difficulty: '',
      courseOutcome: '',
      programOutcome: '',
      bloomTaxonomy: '',
      answerScheme: '',
      image: null,
    });
    setNewQuestionModalOpen(true);
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

    // Dynamic Generator for any positive integer total marks (e.g. 70, 40, 50, 80, 100, etc.)
    const numGroups = tm <= 30 ? 2 : 4;
    const baseGroupMarks = Math.floor(tm / numGroups);
    const remainder = tm % numGroups;

    const dynamicGroups = [];
    for (let g = 0; g < numGroups; g++) {
      const gMarks = baseGroupMarks + (g >= numGroups - remainder ? 1 : 0);
      const sub1 = Math.floor(gMarks / 2);
      const sub2 = gMarks - sub1;
      const uIndex = g % units.length;
      const uTitle = units[uIndex]?.unitTitle || `Unit ${uIndex + 1}`;

      dynamicGroups.push({
        groupOrder: g + 1,
        groupLabel: `Group ${g + 1} (${uTitle})`,
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
  };

  // Step 1 -> 2: Save / Create Blueprint
  const handleProceedToBank = async () => {
    if (!blueprint.title || !blueprint.title.trim()) {
      showNotification('Please select or specify an Examination Paper Title (e.g. End Sem Exam, CCE Exam, Open Book Test).', 'error');
      return;
    }
    if (!blueprint.course || !blueprint.course.trim()) {
      showNotification('Please select or specify the Course / Degree (e.g. B.E. Computer Engineering).', 'error');
      return;
    }
    if (!blueprint.classYear || !blueprint.classYear.trim()) {
      showNotification('Please select the Class / Year (FE, SE, TE, or BE).', 'error');
      return;
    }
    if (!blueprint.academicPattern || !blueprint.academicPattern.trim()) {
      showNotification('Please select or specify the Academic Pattern (e.g. 2019, 2024, 2025).', 'error');
      return;
    }
    if (!blueprint.semester || !blueprint.semester.trim()) {
      showNotification('Please select the Semester for this examination.', 'error');
      return;
    }
    if (!blueprint.subject || !blueprint.subject.trim()) {
      showNotification('Please select the Subject for this question paper.', 'error');
      return;
    }
    const tm = Number(blueprint.totalMarks);
    if (!tm || tm <= 0) {
      showNotification('Please enter or select a valid positive whole-number for Total Examination Marks.', 'error');
      return;
    }
    try {
      const dynamicSections = getDynamicSections();
      const payload = {
        ...blueprint,
        durationHours: Number(blueprint.durationHours) || (tm <= 30 ? 1.0 : tm <= 60 ? 2.0 : 2.5),
        totalMarks: tm,
        sections: dynamicSections,
      };
      const res = await blueprintService.createBlueprint(payload);
      if (res.data?.id || res.id) {
        setBlueprintId(res.data?.id || res.id);
      }
      setStep(2);
    } catch (err) {
      showNotification(err.response?.data?.message || err.message || 'Blueprint validation error', 'error');
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

      {/* Notification Toast Alert */}
      {wizardNotification.message && (
        <div
          style={{
            margin: '0 1.5rem 1rem 1.5rem',
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: wizardNotification.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${wizardNotification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
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
      {/* --------------------------------------------------------------------- */}
      {/* STEP 1: DYNAMIC ACADEMIC CONTEXT & BLUEPRINT CONFIGURATION            */}
      {/* --------------------------------------------------------------------- */}
      {step === 1 && (
        <div style={styles.stepContent}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          </div>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Step 1: Academic Structure &amp; Exam Blueprint</h3>
            <p style={styles.cardSubtitle}>
              Select department, course, class/year, examination pattern, subject, and total marks. The system dynamically adapts the university marks structure from database templates.
            </p>
          </div>

          <div style={styles.grid2}>
            {/* Paper Title Dropdown / Custom Field */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>
                  Paper Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomTitle(!isCustomTitle);
                    if (!isCustomTitle) setBlueprint((p) => ({ ...p, title: '' }));
                  }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCustomTitle ? '← Choose from Standard Titles' : '+ Add Custom Paper Title'}
                </button>
              </div>
              {isCustomTitle ? (
                <input
                  type="text"
                  style={styles.input}
                  placeholder="Type custom paper title (e.g. Unit Test 1, Preliminary Examination, Re-Exam)..."
                  value={blueprint.title}
                  onChange={(e) => setBlueprint({ ...blueprint, title: e.target.value })}
                />
              ) : (
                <select
                  style={styles.select}
                  value={blueprint.title}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomTitle(true);
                      setBlueprint({ ...blueprint, title: '' });
                    } else {
                      setBlueprint({ ...blueprint, title: e.target.value });
                    }
                  }}
                >
                  <option value="">-- Select Paper Title --</option>
                  {paperTitlesList.map((t) => (
                    <option key={t.id} value={t.title}>
                      {t.title}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Add Custom Paper Title...</option>
                </select>
              )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>Course / Degree</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCourse(!isCustomCourse);
                    if (!isCustomCourse) setBlueprint((p) => ({ ...p, course: '' }));
                  }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCustomCourse ? '← Choose from List' : '+ Add Custom Course'}
                </button>
              </div>
              {isCustomCourse ? (
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. B.Tech (Artificial Intelligence & Data Science)"
                  value={blueprint.course}
                  onChange={(e) => setBlueprint({ ...blueprint, course: e.target.value })}
                />
              ) : (
                <select
                  style={styles.select}
                  value={blueprint.course}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomCourse(true);
                      setBlueprint({ ...blueprint, course: '' });
                    } else {
                      setBlueprint({ ...blueprint, course: e.target.value });
                    }
                  }}
                >
                  <option value="">-- Select Course / Degree --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.degree || 'B.E.'})
                    </option>
                  ))}
                  {courses.length === 0 && (
                    <>
                      <option value="B.E. (Computer Engineering)">B.E. (Computer Engineering)</option>
                      <option value="B.Tech (Computer Science & Engineering)">B.Tech (Computer Science & Engineering)</option>
                      <option value="M.E. (Computer Engineering)">M.E. (Computer Engineering)</option>
                    </>
                  )}
                  <option value="__CUSTOM__">+ Add Custom Course...</option>
                </select>
              )}
            </div>

            {/* Class / Year Selection (FE, SE, TE, BE, ME) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>Class / Year</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomClassYear(!isCustomClassYear);
                    if (!isCustomClassYear) setBlueprint((p) => ({ ...p, classYear: '' }));
                  }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCustomClassYear ? '← Choose from List' : '+ Add Custom Class'}
                </button>
              </div>
              {isCustomClassYear ? (
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. FY M.Tech, Third Year Honours"
                  value={blueprint.classYear}
                  onChange={(e) => setBlueprint({ ...blueprint, classYear: e.target.value })}
                />
              ) : (
                <select
                  style={styles.select}
                  value={blueprint.classYear}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomClassYear(true);
                      setBlueprint({ ...blueprint, classYear: '' });
                    } else {
                      setBlueprint({ ...blueprint, classYear: e.target.value });
                    }
                  }}
                >
                  <option value="">-- Select Class / Year --</option>
                  <option value="FE">FE — First Year Engineering</option>
                  <option value="SE">SE — Second Year Engineering</option>
                  <option value="TE">TE — Third Year Engineering</option>
                  <option value="BE">BE — Final Year Engineering</option>
                  <option value="ME">ME — Master of Engineering (Post-Graduate)</option>
                  <option value="__CUSTOM__">+ Add Custom Class / Year...</option>
                </select>
              )}
            </div>

            {/* Academic Pattern Selection */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>
                  Academic Pattern <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomPattern(!isCustomPattern);
                    if (!isCustomPattern) setBlueprint((p) => ({ ...p, academicPattern: '' }));
                  }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCustomPattern ? '← Choose from List' : '+ Add Custom Pattern'}
                </button>
              </div>
              {isCustomPattern ? (
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. 2026, Autonomous-2024"
                  value={blueprint.academicPattern}
                  onChange={(e) => setBlueprint({ ...blueprint, academicPattern: e.target.value })}
                />
              ) : (
                <select
                  style={styles.select}
                  value={blueprint.academicPattern}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomPattern(true);
                      setBlueprint({ ...blueprint, academicPattern: '' });
                    } else {
                      setBlueprint({ ...blueprint, academicPattern: e.target.value });
                    }
                  }}
                >
                  <option value="">-- Select Academic Pattern --</option>
                  {patterns.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                  {patterns.length === 0 && (
                    <>
                      <option value="2019">2019</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                    </>
                  )}
                  <option value="__CUSTOM__">+ Add Custom Academic Pattern...</option>
                </select>
              )}
            </div>

            {/* Semester Selection */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>Semester</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSemester(!isCustomSemester);
                    if (!isCustomSemester) setBlueprint((p) => ({ ...p, semester: '' }));
                  }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCustomSemester ? '← Choose from List' : '+ Add Custom Semester'}
                </button>
              </div>
              {isCustomSemester ? (
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. Semester 1, Trimester 2"
                  value={blueprint.semester}
                  onChange={(e) => setBlueprint({ ...blueprint, semester: e.target.value })}
                />
              ) : (
                <select
                  style={styles.select}
                  value={blueprint.semester}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomSemester(true);
                      setBlueprint({ ...blueprint, semester: '' });
                    } else {
                      setBlueprint({ ...blueprint, semester: e.target.value });
                    }
                  }}
                >
                  <option value="">-- Select Semester --</option>
                  {semesters.map((s) => (
                    <option key={s.number} value={s.label}>
                      {s.label}
                    </option>
                  ))}
                  {semesters.length === 0 && (
                    <>
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                      <option value="Semester 3">Semester 3</option>
                      <option value="Semester 4">Semester 4</option>
                      <option value="Semester 5">Semester 5</option>
                      <option value="Semester 6">Semester 6</option>
                      <option value="Semester 7">Semester 7</option>
                      <option value="Semester 8">Semester 8</option>
                    </>
                  )}
                  <option value="__CUSTOM__">+ Add Custom Semester...</option>
                </select>
              )}
            </div>

            {/* Total Marks */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={styles.label}>Total Marks</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMarks(!isCustomMarks);
                    if (!isCustomMarks) setBlueprint((p) => ({ ...p, totalMarks: '' }));
                  }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCustomMarks ? '← Choose Standard Marks' : '+ Add Custom Marks'}
                </button>
              </div>
              {isCustomMarks ? (
                <input
                  type="number"
                  min={5}
                  max={200}
                  style={styles.input}
                  placeholder="e.g. 25, 40, 50, 80, 100"
                  value={blueprint.totalMarks}
                  onChange={(e) => {
                    const tm = e.target.value ? parseInt(e.target.value, 10) : '';
                    const autoDur = tm ? (tm <= 30 ? 1.0 : tm <= 60 ? 2.0 : 2.5) : '';
                    setBlueprint((prev) => ({
                      ...prev,
                      totalMarks: tm,
                      durationHours: autoDur || prev.durationHours,
                      sections: [],
                    }));
                    setIsStructureCustomized(false);
                  }}
                />
              ) : (
                <select
                  style={styles.select}
                  value={blueprint.totalMarks}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomMarks(true);
                      setBlueprint({ ...blueprint, totalMarks: '' });
                    } else {
                      const tm = e.target.value ? parseInt(e.target.value, 10) : '';
                      const autoDuration = tm ? (tm <= 30 ? 1.0 : tm === 60 ? 2.0 : 2.5) : '';
                      setBlueprint((prev) => ({
                        ...prev,
                        totalMarks: tm,
                        durationHours: autoDuration || prev.durationHours,
                        sections: [],
                      }));
                      setIsStructureCustomized(false);
                    }
                  }}
                >
                  <option value="">-- Select Total Marks --</option>
                  <option value={20}>20 Marks (Internal Assessment / Unit Test)</option>
                  <option value={30}>30 Marks (In-Semester Examination)</option>
                  <option value={60}>60 Marks (End-Semester 60M Pattern)</option>
                  <option value={70}>70 Marks (Standard End-Semester 70M Pattern)</option>
                  <option value="__CUSTOM__">+ Add Custom Total Marks...</option>
                </select>
              )}
            </div>

            {/* Subject Selection (Searchable, Full Catalog & + Add Subject) */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={styles.label}>
                  Subject (Fast Search by Code, Full Title, or Short Name) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {teacherProfile?.name && (
                    <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                      Faculty Authorized: {teacherProfile.name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setAddSubjectModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    <Plus size={14} />
                    <span>+ Add Subject</span>
                  </button>
                </div>
              </div>

              {/* Subject Search Filter */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Type to filter subjects: e.g. DAA, SPOS, DBMS, CNS, WT, 310243, Algorithms, FE, SE, TE, BE..."
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
                <option value="">-- Select Subject ({filteredSubjects.length} available in Department) --</option>
                {filteredSubjects.map((s) => (
                  <option key={s.id || s.code} value={s.title}>
                    [{s.code || s.subject_code}] {s.shortName ? `(${s.shortName}) ` : ''}{s.title} {s.semester ? `— ${s.semester}` : ''}
                  </option>
                ))}
                <option value="__NEW_SUBJECT__">+ Add New Subject to System...</option>
              </select>
            </div>

            {/* Subject Code */}
            <div>
              <label style={styles.label}>Subject Code</label>
              <input
                type="text"
                style={styles.input}
                placeholder="e.g. 310243 or COMP-301"
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
                placeholder="e.g. 1.0, 2.0, 2.5"
                value={blueprint.durationHours}
                onChange={(e) => setBlueprint({ ...blueprint, durationHours: parseFloat(e.target.value) || '' })}
              />
            </div>
          </div>

          {/* Dynamic & Fully Customizable University Marks Structure */}
          {(() => {
            const activeSections = (blueprint.sections && blueprint.sections.length > 0)
              ? blueprint.sections
              : (blueprint.totalMarks ? getDynamicSections() : []);
            const isCustom = isStructureCustomized || (blueprint.sections && blueprint.sections.length > 0);

            return (
              <div style={styles.summaryBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={styles.summaryTitle}>
                      University Marks Structure {blueprint.totalMarks ? `(${blueprint.totalMarks} Marks Pattern)` : ''}
                    </h4>
                    {isCustom ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                        ✓ Custom Layout Active ({activeSections.length} Question Pairs)
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '3px 8px', borderRadius: '4px' }}>
                        Configurable Academic Template
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={handleResetStructure}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#475569',
                          cursor: 'pointer',
                        }}
                        title="Reset to standard university template"
                      >
                        <RotateCcw size={13} />
                        <span>Reset to Default Template</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenCustomizeStructure}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #0284c7',
                        backgroundColor: '#eff6ff',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#0284c7',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <Settings size={14} />
                      <span>⚙️ Customize Marks Structure</span>
                    </button>
                  </div>
                </div>

                {!blueprint.totalMarks && (!blueprint.sections || blueprint.sections.length === 0) ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#334155' }}>
                      No examination marks pattern pre-applied.
                    </p>
                    <p style={{ margin: 0 }}>
                      Select <strong>Total Marks</strong> above to generate a standard university layout, or click <strong>&ldquo;⚙️ Customize Marks Structure&rdquo;</strong> to design custom question pairs, units, and sub-question allocations.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={styles.groupList}>
                      {activeSections.map((sec, idx) => {
                        const pSubs = sec.subquestionsConfig || [];
                        const pMarksStr = pSubs.length > 0 ? pSubs.map((s) => s.marks).join(' + ') + ` = ${sec.targetMarks}M` : `${sec.targetMarks}M`;
                        return (
                          <div key={idx} style={styles.groupCard}>
                            <strong>Pair {sec.groupOrder || idx + 1} ({sec.groupLabel || `Unit ${sec.targetUnit || idx + 1}`}):</strong>{' '}
                            Q{sec.primaryQuestionNumber || idx * 2 + 1} ({pMarksStr}){' '}
                            {sec.alternativeQuestionNumber && (
                              <>
                                <span style={styles.orPill}>OR</span>{' '}
                                Q{sec.alternativeQuestionNumber} ({pMarksStr})
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p style={styles.summaryFooter}>
                      Total Answered Marks:{' '}
                      {activeSections.map((s) => s.targetMarks).join(' + ')} = {blueprint.totalMarks || activeSections.reduce((acc, s) => acc + (Number(s.targetMarks) || 0), 0)} Marks.{' '}
                      Candidate answers {activeSections.length} compulsory questions with internal OR alternatives across {activeSections.length} syllabus units.
                    </p>
                  </>
                )}
              </div>
            );
          })()}

{/* MODAL: REPLACE QUESTION FROM SHARED SUBJECT POOL (Sprint Section 7) */}
          {replacingTarget && (
            <div style={styles.modalOverlay}>
              <div style={{ ...styles.modalCard, maxWidth: '820px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                      Select Replacement Question from Shared Pool ({blueprint.subject})
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Replacing for {replacingTarget.questionRole === 'primary' ? 'Primary' : 'Alternative'} Question. Choose from department repository.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplacingTarget(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Shared Pool Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search question text or topic..."
                    value={poolFilter.search}
                    onChange={(e) => setPoolFilter({ ...poolFilter, search: e.target.value })}
                    style={{ ...styles.input, flex: 2, height: '36px', fontSize: '12px' }}
                  />
                  <select
                    value={poolFilter.unit}
                    onChange={(e) => setPoolFilter({ ...poolFilter, unit: e.target.value })}
                    style={{ ...styles.select, flex: 1, height: '36px', fontSize: '12px' }}
                  >
                    <option value="">All Units</option>
                    {[1, 2, 3, 4, 5, 6].map((u) => (
                      <option key={u} value={u}>Unit {u}</option>
                    ))}
                  </select>
                  <select
                    value={poolFilter.difficulty}
                    onChange={(e) => setPoolFilter({ ...poolFilter, difficulty: e.target.value })}
                    style={{ ...styles.select, flex: 1, height: '36px', fontSize: '12px' }}
                  >
                    <option value="">All Difficulties</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>

                {/* Replacement Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {questions
                    .filter((q) => {
                      if (poolFilter.unit && String(q.unitNumber) !== String(poolFilter.unit)) return false;
                      if (poolFilter.difficulty && q.difficulty !== poolFilter.difficulty) return false;
                      if (poolFilter.search) {
                        const s = poolFilter.search.toLowerCase();
                        return (q.questionText || '').toLowerCase().includes(s) || (q.topic || '').toLowerCase().includes(s);
                      }
                      return true;
                    })
                    .map((q) => (
                      <div
                        key={q.id}
                        style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '12px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#e2e8f0', color: '#334155', padding: '1px 6px', borderRadius: '4px' }}>
                              Unit {q.unitNumber}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                              {q.marks} Marks
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: q.difficulty === 'HARD' ? '#fee2e2' : q.difficulty === 'MEDIUM' ? '#fef3c7' : '#dcfce7', color: q.difficulty === 'HARD' ? '#991b1b' : q.difficulty === 'MEDIUM' ? '#92400e' : '#166534', padding: '1px 6px', borderRadius: '4px' }}>
                              {q.difficulty}
                            </span>
                            {(q.source_set || q.sourceSet) && (
                              <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>
                                Origin: {q.source_set || q.sourceSet}
                              </span>
                            )}
                            {(q.author_name || q.authorName) && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                by {q.author_name || q.authorName}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>
                            {q.questionText}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectReplacement(q)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Select Replacement
                        </button>
                      </div>
                    ))}
                  {questions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                      No alternative questions found in repository for {blueprint.subject}.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setReplacingTarget(null)}
                    style={styles.secondaryButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: EDIT QUESTION DETAILS & MANUAL MARKS (Sprint Section 6) */}
          {editingTarget && (
            <div style={styles.modalOverlay}>
              <div style={{ ...styles.modalCard, maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                    Edit Question Content &amp; Manual Marks Allocation
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingTarget(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveEditedQuestion}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={styles.label}>Question Text *</label>
                      <textarea
                        rows={3}
                        required
                        value={editingQuestionForm.questionText}
                        onChange={(e) => setEditingQuestionForm({ ...editingQuestionForm, questionText: e.target.value })}
                        style={{ ...styles.input, height: 'auto', padding: '8px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={styles.label}>Total Marks Allocation *</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          required
                          value={editingQuestionForm.marks}
                          onChange={(e) => setEditingQuestionForm({ ...editingQuestionForm, marks: Number(e.target.value) || 1 })}
                          style={styles.input}
                        />
                      </div>

                      <div>
                        <label style={styles.label}>Difficulty Level</label>
                        <select
                          value={editingQuestionForm.difficulty}
                          onChange={(e) => setEditingQuestionForm({ ...editingQuestionForm, difficulty: e.target.value })}
                          style={styles.select}
                        >
                          <option value="EASY">EASY</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HARD">HARD</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={styles.label}>Subquestions Breakdown</label>
                        <button
                          type="button"
                          onClick={() => {
                            const curSubs = [...editingQuestionForm.subquestions];
                            const nextPart = String.fromCharCode(97 + curSubs.length);
                            curSubs.push({ subPart: nextPart, questionText: '', marks: 4 });
                            setEditingQuestionForm({ ...editingQuestionForm, subquestions: curSubs });
                          }}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#1d4ed8',
                            cursor: 'pointer',
                          }}
                        >
                          + Add Subquestion
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {editingQuestionForm.subquestions.map((sub, sidx) => (
                          <div key={sidx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', width: '22px' }}>
                              ({sub.subPart || String.fromCharCode(97 + sidx)})
                            </span>
                            <input
                              type="text"
                              placeholder="Subquestion details..."
                              value={sub.questionText}
                              onChange={(e) => {
                                const curSubs = [...editingQuestionForm.subquestions];
                                curSubs[sidx].questionText = e.target.value;
                                setEditingQuestionForm({ ...editingQuestionForm, subquestions: curSubs });
                              }}
                              style={{ ...styles.input, flex: 3 }}
                            />
                            <input
                              type="number"
                              min={1}
                              max={25}
                              placeholder="M"
                              value={sub.marks}
                              onChange={(e) => {
                                const curSubs = [...editingQuestionForm.subquestions];
                                curSubs[sidx].marks = Number(e.target.value) || 1;
                                setEditingQuestionForm({ ...editingQuestionForm, subquestions: curSubs });
                              }}
                              style={{ ...styles.input, width: '65px' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const curSubs = editingQuestionForm.subquestions.filter((_, idx) => idx !== sidx);
                                setEditingQuestionForm({ ...editingQuestionForm, subquestions: curSubs });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingTarget(null)}
                        style={styles.secondaryButton}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        style={styles.primaryButton}
                      >
                        Save Question Changes
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 1 (Blueprint)</span>
            </button>
          </div>
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
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  <Database size={14} />
                  <span>Pool: <strong>{questions.length}</strong> Questions Available</span>
                </div>

                <button
                  type="button"
                  style={styles.actionBtnPrimary}
                  onClick={handleOpenCreateQuestion}
                  title="Add Question"
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
                    <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
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
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditQuestion(q)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Edit / Replace Question Content"
                        >
                          <Edit3 size={13} color="#2563eb" />
                          <span>Edit</span>
                        </button>
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
              disabled={questions.length === 0 || checkingFeasibility}
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 2 (Question Bank)</span>
            </button>
          </div>
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
                              <span style={{ color: '#059669', fontWeight: 600, backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                                ✓ Ready
                              </span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                                ✗ {Math.max(0, p.requiredCount - p.availableCount)} Missing
                              </span>
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 3 (Feasibility)</span>
            </button>
          </div>
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

          {/* Active Set Question Paper Structure & Interactive Editor (Sprint Section 6 & 7) */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {activeSet.setCode} Examination Structure &amp; Question Allocations
                </h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Add, edit, replace, or reorder questions. Marks and numbering auto-recalculate dynamically.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '8px' }}>
                  Total: {activeSet.totalMarks} Marks
                </span>
                <button
                  type="button"
                  onClick={handleAddNewSectionToSet}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Add another question section to this set"
                >
                  <Plus size={14} />
                  <span>Add Question Section</span>
                </button>
              </div>
            </div>

            {/* Sections & Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(activeSet.paperStructureSnapshot?.sections || []).map((sec, secIdx) => {
                return (
                  <div
                    key={secIdx}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                          Group {sec.groupOrder || secIdx + 1}: {sec.groupLabel || `Unit ${sec.targetUnit || secIdx + 1}`}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                          {sec.targetMarks} Marks
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveSection(secIdx, -1)}
                          disabled={secIdx === 0}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: secIdx === 0 ? 'not-allowed' : 'pointer',
                            opacity: secIdx === 0 ? 0.4 : 1,
                          }}
                          title="Move Question Section Up"
                        >
                          <ArrowUp size={13} color="#475569" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSection(secIdx, 1)}
                          disabled={secIdx === (activeSet.paperStructureSnapshot?.sections || []).length - 1}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: secIdx === (activeSet.paperStructureSnapshot?.sections || []).length - 1 ? 'not-allowed' : 'pointer',
                            opacity: secIdx === (activeSet.paperStructureSnapshot?.sections || []).length - 1 ? 0.4 : 1,
                          }}
                          title="Move Question Section Down"
                        >
                          <ArrowDown size={13} color="#475569" />
                        </button>
                      </div>
                    </div>

                    {/* Primary Question Box */}
                    {sec.primaryQuestion && (
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#0284c7', marginRight: '8px' }}>
                              Q{sec.primaryQuestionNumber}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>
                              Primary Compulsory
                            </span>
                            {(sec.primaryQuestion.sourceSet || sec.primaryQuestion.source_set) && (
                              <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>
                                Origin: {sec.primaryQuestion.sourceSet || sec.primaryQuestion.source_set}
                              </span>
                            )}
                            {(sec.primaryQuestion.authorName || sec.primaryQuestion.author_name) && (
                              <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>
                                by {sec.primaryQuestion.authorName || sec.primaryQuestion.author_name}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSetQuestion(secIdx, 'primary', sec.primaryQuestion)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#1e293b',
                                cursor: 'pointer',
                              }}
                              title="Edit Question Text & Manual Marks"
                            >
                              <Edit3 size={12} color="#2563eb" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setReplacingTarget({ sectionIndex: secIdx, questionRole: 'primary', currentQuestion: sec.primaryQuestion })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#1d4ed8',
                                cursor: 'pointer',
                              }}
                              title="Replace Question from Shared Pool"
                            >
                              <Repeat size={12} color="#1d4ed8" />
                              <span>Replace</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveSetQuestion(secIdx, 'primary')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 8px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '4px',
                                color: '#dc2626',
                                cursor: 'pointer',
                              }}
                              title="Remove Question"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Subquestions & Marks */}
                        {(sec.primaryQuestion.subquestions || [{ subPart: 'a', questionText: sec.primaryQuestion.questionText, marks: sec.primaryQuestion.marks }]).map((sq, sqi) => (
                          <div key={sqi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                            <span><strong>({sq.subPart || String.fromCharCode(97 + sqi)})</strong> {sq.questionText}</span>
                            <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', marginLeft: '12px' }}>[{sq.marks}M]</span>
                          </div>
                        ))}

                        {/* Diagram if present */}
                        {(sec.primaryQuestion.image?.dataUrl || sec.primaryQuestion.image || sec.primaryQuestion.imageData || sec.primaryQuestion.imageUrl) && (
                          <div style={{ marginTop: '8px' }}>
                            <img
                              src={sec.primaryQuestion.image?.dataUrl || sec.primaryQuestion.image || sec.primaryQuestion.imageData || sec.primaryQuestion.imageUrl}
                              alt="Question Diagram"
                              style={{ maxWidth: '240px', maxHeight: '120px', objectFit: 'contain', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Alternative OR Question */}
                    {sec.alternativeQuestion && (
                      <>
                        <div style={{ textAlign: 'center', margin: '4px 0', fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                          — OR —
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 800, fontSize: '14px', color: '#7c3aed', marginRight: '8px' }}>
                                Q{sec.alternativeQuestionNumber}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#f5f3ff', color: '#6d28d9', padding: '2px 6px', borderRadius: '4px' }}>
                                Alternative Option
                              </span>
                              {(sec.alternativeQuestion.sourceSet || sec.alternativeQuestion.source_set) && (
                                <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>
                                  Origin: {sec.alternativeQuestion.sourceSet || sec.alternativeQuestion.source_set}
                                </span>
                              )}
                              {(sec.alternativeQuestion.authorName || sec.alternativeQuestion.author_name) && (
                                <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>
                                  by {sec.alternativeQuestion.authorName || sec.alternativeQuestion.author_name}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditSetQuestion(secIdx, 'alternative', sec.alternativeQuestion)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  cursor: 'pointer',
                                }}
                                title="Edit Question Text & Manual Marks"
                              >
                                <Edit3 size={12} color="#2563eb" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setReplacingTarget({ sectionIndex: secIdx, questionRole: 'alternative', currentQuestion: sec.alternativeQuestion })}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  backgroundColor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                }}
                                title="Replace Question from Shared Pool"
                              >
                                <Repeat size={12} color="#1d4ed8" />
                                <span>Replace</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveSetQuestion(secIdx, 'alternative')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '4px 8px',
                                  backgroundColor: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  borderRadius: '4px',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                }}
                                title="Remove Alternative Question"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {(sec.alternativeQuestion.subquestions || [{ subPart: 'a', questionText: sec.alternativeQuestion.questionText, marks: sec.alternativeQuestion.marks }]).map((sq, sqi) => (
                            <div key={sqi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                              <span><strong>({sq.subPart || String.fromCharCode(97 + sqi)})</strong> {sq.questionText}</span>
                              <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', marginLeft: '12px' }}>[{sq.marks}M]</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(4)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 4 (Validation & Sets)</span>
            </button>
          </div>
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
      {/* MODAL: ADD / EDIT QUESTION                                            */}
      {/* --------------------------------------------------------------------- */}
      {newQuestionModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>
              {editingQuestionId ? 'Edit / Replace Question' : 'Add Question'} for {blueprint.subject}
            </h3>
            <form onSubmit={handleSaveQuestion}>
              <div style={styles.grid2}>
                <div>
                  <label style={styles.label}>Unit Selector <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.unitNumber}
                    required
                    onChange={(e) => {
                      const uNum = e.target.value ? parseInt(e.target.value, 10) : '';
                      setNewQuestionForm({
                        ...newQuestionForm,
                        unitNumber: uNum,
                        unitTitle: uNum ? `Unit ${uNum}` : '',
                      });
                    }}
                  >
                    <option value="">-- Select Unit --</option>
                    <option value={1}>Unit 1</option>
                    <option value={2}>Unit 2</option>
                    <option value={3}>Unit 3</option>
                    <option value={4}>Unit 4</option>
                    <option value={5}>Unit 5</option>
                    <option value={6}>Unit 6</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Marks <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.marks}
                    required
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, marks: e.target.value ? parseInt(e.target.value, 10) : '' })
                    }
                  >
                    <option value="">-- Select Question Marks --</option>
                    <option value={2}>2 Marks</option>
                    <option value={3}>3 Marks</option>
                    <option value={4}>4 Marks</option>
                    <option value={5}>5 Marks</option>
                    <option value={6}>6 Marks</option>
                    <option value={7}>7 Marks</option>
                    <option value={8}>8 Marks</option>
                    <option value={9}>9 Marks</option>
                    <option value={10}>10 Marks</option>
                    <option value={14}>14 Marks</option>
                    <option value={15}>15 Marks</option>
                    <option value={17}>17 Marks</option>
                    <option value={18}>18 Marks</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Difficulty <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    style={styles.select}
                    value={newQuestionForm.difficulty}
                    required
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, difficulty: e.target.value })
                    }
                  >
                    <option value="">-- Select Difficulty --</option>
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
                    <option value="">-- Select Question Type --</option>
                    <option value="DESCRIPTIVE">DESCRIPTIVE</option>
                    <option value="NUMERICAL">NUMERICAL</option>
                    <option value="ANALYTICAL">ANALYTICAL</option>
                  </select>
                </div>
              </div>

              {/* CO / PO / Bloom's Taxonomy Dropdowns (OBE Compliance with Prompt Placeholders) */}
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
                    <option value="">-- Select Course Outcome (CO) --</option>
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
                    <option value="">-- Select Program Outcome (PO) --</option>
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
                    <option value="">-- Select Bloom's Taxonomy Level --</option>
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

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CUSTOMIZE MARKS STRUCTURE & QUESTION LAYOUT (Requirement 1)     */}
      {/* --------------------------------------------------------------------- */}
      {customStructureModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} color="var(--color-primary)" />
                  <span>Customize Examination Marks Structure &amp; Question Layout</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Configure question pairs, syllabus units, sub-question marks, and OR alternatives for this examination blueprint.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomStructureModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* List of Question Pairs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {customSectionsDraft.map((sec, secIdx) => {
                const subquestions = sec.subquestionsConfig || [];
                const primaryMarks = subquestions.reduce((sum, sq) => sum + (Number(sq.marks) || 0), 0);
                return (
                  <div
                    key={secIdx}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '14px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                          Question Pair #{secIdx + 1}
                        </span>
                        <span style={{ fontSize: '12px', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Q{sec.primaryQuestionNumber || (secIdx * 2 + 1)} OR Q{sec.alternativeQuestionNumber || (secIdx * 2 + 2)}
                        </span>
                        <span style={{ fontSize: '12px', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          Target: {primaryMarks} Marks
                        </span>
                      </div>
                      {customSectionsDraft.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = customSectionsDraft.filter((_, i) => i !== secIdx).map((s, idx) => ({
                              ...s,
                              groupOrder: idx + 1,
                              primaryQuestionNumber: idx * 2 + 1,
                              alternativeQuestionNumber: idx * 2 + 2,
                            }));
                            setCustomSectionsDraft(updated);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                          title="Remove this question pair"
                        >
                          <Trash2 size={15} />
                          <span>Remove Pair</span>
                        </button>
                      )}
                    </div>

                    {/* Pair Details: Group Label & Unit */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Syllabus Unit
                        </label>
                        <select
                          value={sec.targetUnit || ((secIdx % 6) + 1)}
                          onChange={(e) => {
                            const u = parseInt(e.target.value, 10);
                            const updated = [...customSectionsDraft];
                            updated[secIdx] = {
                              ...updated[secIdx],
                              targetUnit: u,
                              groupLabel: `Group ${secIdx + 1} (Unit ${u})`,
                              subquestionsConfig: (updated[secIdx].subquestionsConfig || []).map((sq) => ({ ...sq, unit: u })),
                            };
                            setCustomSectionsDraft(updated);
                          }}
                          style={styles.select}
                        >
                          {[1, 2, 3, 4, 5, 6].map((u) => (
                            <option key={u} value={u}>
                              Unit {u}{subjectUnits[u - 1]?.unitTitle ? `: ${subjectUnits[u - 1].unitTitle}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Group Label
                        </label>
                        <input
                          type="text"
                          value={sec.groupLabel || `Pair ${secIdx + 1} (Unit ${sec.targetUnit || secIdx + 1})`}
                          onChange={(e) => {
                            const updated = [...customSectionsDraft];
                            updated[secIdx] = { ...updated[secIdx], groupLabel: e.target.value };
                            setCustomSectionsDraft(updated);
                          }}
                          style={styles.input}
                        />
                      </div>
                    </div>

                    {/* Sub-questions Configuration */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                          Sub-questions Breakdown (Applies to both Primary and OR Alternative)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...customSectionsDraft];
                            const curSubs = [...(updated[secIdx].subquestionsConfig || [])];
                            const nextChar = String.fromCharCode(97 + curSubs.length);
                            curSubs.push({
                              subPart: nextChar,
                              marks: 5,
                              difficulty: 'MEDIUM',
                              questionType: 'DESCRIPTIVE',
                              unit: sec.targetUnit || 1,
                            });
                            const newTarget = curSubs.reduce((sum, sq) => sum + (Number(sq.marks) || 0), 0);
                            updated[secIdx] = {
                              ...updated[secIdx],
                              subquestionsConfig: curSubs,
                              targetMarks: newTarget,
                            };
                            setCustomSectionsDraft(updated);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#1d4ed8',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={12} />
                          <span>Add Sub-question</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {subquestions.map((sub, subIdx) => (
                          <div key={subIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', width: '24px', color: '#1e293b' }}>
                              ({sub.subPart || String.fromCharCode(97 + subIdx)})
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>Marks:</span>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={sub.marks}
                                onChange={(e) => {
                                  const updated = [...customSectionsDraft];
                                  const curSubs = [...(updated[secIdx].subquestionsConfig || [])];
                                  curSubs[subIdx] = { ...curSubs[subIdx], marks: Number(e.target.value) || 1 };
                                  const newTarget = curSubs.reduce((sum, sq) => sum + (Number(sq.marks) || 0), 0);
                                  updated[secIdx] = {
                                    ...updated[secIdx],
                                    subquestionsConfig: curSubs,
                                    targetMarks: newTarget,
                                  };
                                  setCustomSectionsDraft(updated);
                                }}
                                style={{ ...styles.input, width: '70px', padding: '4px 8px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>Difficulty:</span>
                              <select
                                value={sub.difficulty || 'MEDIUM'}
                                onChange={(e) => {
                                  const updated = [...customSectionsDraft];
                                  const curSubs = [...(updated[secIdx].subquestionsConfig || [])];
                                  curSubs[subIdx] = { ...curSubs[subIdx], difficulty: e.target.value };
                                  updated[secIdx] = { ...updated[secIdx], subquestionsConfig: curSubs };
                                  setCustomSectionsDraft(updated);
                                }}
                                style={{ ...styles.select, padding: '4px 8px', fontSize: '12px' }}
                              >
                                <option value="EASY">EASY</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HARD">HARD</option>
                              </select>
                            </div>

                            {subquestions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...customSectionsDraft];
                                  const curSubs = (updated[secIdx].subquestionsConfig || []).filter((_, i) => i !== subIdx).map((sq, i) => ({
                                    ...sq,
                                    subPart: String.fromCharCode(97 + i),
                                  }));
                                  const newTarget = curSubs.reduce((sum, sq) => sum + (Number(sq.marks) || 0), 0);
                                  updated[secIdx] = {
                                    ...updated[secIdx],
                                    subquestionsConfig: curSubs,
                                    targetMarks: newTarget,
                                  };
                                  setCustomSectionsDraft(updated);
                                }}
                                style={{
                                  marginLeft: 'auto',
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                title="Remove sub-question"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Button to Add New Pair */}
            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={() => {
                  const nextIdx = customSectionsDraft.length + 1;
                  const targetU = ((nextIdx - 1) % 6) + 1;
                  const newPair = {
                    groupOrder: nextIdx,
                    groupLabel: `Group ${nextIdx} (Unit ${targetU})`,
                    targetUnit: targetU,
                    targetMarks: 10,
                    primaryQuestionNumber: nextIdx * 2 - 1,
                    alternativeQuestionNumber: nextIdx * 2,
                    subquestionsConfig: [
                      { subPart: 'a', marks: 5, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: targetU },
                      { subPart: 'b', marks: 5, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: targetU },
                    ],
                  };
                  setCustomSectionsDraft([...customSectionsDraft, newPair]);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#ffffff',
                  border: '1px dashed #0284c7',
                  borderRadius: '6px',
                  color: '#0284c7',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                <span>+ Add Question Pair / Group</span>
              </button>
            </div>

            {/* Summary Footer */}
            <div
              style={{
                marginTop: '20px',
                padding: '14px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  Total Structure Answered Marks:{' '}
                  <span style={{ color: 'var(--color-primary)', fontSize: '16px' }}>
                    {customSectionsDraft.reduce((acc, sec) => acc + (Number(sec.targetMarks) || 0), 0)} Marks
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Total Pairs: {customSectionsDraft.length} | Total Questions Configured:{' '}
                  {customSectionsDraft.length * 2} (compulsory + OR alternatives)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCustomStructureModalOpen(false)}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sum = customSectionsDraft.reduce((acc, sec) => acc + (Number(sec.targetMarks) || 0), 0);
                    const autoDur = sum <= 30 ? 1.0 : sum <= 60 ? 2.0 : 2.5;
                    setBlueprint((prev) => ({
                      ...prev,
                      sections: customSectionsDraft,
                      totalMarks: sum,
                      durationHours: prev.durationHours || autoDur,
                    }));
                    setIsStructureCustomized(true);
                    setCustomStructureModalOpen(false);
                    showNotification(`Custom marks structure applied successfully (${customSectionsDraft.length} pairs, ${sum} Marks).`, 'success');
                  }}
                  style={styles.primaryButton}
                >
                  Apply Custom Structure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD NEW SUBJECT TO SYSTEM (Requirement 3)                       */}
      {/* --------------------------------------------------------------------- */}
      {addSubjectModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="var(--color-primary)" />
                <span>Add New Subject to Computer Engineering</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddSubjectModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubjectSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={styles.label}>Subject Full Title <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deep Learning and Neural Networks"
                    value={newSubjectForm.title}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, title: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={styles.label}>Subject Code <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 410250 or COMP-401"
                      value={newSubjectForm.code}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, code: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Short Name / Acronym</label>
                    <input
                      type="text"
                      placeholder="e.g. DLNN, CC, CNS"
                      value={newSubjectForm.shortName}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, shortName: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={styles.label}>Class / Year <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={newSubjectForm.classYear}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, classYear: e.target.value })}
                      style={styles.select}
                    >
                      <option value="FE">FE — First Year Engineering</option>
                      <option value="SE">SE — Second Year Engineering</option>
                      <option value="TE">TE — Third Year Engineering</option>
                      <option value="BE">BE — Final Year Engineering</option>
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Semester <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={newSubjectForm.semester}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, semester: e.target.value })}
                      style={styles.select}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={`Semester ${s}`}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={styles.label}>Academic Pattern</label>
                    <select
                      value={newSubjectForm.patternName}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, patternName: e.target.value })}
                      style={styles.select}
                    >
                      <option value="2019">2019 Pattern</option>
                      <option value="2024">2024 Pattern</option>
                      <option value="2025">2025 Pattern</option>
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Standard Total Marks</label>
                    <select
                      value={newSubjectForm.totalMarks}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, totalMarks: parseInt(e.target.value, 10) })}
                      style={styles.select}
                    >
                      <option value={70}>70 Marks</option>
                      <option value={60}>60 Marks</option>
                      <option value={30}>30 Marks</option>
                      <option value={20}>20 Marks</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setAddSubjectModalOpen(false)}
                    style={styles.secondaryButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSubject}
                    style={styles.primaryButton}
                  >
                    {savingSubject ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    <span>Save &amp; Select Subject</span>
                  </button>
                </div>
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
