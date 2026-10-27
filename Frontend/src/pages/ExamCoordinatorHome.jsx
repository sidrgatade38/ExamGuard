import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import examCoordinatorService from '../services/examCoordinatorService';
import answerKeyService from '../services/answerKeyService';
import NotificationBell from '../components/NotificationBell';
import AlgorithmFlowDiagram from '../components/AlgorithmFlowDiagram';
import {
  ClipboardCheck,
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
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Layers,
  Lock,
  Hash,
  Key,
  Menu,
  Activity,
  ArrowRight,
  ChevronRight,
  Info,
  Check,
  AlertTriangle,
  Building,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export default function ExamCoordinatorHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'papers' | 'deliveries' | 'activity'

  // Dashboard Stats State (Data-driven KPIs)
  const [dashboardStats, setDashboardStats] = useState({
    totalAssigned: 0,
    readyForAccess: 0,
    awaitingDelivery: 0,
    upcomingDeliveriesCount: 0,
    nextDelivery: null,
    integrityStats: { verified: 0, pending: 0, failed: 0, total: 0, verifiedRatePercent: 0 },
    statusCounts: { submitted: 0, scheduled: 0, available: 0, archived: 0 },
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Question Papers state
  const [papers, setPapers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [papersError, setPapersError] = useState('');

  // Recent Activity state
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Digital Signature Verification state (Module 7 & 9)
  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationResults, setVerificationResults] = useState({});

  // Details Modal State
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Verification Proof Modal State
  const [activeProofModal, setActiveProofModal] = useState(null);

  // Answer Key State (Module 10)
  const [selectedAnswerKeyPaper, setSelectedAnswerKeyPaper] = useState(null);
  const [answerKeyData, setAnswerKeyData] = useState(null);
  const [loadingAnswerKey, setLoadingAnswerKey] = useState(false);
  const [answerKeyError, setAnswerKeyError] = useState('');
  const [downloadingAnswerKey, setDownloadingAnswerKey] = useState(false);
  const [verifyingAnswerKey, setVerifyingAnswerKey] = useState(false);
  const [answerKeyVerifyResult, setAnswerKeyVerifyResult] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Notification / Alert message state
  const [actionAlert, setActionAlert] = useState(null);

  // Cryptographic Algorithm Flow Modal state (Module 20)
  const [showAlgorithmModal, setShowAlgorithmModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Fetch Dashboard KPIs
  const fetchDashboardStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const stats = await examCoordinatorService.getDashboardStats();
      if (stats) {
        setDashboardStats(stats);
      }
    } catch (err) {
      console.warn('[ExamCoordinatorHome] Failed to load dashboard stats:', err.message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Recent Activity
  const fetchRecentActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const activity = await examCoordinatorService.getRecentActivity(15);
      setRecentActivity(Array.isArray(activity) ? activity : []);
    } catch (err) {
      console.warn('[ExamCoordinatorHome] Failed to load recent activity:', err.message);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  // Fetch Assigned Question Papers
  const fetchPapers = useCallback(async () => {
    setLoadingPapers(true);
    setPapersError('');
    try {
      const result = await examCoordinatorService.getAssignedQuestionPapers({
        search: searchTerm.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });

      const paperList = Array.isArray(result) ? result : result?.papers || [];
      setPapers(paperList);
      if (result?.pagination) {
        setPagination(result.pagination);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load assigned question papers.';
      setPapersError(msg);
    } finally {
      setLoadingPapers(false);
    }
  }, [searchTerm, statusFilter]);

  // Combined Refresh
  const handleRefreshAll = useCallback(() => {
    fetchDashboardStats();
    fetchRecentActivity();
    fetchPapers();
  }, [fetchDashboardStats, fetchRecentActivity, fetchPapers]);

  useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);

  // Load Answer Key Details
  const loadCoordinatorAnswerKeyDetails = async (paperId) => {
    setLoadingAnswerKey(true);
    setAnswerKeyError('');
    try {
      const data = await answerKeyService.getCoordinatorAnswerKey(paperId);
      setAnswerKeyData(data);
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Failed to load answer key details.');
    } finally {
      setLoadingAnswerKey(false);
    }
  };

  const handleOpenAnswerKeyModal = (paper) => {
    setSelectedAnswerKeyPaper(paper);
    setAnswerKeyData(null);
    setAnswerKeyError('');
    setAnswerKeyVerifyResult(null);
    loadCoordinatorAnswerKeyDetails(paper.id);
  };

  const handleDownloadCoordinatorAnswerKey = async () => {
    if (!selectedAnswerKeyPaper) return;
    setDownloadingAnswerKey(true);
    setAnswerKeyError('');
    try {
      await answerKeyService.downloadCoordinatorAnswerKey(
        selectedAnswerKeyPaper.id,
        answerKeyData?.fileName || `${selectedAnswerKeyPaper.subject}_AnswerKey.pdf`
      );
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Failed to download answer key.');
    } finally {
      setDownloadingAnswerKey(false);
    }
  };

  const handleVerifyCoordinatorAnswerKeySignature = async () => {
    if (!selectedAnswerKeyPaper) return;
    setVerifyingAnswerKey(true);
    setAnswerKeyError('');
    try {
      const result = await answerKeyService.verifyCoordinatorAnswerKeySignature(selectedAnswerKeyPaper.id);
      setAnswerKeyVerifyResult(result);
    } catch (err) {
      setAnswerKeyError(err.response?.data?.message || err.message || 'Signature verification failed.');
    } finally {
      setVerifyingAnswerKey(false);
    }
  };

  // Handle Digital Signature & Integrity Verification
  const handleVerifySignature = async (paperId) => {
    setVerifyingId(paperId);
    setActionAlert(null);
    try {
      const result = await examCoordinatorService.verifySignature(paperId);
      setVerificationResults((prev) => ({
        ...prev,
        [paperId]: result,
      }));

      // Update paper item locally
      setPapers((prevPapers) =>
        prevPapers.map((p) =>
          p.id === paperId
            ? {
                ...p,
                verificationStatus: result.verified ? 'VERIFIED' : 'FAILED',
                lastVerification: {
                  verified: result.verified,
                  timestamp: new Date().toISOString(),
                  algorithm: result.algorithm,
                },
              }
            : p
        )
      );

      // Re-fetch dashboard stats & recent activity to stay perfectly synced
      fetchDashboardStats();
      fetchRecentActivity();

      if (result.verified) {
        setActionAlert({
          type: 'success',
          title: 'Integrity Verification Passed',
          message: `Ciphertext SHA-256 hash matches the authoring faculty's RSA-PSS digital signature (${result.algorithm || 'RSA-PSS-SHA256'}). Question paper is cryptographically authentic.`,
        });
      } else {
        setActionAlert({
          type: 'danger',
          title: 'CRITICAL INTEGRITY FAILURE',
          message: 'Digital signature or ciphertext hash check failed. Ciphertext has been modified or corrupted in storage. Access is blocked.',
        });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Verification failed.';
      setVerificationResults((prev) => ({
        ...prev,
        [paperId]: { verified: false, tamperDetected: true, error: msg },
      }));
      setActionAlert({
        type: 'danger',
        title: 'Verification Error',
        message: msg,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  // Handle Secure Download of Decrypted PDF
  const handleDownloadPaper = async (paper) => {
    const vResult = verificationResults[paper.id];
    const isTampered =
      vResult?.tamperDetected ||
      vResult?.verified === false ||
      paper.verificationStatus === 'FAILED';

    if (isTampered) {
      setActionAlert({
        type: 'danger',
        title: 'Download Blocked by Security Policy',
        message: 'Security Policy Invariant: Question papers with failed cryptographic integrity verification cannot be decrypted or downloaded.',
      });
      return;
    }

    // Check delivery window restriction
    const isReady = paper.isDeliverable !== false;
    if (!isReady && paper.assignment?.deliveryStatus === 'PENDING') {
      setActionAlert({
        type: 'warning',
        title: 'Delivery Window Lock Active',
        message: `This question paper is scheduled for delivery on ${paper.scheduledDeliveryDate || paper.assignment?.scheduledDeliveryDate || 'the designated date'}. Decryption is strictly restricted until the authorized delivery window opens.`,
      });
      return;
    }

    setDownloadingId(paper.id);
    setActionAlert(null);
    try {
      await examCoordinatorService.downloadQuestionPaper(paper.id, paper.fileName);
      setActionAlert({
        type: 'success',
        title: 'Decryption & Download Successful',
        message: `Question paper "${paper.title}" successfully authenticated via Verify-Before-Decrypt pipeline and downloaded.`,
      });
      fetchRecentActivity();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to download question paper.';
      setActionAlert({
        type: 'danger',
        title: 'Download Failed',
        message: msg,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Distinct department list for filtering
  const departments = useMemo(() => {
    const set = new Set();
    papers.forEach((p) => {
      if (p.department) set.add(p.department);
      if (p.pattern) set.add(p.pattern);
    });
    return Array.from(set);
  }, [papers]);

  // Client-side filtering of papers
  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          (p.title && p.title.toLowerCase().includes(term)) ||
          (p.subject && p.subject.toLowerCase().includes(term)) ||
          (p.department && p.department.toLowerCase().includes(term)) ||
          (p.pattern && p.pattern.toLowerCase().includes(term)) ||
          (p.teacher?.name && p.teacher.name.toLowerCase().includes(term)) ||
          (p.examType && p.examType.toLowerCase().includes(term));
        if (!matches) return false;
      }

      // Department filter
      if (departmentFilter !== 'ALL') {
        const matchesDept = p.department === departmentFilter || p.pattern === departmentFilter;
        if (!matchesDept) return false;
      }

      // Status filter
      if (statusFilter === 'READY_FOR_ACCESS') {
        return p.isDeliverable === true && p.verificationStatus !== 'FAILED';
      }
      if (statusFilter === 'AWAITING_DELIVERY') {
        return p.isDeliverable === false || p.assignment?.deliveryStatus === 'PENDING';
      }
      if (statusFilter === 'VERIFIED') {
        return verificationResults[p.id]?.verified === true || p.verificationStatus === 'VERIFIED';
      }
      if (statusFilter === 'VERIFICATION_FAILED') {
        return (
          verificationResults[p.id]?.tamperDetected === true ||
          verificationResults[p.id]?.verified === false ||
          p.verificationStatus === 'FAILED'
        );
      }
      if (statusFilter === 'VERIFICATION_PENDING') {
        const isVerified = verificationResults[p.id]?.verified === true || p.verificationStatus === 'VERIFIED';
        const isFailed =
          verificationResults[p.id]?.tamperDetected === true ||
          verificationResults[p.id]?.verified === false ||
          p.verificationStatus === 'FAILED';
        return !isVerified && !isFailed;
      }

      return true;
    });
  }, [papers, searchTerm, departmentFilter, statusFilter, verificationResults]);

  // Filtered upcoming deliveries (papers awaiting scheduled delivery)
  const upcomingDeliveries = useMemo(() => {
    return papers.filter(
      (p) =>
        p.isDeliverable === false ||
        p.assignment?.deliveryStatus === 'PENDING' ||
        p.status === 'SCHEDULED'
    );
  }, [papers]);

  // Navigate to papers workspace with a pre-set filter
  const filterToPapers = (filterKey) => {
    setStatusFilter(filterKey);
    setActiveTab('papers');
    const el = document.getElementById('papers-workspace');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={styles.container}>
      {/* Top Navigation Bar */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <div style={styles.brandIcon}>
            <ClipboardCheck size={26} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={styles.brandTitle}>ExamGuard</h1>
              <span style={styles.appEnvironmentPill}>SECURE EXAM CELL</span>
            </div>
            <p style={styles.brandSubtitle}>Examination Coordinator Control Center & Delivery Gateway</p>
          </div>
        </div>

        {/* Center Navigation Links (Desktop) */}
        <nav className="nav-desktop-tabs" style={styles.navTabs}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              ...styles.navTabBtn,
              ...(activeTab === 'overview' ? styles.navTabBtnActive : {}),
            }}
          >
            <Activity size={15} />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('papers')}
            style={{
              ...styles.navTabBtn,
              ...(activeTab === 'papers' ? styles.navTabBtnActive : {}),
            }}
          >
            <FileText size={15} />
            <span>Assigned Papers</span>
            {papers.length > 0 && <span style={styles.navTabBadge}>{papers.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            style={{
              ...styles.navTabBtn,
              ...(activeTab === 'deliveries' ? styles.navTabBtnActive : {}),
            }}
          >
            <Clock size={15} />
            <span>Upcoming Deliveries</span>
            {upcomingDeliveries.length > 0 && (
              <span style={{ ...styles.navTabBadge, backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#fde047' }}>
                {upcomingDeliveries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            style={{
              ...styles.navTabBtn,
              ...(activeTab === 'activity' ? styles.navTabBtnActive : {}),
            }}
          >
            <ShieldCheck size={15} />
            <span>Audit Trail</span>
          </button>
        </nav>

        {/* Desktop Profile Section */}
        <div className="nav-desktop" style={styles.userProfile}>
          <button
            onClick={() => setShowAlgorithmModal(true)}
            style={styles.algorithmFlowBtn}
            title="View Cryptographic Algorithm Flow"
          >
            <Layers size={15} />
            <span>Algorithm Flow</span>
          </button>
          <NotificationBell onSelectPaper={(p) => setSelectedPaper(p)} />
          <div style={styles.roleBadge}>
            <Lock size={12} style={{ marginRight: '4px' }} />
            Role: EXAM_COORDINATOR
          </div>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{user?.name || 'Exam Coordinator'}</span>
            <span style={styles.userEmail}>{user?.email}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Mobile Navigation Controls */}
        <div className="nav-mobile-controls" style={styles.navMobileControls}>
          <NotificationBell onSelectPaper={(p) => setSelectedPaper(p)} />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={styles.mobileMenuToggle}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-nav-drawer open" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={20} color="var(--color-primary)" />
                <span style={{ fontWeight: '700', color: 'var(--color-structure-text)', fontSize: '1rem' }}>
                  ExamGuard
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-structure-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.mobileUserBox}>
              <User size={22} color="var(--color-accent)" />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-structure-text)' }}>
                  {user?.name || 'Exam Coordinator'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontFamily: 'var(--font-jetbrains)' }}>
                  {user?.email}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-structure-muted)', marginTop: '2px' }}>
                  ROLE: EXAM_COORDINATOR
                </div>
              </div>
            </div>

            {/* Mobile Tab Selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={() => {
                  setActiveTab('overview');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.mobileNavTabBtn,
                  ...(activeTab === 'overview' ? styles.mobileNavTabBtnActive : {}),
                }}
              >
                <Activity size={18} />
                <span>Overview Dashboard</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('papers');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.mobileNavTabBtn,
                  ...(activeTab === 'papers' ? styles.mobileNavTabBtnActive : {}),
                }}
              >
                <FileText size={18} />
                <span>Assigned Papers ({papers.length})</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('deliveries');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.mobileNavTabBtn,
                  ...(activeTab === 'deliveries' ? styles.mobileNavTabBtnActive : {}),
                }}
              >
                <Clock size={18} />
                <span>Upcoming Deliveries ({upcomingDeliveries.length})</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('activity');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.mobileNavTabBtn,
                  ...(activeTab === 'activity' ? styles.mobileNavTabBtnActive : {}),
                }}
              >
                <ShieldCheck size={18} />
                <span>Recent Activity & Audit Trail</span>
              </button>
            </div>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '1rem',
                borderTop: '1px solid var(--color-structure-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <button
                onClick={() => {
                  setShowAlgorithmModal(true);
                  setMobileMenuOpen(false);
                }}
                style={styles.mobileActionBtn}
              >
                <Layers size={18} />
                <span>Algorithm Flow Diagram</span>
              </button>
              <button onClick={handleLogout} style={styles.mobileLogoutBtn}>
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main style={styles.main}>
        {/* Banner with Coordinator Identity & Context */}
        <div style={styles.welcomeBanner}>
          <div style={styles.welcomeText}>
            <h2 style={styles.welcomeHeading}>
              Welcome, {user?.name || 'Exam Coordinator'}
            </h2>
            <p style={styles.welcomeSub}>
              Authorized Examination Cell Gateway • Secure scheduled transmission & cryptographic verification of examination question papers.
            </p>
          </div>
          <div style={styles.welcomeActions}>
            <button
              onClick={handleRefreshAll}
              disabled={loadingPapers || loadingStats}
              style={styles.headerRefreshBtn}
              title="Refresh all metrics, papers, and activity"
            >
              <RefreshCw
                size={16}
                style={loadingPapers || loadingStats ? { animation: 'spin 1s linear infinite' } : {}}
              />
              <span>Sync Workspace</span>
            </button>
          </div>
        </div>

        {/* 4 Actionable Data-Driven KPI Cards */}
        <section style={styles.metricsGrid}>
          {/* Card 1: Assigned Question Papers */}
          <div
            style={styles.metricCardInteractive}
            onClick={() => filterToPapers('ALL')}
            title="Click to view all assigned question papers"
          >
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
              <FileText size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.metricLabelRow}>
                <span style={styles.metricLabel}>Assigned Question Papers</span>
                <ChevronRight size={14} color="#94a3b8" />
              </div>
              <div style={styles.metricValue}>
                {loadingStats ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : dashboardStats.totalAssigned}
              </div>
              <div style={styles.metricDesc}>
                {dashboardStats.statusCounts?.available || 0} Available • {dashboardStats.awaitingDelivery} Awaiting Delivery
              </div>
            </div>
          </div>

          {/* Card 2: Ready for Secure Access */}
          <div
            style={styles.metricCardInteractive}
            onClick={() => filterToPapers('READY_FOR_ACCESS')}
            title="Click to view papers currently in authorized delivery window"
          >
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
              <ShieldCheck size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.metricLabelRow}>
                <span style={styles.metricLabel}>Ready for Secure Access</span>
                <span style={styles.activePulseDot} title="Delivery window open" />
              </div>
              <div style={styles.metricValue}>
                {loadingStats ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : dashboardStats.readyForAccess}
              </div>
              <div style={styles.metricDesc}>
                Within delivery window • Verify-Before-Decrypt active
              </div>
            </div>
          </div>

          {/* Card 3: Upcoming Deliveries */}
          <div
            style={styles.metricCardInteractive}
            onClick={() => {
              setActiveTab('deliveries');
            }}
            title="Click to view upcoming scheduled delivery dates"
          >
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
              <Clock size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.metricLabelRow}>
                <span style={styles.metricLabel}>Upcoming Deliveries</span>
                <ChevronRight size={14} color="#94a3b8" />
              </div>
              <div style={styles.metricValue}>
                {loadingStats ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : dashboardStats.upcomingDeliveriesCount}
              </div>
              <div style={styles.metricDesc}>
                {dashboardStats.nextDelivery?.deliveryDate
                  ? `Next: ${dashboardStats.nextDelivery.deliveryDate}`
                  : 'No scheduled deliveries pending'}
              </div>
            </div>
          </div>

          {/* Card 4: Integrity Verification */}
          <div
            style={styles.metricCardInteractive}
            onClick={() => filterToPapers('VERIFIED')}
            title="Click to inspect cryptographic verification status"
          >
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
              <Layers size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.metricLabelRow}>
                <span style={styles.metricLabel}>Integrity Verification</span>
                <ChevronRight size={14} color="#94a3b8" />
              </div>
              <div style={styles.metricValue}>
                {loadingStats ? (
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  `${dashboardStats.integrityStats?.verified || 0} Verified`
                )}
              </div>
              <div style={styles.metricDesc}>
                {dashboardStats.integrityStats?.failed > 0 ? (
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>
                    {dashboardStats.integrityStats.failed} Failed Tamper Check
                  </span>
                ) : (
                  `${dashboardStats.integrityStats?.verifiedRatePercent || 0}% rate • RSA-PSS + SHA-256`
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Global Action Alert Toast */}
        {actionAlert && (
          <div
            style={{
              ...styles.alertBanner,
              backgroundColor:
                actionAlert.type === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : actionAlert.type === 'warning'
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              borderColor:
                actionAlert.type === 'success'
                  ? '#22c55e'
                  : actionAlert.type === 'warning'
                  ? '#eab308'
                  : '#ef4444',
              color:
                actionAlert.type === 'success'
                  ? '#86efac'
                  : actionAlert.type === 'warning'
                  ? '#fef08a'
                  : '#fca5a5',
            }}
          >
            {actionAlert.type === 'success' ? (
              <CheckCircle2 size={20} color="#22c55e" style={{ flexShrink: 0 }} />
            ) : actionAlert.type === 'warning' ? (
              <AlertTriangle size={20} color="#eab308" style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              {actionAlert.title && (
                <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '2px' }}>
                  {actionAlert.title}
                </div>
              )}
              <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>{actionAlert.message}</div>
            </div>
            <button
              onClick={() => setActionAlert(null)}
              style={styles.alertCloseBtn}
              title="Dismiss alert"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* PRIMARY WORKSPACE: ASSIGNED QUESTION PAPERS */}
        {(activeTab === 'overview' || activeTab === 'papers') && (
          <section id="papers-workspace" style={styles.papersSection}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={styles.sectionTitle}>Assigned Examination Question Papers</h2>
                  <span style={styles.countBadge}>
                    {filteredPapers.length} of {papers.length} Papers
                  </span>
                </div>
                <p style={styles.sectionSubtitle}>
                  Authorized repository of question papers assigned to your Exam Coordinator account for verification and scheduled distribution.
                </p>
              </div>

              {/* Status Filter Pills */}
              <div style={styles.quickFilterPills}>
                <button
                  onClick={() => setStatusFilter('ALL')}
                  style={{
                    ...styles.filterPill,
                    ...(statusFilter === 'ALL' ? styles.filterPillActive : {}),
                  }}
                >
                  All ({papers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('READY_FOR_ACCESS')}
                  style={{
                    ...styles.filterPill,
                    ...(statusFilter === 'READY_FOR_ACCESS' ? styles.filterPillActive : {}),
                  }}
                >
                  Ready for Access ({dashboardStats.readyForAccess})
                </button>
                <button
                  onClick={() => setStatusFilter('AWAITING_DELIVERY')}
                  style={{
                    ...styles.filterPill,
                    ...(statusFilter === 'AWAITING_DELIVERY' ? styles.filterPillActive : {}),
                  }}
                >
                  Awaiting Delivery ({dashboardStats.awaitingDelivery})
                </button>
                <button
                  onClick={() => setStatusFilter('VERIFIED')}
                  style={{
                    ...styles.filterPill,
                    ...(statusFilter === 'VERIFIED' ? styles.filterPillActive : {}),
                  }}
                >
                  Verified
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={styles.filterBar}>
              <div style={styles.searchWrapper}>
                <Search size={16} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search by subject, title, department, exam type, faculty setter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} style={styles.searchClearBtn}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={styles.filterControls}>
                {departments.length > 0 && (
                  <div style={styles.selectWrapper}>
                    <Building size={14} style={{ color: '#94a3b8', marginRight: '6px' }} />
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      style={styles.select}
                    >
                      <option value="ALL">All Departments / Patterns</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={styles.selectWrapper}>
                  <Filter size={14} style={{ color: '#94a3b8', marginRight: '6px' }} />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={styles.select}
                  >
                    <option value="ALL">Status: All Papers ({papers.length})</option>
                    <option value="READY_FOR_ACCESS">Ready for Secure Access</option>
                    <option value="AWAITING_DELIVERY">Awaiting Delivery Window</option>
                    <option value="VERIFIED">Integrity Verified (RSA-PSS)</option>
                    <option value="VERIFICATION_PENDING">Verification Pending</option>
                    <option value="VERIFICATION_FAILED">Tamper Detected (Failed)</option>
                  </select>
                </div>

                <button
                  onClick={fetchPapers}
                  disabled={loadingPapers}
                  style={styles.refreshBtn}
                  title="Reload question papers"
                >
                  <RefreshCw
                    size={15}
                    style={loadingPapers ? { animation: 'spin 1s linear infinite' } : {}}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Papers Data Content */}
            {loadingPapers ? (
              /* Loading Skeletons */
              <div style={styles.skeletonContainer}>
                {[1, 2, 3].map((n) => (
                  <div key={n} style={styles.skeletonRow}>
                    <div style={{ ...styles.skeletonPulse, width: '40px', height: '40px', borderRadius: '8px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ ...styles.skeletonPulse, width: '35%', height: '18px' }} />
                      <div style={{ ...styles.skeletonPulse, width: '60%', height: '14px' }} />
                    </div>
                    <div style={{ ...styles.skeletonPulse, width: '120px', height: '24px' }} />
                    <div style={{ ...styles.skeletonPulse, width: '180px', height: '36px', borderRadius: '6px' }} />
                  </div>
                ))}
              </div>
            ) : papersError ? (
              /* Error State */
              <div style={{ ...styles.stateCard, borderColor: '#ef4444' }}>
                <AlertCircle size={36} color="#ef4444" />
                <h3 style={{ ...styles.emptyTitle, color: '#fca5a5' }}>Failed to Load Question Papers</h3>
                <p style={{ ...styles.emptySubtitle, color: '#fca5a5', maxWidth: '500px' }}>
                  {papersError}
                </p>
                <button onClick={fetchPapers} style={styles.retryBtn}>
                  <RefreshCw size={14} style={{ marginRight: '6px' }} />
                  Retry Loading Papers
                </button>
              </div>
            ) : filteredPapers.length === 0 ? (
              /* Informative Empty State with Zero Unauthorized Actions */
              <div style={styles.emptyStateCard}>
                <div style={styles.emptyIconBox}>
                  <FileText size={40} color="#38bdf8" />
                </div>
                <h3 style={styles.emptyTitle}>
                  {papers.length === 0
                    ? 'No Examination Question Papers Assigned Yet'
                    : 'No Question Papers Match Current Filters'}
                </h3>
                <p style={styles.emptySubtitle}>
                  {papers.length === 0
                    ? 'Question papers are prepared by department faculty paper setters and submitted to the Examination Cell. Once scheduled and assigned to your coordinator account, papers will automatically appear in this workspace for cryptographic verification and scheduled download.'
                    : 'Try clearing your search terms or changing the status filter dropdown.'}
                </p>

                {papers.length === 0 ? (
                  <div style={styles.emptyGuidelinesBox}>
                    <div style={styles.guidelineHeader}>
                      <Info size={16} color="#38bdf8" />
                      <span>Exam Coordinator Workflow Guidance</span>
                    </div>
                    <ul style={styles.guidelineList}>
                      <li>
                        <strong>Paper Assignment:</strong> Teachers submit encrypted question papers and designate an authorized Exam Coordinator for reception.
                      </li>
                      <li>
                        <strong>Scheduled Delivery:</strong> Question papers remain cryptographically locked until the scheduled examination date and time.
                      </li>
                      <li>
                        <strong>Verify-Before-Decrypt:</strong> Once assigned, click "Verify Integrity" to evaluate RSA-PSS signatures and SHA-256 ciphertext digests.
                      </li>
                      <li>
                        <strong>Contact Administration:</strong> If an expected question paper has not arrived, contact the Examination Cell Administrator or authoring faculty member.
                      </li>
                    </ul>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('ALL');
                      setDepartmentFilter('ALL');
                    }}
                    style={styles.resetFilterBtn}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              /* Question Papers Table View */
              <div style={styles.tableCard}>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Subject & Paper Details</th>
                        <th style={styles.th}>Course & Session</th>
                        <th style={styles.th}>Setter / Faculty</th>
                        <th style={styles.th}>Scheduled Delivery</th>
                        <th style={styles.th}>Integrity Status</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPapers.map((paper) => {
                        const vResult = verificationResults[paper.id];
                        const isVerifying = verifyingId === paper.id;
                        const isDownloading = downloadingId === paper.id;

                        const isVerified =
                          vResult?.verified === true || paper.verificationStatus === 'VERIFIED';
                        const isTampered =
                          vResult?.tamperDetected === true ||
                          vResult?.verified === false ||
                          paper.verificationStatus === 'FAILED';

                        const isDeliverable = paper.isDeliverable !== false;
                        const deliveryStatus = paper.assignment?.deliveryStatus || 'PENDING';

                        return (
                          <tr key={paper.id} style={styles.tr}>
                            {/* Subject & Title */}
                            <td style={styles.td}>
                              <div style={styles.paperSubject}>{paper.subject}</div>
                              <div style={styles.paperTitle}>{paper.title}</div>
                              <div style={styles.metaRow}>
                                <span style={styles.formatBadge}>
                                  {paper.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}
                                </span>
                                {paper.department && (
                                  <span style={styles.deptBadge}>
                                    <Building size={10} style={{ marginRight: '3px' }} />
                                    {paper.department}
                                  </span>
                                )}
                                {paper.pattern && (
                                  <span style={styles.patternBadge}>
                                    {paper.pattern}
                                  </span>
                                )}
                                <span style={styles.fileSizeText}>
                                  {paper.fileSize ? `${(paper.fileSize / 1024).toFixed(1)} KB` : 'Protected Ciphertext'}
                                </span>
                              </div>
                            </td>

                            {/* Course, Exam Type, Semester */}
                            <td style={styles.td}>
                              <div style={styles.examType}>{paper.examType || 'Final Examination'}</div>
                              <div style={styles.examDate}>
                                <Calendar size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                                {paper.examDate || 'Designated Exam Day'}
                              </div>
                              <div style={styles.semesterText}>
                                <GraduationCap size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                                {paper.semester || 'Semester'} ({paper.academicYear || 'Current Year'})
                              </div>
                            </td>

                            {/* Setter / Faculty */}
                            <td style={styles.td}>
                              <div style={styles.teacherName}>
                                <User size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                                {paper.teacher?.name || 'Faculty Member'}
                              </div>
                              <div style={styles.teacherEmail}>{paper.teacher?.email || '—'}</div>
                            </td>

                            {/* Scheduled Delivery Status */}
                            <td style={styles.td}>
                              <div style={styles.deliveryDate}>
                                <Clock size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                                {paper.scheduledDeliveryDate || paper.assignment?.scheduledDeliveryDate || 'Scheduled Next-Day'}
                              </div>
                              <div>
                                {isDeliverable ? (
                                  <span
                                    style={{
                                      ...styles.deliveryBadge,
                                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                      color: '#86efac',
                                      borderColor: '#22c55e',
                                    }}
                                  >
                                    <Check size={10} style={{ marginRight: '3px' }} />
                                    DELIVERY WINDOW OPEN
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      ...styles.deliveryBadge,
                                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                      color: '#fde047',
                                      borderColor: '#eab308',
                                    }}
                                  >
                                    <Clock size={10} style={{ marginRight: '3px' }} />
                                    SCHEDULED: {deliveryStatus}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Digital Signature & Integrity Status */}
                            <td style={styles.td}>
                              {isVerifying ? (
                                <span
                                  style={{
                                    ...styles.statusPill,
                                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                  }}
                                >
                                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', marginRight: '4px' }} />
                                  Verifying RSA-PSS...
                                </span>
                              ) : isVerified ? (
                                <span
                                  onClick={() => setActiveProofModal(paper)}
                                  style={{
                                    ...styles.statusPill,
                                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                    color: '#86efac',
                                    borderColor: '#22c55e',
                                    cursor: 'pointer',
                                  }}
                                  title="Click to view cryptographic verification proof"
                                >
                                  <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                                  Verified (RSA-PSS)
                                </span>
                              ) : isTampered ? (
                                <span
                                  style={{
                                    ...styles.statusPill,
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    color: '#fca5a5',
                                    borderColor: '#ef4444',
                                  }}
                                  title="Cryptographic verification failed: document is compromised"
                                >
                                  <ShieldAlert size={12} style={{ marginRight: '4px' }} />
                                  Tamper Detected!
                                </span>
                              ) : (
                                <span
                                  style={{
                                    ...styles.statusPill,
                                    backgroundColor: 'rgba(148, 163, 184, 0.12)',
                                    color: '#cbd5e1',
                                  }}
                                  title="Signed by faculty setter; pending live verification"
                                >
                                  <Lock size={12} style={{ marginRight: '4px' }} />
                                  Signed (Pending Verification)
                                </span>
                              )}
                            </td>

                            {/* State-Gated Actions */}
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <div style={styles.actionRow}>
                                {/* Answer Key */}
                                <button
                                  onClick={() => handleOpenAnswerKeyModal(paper)}
                                  style={styles.answerKeyBtn}
                                  title="View and download official answer key"
                                >
                                  <Key size={14} />
                                  <span>Answer Key</span>
                                </button>

                                {/* Safe Metadata Modal */}
                                <button
                                  onClick={() => setSelectedPaper(paper)}
                                  style={styles.viewBtn}
                                  title="View cryptographic safe metadata"
                                >
                                  <Eye size={14} />
                                  <span>Details</span>
                                </button>

                                {/* Live Verification */}
                                <button
                                  onClick={() => handleVerifySignature(paper.id)}
                                  disabled={isVerifying}
                                  style={styles.verifyBtn}
                                  title="Verify RSA-PSS signature and SHA-256 ciphertext hash"
                                >
                                  {isVerifying ? (
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                  ) : (
                                    <ShieldCheck size={14} />
                                  )}
                                  <span>Verify</span>
                                </button>

                                {/* Secure Download */}
                                <button
                                  onClick={() => handleDownloadPaper(paper)}
                                  disabled={isDownloading || isTampered}
                                  style={{
                                    ...styles.downloadBtn,
                                    ...(isTampered
                                      ? { backgroundColor: '#475569', cursor: 'not-allowed', opacity: 0.5 }
                                      : !isDeliverable
                                      ? { backgroundColor: '#334155', color: '#94a3b8' }
                                      : {}),
                                  }}
                                  title={
                                    isTampered
                                      ? 'Download blocked: Integrity verification failed'
                                      : !isDeliverable
                                      ? 'Locked until scheduled examination delivery date'
                                      : 'Verify-Before-Decrypt and download decrypted PDF'
                                  }
                                >
                                  {isDownloading ? (
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                  ) : !isDeliverable ? (
                                    <Lock size={14} />
                                  ) : (
                                    <Download size={14} />
                                  )}
                                  <span>
                                    {isDownloading
                                      ? 'Decrypting...'
                                      : !isDeliverable
                                      ? 'Locked'
                                      : 'Download'}
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* UPCOMING EXAMINATION DELIVERIES SECTION */}
        {(activeTab === 'overview' || activeTab === 'deliveries') && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={20} color="#eab308" />
                  <h3 style={styles.sectionTitle}>Upcoming Examination Deliveries</h3>
                </div>
                <p style={styles.sectionSubtitle}>
                  Scheduled question paper transmissions configured by department paper setters.
                </p>
              </div>
              <span style={{ ...styles.countBadge, backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#fde047' }}>
                {upcomingDeliveries.length} Pending Delivery
              </span>
            </div>

            {upcomingDeliveries.length === 0 ? (
              <div style={styles.inlineEmptyBox}>
                <Clock size={28} color="#64748b" />
                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No examination question papers currently awaiting delivery. All assigned papers are delivered or open for access.
                </p>
              </div>
            ) : (
              <div style={styles.deliveryGrid}>
                {upcomingDeliveries.map((paper) => (
                  <div key={paper.id} style={styles.deliveryItemCard}>
                    <div style={styles.deliveryItemHeader}>
                      <div>
                        <div style={styles.deliveryItemSubject}>{paper.subject}</div>
                        <div style={styles.deliveryItemTitle}>{paper.title}</div>
                      </div>
                      <span style={styles.scheduledPill}>
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        {paper.scheduledDeliveryDate || paper.assignment?.scheduledDeliveryDate || 'Scheduled'}
                      </span>
                    </div>

                    <div style={styles.deliveryItemDetails}>
                      <div style={styles.deliveryMetaLine}>
                        <span style={styles.deliveryMetaKey}>Exam Session:</span>
                        <span style={styles.deliveryMetaVal}>
                          {paper.examType} ({paper.semester})
                        </span>
                      </div>
                      <div style={styles.deliveryMetaLine}>
                        <span style={styles.deliveryMetaKey}>Setter Faculty:</span>
                        <span style={styles.deliveryMetaVal}>
                          {paper.teacher?.name || 'Faculty Member'}
                        </span>
                      </div>
                      <div style={styles.deliveryMetaLine}>
                        <span style={styles.deliveryMetaKey}>Department:</span>
                        <span style={styles.deliveryMetaVal}>
                          {paper.department || paper.pattern || 'General Examination'}
                        </span>
                      </div>
                    </div>

                    <div style={styles.deliveryItemFooter}>
                      <button
                        onClick={() => setSelectedPaper(paper)}
                        style={styles.deliveryInspectBtn}
                      >
                        <Eye size={13} style={{ marginRight: '4px' }} />
                        Safe Metadata
                      </button>
                      <button
                        onClick={() => handleVerifySignature(paper.id)}
                        disabled={verifyingId === paper.id}
                        style={styles.deliveryVerifyBtn}
                      >
                        <ShieldCheck size={13} style={{ marginRight: '4px' }} />
                        Pre-Verify Integrity
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* AUDIT TRAIL & RECENT ACTIVITY SECTION */}
        {(activeTab === 'overview' || activeTab === 'activity') && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={20} color="#38bdf8" />
                  <h3 style={styles.sectionTitle}>Examination Cell Audit Trail & Recent Activity</h3>
                </div>
                <p style={styles.sectionSubtitle}>
                  Cryptographic verification logs, access events, and paper transmission history.
                </p>
              </div>
              <button
                onClick={fetchRecentActivity}
                disabled={loadingActivity}
                style={styles.iconRefreshBtn}
                title="Refresh audit activity"
              >
                <RefreshCw
                  size={14}
                  style={loadingActivity ? { animation: 'spin 1s linear infinite' } : {}}
                />
              </button>
            </div>

            {loadingActivity ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.85rem' }}>Loading recent activity logs...</p>
              </div>
            ) : recentActivity.length === 0 ? (
              <div style={styles.inlineEmptyBox}>
                <ShieldCheck size={28} color="#64748b" />
                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No recent coordinator events recorded in the audit trail yet. Events will record as papers are verified, decrypted, or inspected.
                </p>
              </div>
            ) : (
              <div style={styles.activityList}>
                {recentActivity.map((act) => {
                  const isSuccess =
                    act.action.includes('SUCCESS') ||
                    act.action.includes('VERIFIED') ||
                    act.action.includes('DOWNLOADED');
                  const isFailure =
                    act.action.includes('FAIL') ||
                    act.action.includes('TAMPER') ||
                    act.action.includes('DENIED');

                  return (
                    <div key={act.id || act.timestamp} style={styles.activityItem}>
                      <div
                        style={{
                          ...styles.activityIconBox,
                          backgroundColor: isFailure
                            ? 'rgba(239, 68, 68, 0.15)'
                            : isSuccess
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(56, 189, 248, 0.15)',
                          color: isFailure ? '#ef4444' : isSuccess ? '#22c55e' : '#38bdf8',
                        }}
                      >
                        {isFailure ? (
                          <ShieldAlert size={16} />
                        ) : isSuccess ? (
                          <ShieldCheck size={16} />
                        ) : (
                          <Activity size={16} />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={styles.activityTitleRow}>
                          <span style={styles.activityActionText}>{act.action}</span>
                          <span style={styles.activityTime}>
                            {act.created_at ? new Date(act.created_at).toLocaleString() : 'Recent'}
                          </span>
                        </div>
                        <div style={styles.activityDetails}>
                          {act.details?.title && (
                            <span style={{ fontWeight: '600', color: '#f8fafc', marginRight: '6px' }}>
                              [{act.details.title}]
                            </span>
                          )}
                          {act.details?.subject && (
                            <span style={{ color: '#cbd5e1', marginRight: '6px' }}>
                              ({act.details.subject})
                            </span>
                          )}
                          {act.details?.algorithm && (
                            <span style={styles.inlineMonoBadge}>{act.details.algorithm}</span>
                          )}
                          {act.users?.name && (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '6px' }}>
                              • by {act.users.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SECURITY ARCHITECTURE BANNER */}
        <section style={styles.securityBanner}>
          <div style={styles.securityHeader}>
            <ShieldCheck size={22} color="#10b981" />
            <div>
              <span style={styles.securityTitle}>ExamGuard End-to-End Cryptographic Security Guarantees</span>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Strict implementation of RBAC, digital signatures, envelope encryption, and audit accountability.
              </p>
            </div>
          </div>
          <div style={styles.securityGrid}>
            <div style={styles.securityFeature}>
              <div style={styles.securityFeatureTitle}>
                <Lock size={14} color="#38bdf8" style={{ marginRight: '6px' }} />
                Verify-Before-Decrypt Invariant
              </div>
              <p style={styles.securityFeatureDesc}>
                The server strictly evaluates ciphertext SHA-256 digests and RSA-PSS digital signatures before unwrapping the AES key. If the signature or ciphertext has been altered, decryption fails closed.
              </p>
            </div>

            <div style={styles.securityFeature}>
              <div style={styles.securityFeatureTitle}>
                <Hash size={14} color="#38bdf8" style={{ marginRight: '6px' }} />
                Envelope Encryption Scheme
              </div>
              <p style={styles.securityFeatureDesc}>
                Question papers are encrypted with unique AES-256-GCM data encryption keys (DEKs). DEKs are wrapped using 2048-bit RSA-OAEP and stored separately from ciphertext in private storage.
              </p>
            </div>

            <div style={styles.securityFeature}>
              <div style={styles.securityFeatureTitle}>
                <ShieldCheck size={14} color="#38bdf8" style={{ marginRight: '6px' }} />
                Zero Secret Leakage
              </div>
              <p style={styles.securityFeatureDesc}>
                Plaintext AES keys, initialization vectors, authentication tags, and RSA private keys are NEVER exposed in any API response or coordinator metadata view.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* QUESTION PAPER METADATA MODAL */}
      {selectedPaper && (
        <div style={styles.modalOverlay} onClick={() => setSelectedPaper(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color="#38bdf8" />
                <h3 style={styles.modalTitle}>Question Paper Safe Metadata</h3>
              </div>
              <button onClick={() => setSelectedPaper(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Subject & Examination</div>
                <div style={styles.metaGrid}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Subject</span>
                    <span style={styles.metaVal}>{selectedPaper.subject}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Paper Title</span>
                    <span style={styles.metaVal}>{selectedPaper.title}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Department / Pattern</span>
                    <span style={styles.metaVal}>
                      {selectedPaper.department || selectedPaper.pattern || 'University Standard'}
                    </span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Exam Type</span>
                    <span style={styles.metaVal}>{selectedPaper.examType}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Exam Date</span>
                    <span style={styles.metaVal}>{selectedPaper.examDate}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Semester & Year</span>
                    <span style={styles.metaVal}>
                      {selectedPaper.semester} ({selectedPaper.academicYear})
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Authoring Faculty & Assignment</div>
                <div style={styles.metaGrid}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Setter Faculty</span>
                    <span style={styles.metaVal}>{selectedPaper.teacher?.name || 'Faculty Member'}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Faculty Email</span>
                    <span style={styles.metaVal}>{selectedPaper.teacher?.email || '—'}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Submitted At</span>
                    <span style={styles.metaVal}>
                      {selectedPaper.submittedAt ? new Date(selectedPaper.submittedAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Scheduled Delivery</span>
                    <span style={styles.metaVal}>
                      {selectedPaper.scheduledDeliveryDate || selectedPaper.assignment?.scheduledDeliveryDate || 'Designated Exam Day'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Cryptographic Integrity Metadata</div>
                <div style={styles.metaGrid}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Signature Algorithm</span>
                    <span style={styles.metaValMono}>
                      {selectedPaper.digitalSignature?.algorithm || 'RSA-PSS-SHA256'}
                    </span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Encryption Scheme</span>
                    <span style={styles.metaValMono}>AES-256-GCM (RSA-OAEP Wrapped)</span>
                  </div>
                  <div style={{ ...styles.metaItem, gridColumn: 'span 2' }}>
                    <span style={styles.metaLabel}>Ciphertext SHA-256 Hash</span>
                    <span style={styles.metaValHash}>
                      {selectedPaper.digitalSignature?.fileHash || 'Protected Ciphertext Digest'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.modalNotice}>
                <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Zero Secret Leakage Guarantee: Plaintext AES keys and RSA private keys are strictly server-side and never returned in API responses.
                </span>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => handleVerifySignature(selectedPaper.id)}
                disabled={verifyingId === selectedPaper.id}
                style={styles.modalVerifyBtn}
              >
                <ShieldCheck size={16} />
                <span>Verify Signature</span>
              </button>

              <button
                onClick={() => handleDownloadPaper(selectedPaper)}
                disabled={downloadingId === selectedPaper.id || verificationResults[selectedPaper.id]?.tamperDetected}
                style={styles.modalDownloadBtn}
              >
                <Download size={16} />
                <span>Download Decrypted PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION PROOF MODAL */}
      {activeProofModal && (
        <div style={styles.modalOverlay} onClick={() => setActiveProofModal(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#22c55e" />
                <h3 style={styles.modalTitle}>Cryptographic Verification Proof</h3>
              </div>
              <button onClick={() => setActiveProofModal(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid #22c55e', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#86efac', fontWeight: '700' }}>
                  <CheckCircle2 size={18} />
                  <span>Digital Signature & Integrity Validated</span>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  The ciphertext stored in private storage matches the cryptographic signature created by authoring faculty {activeProofModal.teacher?.name || 'Member'}.
                </p>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Verification Details</div>
                <div style={styles.metaGrid}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Paper</span>
                    <span style={styles.metaVal}>{activeProofModal.title}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Signature Algorithm</span>
                    <span style={styles.metaValMono}>{activeProofModal.digitalSignature?.algorithm || 'RSA-PSS-SHA256'}</span>
                  </div>
                  <div style={{ ...styles.metaItem, gridColumn: 'span 2' }}>
                    <span style={styles.metaLabel}>Verified Ciphertext Digest (SHA-256)</span>
                    <span style={styles.metaValHash}>{activeProofModal.digitalSignature?.fileHash || 'Computed Valid Digest'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setActiveProofModal(null)}
                style={styles.viewBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANSWER KEY INSPECTION MODAL (Module 10) */}
      {selectedAnswerKeyPaper && (
        <div style={styles.modalOverlay} onClick={() => setSelectedAnswerKeyPaper(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} color="#a855f7" />
                <h3 style={styles.modalTitle}>Official Answer Key Details</h3>
              </div>
              <button onClick={() => setSelectedAnswerKeyPaper(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {loadingAnswerKey ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                  <p>Retrieving authorized answer key record...</p>
                </div>
              ) : (
                <>
                  <div style={styles.modalSection}>
                    <div style={styles.modalSectionTitle}>Subject & Examination</div>
                    <div style={styles.metaGrid}>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Subject</span>
                        <span style={styles.metaVal}>{selectedAnswerKeyPaper.subject}</span>
                      </div>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Paper Title</span>
                        <span style={styles.metaVal}>{selectedAnswerKeyPaper.title}</span>
                      </div>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Exam Date</span>
                        <span style={styles.metaVal}>{selectedAnswerKeyPaper.examDate}</span>
                      </div>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Authoring Faculty</span>
                        <span style={styles.metaVal}>{selectedAnswerKeyPaper.teacher?.name || 'Faculty Member'}</span>
                      </div>
                    </div>
                  </div>

                  {answerKeyError && (
                    <div
                      style={{
                        ...styles.alertBanner,
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        borderColor: '#ef4444',
                        color: '#fca5a5',
                        marginBottom: '1rem',
                      }}
                    >
                      <AlertCircle size={18} />
                      <span style={{ fontSize: '0.85rem' }}>{answerKeyError}</span>
                    </div>
                  )}

                  {!answerKeyData?.submitted ? (
                    <div
                      style={{
                        padding: '1.5rem',
                        textAlign: 'center',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(148, 163, 184, 0.08)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: '#cbd5e1',
                      }}
                    >
                      <Clock size={32} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
                      <h4 style={{ margin: '0 0 0.35rem 0', color: '#f8fafc' }}>Answer Key Pending</h4>
                      <p style={{ margin: 0, fontSize: '0.825rem', color: '#94a3b8' }}>
                        The authoring faculty member has not yet submitted an answer key for this question paper.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={styles.modalSection}>
                        <div style={styles.modalSectionTitle}>Answer Key File Metadata</div>
                        <div style={styles.metaGrid}>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>File Name</span>
                            <span style={styles.metaVal}>{answerKeyData.fileName}</span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>File Size</span>
                            <span style={styles.metaVal}>
                              {(answerKeyData.fileSize / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Submission Date</span>
                            <span style={styles.metaVal}>
                              {new Date(answerKeyData.uploadedAt).toLocaleString()}
                            </span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Lifecycle Status</span>
                            <span style={{ ...styles.metaVal, color: '#4ade80' }}>
                              {answerKeyData.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={styles.modalSection}>
                        <div style={styles.modalSectionTitle}>Cryptographic Security & Digital Signature</div>
                        <div style={styles.metaGrid}>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Signature Algorithm</span>
                            <span style={styles.metaValMono}>
                              {answerKeyData.digitalSignature?.algorithm || 'RSA-PSS-SHA256'}
                            </span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Encryption Scheme</span>
                            <span style={styles.metaValMono}>AES-256-GCM (RSA-OAEP Wrapped)</span>
                          </div>
                          <div style={{ ...styles.metaItem, gridColumn: 'span 2' }}>
                            <span style={styles.metaLabel}>Ciphertext SHA-256 Digest</span>
                            <span style={styles.metaValHash}>
                              {answerKeyData.digitalSignature?.fileHash || 'Protected Ciphertext Digest'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {answerKeyVerifyResult && (
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            backgroundColor: answerKeyVerifyResult.verified
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${answerKeyVerifyResult.verified ? '#22c55e' : '#ef4444'}`,
                            color: answerKeyVerifyResult.verified ? '#86efac' : '#fca5a5',
                            fontSize: '0.825rem',
                          }}
                        >
                          {answerKeyVerifyResult.verified ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ShieldCheck size={16} color="#22c55e" />
                              <span>
                                <strong>Answer Key Signature Verified:</strong> Integrity is intact and matches author's key.
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ShieldAlert size={16} color="#ef4444" />
                              <span>
                                <strong>Tamper Detected:</strong> Digital signature or hash validation failed!
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={styles.modalNotice}>
                        <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Strict Verify-Before-Decrypt pipeline is executed on download. AES keys and private keys are never exposed.
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {answerKeyData?.submitted && (
              <div style={styles.modalFooter}>
                <button
                  onClick={handleVerifyCoordinatorAnswerKeySignature}
                  disabled={verifyingAnswerKey}
                  style={styles.modalVerifyBtn}
                >
                  {verifyingAnswerKey ? (
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  <span>Verify Signature</span>
                </button>

                <button
                  onClick={handleDownloadCoordinatorAnswerKey}
                  disabled={downloadingAnswerKey || answerKeyVerifyResult?.tamperDetected}
                  style={{
                    ...styles.modalDownloadBtn,
                    backgroundColor: '#9333ea',
                    ...(answerKeyVerifyResult?.tamperDetected ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                  }}
                >
                  {downloadingAnswerKey ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>Download Decrypted PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1.5rem',
    backgroundColor: 'var(--color-structure)',
    borderBottom: '1px solid var(--color-structure-border)',
    boxShadow: 'var(--shadow-sm)',
    gap: '1rem',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  brandIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
  },
  brandTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--color-structure-text)',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  appEnvironmentPill: {
    fontSize: '0.65rem',
    fontWeight: '700',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    padding: '1px 6px',
    borderRadius: '4px',
    letterSpacing: '0.05em',
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--color-structure-muted)',
    margin: 0,
  },
  navTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-structure-hover)',
    padding: '0.25rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-structure-border)',
  },
  navTabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-structure-muted)',
    fontSize: '0.8rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  navTabBtnActive: {
    backgroundColor: 'var(--color-structure)',
    color: 'var(--color-structure-text)',
    fontWeight: '600',
    boxShadow: 'var(--shadow-sm)',
  },
  navTabBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    padding: '1px 5px',
    borderRadius: '10px',
  },
  mobileNavTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-structure-text)',
    fontSize: '0.9rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  mobileNavTabBtnActive: {
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    fontWeight: '600',
  },
  userProfile: {
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
    margin: '1rem 0 0.5rem',
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
  algorithmFlowBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  mobileActionBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    color: '#38bdf8',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '0.25rem 0.6rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent-hover)',
    border: '1px solid var(--color-accent-border)',
    fontFamily: 'var(--font-jetbrains)',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--color-structure-text)',
  },
  userEmail: {
    fontSize: '0.75rem',
    color: 'var(--color-structure-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.45rem 0.85rem',
    backgroundColor: 'var(--color-structure-hover)',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-structure-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '38px',
  },
  main: {
    maxWidth: '1360px',
    margin: '0 auto',
    padding: '1.75rem 1.25rem 4rem',
    width: '100%',
  },
  welcomeBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    marginBottom: '1.5rem',
    boxShadow: 'var(--shadow-sm)',
  },
  welcomeHeading: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: 0,
  },
  welcomeSub: {
    fontSize: '0.825rem',
    color: 'var(--color-text-muted)',
    margin: '4px 0 0',
  },
  welcomeActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  headerRefreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.95rem',
    backgroundColor: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.825rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
    gap: '1.25rem',
    marginBottom: '1.75rem',
  },
  metricCardInteractive: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1.25rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  metricIconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  metricLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  metricLabel: {
    fontSize: '0.775rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metricValue: {
    fontSize: '1.65rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    lineHeight: 1.2,
    fontFamily: 'var(--font-ibm-plex)',
  },
  metricDesc: {
    fontSize: '0.725rem',
    color: 'var(--color-text-muted)',
    marginTop: '4px',
  },
  activePulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    boxShadow: '0 0 6px #22c55e',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    marginBottom: '1.5rem',
  },
  alertCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
  },
  papersSection: {
    marginBottom: '2.5rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    margin: '4px 0 0 0',
  },
  countBadge: {
    fontSize: '0.75rem',
    color: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-subtle)',
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--color-primary-border)',
    fontFamily: 'var(--font-ibm-plex)',
    fontWeight: '600',
  },
  quickFilterPills: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  filterPill: {
    padding: '0.35rem 0.75rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterPillActive: {
    backgroundColor: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: '#ffffff',
    fontWeight: '600',
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  searchWrapper: {
    position: 'relative',
    flex: '1 1 min(100%, 320px)',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.85rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--color-text-muted)',
  },
  searchInput: {
    width: '100%',
    padding: '0.65rem 2.2rem 0.65rem 2.4rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: '42px',
  },
  searchClearBtn: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '2px',
  },
  filterControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  selectWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: '0 0.75rem',
    minHeight: '42px',
  },
  select: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-text-primary)',
    fontSize: '0.825rem',
    padding: '0.6rem 0',
    outline: 'none',
    cursor: 'pointer',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 0.95rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.825rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '42px',
  },
  skeletonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  skeletonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  skeletonPulse: {
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: '4px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  emptyStateCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3.5rem 2rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--color-border-strong)',
    textAlign: 'center',
  },
  emptyIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: '0.5rem 0 0.5rem 0',
  },
  emptySubtitle: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    maxWidth: '620px',
    lineHeight: 1.5,
    margin: '0 auto 1.5rem',
  },
  emptyGuidelinesBox: {
    width: '100%',
    maxWidth: '680px',
    backgroundColor: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    textAlign: 'left',
  },
  guidelineHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: '600',
    fontSize: '0.85rem',
    color: 'var(--color-primary)',
    marginBottom: '0.75rem',
  },
  guidelineList: {
    margin: 0,
    paddingLeft: '1.25rem',
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.6,
  },
  resetFilterBtn: {
    padding: '0.6rem 1.25rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  retryBtn: {
    marginTop: '1rem',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.6rem 1.25rem',
    backgroundColor: 'var(--color-danger)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.825rem',
    cursor: 'pointer',
    fontWeight: '600',
  },
  stateCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--color-border-strong)',
    textAlign: 'center',
  },
  tableCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  tableWrapper: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    width: '100%',
  },
  table: {
    width: '100%',
    minWidth: '780px',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '0.85rem 1.25rem',
    fontSize: '0.725rem',
    fontWeight: '700',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-alt)',
  },
  tr: {
    borderBottom: '1px solid var(--color-border)',
    transition: 'background-color var(--transition-fast)',
  },
  td: {
    padding: '1rem 1.25rem',
    fontSize: '0.85rem',
    verticalAlign: 'middle',
  },
  paperSubject: {
    fontWeight: '700',
    color: 'var(--color-structure)',
    fontSize: '0.95rem',
  },
  paperTitle: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.85rem',
    marginTop: '2px',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginTop: '6px',
    flexWrap: 'wrap',
  },
  formatBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    backgroundColor: 'var(--color-danger-subtle)',
    color: 'var(--color-danger)',
    padding: '1px 5px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--color-danger-border)',
  },
  deptBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.675rem',
    fontWeight: '600',
    backgroundColor: 'var(--color-surface-alt)',
    color: 'var(--color-text-secondary)',
    padding: '1px 6px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--color-border)',
  },
  patternBadge: {
    fontSize: '0.675rem',
    fontWeight: '600',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    color: '#38bdf8',
    padding: '1px 6px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
  },
  fileSizeText: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  examType: {
    fontWeight: '600',
    color: 'var(--color-text-primary)',
    fontSize: '0.85rem',
  },
  examDate: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '3px',
    fontFamily: 'var(--font-ibm-plex)',
  },
  semesterText: {
    fontSize: '0.725rem',
    color: 'var(--color-text-muted)',
    marginTop: '2px',
  },
  teacherName: {
    fontWeight: '500',
    color: 'var(--color-text-primary)',
  },
  teacherEmail: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '2px',
    fontFamily: 'var(--font-jetbrains)',
  },
  deliveryDate: {
    fontSize: '0.8rem',
    color: 'var(--color-text-primary)',
    marginBottom: '4px',
    fontFamily: 'var(--font-ibm-plex)',
  },
  deliveryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '0.3rem 0.65rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid transparent',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  answerKeyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.45rem 0.75rem',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: 'var(--radius-sm)',
    color: '#7e22ce',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '36px',
  },
  viewBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.45rem 0.75rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '36px',
  },
  verifyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.45rem 0.75rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.45rem 0.85rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  sectionCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    marginBottom: '2rem',
    boxShadow: 'var(--shadow-sm)',
  },
  inlineEmptyBox: {
    padding: '2.5rem',
    textAlign: 'center',
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--color-border)',
  },
  deliveryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
    gap: '1rem',
  },
  deliveryItemCard: {
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  deliveryItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
    gap: '0.5rem',
  },
  deliveryItemSubject: {
    fontWeight: '700',
    color: 'var(--color-structure)',
    fontSize: '0.925rem',
  },
  deliveryItemTitle: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    marginTop: '2px',
  },
  scheduledPill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.675rem',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: 'var(--radius-xs)',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    color: '#fde047',
    border: '1px solid #eab308',
    whiteSpace: 'nowrap',
  },
  deliveryItemDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '1rem',
    fontSize: '0.775rem',
  },
  deliveryMetaLine: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  deliveryMetaKey: {
    color: 'var(--color-text-muted)',
  },
  deliveryMetaVal: {
    fontWeight: '500',
    color: 'var(--color-text-primary)',
  },
  deliveryItemFooter: {
    display: 'flex',
    gap: '0.5rem',
    borderTop: '1px solid var(--color-border)',
    paddingTop: '0.75rem',
  },
  deliveryInspectBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.45rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  deliveryVerifyBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.45rem',
    backgroundColor: 'var(--color-primary-subtle)',
    border: '1px solid var(--color-primary-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-primary)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    padding: '0.85rem',
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  activityIconBox: {
    width: '34px',
    height: '34px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2px',
  },
  activityActionText: {
    fontWeight: '600',
    fontSize: '0.825rem',
    color: 'var(--color-structure)',
  },
  activityTime: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-ibm-plex)',
  },
  activityDetails: {
    fontSize: '0.775rem',
    color: 'var(--color-text-muted)',
  },
  inlineMonoBadge: {
    fontSize: '0.675rem',
    fontFamily: 'var(--font-jetbrains)',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    color: '#38bdf8',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  iconRefreshBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '4px',
  },
  securityBanner: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  securityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  securityTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
  },
  securityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: '1rem',
  },
  securityFeature: {
    backgroundColor: 'var(--color-surface-alt)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  securityFeatureTitle: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.825rem',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
    marginBottom: '0.4rem',
  },
  securityFeatureDesc: {
    fontSize: '0.775rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
    overflowY: 'auto',
  },
  modalContent: {
    width: '100%',
    maxWidth: '650px',
    maxHeight: '90vh',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--color-border)',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
  },
  modalBody: {
    padding: '1.5rem',
    maxHeight: '75vh',
    overflowY: 'auto',
  },
  modalSection: {
    marginBottom: '1.25rem',
  },
  modalSectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--color-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '0.75rem',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--color-surface-alt)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  metaLabel: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    marginBottom: '2px',
  },
  metaVal: {
    fontSize: '0.85rem',
    color: 'var(--color-text-primary)',
    fontWeight: '500',
  },
  metaValMono: {
    fontSize: '0.8rem',
    color: 'var(--color-accent-hover)',
    fontFamily: 'var(--font-jetbrains)',
  },
  metaValHash: {
    fontSize: '0.75rem',
    color: 'var(--color-accent-hover)',
    fontFamily: 'var(--font-jetbrains)',
    wordBreak: 'break-all',
  },
  modalNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    backgroundColor: 'var(--color-success-subtle)',
    border: '1px solid var(--color-success-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem',
    marginTop: '1rem',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-alt)',
    flexWrap: 'wrap',
  },
  modalVerifyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 1rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '44px',
  },
  modalDownloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 1.25rem',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
};
