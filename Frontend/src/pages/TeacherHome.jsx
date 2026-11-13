import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import questionPaperService from '../services/questionPaperService';
import answerKeyService from '../services/answerKeyService';
import blueprintService from '../services/blueprintService';
import academicService from '../services/academicService';
import {
  BookOpen,
  Plus,
  FileText,
  Calendar,
  Clock,
  User,
  Download,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  X,
  Upload,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Key,
  FileCheck,
  Sparkles,
  Menu,
  Trash2,
  LayoutDashboard,
  UserCheck,
  Building,
  History,
  Award,
  Save,
} from 'lucide-react';
import QuestionPaperGeneratorWizard from '../components/QuestionPaperGeneratorWizard';
import DeletePaperModal from '../components/DeletePaperModal';
import AlgorithmFlowDiagram from '../components/AlgorithmFlowDiagram';
import AppHeader from '../components/AppHeader';

export default function TeacherHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Navigation tab: 'dashboard' | 'list' | 'assigned' | 'drafts' | 'create' | 'profile'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Teacher Profile State (Module 2.1 & Sprint Corrections)
  const [profileData, setProfileData] = useState(() => user?.profile || {
    name: user?.name || '',
    email: user?.email || '',
    facultyId: `COMP-FAC-${(user?.id || 'FACULTY').slice(0, 6).toUpperCase()}`,
    department: 'Department of Computer Engineering',
    designation: 'Assistant Professor',
    qualification: 'M.E. (Computer Engineering)',
    specialization: 'Computer Engineering & System Architecture',
    experienceYears: 5,
    phone: '',
    mobileNumber: '',
    isActive: true,
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [designationsList, setDesignationsList] = useState([
    'Professor',
    'Associate Professor',
    'Assistant Professor',
    'Lecturer',
  ]);
  const [draftToDelete, setDraftToDelete] = useState(null);

  // Traceable Verification History State (Module 5.4)
  const [historyPaper, setHistoryPaper] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Drafts state (Module 23 & Lifecycle)
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftsError, setDraftsError] = useState('');
  const [activeDraft, setActiveDraft] = useState(null);

  // Question Papers state (Authored)
  const [papers, setPapers] = useState([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [papersError, setPapersError] = useState('');

  // Assigned Question Papers state (Assigned to Authenticated Faculty - Module 12 & 15)
  const [assignedPapers, setAssignedPapers] = useState([]);
  const [loadingAssignedPapers, setLoadingAssignedPapers] = useState(false);
  const [assignedPapersError, setAssignedPapersError] = useState('');

  // In-app Action Notification Alert with Auto-Dismiss (3-5s success, 5-7s error)
  const [actionAlert, setActionAlertState] = useState(null);
  const actionAlertTimerRef = useRef(null);
  const setActionAlert = useCallback((alert) => {
    if (actionAlertTimerRef.current) clearTimeout(actionAlertTimerRef.current);
    setActionAlertState(alert);
    if (alert) {
      const duration = alert.type === 'success' || alert.type === 'info' ? 4000 : 6000;
      actionAlertTimerRef.current = setTimeout(() => {
        setActionAlertState(null);
      }, duration);
    }
  }, []);

  // Digital Signature Verification state (Module 7)
  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationResults, setVerificationResults] = useState({});

  // Question Paper Deletion state (Module 20)
  const [paperToDelete, setPaperToDelete] = useState(null);
  const [isDeletingPaper, setIsDeletingPaper] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  // Cryptographic Algorithm Flow Modal state (Module 20)
  const [showAlgorithmModal, setShowAlgorithmModal] = useState(false);

  // Eligible Recipients for dropdown
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    semester: 'Semester 5',
    academicYear: '2026-2027',
    examType: 'End Semester Examination',
    examDate: '',
    assignedToUserId: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Details Modal State
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Answer Key State (Module 10)
  const [answerKeyModalPaper, setAnswerKeyModalPaper] = useState(null);
  const [answerKeyData, setAnswerKeyData] = useState(null);
  const [loadingAnswerKey, setLoadingAnswerKey] = useState(false);
  const [answerKeyError, setAnswerKeyError] = useState('');
  const [answerKeySuccess, setAnswerKeySuccess] = useState('');
  const [answerKeyFile, setAnswerKeyFile] = useState(null);
  const [uploadingAnswerKey, setUploadingAnswerKey] = useState(false);
  const [downloadingAnswerKey, setDownloadingAnswerKey] = useState(false);
  const [verifyingAnswerKey, setVerifyingAnswerKey] = useState(false);
  const [answerKeyVerifyResult, setAnswerKeyVerifyResult] = useState(null);

  // Search/Filter State
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const loadAnswerKeyDetails = async (paperId) => {
    setLoadingAnswerKey(true);
    setAnswerKeyError('');
    try {
      const data = await answerKeyService.getTeacherAnswerKey(paperId);
      setAnswerKeyData(data);
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Failed to load answer key details.');
    } finally {
      setLoadingAnswerKey(false);
    }
  };

  const handleOpenAnswerKeyModal = (paper) => {
    setAnswerKeyModalPaper(paper);
    setAnswerKeyData(null);
    setAnswerKeyError('');
    setAnswerKeySuccess('');
    setAnswerKeyFile(null);
    setAnswerKeyVerifyResult(null);
    loadAnswerKeyDetails(paper.id);
  };

  const handleUploadAnswerKey = async (e) => {
    e.preventDefault();
    if (!answerKeyFile) {
      setAnswerKeyError('Please select a PDF answer key file to upload.');
      return;
    }
    setUploadingAnswerKey(true);
    setAnswerKeyError('');
    setAnswerKeySuccess('');
    try {
      await answerKeyService.uploadTeacherAnswerKey(answerKeyModalPaper.id, answerKeyFile);
      setAnswerKeySuccess('Answer key encrypted and uploaded successfully with RSA-PSS digital signature!');
      setAnswerKeyFile(null);
      await loadAnswerKeyDetails(answerKeyModalPaper.id);
      fetchPapers();
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Failed to upload answer key.');
    } finally {
      setUploadingAnswerKey(false);
    }
  };

  const handleDownloadAnswerKey = async () => {
    if (!answerKeyModalPaper) return;
    setDownloadingAnswerKey(true);
    setAnswerKeyError('');
    try {
      await answerKeyService.downloadTeacherAnswerKey(
        answerKeyModalPaper.id,
        answerKeyData?.fileName || `${answerKeyModalPaper.subject}_AnswerKey.pdf`
      );
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Failed to download answer key.');
    } finally {
      setDownloadingAnswerKey(false);
    }
  };

  const handleVerifyAnswerKeySignature = async () => {
    if (!answerKeyModalPaper) return;
    setVerifyingAnswerKey(true);
    setAnswerKeyError('');
    try {
      const result = await answerKeyService.verifyTeacherAnswerKeySignature(answerKeyModalPaper.id);
      setAnswerKeyVerifyResult(result);
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Signature verification failed.');
    } finally {
      setVerifyingAnswerKey(false);
    }
  };

  // Fetch Teacher's Question Papers
  const fetchPapers = useCallback(async () => {
    setLoadingPapers(true);
    setPapersError('');
    try {
      const data = await questionPaperService.getMyQuestionPapers();
      setPapers(data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load question papers.';
      setPapersError(msg);
    } finally {
      setLoadingPapers(false);
    }
  }, []);

  // Fetch Question Papers Assigned to Authenticated Faculty (Module 12 & 15)
  const fetchAssignedPapers = useCallback(async () => {
    setLoadingAssignedPapers(true);
    setAssignedPapersError('');
    try {
      const data = await questionPaperService.getAssignedQuestionPapers();
      setAssignedPapers(data || []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load assigned question papers.';
      setAssignedPapersError(msg);
    } finally {
      setLoadingAssignedPapers(false);
    }
  }, []);

  // Fetch Eligible Faculty Recipients
  const fetchRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const list = await questionPaperService.getEligibleRecipients();
      setRecipients(list);
      // Default to first recipient if not set
      if (list && list.length > 0) {
        setFormData((prev) => (prev.assignedToUserId ? prev : { ...prev, assignedToUserId: list[0].id }));
      }
    } catch (err) {
      console.error('Failed to load recipients:', err);
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  // Fetch Saved Paper Drafts (Module 23)
  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    setDraftsError('');
    try {
      const res = await blueprintService.listDrafts();
      setDrafts(res.data || []);
    } catch (err) {
      console.warn('Failed to load drafts:', err);
      setDraftsError('Could not load drafts list.');
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  // Fetch Teacher Profile (Module 2.1)
  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    setProfileError('');
    try {
      const [res, desigRes] = await Promise.all([
        authService.getProfile().catch(() => ({ data: null })),
        academicService.getDesignations().catch(() => ({ data: [] })),
      ]);
      if (res?.data) {
        setProfileData(res.data);
      }
      if (desigRes?.data && desigRes.data.length > 0) {
        const dNames = desigRes.data.map(d => typeof d === 'string' ? d : d.name);
        setDesignationsList(dNames);
      }
    } catch (err) {
      console.warn('Failed to fetch profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
    fetchAssignedPapers();
    fetchRecipients();
    fetchDrafts();
    fetchProfile();
  }, [fetchPapers, fetchAssignedPapers, fetchRecipients, fetchDrafts, fetchProfile]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    const phoneVal = (profileData?.phone || profileData?.mobileNumber || '').trim();
    // Contact number validation (if provided)
    if (phoneVal) {
      const phoneRegex = /^\+?[0-9\s-]{10,15}$/;
      if (!phoneRegex.test(phoneVal)) {
        setProfileError('Please enter a valid 10-15 digit phone number (e.g. +91 9876543210 or 9876543210).');
        setSavingProfile(false);
        return;
      }
    }

    try {
      // Keep department strictly locked to Computer Engineering
      const payload = {
        name: (profileData?.name || '').trim(),
        designation: profileData?.designation || 'Assistant Professor',
        phone: phoneVal,
        mobileNumber: phoneVal,
        qualification: (profileData?.qualification || '').trim(),
        specialization: (profileData?.specialization || '').trim(),
        experienceYears: Number(profileData?.experienceYears || profileData?.experience_years || 0),
        department: 'Department of Computer Engineering',
      };
      const res = await authService.updateProfile(payload);
      if (res.data) {
        setProfileData(res.data);
      }
      setProfileSuccess('Faculty profile updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || err.message || 'Failed to update profile.');
      setTimeout(() => setProfileError(''), 6000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenVerificationHistory = async (paper) => {
    setHistoryPaper(paper);
    setVerificationHistory([]);
    setLoadingHistory(true);
    try {
      const history = await questionPaperService.getVerificationHistory(paper.id);
      setVerificationHistory(history || []);
    } catch (err) {
      console.warn('Failed to load verification history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Resume Draft Handler
  const handleResumeDraft = (draft) => {
    setActiveDraft(draft);
    setActiveTab('create');
  };

  // Delete Draft Handler with inline confirmation modal
  const handleDeleteDraft = (draftId, draftTitle) => {
    setDraftToDelete({ id: draftId, title: draftTitle || 'Untitled Draft' });
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;
    try {
      await blueprintService.deleteDraft(draftToDelete.id);
      setActionAlert({
        type: 'success',
        message: `Draft "${draftToDelete.title}" was deleted successfully.`,
      });
      fetchDrafts();
      setDraftToDelete(null);
    } catch (err) {
      setActionAlert({
        type: 'danger',
        message: `Failed to delete draft: ${err.message}`,
      });
      setDraftToDelete(null);
    }
  };

  // Form Field Change Handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // File Change Handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFormError('Invalid file type. Only PDF documents (.pdf) are permitted.');
      setSelectedFile(null);
      return;
    }

    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setFormError(`File size exceeds ${maxSizeMb} MB limit.`);
      setSelectedFile(null);
      return;
    }

    setFormError('');
    setSelectedFile(file);
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Validations
    if (!formData.title.trim() || !formData.subject.trim() || !formData.examDate) {
      setFormError('Please fill in all required metadata fields.');
      return;
    }

    if (!formData.assignedToUserId) {
      setFormError('Please select a recipient faculty member.');
      return;
    }

    if (!selectedFile) {
      setFormError('Please select a valid question paper PDF file.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('title', formData.title.trim());
      payload.append('subject', formData.subject.trim());
      payload.append('semester', formData.semester);
      payload.append('academicYear', formData.academicYear);
      payload.append('examType', formData.examType);
      payload.append('examDate', formData.examDate);
      payload.append('assignedToUserId', formData.assignedToUserId);
      payload.append('file', selectedFile);

      await questionPaperService.submitQuestionPaper(payload);

      setFormSuccess('Question paper submitted successfully! Next-day delivery has been scheduled.');
      // Reset form
      setFormData((prev) => ({
        ...prev,
        title: '',
        subject: '',
        examDate: '',
      }));
      setSelectedFile(null);

      // Refresh list and switch to list tab after short delay
      fetchPapers();
      setTimeout(() => {
        setActiveTab('list');
        setFormSuccess('');
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit question paper.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Download Request (Module 6: Decrypted PDF Stream with Module 7 Verify-Before-Decrypt)
  const handleDownload = async (paperId, fileName = 'question_paper.pdf') => {
    setDownloadingId(paperId);
    setActionAlert(null);
    try {
      await questionPaperService.downloadQuestionPaper(paperId, fileName);
      setActionAlert({
        type: 'success',
        message: `Question paper "${fileName}" successfully decrypted and downloaded.`,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to download question paper.';
      setActionAlert({
        type: 'danger',
        message: `Download failed: ${msg}`,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Live Signature & Integrity Verification (Module 7)
  const handleVerifySignature = async (paperId) => {
    setVerifyingId(paperId);
    setActionAlert(null);
    try {
      const res = await questionPaperService.verifySignature(paperId);
      setVerificationResults((prev) => ({
        ...prev,
        [paperId]: {
          verified: res.verified,
          tamperDetected: res.tamperDetected,
          algorithm: res.algorithm,
          fileHash: res.fileHash,
          checkedAt: new Date().toLocaleTimeString(),
        },
      }));
      if (res.verified) {
        setActionAlert({
          type: 'success',
          message: `Integrity check PASSED: Ciphertext hash matches RSA-PSS signature (${res.algorithm || 'RSA-PSS-SHA256'}).`,
        });
      } else {
        setActionAlert({
          type: 'danger',
          message: 'CRITICAL SECURITY ALERT: Digital signature or ciphertext hash verification failed! Document may be tampered.',
        });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Verification check failed';
      setVerificationResults((prev) => ({
        ...prev,
        [paperId]: {
          verified: false,
          tamperDetected: true,
          error: msg,
          checkedAt: new Date().toLocaleTimeString(),
        },
      }));
      setActionAlert({
        type: 'danger',
        message: `Verification error: ${msg}`,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  // Open delete confirmation modal
  const handleOpenDeleteModal = (paper) => {
    setPaperToDelete(paper);
    setDeleteError('');
  };

  // Execute secure question paper deletion (Module 20)
  const handleConfirmDelete = async (paperId, reason) => {
    setIsDeletingPaper(true);
    setDeleteError('');
    try {
      await questionPaperService.deleteQuestionPaper(paperId, reason);
      const deletedTitle = paperToDelete?.title || 'Paper';
      setDeleteSuccess(`Question paper "${deletedTitle}" was successfully deleted from storage and archived.`);
      setPaperToDelete(null);
      if (selectedPaper?.id === paperId) {
        setSelectedPaper(null);
      }
      setActionAlert({
        type: 'success',
        message: `Question paper "${deletedTitle}" deleted successfully.`,
      });
      await fetchPapers();
      setTimeout(() => setDeleteSuccess(''), 6000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete question paper.';
      setDeleteError(msg);
    } finally {
      setIsDeletingPaper(false);
    }
  };

  // Filtered Papers (Authored)
  const filteredPapers = papers.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.subject?.toLowerCase().includes(q) ||
      p.exam_type?.toLowerCase().includes(q)
    );
  });

  // Filtered Assigned Papers (Assigned to Me)
  const filteredAssignedPapers = assignedPapers.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.subject?.toLowerCase().includes(q) ||
      p.examType?.toLowerCase().includes(q) ||
      p.teacher?.name?.toLowerCase().includes(q)
    );
  });

  // KPI Statistics for Dashboard (Module 2.2)
  const stats = useMemo(() => {
    const authoredCount = papers.length;
    const assignedCount = assignedPapers.length;
    const pendingVerification = papers.filter(
      (p) => (p.review_status === 'PENDING_REVIEW' || p.review_status === 'PENDING' || !p.review_status) && p.status !== 'DRAFT'
    ).length;
    const verifiedCount = papers.filter(
      (p) => p.review_status === 'REVIEWED' || p.review_status === 'RECOMMENDED' || p.admin_approval_status === 'APPROVED' || p.status === 'SCHEDULED' || p.status === 'DELIVERED'
    ).length;
    const rejectedCount = papers.filter(
      (p) => p.review_status === 'REJECTED' || p.review_status === 'RETURNED' || p.admin_approval_status === 'REJECTED' || p.admin_approval_status === 'RETURNED'
    ).length;
    const draftsCount = drafts.length;

    return {
      authoredCount,
      assignedCount,
      pendingVerification,
      verifiedCount,
      rejectedCount,
      draftsCount,
    };
  }, [papers, assignedPapers, drafts]);

  const teacherNavTabs = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: UserCheck },
    { id: 'list', label: 'My Papers', icon: Layers, badge: papers.length },
    { id: 'drafts', label: 'Drafts', icon: Sparkles, badge: drafts.length },
    { id: 'create', label: '+ Create Paper', icon: Plus, isPrimary: true },
  ], [papers.length, drafts.length]);

  return (
    <div style={styles.container}>
      {/* Unified Modern Academic Navigation Header */}
      <AppHeader
        user={user}
        role="TEACHER"
        activeTab={activeTab}
        onTabChange={(tabId) => {
          if (tabId === 'create') {
            setActiveDraft(null);
          }
          setActiveTab(tabId);
        }}
        tabs={teacherNavTabs}
        onOpenAlgorithmFlow={() => setShowAlgorithmModal(true)}
        onLogout={handleLogout}
        profileData={profileData}
      />

      {/* Main Content Container */}
      <main style={styles.main}>
        {/* Global Action Alert */}
        {actionAlert && (
          <div
            style={{
              ...(actionAlert.type === 'success' ? styles.alertSuccess : styles.alertError),
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {actionAlert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{actionAlert.message}</span>
            </div>
            <button
              onClick={() => setActionAlert(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.2rem' }}
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        )}



        {/* TAB 0: PERSONALIZED DASHBOARD (MODULE 2.2) */}
        {activeTab === 'dashboard' && (
          <div style={styles.tabContent}>
            {/* Welcome & Faculty Profile Banner */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem',
                marginBottom: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--color-primary-subtle)',
                      color: 'var(--color-primary)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Building size={12} />
                    Department of Computer Engineering
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-jetbrains)',
                    }}
                  >
                    ID: {profileData?.facultyId || 'COMP-FACULTY'}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-structure)', margin: '0 0 0.25rem 0' }}>
                  Welcome back, Professor {profileData?.name || user?.name}!
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Manage secure question paper authoring, digital verification status, and assigned colleague papers.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDraft(null);
                    setActiveTab('create');
                  }}
                  style={{
                    ...styles.submitBtn,
                    padding: '0.6rem 1.1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Plus size={16} />
                  <span>Create Paper</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  style={{
                    ...styles.secondaryBtn,
                    padding: '0.6rem 1.1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  <User size={16} />
                  <span>My Profile</span>
                </button>
              </div>
            </div>

            {/* KPI Metric Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: '1rem',
                marginBottom: '1.75rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('list')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Created by Me</span>
                  <Layers size={18} color="#0284c7" />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0284c7', margin: '0.5rem 0 0.2rem 0' }}>
                  {stats.authoredCount}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total examination papers</span>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('list')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Pending Verification</span>
                  <Clock size={18} color="#f59e0b" />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f59e0b', margin: '0.5rem 0 0.2rem 0' }}>
                  {stats.pendingVerification}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Under review by coordinator</span>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('list')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Verified &amp; Approved</span>
                  <CheckCircle2 size={18} color="#10b981" />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#10b981', margin: '0.5rem 0 0.2rem 0' }}>
                  {stats.verifiedCount}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Digitally verified papers</span>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('list')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Needs Revision</span>
                  <AlertCircle size={18} color="#ef4444" />
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ef4444', margin: '0.5rem 0 0.2rem 0' }}>
                  {stats.rejectedCount}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Returned or rejected</span>
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            {/* Recent Authored Papers Summary */}
            <div style={styles.statsBanner}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-structure)', margin: '0 0 0.25rem 0' }}>
                  Recent Examination Papers
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Latest question papers authored for the Computer Engineering Department.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                View All &rarr;
              </button>
            </div>

            {papers.length === 0 ? (
              <div style={styles.emptyState}>
                <BookOpen size={44} color="#94a3b8" />
                <h3 style={styles.emptyTitle}>No Examination Papers Authored Yet</h3>
                <p style={styles.emptySubtitle}>
                  You have not created any question papers yet. Click &quot;Create Paper&quot; above to launch the builder with university templates and diagram support.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {papers.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={styles.subjectPill}>{p.subject}</span>
                        <span style={styles.statusBadge}>{p.status}</span>
                      </div>
                      <h4 style={{ margin: '0.35rem 0 0.2rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-structure)' }}>
                        {p.title}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Semester: {p.semester} • Exam Date: {p.exam_date || 'TBD'} • Created: {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {p.review_status === 'REVIEWED' || p.review_status === 'RECOMMENDED' ? (
                        <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Verified {p.reviewer?.name ? `by ${p.reviewer.name}` : ''}
                        </span>
                      ) : p.review_status === 'RETURNED' ? (
                        <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={14} /> Returned for Revision
                        </span>
                      ) : p.review_status === 'REJECTED' ? (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={14} /> Rejected
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> Pending Verification
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedPaper(p)}
                        style={{ ...styles.actionBtn, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        <Eye size={14} />
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 0.5: MY FACULTY PROFILE (MODULE 2.1) */}
        {activeTab === 'profile' && (
          <div style={styles.tabContent}>
            <div style={styles.statsBanner}>
              <div>
                <h2 style={styles.sectionHeading}>My Faculty Profile</h2>
                <p style={styles.sectionSubtitle}>
                  Institutional credentials and profile settings strictly affiliated with the Computer Engineering Department.
                </p>
              </div>
            </div>

            {profileSuccess && (
              <div style={styles.alertSuccess}>
                <CheckCircle2 size={18} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div style={styles.alertError}>
                <AlertCircle size={18} />
                <span>{profileError}</span>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
                gap: '1.5rem',
                marginTop: '1rem',
              }}
            >
              {/* Institutional ID Badge Card */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--color-primary-border)',
                    }}
                  >
                    <User size={28} color="var(--color-primary)" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-structure)' }}>
                      {profileData?.name || user?.name}
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {profileData?.email || user?.email}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px' }}>
                      {profileData?.designation || 'Assistant Professor'}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Department:</span>
                    <strong style={{ color: 'var(--color-structure)' }}>Department of Computer Engineering</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Faculty ID:</span>
                    <strong style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--color-primary)' }}>
                      {profileData?.facultyId || profileData?.faculty_id || 'COMP-FAC-001'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Account Status:</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>● Active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Role Scope:</span>
                    <span>TEACHER (Computer Engineering)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Mobile Number:</span>
                    <span style={{ fontWeight: 600 }}>{profileData?.phone || profileData?.mobileNumber || profileData?.mobile_number || 'Not configured'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Qualification:</span>
                    <span>{profileData?.qualification || 'M.E. (Computer Engineering)'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Specialization:</span>
                    <span>{profileData?.specialization || 'Computer Engineering & System Architecture'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Experience:</span>
                    <span>{profileData?.experienceYears || profileData?.experience_years ? `${profileData.experienceYears || profileData.experience_years} Years` : '5 Years'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Account Created:</span>
                    <span>{user?.created_at || user?.createdAt ? new Date(user.created_at || user.createdAt).toLocaleDateString() : 'Active Member'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Last Profile Update:</span>
                    <span>{profileData?.updatedAt || profileData?.updated_at ? new Date(profileData.updatedAt || profileData.updated_at).toLocaleString() : 'Recently'}</span>
                  </div>
                </div>
              </div>

              {/* Profile Details Edit Form */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-structure)', margin: '0 0 1rem 0' }}>
                  Update Profile Information
                </h3>

                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={styles.label}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      style={styles.input}
                      value={profileData?.name || ''}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder="e.g. Dr. A. P. Sharma"
                      required
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Email Address (Institutional)</label>
                    <input
                      type="email"
                      style={{ ...styles.input, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
                      value={profileData?.email || user?.email || ''}
                      disabled
                      readOnly
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={styles.label}>Faculty ID (System-Generated)</label>
                      <span style={{ fontSize: '11px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        IMMUTABLE
                      </span>
                    </div>
                    <input
                      type="text"
                      style={{ ...styles.input, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', cursor: 'not-allowed', fontFamily: 'var(--font-jetbrains)' }}
                      value={profileData?.facultyId || profileData?.faculty_id || `COMP-FAC-${(user?.id || 'FACULTY').slice(0, 6).toUpperCase()}`}
                      readOnly
                      disabled
                      title="Faculty ID is permanent and managed by the institution."
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Academic Department (Locked)</label>
                    <input
                      type="text"
                      style={{ ...styles.input, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
                      value="Department of Computer Engineering"
                      disabled
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                      ExamGuard is exclusively for the Computer Engineering Department.
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Academic Designation</label>
                    <select
                      style={styles.select}
                      value={profileData?.designation || 'Assistant Professor'}
                      onChange={(e) => setProfileData({ ...profileData, designation: e.target.value })}
                    >
                      {designationsList.map((d, idx) => (
                        <option key={idx} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Mobile / Phone Number</label>
                    <input
                      type="tel"
                      style={styles.input}
                      value={profileData?.phone || profileData?.mobileNumber || ''}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value, mobileNumber: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                      Institutional contact phone for urgent Examination Cell notifications and Resend SMS/email alerts.
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Highest Qualification</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={profileData?.qualification || ''}
                      onChange={(e) => setProfileData({ ...profileData, qualification: e.target.value })}
                      placeholder="e.g. Ph.D. (Computer Engg), M.Tech (CSE)"
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Area of Specialization</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={profileData?.specialization || ''}
                      onChange={(e) => setProfileData({ ...profileData, specialization: e.target.value })}
                      placeholder="e.g. Cryptography, Distributed Systems, AI/ML"
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Teaching / Professional Experience (Years)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      style={styles.input}
                      value={profileData?.experienceYears ?? profileData?.experience_years ?? 5}
                      onChange={(e) => setProfileData({ ...profileData, experienceYears: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      ...styles.submitBtn,
                      marginTop: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {savingProfile ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: LIST QUESTION PAPERS */}
        {activeTab === 'list' && (
          <div style={styles.tabContent}>
            {/* Header / Stats Banner */}
            <div style={styles.statsBanner}>
              <div>
                <h2 style={styles.sectionHeading}>Authored Question Papers</h2>
                <p style={styles.sectionSubtitle}>
                  View and manage all examination question papers created by your account.
                </p>
              </div>

              <div style={styles.bannerActions}>
                <button onClick={fetchPapers} style={styles.refreshBtn} title="Refresh Papers List">
                  <RefreshCw size={16} className={loadingPapers ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
                <button onClick={() => setActiveTab('create')} style={styles.primaryAddBtn}>
                  <Plus size={16} />
                  <span>New Paper</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div style={styles.searchBarWrapper}>
              <input
                type="text"
                placeholder="Search by subject, title, or exam type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {/* Error Alert */}
            {papersError && (
              <div style={styles.alertError}>
                <AlertCircle size={18} />
                <span>{papersError}</span>
              </div>
            )}

            {/* Loading State */}
            {loadingPapers ? (
              <div style={styles.loadingContainer}>
                <Loader2 size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Loading question papers from Supabase...</span>
              </div>
            ) : filteredPapers.length === 0 ? (
              /* Empty State */
              <div style={styles.emptyState}>
                <FileText size={48} color="#64748b" />
                <h3 style={styles.emptyTitle}>No Question Papers Found</h3>
                <p style={styles.emptySubtitle}>
                  {searchTerm
                    ? 'No question papers match your search criteria.'
                    : 'You have not submitted any question papers yet.'}
                </p>
                {!searchTerm && (
                  <button onClick={() => setActiveTab('create')} style={styles.emptyActionBtn}>
                    <Plus size={16} />
                    <span>Create Your First Question Paper</span>
                  </button>
                )}
              </div>
            ) : (
              /* Paper Cards Grid */
              <div style={styles.papersGrid}>
                {filteredPapers.map((paper) => {
                  const assignment = paper.question_paper_assignments?.[0];
                  const recipient = assignment?.recipient;

                  return (
                    <div key={paper.id} style={styles.paperCard}>
                      <div style={styles.cardHeader}>
                        <div style={styles.subjectPill}>{paper.subject}</div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span style={styles.signatureBadge} title="RSA-PSS SHA-256 Digital Signature Verified">
                            <ShieldCheck size={11} color="#34d399" />
                            <span>Signature Verified</span>
                          </span>
                          <span style={styles.statusBadge}>{paper.status}</span>
                        </div>
                      </div>

                      <h3 style={styles.paperTitle}>{paper.title}</h3>

                      {/* Module 5.3: Authorized Verifier Display & Decision Status */}
                      <div
                        style={{
                          margin: '0.5rem 0',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '6px',
                          border:
                            paper.review_status === 'RECOMMENDED' || paper.review_status === 'REVIEWED' || paper.admin_approval_status === 'APPROVED'
                              ? '1px solid #bbf7d0'
                              : paper.review_status === 'RETURNED' || paper.admin_approval_status === 'RETURNED'
                              ? '1px solid #fde68a'
                              : paper.review_status === 'REJECTED' || paper.admin_approval_status === 'REJECTED'
                              ? '1px solid #fca5a5'
                              : '1px solid #e2e8f0',
                          backgroundColor:
                            paper.review_status === 'RECOMMENDED' || paper.review_status === 'REVIEWED' || paper.admin_approval_status === 'APPROVED'
                              ? '#f0fdf4'
                              : paper.review_status === 'RETURNED' || paper.admin_approval_status === 'RETURNED'
                              ? '#fffbeb'
                              : paper.review_status === 'REJECTED' || paper.admin_approval_status === 'REJECTED'
                              ? '#fef2f2'
                              : '#f8fafc',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-structure)' }}>
                            {paper.review_status === 'RECOMMENDED' || paper.review_status === 'REVIEWED' || paper.admin_approval_status === 'APPROVED'
                              ? '✔ Verified'
                              : paper.review_status === 'RETURNED' || paper.admin_approval_status === 'RETURNED'
                              ? '⚠ Returned for Revision'
                              : paper.review_status === 'REJECTED' || paper.admin_approval_status === 'REJECTED'
                              ? '✖ Rejected'
                              : '⏳ Pending Verification'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenVerificationHistory(paper)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: 0,
                            }}
                          >
                            <History size={12} />
                            <span>Audit History</span>
                          </button>
                        </div>

                        {paper.reviewer?.name ? (
                          <div style={{ color: '#334155', marginTop: '3px' }}>
                            <strong>Verified by:</strong> {paper.reviewer.name}
                            {paper.reviewed_at && (
                              <span style={{ color: '#64748b' }}>
                                {' '}• {new Date(paper.reviewed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : paper.review_status && paper.review_status !== 'PENDING_REVIEW' && paper.review_status !== 'PENDING' ? (
                          <div style={{ color: '#334155', marginTop: '3px' }}>
                            <strong>Decision:</strong> {paper.review_status}
                            {paper.reviewed_at && (
                              <span style={{ color: '#64748b' }}>
                                {' '}• {new Date(paper.reviewed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#64748b', marginTop: '3px' }}>
                            Awaiting verification by Exam Coordinator.
                          </div>
                        )}

                        {(paper.review_comments || paper.admin_comments) && (
                          <div style={{ color: '#475569', fontStyle: 'italic', marginTop: '3px' }}>
                            &quot;{paper.review_comments || paper.admin_comments}&quot;
                          </div>
                        )}
                      </div>

                      <div style={styles.metaRows}>
                        <div style={styles.metaRow}>
                          <Calendar size={14} color="#94a3b8" />
                          <span>
                            <strong>Exam Date:</strong> {paper.exam_date}
                          </span>
                        </div>

                        <div style={styles.metaRow}>
                          <Clock size={14} color="#94a3b8" />
                          <span>
                            <strong>Submitted:</strong>{' '}
                            {paper.submitted_at ? new Date(paper.submitted_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>

                        <div style={styles.deliveryRow}>
                          <Clock size={14} color="#38bdf8" />
                          <span>
                            <strong>Next-Day Delivery:</strong>{' '}
                            <span style={styles.deliveryDateHighlight}>
                              {paper.scheduled_delivery_date || assignment?.scheduled_delivery_date || 'N/A'}
                            </span>
                          </span>
                        </div>

                        <div style={styles.metaRow}>
                          <User size={14} color="#94a3b8" />
                          <span>
                            <strong>Assigned Faculty:</strong>{' '}
                            {recipient ? `${recipient.name} (${recipient.email})` : 'Assigned Faculty'}
                          </span>
                        </div>
                      </div>

                                            {/* Collapsible Cryptographic Security Details */}
                      <details style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1', outline: 'none' }}>
                          🔒 Security &amp; Cryptographic Details
                        </summary>
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#475569' }}>
                          <div><strong>Cipher:</strong> AES-256-GCM (Payload)</div>
                          <div><strong>Envelope Key:</strong> RSA-OAEP (2048-bit)</div>
                          <div><strong>Digital Signature:</strong> RSA-PSS (SHA-256)</div>
                          <div><strong>Integrity Digest:</strong> SHA-256 Validated</div>
                        </div>
                        {verificationResults[paper.id] && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: verificationResults[paper.id].verified ? '#dcfce7' : '#fee2e2',
                              color: verificationResults[paper.id].verified ? '#15803d' : '#991b1b',
                              fontWeight: 600,
                            }}
                          >
                            {verificationResults[paper.id].verified
                              ? '✔ RSA-PSS Signature & SHA-256 Verified Valid'
                              : '✖ Signature or Integrity Check Failed'}
                          </div>
                        )}
                      </details>

                      <div style={styles.cardFooter}>
                        <span style={styles.fileInfoText}>
                          PDF • {(paper.file_size / 1024).toFixed(1)} KB
                        </span>

                        <div style={styles.cardBtnGroup}>
                          <button
                            onClick={() => handleVerifySignature(paper.id)}
                            disabled={verifyingId === paper.id}
                            style={styles.verifyCardBtn}
                            title="Verify RSA-PSS Signature & Integrity"
                          >
                            {verifyingId === paper.id ? (
                              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <ShieldCheck size={13} />
                            )}
                            <span>Verify</span>
                          </button>

                          <button
                            onClick={() => handleOpenAnswerKeyModal(paper)}
                            style={styles.answerKeyCardBtn}
                            title="Manage Answer Key"
                          >
                            <Key size={13} />
                            <span>Answer Key</span>
                          </button>

                          <button
                            onClick={() => setSelectedPaper(paper)}
                            style={styles.viewBtn}
                            title="View Full Metadata"
                          >
                            <Eye size={15} />
                            <span>Details</span>
                          </button>

                          <span
                            style={styles.cellSecuredBadge}
                            title="Under strict Exam Cell policy, final examination papers can only be downloaded and decrypted by the authorized Exam Coordinator."
                          >
                            <ShieldCheck size={13} color="#0284c7" />
                            <span>Exam Cell Locked</span>
                          </span>

                          {paper.status !== 'DELIVERED' && paper.status !== 'ARCHIVED' && paper.status !== 'DELETED' && (
                            <button
                              onClick={() => handleOpenDeleteModal(paper)}
                              style={styles.deleteCardBtn}
                              title="Delete Question Paper"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2B: DRAFTS (MODULE 23) */}
        {activeTab === 'drafts' && (
          <div style={styles.tabContent}>
            {/* Header / Stats Banner */}
            <div style={styles.statsBanner}>
              <div>
                <h2 style={styles.sectionHeading}>Question Paper Drafts</h2>
                <p style={styles.sectionSubtitle}>
                  Multi-day saved examination drafts. Resume or edit your work anytime without data loss.
                </p>
              </div>

              <div style={styles.bannerActions}>
                <button onClick={fetchDrafts} style={styles.refreshBtn} title="Refresh Drafts">
                  <RefreshCw size={16} className={loadingDrafts ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => {
                    setActiveDraft(null);
                    setActiveTab('create');
                  }}
                  style={styles.createPaperBtn}
                >
                  <Plus size={16} />
                  <span>New Paper Draft</span>
                </button>
              </div>
            </div>

            {draftsError && (
              <div style={styles.alertError}>
                <AlertCircle size={18} />
                <span>{draftsError}</span>
              </div>
            )}

            {loadingDrafts ? (
              <div style={styles.loadingContainer}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '0.75rem', color: 'var(--color-structure-muted)' }}>Loading saved drafts...</p>
              </div>
            ) : drafts.length === 0 ? (
              <div style={styles.emptyState}>
                <Sparkles size={48} color="var(--color-structure-muted)" />
                <h3 style={styles.emptyTitle}>No saved drafts found</h3>
                <p style={styles.emptySubtitle}>
                  You have no pending drafts. Start generating an examination paper and click &ldquo;Save Draft&rdquo; at any stage to work across multiple days.
                </p>
                <button
                  onClick={() => {
                    setActiveDraft(null);
                    setActiveTab('create');
                  }}
                  style={{ ...styles.submitBtn, width: 'auto', marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Plus size={16} />
                  <span>Create Question Paper</span>
                </button>
              </div>
            ) : (
              <div style={styles.paperGrid}>
                {drafts.map((draft) => {
                  const bp = draft.blueprint || draft.payload || {};
                  return (
                    <div key={draft.id} style={styles.paperCard}>
                      <div style={styles.cardHeader}>
                        <div style={styles.subjectPill}>{draft.subject || bp.subject || 'Curriculum Draft'}</div>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          DRAFT • STEP {draft.step || 1}
                        </span>
                      </div>

                      <h3 style={styles.paperTitle}>{draft.title || bp.title || `${draft.subject || 'Examination'} Draft`}</h3>

                      <div style={styles.paperMeta}>
                        <div style={styles.metaItem}>
                          <Clock size={14} color="var(--color-structure-muted)" />
                          <span>Last Saved: {new Date(draft.updated_at || draft.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={styles.metaItem}>
                          <Layers size={14} color="var(--color-structure-muted)" />
                          <span>Pattern: {bp.academicPattern || '2019 Pattern'} • {bp.semester || 'Semester 5'}</span>
                        </div>
                        <div style={styles.metaItem}>
                          <CheckCircle2 size={14} color="var(--color-structure-muted)" />
                          <span>Total Marks: {bp.totalMarks || 70} Marks • Class: {bp.classYear || 'TE'}</span>
                        </div>
                      </div>

                      <div style={styles.cardActions}>
                        <button
                          onClick={() => handleResumeDraft(draft)}
                          style={{
                            ...styles.primaryActionBtn,
                            flex: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                          }}
                        >
                          <Sparkles size={14} />
                          <span>Resume Draft</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id, draft.title || bp.title)}
                          style={{
                            ...styles.secondaryActionBtn,
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.4rem 0.6rem',
                          }}
                          title="Delete Draft"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CREATE QUESTION PAPER (EXACTLY ONE WORKFLOW: 5-STEP WIZARD) */}
        {activeTab === 'create' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <QuestionPaperGeneratorWizard
              initialDraft={activeDraft}
              recipients={recipients}
              onSuccess={(msg) => {
                setActionAlert({ type: 'success', message: msg });
                fetchPapers();
                fetchDrafts();
                setActiveDraft(null);
                setActiveTab('list');
              }}
              onCancel={() => {
                setActiveDraft(null);
                setActiveTab('dashboard');
              }}
            />
          </div>
        )}

</main>

      {/* CONFIRM DRAFT DELETION MODAL */}
      {draftToDelete && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '420px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Delete Draft</h3>
              <button onClick={() => setDraftToDelete(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#334155' }}>
                Are you sure you want to delete the draft <strong>&ldquo;{draftToDelete.title}&rdquo;</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDraftToDelete(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteDraft}
                  style={{
                    ...styles.submitBtn,
                    backgroundColor: '#dc2626',
                    borderColor: '#b91c1c',
                    color: '#ffffff',
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                  }}
                >
                  Yes, Delete Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION PAPER DETAILS MODAL */}
      {selectedPaper && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.modalBadge}>{selectedPaper.status}</span>
                <h3 style={styles.modalTitle}>{selectedPaper.title}</h3>
                <span style={styles.modalSubject}>{selectedPaper.subject}</span>
              </div>
              <button onClick={() => setSelectedPaper(null)} style={styles.modalCloseBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Semester</span>
                  <span style={styles.detailValue}>{selectedPaper.semester || 'N/A'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Academic Year</span>
                  <span style={styles.detailValue}>{selectedPaper.academic_year || selectedPaper.academicYear || 'N/A'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Exam Type</span>
                  <span style={styles.detailValue}>{selectedPaper.exam_type || selectedPaper.examType || 'N/A'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Exam Date</span>
                  <span style={styles.detailValue}>{selectedPaper.exam_date || selectedPaper.examDate || 'N/A'}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Submitted At</span>
                  <span style={styles.detailValue}>
                    {(selectedPaper.submitted_at || selectedPaper.submittedAt)
                      ? new Date(selectedPaper.submitted_at || selectedPaper.submittedAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Scheduled Delivery</span>
                  <span style={{ ...styles.detailValue, color: '#38bdf8' }}>
                    {selectedPaper.scheduled_delivery_date || selectedPaper.scheduledDeliveryDate || 'N/A'}
                  </span>
                </div>
              </div>

              <div style={styles.storageBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={styles.storageBoxLabel}>Private Storage &amp; Key Management</span>
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: '500' }}>
                    Envelope Encryption
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <div><strong style={{ color: '#cbd5e1' }}>Cipher:</strong> AES-256-GCM</div>
                  <div><strong style={{ color: '#cbd5e1' }}>Key Wrap:</strong> RSA-OAEP (SHA-256)</div>
                  <div><strong style={{ color: '#cbd5e1' }}>Storage:</strong> Private Bucket</div>
                </div>
                <code style={styles.storageCode}>{selectedPaper.file_name || selectedPaper.fileName} • Protected Storage (Encrypted at Rest)</code>
              </div>

              {selectedPaper.teacher && (
                <div style={styles.recipientBox}>
                  <span style={styles.detailLabel}>Authoring / Setter Faculty</span>
                  <span style={styles.detailValue}>
                    {selectedPaper.teacher.name} ({selectedPaper.teacher.email})
                  </span>
                </div>
              )}

              {selectedPaper.question_paper_assignments?.[0] && (
                <div style={styles.recipientBox}>
                  <span style={styles.detailLabel}>Assigned Recipient Faculty</span>
                  <span style={styles.detailValue}>
                    {selectedPaper.question_paper_assignments[0].recipient?.name} (
                    {selectedPaper.question_paper_assignments[0].recipient?.email})
                  </span>
                  <span style={styles.assignmentStatusBadge}>
                    Delivery Status: {selectedPaper.question_paper_assignments[0].delivery_status}
                  </span>
                </div>
              )}

              {/* Digital Signature & Cryptographic Integrity Panel (Module 7) */}
              <div style={styles.signatureBox}>
                <div style={styles.signatureBoxHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={16} color="#34d399" />
                    <span style={styles.signatureBoxTitle}>Digital Signature &amp; Integrity</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVerifySignature(selectedPaper.id)}
                    disabled={verifyingId === selectedPaper.id}
                    style={styles.modalVerifyBtn}
                  >
                    {verifyingId === selectedPaper.id ? (
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <ShieldCheck size={13} />
                    )}
                    <span>Verify Signature</span>
                  </button>
                </div>

                <div style={styles.signatureDetailGrid}>
                  <div>
                    <span style={styles.detailLabel}>Algorithm:</span>{' '}
                    <span style={styles.signatureDetailValue}>
                      {selectedPaper.digital_signatures?.[0]?.algorithm || 'RSA-PSS-SHA256'}
                    </span>
                  </div>
                  <div>
                    <span style={styles.detailLabel}>Status:</span>{' '}
                    <span style={{ ...styles.signatureDetailValue, color: '#34d399' }}>
                      Cryptographically Signed
                    </span>
                  </div>
                </div>

                {verificationResults[selectedPaper.id] && (
                  <div
                    style={
                      verificationResults[selectedPaper.id].verified
                        ? styles.verificationSuccessAlert
                        : styles.verificationFailureAlert
                    }
                  >
                    {verificationResults[selectedPaper.id].verified ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={15} color="#34d399" />
                        <span>
                          <strong>Verified Authentic:</strong> RSA-PSS digital signature and SHA-256 hash valid at {verificationResults[selectedPaper.id].checkedAt}.
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldAlert size={15} color="#f87171" />
                        <span>
                          <strong>Integrity Alert:</strong> {verificationResults[selectedPaper.id].error || 'Ciphertext verification failed.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <div style={styles.modalSecurityNotice}>
                <ShieldCheck size={20} color="#0284c7" />
                <div>
                  <div style={{ fontWeight: 600, color: '#0369a1', fontSize: '13px' }}>
                    Exam Cell Confidentiality Enforced
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Final paper decryption and PDF download is restricted exclusively to the authorized Exam Coordinator upon scheduled delivery.
                  </div>
                </div>
              </div>

              {/* Delete Button in Details Modal (Module 20) */}
              {selectedPaper.status !== 'DELIVERED' && selectedPaper.status !== 'ARCHIVED' && selectedPaper.status !== 'DELETED' && (
                <button
                  onClick={() => handleOpenDeleteModal(selectedPaper)}
                  style={styles.modalDeleteBtn}
                  title="Delete Question Paper"
                >
                  <Trash2 size={16} />
                  <span>Delete Paper</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ANSWER KEY MODAL (Module 10) */}
      {answerKeyModalPaper && (
        <div style={styles.modalOverlay} onClick={() => setAnswerKeyModalPaper(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Key size={18} color="#a855f7" />
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Module 10 • Post-Exam Answer Key
                  </span>
                </div>
                <h3 style={styles.modalTitle}>{answerKeyModalPaper.title}</h3>
                <span style={styles.modalSubject}>{answerKeyModalPaper.subject}</span>
              </div>
              <button onClick={() => setAnswerKeyModalPaper(null)} style={styles.modalCloseBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {loadingAnswerKey ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                  <p>Retrieving answer key status and timing windows...</p>
                </div>
              ) : (
                <>
                  {/* Submission Window Status Banner */}
                  {answerKeyData?.submissionWindow && (
                    <div style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      backgroundColor: answerKeyData.submissionWindow.canUpload
                        ? (answerKeyData.submissionWindow.daysSinceExam <= 2 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)')
                        : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${
                        answerKeyData.submissionWindow.canUpload
                          ? (answerKeyData.submissionWindow.daysSinceExam <= 2 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)')
                          : 'rgba(239, 68, 68, 0.3)'
                      }`,
                      marginBottom: '1rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8' }}>
                          Timing Window Status
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          backgroundColor: answerKeyData.submissionWindow.canUpload
                            ? (answerKeyData.submissionWindow.daysSinceExam <= 2 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)')
                            : 'rgba(239, 68, 68, 0.2)',
                          color: answerKeyData.submissionWindow.canUpload
                            ? (answerKeyData.submissionWindow.daysSinceExam <= 2 ? '#4ade80' : '#facc15')
                            : '#f87171',
                        }}>
                          {answerKeyData.submissionWindow.status}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                        {answerKeyData.submissionWindow.message}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <div><strong>Exam Date:</strong> {answerKeyData.submissionWindow.examDate}</div>
                        <div><strong>Preferred (0–2d):</strong> {answerKeyData.submissionWindow.preferredDeadline}</div>
                        <div><strong>Max Cutoff (4d):</strong> {answerKeyData.submissionWindow.maxDeadline}</div>
                      </div>
                    </div>
                  )}

                  {/* Error & Success Alerts */}
                  {answerKeyError && (
                    <div style={{ ...styles.alertError, marginBottom: '1rem' }}>
                      <AlertCircle size={18} />
                      <span>{answerKeyError}</span>
                    </div>
                  )}

                  {answerKeySuccess && (
                    <div style={{ ...styles.alertSuccess, marginBottom: '1rem' }}>
                      <CheckCircle2 size={18} />
                      <span>{answerKeySuccess}</span>
                    </div>
                  )}

                  {/* IF ANSWER KEY ALREADY SUBMITTED */}
                  {answerKeyData?.submitted ? (
                    <div>
                      <div style={{ ...styles.detailGrid, marginBottom: '1rem' }}>
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>File Name</span>
                          <span style={styles.detailValue}>{answerKeyData.fileName}</span>
                        </div>
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>File Size</span>
                          <span style={styles.detailValue}>{(answerKeyData.fileSize / 1024).toFixed(1)} KB</span>
                        </div>
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>Submitted At</span>
                          <span style={styles.detailValue}>{new Date(answerKeyData.uploadedAt).toLocaleString()}</span>
                        </div>
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>Status</span>
                          <span style={{ ...styles.detailValue, color: '#4ade80' }}>{answerKeyData.status}</span>
                        </div>
                      </div>

                      {/* Cryptographic Protection Panel */}
                      <div style={{ ...styles.storageBox, marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={styles.storageBoxLabel}>Answer Key Cryptographic Envelope</span>
                          <span style={{ fontSize: '0.72rem', color: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: '500' }}>
                            AES-256-GCM + RSA-OAEP
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <div><strong style={{ color: '#cbd5e1' }}>Algorithm:</strong> {answerKeyData.digitalSignature?.algorithm || 'RSA-PSS-SHA256'}</div>
                          <div><strong style={{ color: '#cbd5e1' }}>Storage:</strong> Private Bucket</div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <strong style={{ color: '#cbd5e1' }}>Ciphertext Digest:</strong>{' '}
                            <code style={{ fontSize: '0.7rem', color: '#93c5fd' }}>{answerKeyData.digitalSignature?.fileHash || 'Protected'}</code>
                          </div>
                        </div>
                      </div>

                      {/* Verification Results Panel */}
                      {answerKeyVerifyResult && (
                        <div style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          marginBottom: '1rem',
                          backgroundColor: answerKeyVerifyResult.verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${answerKeyVerifyResult.verified ? '#22c55e' : '#ef4444'}`,
                          color: answerKeyVerifyResult.verified ? '#86efac' : '#fca5a5',
                          fontSize: '0.825rem',
                        }}>
                          {answerKeyVerifyResult.verified ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <CheckCircle2 size={16} color="#22c55e" />
                              <span><strong>RSA-PSS Digital Signature Verified:</strong> Ciphertext integrity is untampered.</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ShieldAlert size={16} color="#ef4444" />
                              <span><strong>Verification Failed:</strong> Integrity hash mismatch or invalid signature!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* IF NOT SUBMITTED YET */
                    <div>
                      {answerKeyData?.submissionWindow?.canUpload ? (
                        <form onSubmit={handleUploadAnswerKey}>
                          <div style={{ ...styles.fileUploadSection, marginBottom: '1rem' }}>
                            <label style={styles.label}>
                              Upload Answer Key Document (PDF Only, Max 10 MB) <span style={styles.required}>*</span>
                            </label>
                            <div style={styles.fileDropZone}>
                              <Upload size={28} color="#a855f7" />
                              <div style={styles.dropZoneText}>
                                {answerKeyFile ? (
                                  <div>
                                    <span style={{ ...styles.selectedFileName, color: '#c084fc' }}>{answerKeyFile.name}</span>
                                    <span style={styles.selectedFileSize}>
                                      ({(answerKeyFile.size / 1024).toFixed(1)} KB)
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <span style={styles.dropPrompt}>Click to browse or drag Answer Key PDF here</span>
                                    <span style={styles.dropSubPrompt}>Must be a valid PDF matching this paper's solutions</span>
                                  </>
                                )}
                              </div>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => setAnswerKeyFile(e.target.files?.[0] || null)}
                                disabled={uploadingAnswerKey}
                                style={styles.fileInputHidden}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                              type="submit"
                              disabled={uploadingAnswerKey || !answerKeyFile}
                              style={{
                                ...styles.submitBtn,
                                backgroundColor: '#9333ea',
                                opacity: uploadingAnswerKey || !answerKeyFile ? 0.6 : 1,
                              }}
                            >
                              {uploadingAnswerKey ? (
                                <span style={styles.btnLoadingContent}>
                                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                  Encrypting &amp; Signing...
                                </span>
                              ) : (
                                'Submit & Encrypt Answer Key'
                              )}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div style={{
                          padding: '1.25rem',
                          textAlign: 'center',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#fca5a5',
                          fontSize: '0.85rem',
                        }}>
                          <AlertCircle size={28} color="#f87171" style={{ margin: '0 auto 0.5rem' }} />
                          <p style={{ margin: 0, fontWeight: '500' }}>
                            {answerKeyData?.submissionWindow?.status === 'BEFORE_EXAM'
                              ? 'Answer keys cannot be submitted before the exam date. Please return on or after the scheduled exam date.'
                              : 'The 4-day post-exam submission window has closed. Submission is no longer accepted.'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer with Actions */}
            {answerKeyData?.submitted && (
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={handleVerifyAnswerKeySignature}
                  disabled={verifyingAnswerKey}
                  style={styles.modalVerifyBtn}
                >
                  {verifyingAnswerKey ? (
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <ShieldCheck size={15} />
                  )}
                  <span>Verify Signature</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAnswerKey}
                  disabled={downloadingAnswerKey || answerKeyVerifyResult?.tamperDetected}
                  style={{
                    ...styles.modalDownloadBtn,
                    backgroundColor: answerKeyVerifyResult?.tamperDetected ? '#475569' : '#9333ea',
                    ...(answerKeyVerifyResult?.tamperDetected ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                  }}
                  title={
                    answerKeyVerifyResult?.tamperDetected
                      ? 'Integrity check failed: download blocked'
                      : 'Download Decrypted PDF'
                  }
                >
                  {downloadingAnswerKey ? (
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>
                    {answerKeyVerifyResult?.tamperDetected
                      ? 'Verification Failed • Download Disabled'
                      : 'Download Decrypted PDF'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRACEABLE VERIFICATION HISTORY MODAL (Module 5.4) */}
      {historyPaper && (
        <div style={styles.modalOverlay} onClick={() => setHistoryPaper(null)}>
          <div
            style={{ ...styles.modalCard, maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Traceable Verification History
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-structure)' }}>
                  {historyPaper.title}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {historyPaper.subject} • Department of Computer Engineering
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryPaper(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px auto' }} />
                <div>Loading verification timeline...</div>
              </div>
            ) : verificationHistory.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 600, color: 'var(--color-structure)' }}>No Verification Actions Recorded Yet</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  This paper is currently {historyPaper.review_status || historyPaper.status}. A traceable record will be appended once an authorized Exam Coordinator reviews this submission.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {verificationHistory.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      backgroundColor: 'var(--color-surface-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor:
                            entry.decision === 'APPROVED' || entry.decision === 'RECOMMENDED' || entry.decision === 'REVIEWED'
                              ? '#dcfce7'
                              : entry.decision === 'RETURNED'
                              ? '#fef3c7'
                              : entry.decision === 'REJECTED'
                              ? '#fee2e2'
                              : '#e0f2fe',
                          color:
                            entry.decision === 'APPROVED' || entry.decision === 'RECOMMENDED' || entry.decision === 'REVIEWED'
                              ? '#166534'
                              : entry.decision === 'RETURNED'
                              ? '#92400e'
                              : entry.decision === 'REJECTED'
                              ? '#991b1b'
                              : '#0369a1',
                        }}
                      >
                        Decision: {entry.decision || entry.new_status}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                        {new Date(entry.verified_at).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--color-structure)', fontWeight: 600 }}>
                      Verified by: {entry.verifier?.name || 'Authorized Verifier'} ({entry.verifier?.roles?.name || entry.verifier?.email || 'Exam Authority'})
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Status transition: <code>{entry.previous_status || 'SUBMITTED'}</code> &rarr; <code>{entry.new_status}</code>
                    </div>

                    {entry.comments && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', backgroundColor: 'var(--color-surface)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-text)', borderLeft: '3px solid var(--color-primary)' }}>
                        <strong>Notes:</strong> {entry.comments}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setHistoryPaper(null)}
                style={{ ...styles.submitBtn, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECURE DELETE PAPER MODAL (Module 20) */}
      <DeletePaperModal
        isOpen={Boolean(paperToDelete)}
        paper={paperToDelete}
        onClose={() => {
          setPaperToDelete(null);
          setDeleteError('');
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingPaper}
        error={deleteError}
      />

      {/* CRYPTOGRAPHIC ALGORITHM FLOW MODAL (Module 20) */}
      <AlgorithmFlowDiagram
        isOpen={showAlgorithmModal}
        onClose={() => setShowAlgorithmModal(false)}
      />
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-inter)',
  },
  navbar: {
    backgroundColor: 'var(--color-structure)',
    borderBottom: '1px solid var(--color-structure-border)',
    padding: '0.875rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  brandIcon: {
    padding: '0.5rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--color-structure-text)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  brandTagline: {
    fontSize: '0.75rem',
    color: 'var(--color-structure-muted)',
    display: 'block',
  },
  navUserSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navMobileControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  mobileMenuToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-structure-border)',
    color: 'var(--color-structure-text)',
    cursor: 'pointer',
  },
  mobileUserBox: {
    backgroundColor: 'var(--color-structure-hover)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-structure-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  mobileTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-structure-muted)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: '44px',
  },
  mobileTabBtnActive: {
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    fontWeight: '600',
  },
  mobileLogoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger)',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--color-structure-hover)',
    padding: '0.35rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-structure-border)',
  },
  userName: {
    fontSize: '0.825rem',
    fontWeight: '600',
    color: 'var(--color-structure-text)',
  },
  userRole: {
    fontSize: '0.7rem',
    color: 'var(--color-accent)',
    fontWeight: '600',
    fontFamily: 'var(--font-jetbrains)',
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-structure-hover)',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-structure-border)',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.825rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '38px',
  },
  main: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '1.75rem 1.25rem',
    width: '100%',
  },
  tabBar: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: '1.75rem',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: '2px',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-muted)',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: '44px',
    transition: 'all var(--transition-fast)',
  },
  activeTab: {
    color: 'var(--color-primary)',
    borderBottomColor: 'var(--color-primary)',
    fontWeight: '600',
  },
  counterBadge: {
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    padding: '0.15rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: '600',
    fontFamily: 'var(--font-ibm-plex)',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  statsBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  sectionHeading: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: '0 0 0.25rem 0',
  },
  sectionSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    margin: 0,
  },
  bannerActions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-strong)',
    padding: '0.5rem 0.875rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minHeight: '44px',
  },
  primaryAddBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  searchBarWrapper: {
    width: '100%',
  },
  searchInput: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    minHeight: '44px',
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    color: 'var(--color-danger-text)',
    fontSize: '0.875rem',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--color-success-subtle)',
    border: '1px solid var(--color-success-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    color: 'var(--color-success-text)',
    fontSize: '0.875rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '4rem 1rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 1rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--color-border-strong)',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '1.15rem',
    fontWeight: '600',
    color: 'var(--color-structure)',
    marginTop: '1rem',
    marginBottom: '0.25rem',
  },
  emptySubtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    marginBottom: '1.25rem',
  },
  emptyActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  papersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
    gap: '1.25rem',
  },
  paperCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
    boxShadow: 'var(--shadow-sm)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  subjectPill: {
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-primary-border)',
  },
  statusBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    backgroundColor: 'var(--color-success-subtle)',
    color: 'var(--color-success)',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    letterSpacing: '0.05em',
    border: '1px solid var(--color-success-border)',
  },
  paperTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--color-structure)',
    margin: 0,
    lineHeight: '1.35',
  },
  metaRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-surface-alt)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  deliveryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--color-accent-hover)',
    fontFamily: 'var(--font-ibm-plex)',
  },
  deliveryDateHighlight: {
    fontWeight: '700',
    color: 'var(--color-accent-hover)',
    fontFamily: 'var(--font-ibm-plex)',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--color-border)',
  },
  fileInfoText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  cardBtnGroup: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  answerKeyCardBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    color: '#7e22ce',
    fontSize: '0.775rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '36px',
  },
  viewBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-strong)',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.775rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '36px',
  },
  cellSecuredBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary-border)',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '600',
    minHeight: '36px',
  },
  modalSecurityNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    flex: 1,
    textAlign: 'left',
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.775rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  formContainer: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem 1.5rem',
    maxWidth: '850px',
    margin: '0 auto',
    boxShadow: 'var(--shadow-sm)',
  },
  formHeader: {
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: '1rem',
  },
  formGroupSpan2: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'var(--color-text-secondary)',
  },
  required: {
    color: 'var(--color-danger)',
  },
  input: {
    padding: '0.65rem 0.85rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    minHeight: '44px',
  },
  select: {
    padding: '0.65rem 0.85rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    minHeight: '44px',
  },
  fileUploadSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  fileDropZone: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    backgroundColor: 'var(--color-surface-alt)',
    border: '2px dashed var(--color-border-strong)',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer',
    textAlign: 'center',
  },
  dropZoneText: {
    marginTop: '0.5rem',
  },
  dropPrompt: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--color-structure)',
  },
  dropSubPrompt: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.2rem',
  },
  selectedFileName: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-jetbrains)',
  },
  selectedFileSize: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  fileInputHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  infoCallout: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    backgroundColor: 'var(--color-accent-subtle)',
    border: '1px solid var(--color-accent-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem 1rem',
  },
  calloutText: {
    fontSize: '0.8rem',
    color: 'var(--color-accent-hover)',
    lineHeight: '1.45',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--color-border)',
    flexWrap: 'wrap',
  },
  cancelBtn: {
    padding: '0.65rem 1.25rem',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minHeight: '44px',
  },
  submitBtn: {
    padding: '0.65rem 1.5rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  btnLoadingContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 1000,
    overflowY: 'auto',
  },
  modalCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    width: '100%',
    maxWidth: '580px',
    maxHeight: '90vh',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalBadge: {
    display: 'inline-block',
    fontSize: '0.65rem',
    fontWeight: '700',
    backgroundColor: 'var(--color-success-subtle)',
    color: 'var(--color-success)',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    marginBottom: '0.35rem',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: 0,
  },
  modalSubject: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
  },
  modalCloseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  modalBody: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    overflowY: 'auto',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: '0.75rem',
  },
  detailItem: {
    backgroundColor: 'var(--color-surface-alt)',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  detailLabel: {
    display: 'block',
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '0.85rem',
    color: 'var(--color-text-primary)',
    fontWeight: '500',
  },
  storageBox: {
    backgroundColor: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
  },
  storageBoxLabel: {
    display: 'block',
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  },
  storageCode: {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: '0.75rem',
    color: 'var(--color-accent-hover)',
    wordBreak: 'break-all',
  },
  recipientBox: {
    backgroundColor: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  assignmentStatusBadge: {
    fontSize: '0.7rem',
    color: 'var(--color-accent)',
    fontWeight: '500',
    marginTop: '0.25rem',
  },
  modalFooter: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  modalDownloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  signatureBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.65rem',
    fontWeight: '600',
    backgroundColor: 'var(--color-success-subtle)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success-border)',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-full)',
  },
  verifyCardBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-border-strong)',
    padding: '0.4rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '36px',
  },
  signatureBox: {
    backgroundColor: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
  },
  signatureBoxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    flexWrap: 'wrap',
  },
  signatureBoxTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--color-structure)',
  },
  modalVerifyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'var(--color-success-subtle)',
    color: 'var(--color-success-text)',
    border: '1px solid var(--color-success-border)',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  signatureDetailGrid: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    flexWrap: 'wrap',
  },
  signatureDetailValue: {
    color: 'var(--color-text-primary)',
    fontWeight: '500',
    fontFamily: 'var(--font-jetbrains)',
  },
  verificationSuccessAlert: {
    marginTop: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-success-subtle)',
    border: '1px solid var(--color-success-border)',
    color: 'var(--color-success-text)',
    fontSize: '0.75rem',
  },
  verificationFailureAlert: {
    marginTop: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    fontSize: '0.75rem',
  },
  deleteCardBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    padding: '0.4rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '36px',
    transition: 'all 0.15s ease',
  },
  modalDeleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'background-color 0.15s ease',
  },
  algorithmFlowBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

