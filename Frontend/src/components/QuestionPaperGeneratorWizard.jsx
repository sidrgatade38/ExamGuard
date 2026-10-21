import React, { useState, useEffect } from 'react';
import questionBankService from '../services/questionBankService';
import blueprintService from '../services/blueprintService';
import questionPaperGeneratorService from '../services/questionPaperGeneratorService';
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
  Eye,
  Plus,
  ShieldCheck,
  Send,
  Database,
  Sliders,
  Calendar,
  User,
  Clock,
  BookOpen,
} from 'lucide-react';

export default function QuestionPaperGeneratorWizard({ recipients = [], onSuccess, onCancel }) {
  // Wizard Step: 1 (Exam Details & Blueprint) -> 2 (Question Bank) -> 3 (Feasibility & Sets) -> 4 (Preview & Edit) -> 5 (Approve & Submit)
  const [step, setStep] = useState(1);

  // Blueprint State
  const [blueprint, setBlueprint] = useState({
    title: 'End Semester Examination: Systems Programming & Operating System',
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
  const [loadingBlueprint, setLoadingBlueprint] = useState(true);

  // Question Bank State
  const [questions, setQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankError, setBankError] = useState('');
  const [seedingBank, setSeedingBank] = useState(false);
  const [newQuestionModalOpen, setNewQuestionModalOpen] = useState(false);
  const [newQuestionForm, setNewQuestionForm] = useState({
    unitNumber: 1,
    unitTitle: 'Loaders and Linkers',
    topic: '',
    questionText: '',
    questionType: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
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

  // Replace Question Modal State
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replacingTarget, setReplacingTarget] = useState(null);
  const [replacingLoading, setReplacingLoading] = useState(false);
  const [replaceError, setReplaceError] = useState('');

  // Final Approval & Submission State
  const [submissionForm, setSubmissionForm] = useState({
    assignedToUserId: recipients.length > 0 ? recipients[0].id : '',
    examDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    confirmedApproval: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Load default SPOS blueprint on mount
  useEffect(() => {
    async function loadDefaultBlueprint() {
      try {
        setLoadingBlueprint(true);
        const res = await blueprintService.getDefaultSPOSBlueprint();
        if (res.success && res.data) {
          setBlueprint(res.data);
        }
      } catch (err) {
        console.warn('Failed to fetch default blueprint, using fallback state.', err);
      } finally {
        setLoadingBlueprint(false);
      }
    }
    loadDefaultBlueprint();
  }, []);

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
  }, [step]);

  // Seed standard SPOS curriculum questions
  const handleSeedBank = async () => {
    setSeedingBank(true);
    setBankError('');
    try {
      await questionBankService.seedSampleQuestions();
      await loadQuestions();
    } catch (err) {
      setBankError(err.response?.data?.message || err.message || 'Failed to seed sample questions.');
    } finally {
      setSeedingBank(false);
    }
  };

  // Add custom question
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      await questionBankService.createQuestion({
        ...newQuestionForm,
        subject: blueprint.subject,
        course: blueprint.course,
        semester: blueprint.semester,
        academicPattern: blueprint.academicPattern,
      });
      setNewQuestionModalOpen(false);
      setNewQuestionForm({
        unitNumber: 1,
        unitTitle: 'Loaders and Linkers',
        topic: '',
        questionText: '',
        questionType: 'DESCRIPTIVE',
        marks: 8,
        difficulty: 'MEDIUM',
        answerScheme: '',
      });
      await loadQuestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add question');
    }
  };

  // Step 1 -> 2: Save / Create Blueprint
  const handleProceedToBank = async () => {
    try {
      const res = await blueprintService.createBlueprint(blueprint);
      if (res.id) {
        setBlueprintId(res.id);
      }
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Blueprint validation error');
    }
  };

  // Step 2 -> 3: Check Feasibility
  const handleCheckFeasibility = async () => {
    if (!blueprintId) {
      const res = await blueprintService.createBlueprint(blueprint);
      setBlueprintId(res.id);
    }
    setCheckingFeasibility(true);
    setGenerationError('');
    try {
      const bId = blueprintId || 'default-spos';
      const res = await blueprintService.checkFeasibility(bId);
      setFeasibility(res.data);
      setStep(3);
    } catch (err) {
      setGenerationError(err.response?.data?.message || err.message || 'Feasibility analysis failed.');
    } finally {
      setCheckingFeasibility(false);
    }
  };

  // Step 3 -> 4: Generate Sets
  const handleGenerateSets = async () => {
    setGenerating(true);
    setGenerationError('');
    try {
      const bId = blueprintId || 'default-spos';
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

  // Question Swap
  const handleOpenReplaceModal = (questionSlot) => {
    setReplacingTarget(questionSlot);
    setReplaceError('');
    setReplaceModalOpen(true);
  };

  const handleConfirmReplace = async (newQuestionId) => {
    if (!generatedPaperData || !replacingTarget) return;
    const currentSet = generatedPaperData.sets[activeSetIndex];
    setReplacingLoading(true);
    setReplaceError('');
    try {
      const res = await questionPaperGeneratorService.replaceQuestion(
        currentSet.id,
        replacingTarget.id,
        newQuestionId
      );
      if (res.success) {
        // Refresh paper data
        const refreshed = await questionPaperGeneratorService.getPaperSets(generatedPaperData.paperId);
        setGeneratedPaperData(refreshed.data);
        setReplaceModalOpen(false);
      }
    } catch (err) {
      setReplaceError(err.response?.data?.message || err.message || 'Failed to replace question.');
    } finally {
      setReplacingLoading(false);
    }
  };

  // Step 5: Final Approval and Secure Submission
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!submissionForm.confirmedApproval) {
      setSubmissionError('You must explicitly review and check the approval box before submitting.');
      return;
    }
    if (!submissionForm.assignedToUserId) {
      setSubmissionError('Please select a recipient faculty member.');
      return;
    }

    const currentSet = generatedPaperData?.sets[activeSetIndex];
    if (!currentSet) {
      setSubmissionError('No active exam set selected.');
      return;
    }

    setSubmitting(true);
    setSubmissionError('');
    try {
      const res = await questionPaperGeneratorService.approveAndSubmit(currentSet.id, {
        assignedToUserId: submissionForm.assignedToUserId,
        examDate: submissionForm.examDate,
      });

      if (onSuccess) {
        onSuccess(res.message || 'Question paper generated and securely submitted!');
      }
    } catch (err) {
      setSubmissionError(err.response?.data?.message || err.message || 'Failed to approve and submit question paper.');
    } finally {
      setSubmitting(false);
    }
  };

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
            <h2 style={styles.title}>Randomized Question Paper Generator</h2>
            <p style={styles.subtitle}>
              Module 18: Curriculum Blueprint &amp; Randomized Multi-Set Generation Pipeline
            </p>
          </div>
        </div>

        {/* Stepper Progress */}
        <div style={styles.stepper}>
          {[
            { num: 1, label: 'Blueprint' },
            { num: 2, label: 'Question Bank' },
            { num: 3, label: 'Feasibility' },
            { num: 4, label: 'Preview & Edit' },
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
      {/* STEP 1: EXAM BLUEPRINT CONFIGURATION                                  */}
      {/* --------------------------------------------------------------------- */}
      {step === 1 && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Step 1: Exam Blueprint &amp; University Structure</h3>
            <p style={styles.cardSubtitle}>
              Configure the examination metadata and alternative OR-group structure. Default pre-loaded with SPPU Systems Programming &amp; OS (May/June 2022 format).
            </p>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Subject Title</label>
              <input
                type="text"
                style={styles.input}
                value={blueprint.subject}
                onChange={(e) => setBlueprint({ ...blueprint, subject: e.target.value })}
              />
            </div>
            <div>
              <label style={styles.label}>Course / Degree</label>
              <input
                type="text"
                style={styles.input}
                value={blueprint.course}
                onChange={(e) => setBlueprint({ ...blueprint, course: e.target.value })}
              />
            </div>
            <div>
              <label style={styles.label}>Pattern &amp; Semester</label>
              <input
                type="text"
                style={styles.input}
                value={`${blueprint.academicPattern} (${blueprint.semester})`}
                disabled
              />
            </div>
            <div>
              <label style={styles.label}>Subject Code</label>
              <input
                type="text"
                style={styles.input}
                value={blueprint.subjectCode}
                onChange={(e) => setBlueprint({ ...blueprint, subjectCode: e.target.value })}
              />
            </div>
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

          {/* OR Group Structure Summary */}
          <div style={styles.summaryBox}>
            <h4 style={styles.summaryTitle}>University OR-Pair Structure (May/June 2022 Reference)</h4>
            <div style={styles.groupList}>
              <div style={styles.groupCard}>
                <strong>Pair 1 (Unit 1):</strong> Q1 (8 + 9 = 17M) <span style={styles.orPill}>OR</span> Q2 (9 + 8 = 17M)
              </div>
              <div style={styles.groupCard}>
                <strong>Pair 2 (Unit 2):</strong> Q3 (8 + 9 = 17M) <span style={styles.orPill}>OR</span> Q4 (8 + 9 = 17M)
              </div>
              <div style={styles.groupCard}>
                <strong>Pair 3 (Unit 3):</strong> Q5 (9 + 9 = 18M) <span style={styles.orPill}>OR</span> Q6 (9 + 9 = 18M)
              </div>
              <div style={styles.groupCard}>
                <strong>Pair 4 (Unit 4):</strong> Q7 (9 + 9 = 18M) <span style={styles.orPill}>OR</span> Q8 (9 + 9 = 18M)
              </div>
            </div>
            <p style={styles.summaryFooter}>
              Total Answered Marks: 17 + 17 + 18 + 18 = <strong>70 Marks</strong>. Candidate answers 1 question per pair.
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
      {/* STEP 2: QUESTION BANK POOL & SEEDING                                  */}
      {/* --------------------------------------------------------------------- */}
      {step === 2 && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={styles.cardTitle}>Step 2: Departmental Question Bank Pool</h3>
                <p style={styles.cardSubtitle}>
                  Questions must be categorized by Unit, Marks, and Difficulty to be eligible for generation.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={styles.actionBtnSecondary}
                  onClick={handleSeedBank}
                  disabled={seedingBank}
                >
                  {seedingBank ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  <span>Seed Standard SPOS Questions</span>
                </button>
                <button
                  type="button"
                  style={styles.actionBtnPrimary}
                  onClick={() => setNewQuestionModalOpen(true)}
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

          {/* Question List */}
          <div style={styles.tableWrapper}>
            {loadingBank ? (
              <div style={styles.loadingState}>
                <Loader2 size={32} className="animate-spin" color="#4f46e5" />
                <p>Loading questions from bank...</p>
              </div>
            ) : questions.length === 0 ? (
              <div style={styles.emptyState}>
                <Database size={40} color="#94a3b8" />
                <p style={{ fontWeight: 600, color: '#334155' }}>No questions found in bank for {blueprint.subject}</p>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Click &ldquo;Seed Standard SPOS Questions&rdquo; above to automatically populate 24 verified university curriculum questions.
                </p>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Question Text</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Marks</th>
                    <th style={styles.th}>Difficulty</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id} style={styles.tr}>
                      <td style={styles.td}>Unit {q.unitNumber}</td>
                      <td style={{ ...styles.td, maxWidth: '400px' }}>
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
              Server-side constraint check ensuring the question bank has sufficient eligible questions without excessive overlap.
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
      {/* STEP 4: UNIVERSITY-STYLE PAPER PREVIEW & EDITING                      */}
      {/* --------------------------------------------------------------------- */}
      {step === 4 && activeSet && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={styles.cardTitle}>Step 4: University Paper Preview &amp; Teacher Review</h3>
                <p style={styles.cardSubtitle}>
                  Formatted matching official SPPU examination layout (May/June 2022). Switch sets or swap questions before final approval.
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

          {/* Authentic University Paper Layout */}
          <div style={styles.paperSheet}>
            {/* Paper Header */}
            <div style={styles.paperTopRow}>
              <div style={{ fontSize: '11px' }}>
                Total No. of Questions : 8] &nbsp;&nbsp;&nbsp; <strong>[{activeSet.setCode}]</strong>
              </div>
              <div style={styles.seatNoBox}>SEAT No. :</div>
            </div>

            <div style={styles.paperHeadingSection}>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                [{activeSet.paperStructureSnapshot.metadata.subjectCode || '310243'}]
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>
                {activeSet.paperStructureSnapshot.metadata.course}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '2px', letterSpacing: '0.5px' }}>
                {(activeSet.paperStructureSnapshot.metadata.subject || '').toUpperCase()}
              </div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                ({activeSet.paperStructureSnapshot.metadata.academicPattern}) ({activeSet.paperStructureSnapshot.metadata.semester})
              </div>
            </div>

            <div style={styles.paperMetaRow}>
              <div>
                <strong>Time : 2½ Hours]</strong>
              </div>
              <div>
                <strong>[Max. Marks : {activeSet.totalMarks}</strong>
              </div>
            </div>

            <hr style={styles.paperDivider} />

            {/* Candidate Instructions */}
            <div style={styles.instructionsBlock}>
              <strong>Instructions to the candidates:</strong>
              <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {(activeSet.paperStructureSnapshot.metadata.instructions || []).map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ol>
            </div>

            <hr style={styles.paperDivider} />

            {/* Questions Body */}
            <div style={styles.questionsBody}>
              {(activeSet.paperStructureSnapshot.sections || []).map((section, sIdx) => (
                <div key={sIdx} style={styles.sectionGroup}>
                  {/* Primary Question */}
                  {section.primaryQuestion && (
                    <div style={styles.questionBlock}>
                      <div style={styles.questionHeader}>
                        <strong>Q{section.primaryQuestion.questionNumber})</strong>
                      </div>
                      <div style={{ flex: 1 }}>
                        {(section.primaryQuestion.subquestions || []).map((sub, subIdx) => (
                          <div key={sub.id || subIdx} style={styles.subquestionRow}>
                            <div style={{ flex: 1 }}>
                              <strong>{sub.part})</strong> {sub.text}
                            </div>
                            <div style={styles.marksRight}>
                              <strong>[{sub.marks}]</strong>
                              <button
                                type="button"
                                style={styles.replaceBtn}
                                onClick={() =>
                                  handleOpenReplaceModal({
                                    id: sub.id,
                                    text: sub.text,
                                    marks: sub.marks,
                                    unit: sub.unit,
                                  })
                                }
                                title="Swap this question with another from bank"
                              >
                                Replace
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Centered OR Divider */}
                  {section.alternativeQuestion && (
                    <div style={styles.orDividerRow}>
                      <div style={styles.orLine} />
                      <span style={styles.orText}>OR</span>
                      <div style={styles.orLine} />
                    </div>
                  )}

                  {/* Alternative Question */}
                  {section.alternativeQuestion && (
                    <div style={styles.questionBlock}>
                      <div style={styles.questionHeader}>
                        <strong>Q{section.alternativeQuestion.questionNumber})</strong>
                      </div>
                      <div style={{ flex: 1 }}>
                        {(section.alternativeQuestion.subquestions || []).map((sub, subIdx) => (
                          <div key={sub.id || subIdx} style={styles.subquestionRow}>
                            <div style={{ flex: 1 }}>
                              <strong>{sub.part})</strong> {sub.text}
                            </div>
                            <div style={styles.marksRight}>
                              <strong>[{sub.marks}]</strong>
                              <button
                                type="button"
                                style={styles.replaceBtn}
                                onClick={() =>
                                  handleOpenReplaceModal({
                                    id: sub.id,
                                    text: sub.text,
                                    marks: sub.marks,
                                    unit: sub.unit,
                                  })
                                }
                                title="Swap this question with another from bank"
                              >
                                Replace
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryButton} onClick={() => setStep(3)}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <button type="button" style={styles.primaryButton} onClick={() => setStep(5)}>
              <span>Proceed to Approval &amp; Submit</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* STEP 5: APPROVAL & SECURE SUBMISSION                                  */}
      {/* --------------------------------------------------------------------- */}
      {step === 5 && activeSet && (
        <div style={styles.stepContent}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Step 5: Teacher Approval &amp; Secure Submission</h3>
            <p style={styles.cardSubtitle}>
              Final sign-off. Approving this set automatically renders the official publication PDF in-memory, signs it with RSA-PSS, encrypts it via AES-256-GCM, and schedules delivery.
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
                  <label style={styles.label}>Designated Recipient Faculty</label>
                  <select
                    style={styles.select}
                    value={submissionForm.assignedToUserId}
                    onChange={(e) =>
                      setSubmissionForm({ ...submissionForm, assignedToUserId: e.target.value })
                    }
                    required
                  >
                    <option value="">Select recipient faculty...</option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.email})
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
                  Security &amp; Cryptographic Assurances:
                </h4>
                <ul style={styles.checklistUl}>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>In-memory vector PDF generation matching official university typography</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>AES-256-GCM envelope encryption with unique random 32-byte DEK and 12-byte IV</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>RSA-PSS-SHA256 digital signature over exact ciphertext buffer before upload</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} color="#059669" />
                    <span>Automatic server-enforced next-day delivery scheduling (time-gated access)</span>
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
                  I confirm that I have reviewed {activeSet.setCode} of &ldquo;{blueprint.subject}&rdquo; and approve it for immediate cryptographic sealing and scheduled distribution.
                </label>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button type="button" style={styles.secondaryButton} onClick={() => setStep(4)}>
                <ArrowLeft size={18} />
                <span>Back to Preview</span>
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
      {/* MODAL: REPLACE QUESTION IN GENERATED SET                              */}
      {/* --------------------------------------------------------------------- */}
      {replaceModalOpen && replacingTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Replace Question ({replacingTarget.marks} Marks, Unit {replacingTarget.unit})</h3>
            <p style={styles.modalSubtitle}>
              Current Question: &ldquo;{replacingTarget.text}&rdquo;
            </p>

            {replaceError && (
              <div style={styles.errorAlert}>
                <AlertCircle size={16} />
                <span>{replaceError}</span>
              </div>
            )}

            <div style={styles.replaceList}>
              {questions
                .filter(
                  (q) =>
                    q.unitNumber === replacingTarget.unit &&
                    q.marks === replacingTarget.marks &&
                    q.id !== replacingTarget.id &&
                    !activeSet.questionIds.includes(q.id)
                )
                .map((candidate) => (
                  <div key={candidate.id} style={styles.candidateCard}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{candidate.questionText}</p>
                      <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                        Difficulty: {candidate.difficulty} | Type: {candidate.questionType}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.selectCandidateBtn}
                      onClick={() => handleConfirmReplace(candidate.id)}
                      disabled={replacingLoading}
                    >
                      Select
                    </button>
                  </div>
                ))}

              {questions.filter(
                (q) =>
                  q.unitNumber === replacingTarget.unit &&
                  q.marks === replacingTarget.marks &&
                  q.id !== replacingTarget.id &&
                  !activeSet.questionIds.includes(q.id)
              ).length === 0 && (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', margin: '20px 0' }}>
                  No alternative unused questions matching {replacingTarget.marks} marks in Unit {replacingTarget.unit} found in bank.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setReplaceModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD CUSTOM QUESTION                                            */}
      {/* --------------------------------------------------------------------- */}
      {newQuestionModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Add Question to Question Bank</h3>
            <form onSubmit={handleCreateQuestion}>
              <div style={styles.grid2}>
                <div>
                  <label style={styles.label}>Unit Number (1-4)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    style={styles.input}
                    value={newQuestionForm.unitNumber}
                    onChange={(e) =>
                      setNewQuestionForm({ ...newQuestionForm, unitNumber: parseInt(e.target.value, 10) })
                    }
                    required
                  />
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

// Inline styles matching ExamGuard Engineering UI design tokens
const styles = {
  wizardContainer: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-md)',
    padding: 'clamp(1rem, 3vw, 1.75rem)',
    border: '1px solid var(--color-border)',
    fontFamily: 'var(--font-inter)',
  },
  wizardHeader: {
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: '20px',
    marginBottom: '24px',
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
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-primary)',
    flexShrink: 0,
  },
  title: {
    fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    margin: '2px 0 0 0',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    overflowX: 'auto',
    padding: '0.5rem 0',
    maxWidth: '650px',
    margin: '0 auto',
    WebkitOverflowScrolling: 'touch',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    minWidth: '60px',
    flexShrink: 0,
  },
  stepCircle: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    transition: 'all 0.2s',
  },
  stepLabel: {
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    fontWeight: '500',
  },
  stepLabelActive: {
    fontSize: '11px',
    color: 'var(--color-primary)',
    fontWeight: '700',
  },
  stepContent: {
    animation: 'fadeIn 0.2s ease-in-out',
  },
  cardHeader: {
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  cardSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--color-text-muted)',
    margin: '4px 0 0 0',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--color-text-secondary)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    fontSize: '0.85rem',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
    outline: 'none',
    backgroundColor: 'var(--color-surface)',
    fontFamily: 'var(--font-inter)',
    minHeight: '44px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    fontSize: '0.85rem',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-surface)',
    outline: 'none',
    fontFamily: 'var(--font-inter)',
    minHeight: '44px',
  },
  summaryBox: {
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    marginTop: '20px',
  },
  summaryTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    margin: '0 0 12px 0',
  },
  groupList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '10px',
  },
  groupCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px',
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
  },
  orPill: {
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-primary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '700',
    fontFamily: 'var(--font-jetbrains)',
  },
  summaryFooter: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    margin: '12px 0 0 0',
    fontFamily: 'var(--font-ibm-plex)',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid var(--color-border)',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '0.85rem',
    border: 'none',
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'background 0.2s',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    padding: '10px 18px',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '0.85rem',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    minHeight: '44px',
  },
  actionBtnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    minHeight: '40px',
  },
  actionBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-text-secondary)',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: '600',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    minHeight: '40px',
  },
  tableWrapper: {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    marginTop: '12px',
  },
  table: {
    width: '100%',
    minWidth: '540px',
    borderCollapse: 'collapse',
    fontSize: '0.825rem',
  },
  thRow: {
    backgroundColor: 'var(--color-surface-subtle)',
    borderBottom: '1px solid var(--color-border)',
  },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tr: {
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  td: {
    padding: '10px 14px',
    color: 'var(--color-text-primary)',
  },
  badgeType: {
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-text-secondary)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'var(--font-jetbrains)',
  },
  badgeDifficulty: {
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'var(--font-jetbrains)',
  },
  badgeApproved: {
    backgroundColor: 'var(--color-success-subtle)',
    color: 'var(--color-success)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600',
  },
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid',
  },
  setTabContainer: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  setTab: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  setTabActive: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  paperSheet: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
    padding: 'clamp(1rem, 3vw, 2.25rem)',
    borderRadius: 'var(--radius-lg)',
    marginTop: '16px',
    overflowX: 'auto',
  },
  paperTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  seatNoBox: {
    border: '1px solid #000000',
    padding: '4px 16px',
    fontSize: '11px',
    fontWeight: 'bold',
    minWidth: '120px',
    fontFamily: 'var(--font-jetbrains)',
  },
  paperHeadingSection: {
    textAlign: 'center',
    margin: '16px 0',
  },
  paperMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    marginTop: '10px',
    flexWrap: 'wrap',
    gap: '0.5rem',
    fontFamily: 'var(--font-ibm-plex)',
    fontVariantNumeric: 'tabular-nums',
  },
  paperDivider: {
    border: 'none',
    borderTop: '1px solid #000000',
    margin: '8px 0',
  },
  instructionsBlock: {
    fontSize: '11px',
    lineHeight: '1.5',
    margin: '8px 0',
  },
  questionsBody: {
    marginTop: '16px',
  },
  sectionGroup: {
    marginBottom: '20px',
  },
  questionBlock: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
  },
  questionHeader: {
    fontSize: '13px',
    fontWeight: 'bold',
    minWidth: '32px',
  },
  subquestionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    fontSize: '13px',
    lineHeight: '1.5',
    marginBottom: '8px',
    gap: '12px',
  },
  marksRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: '12px',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ibm-plex)',
    fontVariantNumeric: 'tabular-nums',
  },
  replaceBtn: {
    fontSize: '11px',
    padding: '3px 8px',
    backgroundColor: 'var(--color-primary-subtle)',
    border: '1px solid var(--color-primary-border)',
    color: 'var(--color-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: '600',
    minHeight: '28px',
  },
  orDividerRow: {
    display: 'flex',
    alignItems: 'center',
    margin: '12px 0',
  },
  orLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--color-border)',
  },
  orText: {
    padding: '0 12px',
    fontWeight: 'bold',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-jetbrains)',
  },
  submissionBox: {
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
  },
  securityChecklist: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    marginTop: '16px',
  },
  checklistUl: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
  },
  approvalCheckboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginTop: '20px',
    padding: '14px',
    backgroundColor: 'var(--color-primary-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-primary-border)',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    marginBottom: '16px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  loadingState: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    maxWidth: 'min(92vw, 600px)',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-xl)',
    border: '1px solid var(--color-border)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '13px',
    color: 'var(--color-text-muted)',
    margin: '4px 0 16px 0',
  },
  replaceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  candidateCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-subtle)',
    gap: '12px',
  },
  selectCandidateBtn: {
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
    flexShrink: 0,
  },
};
