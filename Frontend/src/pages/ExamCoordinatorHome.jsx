import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import examCoordinatorService from '../services/examCoordinatorService';
import answerKeyService from '../services/answerKeyService';
import NotificationBell from '../components/NotificationBell';
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
} from 'lucide-react';

export default function ExamCoordinatorHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Question Papers state
  const [papers, setPapers] = useState([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [papersError, setPapersError] = useState('');

  // Digital Signature Verification state (Module 7 & 9)
  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationResults, setVerificationResults] = useState({});

  // Details Modal State
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

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

  // Notification / Alert message state
  const [actionAlert, setActionAlert] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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

  // Fetch Assigned Question Papers
  const fetchPapers = useCallback(async () => {
    setLoadingPapers(true);
    setPapersError('');
    try {
      const data = await examCoordinatorService.getAssignedQuestionPapers();
      setPapers(data || []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load assigned question papers.';
      setPapersError(msg);
    } finally {
      setLoadingPapers(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

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

      if (result.verified) {
        setActionAlert({
          type: 'success',
          message: `Integrity check PASSED: Ciphertext hash matches RSA-PSS signature (${result.algorithm || 'RSA-PSS-SHA256'}).`,
        });
      } else {
        setActionAlert({
          type: 'danger',
          message: 'CRITICAL SECURITY ALERT: Digital signature or ciphertext hash verification failed! Document may be tampered.',
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
        message: `Verification error: ${msg}`,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  // Handle Secure Download of Decrypted PDF
  const handleDownloadPaper = async (paper) => {
    // If verification has already failed, block download immediately
    const vResult = verificationResults[paper.id];
    if (vResult && (vResult.tamperDetected || vResult.verified === false)) {
      setActionAlert({
        type: 'danger',
        message: 'Security Policy Enforcement: Cannot download question paper with failed integrity verification.',
      });
      return;
    }

    setDownloadingId(paper.id);
    setActionAlert(null);
    try {
      await examCoordinatorService.downloadQuestionPaper(paper.id, paper.fileName);
      setActionAlert({
        type: 'success',
        message: `Question paper "${paper.title}" successfully decrypted and downloaded.`,
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

  // Filter and search papers
  const filteredPapers = papers.filter((p) => {
    const matchesSearch =
      (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.subject && p.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.teacher?.name && p.teacher.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.examType && p.examType.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'VERIFIED') {
      return verificationResults[p.id]?.verified === true;
    }
    if (statusFilter === 'FAILED') {
      return verificationResults[p.id]?.tamperDetected === true || verificationResults[p.id]?.verified === false;
    }
    if (statusFilter === 'PENDING_DELIVERY') {
      return p.assignment?.deliveryStatus === 'PENDING';
    }

    return true;
  });

  // Calculate summary counts
  const totalAssigned = papers.length;
  const verifiedCount = Object.values(verificationResults).filter((r) => r.verified).length;
  const pendingDeliveryCount = papers.filter((p) => p.assignment?.deliveryStatus === 'PENDING').length;

  return (
    <div style={styles.container}>
      {/* Top Navigation Bar */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <div style={styles.brandIcon}>
            <ClipboardCheck size={26} color="#38bdf8" />
          </div>
          <div>
            <h1 style={styles.brandTitle}>ExamGuard</h1>
            <p style={styles.brandSubtitle}>Examination Coordinator Control Center</p>
          </div>
        </div>

        {/* Desktop Profile Section */}
        <div className="nav-desktop" style={styles.userProfile}>
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

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--color-structure-border)' }}>
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
        {/* Metric Cards Banner */}
        <section style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={styles.metricLabel}>Assigned Question Papers</div>
              <div style={styles.metricValue}>{totalAssigned}</div>
              <div style={styles.metricDesc}>Legitimately accessible in exam workflow</div>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={styles.metricLabel}>Integrity Verified</div>
              <div style={styles.metricValue}>{verifiedCount}</div>
              <div style={styles.metricDesc}>RSA-PSS + SHA-256 verified this session</div>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={styles.metricLabel}>Scheduled Delivery</div>
              <div style={styles.metricValue}>{pendingDeliveryCount}</div>
              <div style={styles.metricDesc}>Scheduled next-day delivery workflow</div>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={{ ...styles.metricIconBox, backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={styles.metricLabel}>Security Pipeline</div>
              <div style={styles.metricValue}>Active</div>
              <div style={styles.metricDesc}>Verify-Before-Decrypt & Zero Secret Leakage</div>
            </div>
          </div>
        </section>

        {/* Global Action Alert Toast */}
        {actionAlert && (
          <div
            style={{
              ...styles.alertBanner,
              backgroundColor: actionAlert.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderColor: actionAlert.type === 'success' ? '#22c55e' : '#ef4444',
              color: actionAlert.type === 'success' ? '#86efac' : '#fca5a5',
            }}
          >
            {actionAlert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span style={{ flex: 1, fontSize: '0.875rem' }}>{actionAlert.message}</span>
            <button
              onClick={() => setActionAlert(null)}
              style={styles.alertCloseBtn}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div style={styles.filterBar}>
          <div style={styles.searchWrapper}>
            <Search size={16} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by subject, title, setter faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterControls}>
            <div style={styles.selectWrapper}>
              <Filter size={14} style={{ color: '#94a3b8', marginRight: '6px' }} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.select}
              >
                <option value="ALL">All Papers ({papers.length})</option>
                <option value="VERIFIED">Verified Integrity</option>
                <option value="PENDING_DELIVERY">Pending Next-Day Delivery</option>
                <option value="FAILED">Failed Integrity</option>
              </select>
            </div>

            <button
              onClick={fetchPapers}
              disabled={loadingPapers}
              style={styles.refreshBtn}
              title="Refresh Question Papers"
            >
              <RefreshCw size={15} style={loadingPapers ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Papers Section */}
        <section style={styles.papersSection}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Available Examination Question Papers</h2>
              <p style={styles.sectionSubtitle}>
                Only papers legitimately assigned to your Exam Coordinator account are displayed.
              </p>
            </div>
            <span style={styles.countBadge}>
              {filteredPapers.length} of {papers.length} Available
            </span>
          </div>

          {/* Loading State */}
          {loadingPapers ? (
            <div style={styles.stateCard}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
              <p style={styles.stateText}>Retrieving authorized question papers from secure repository...</p>
            </div>
          ) : papersError ? (
            <div style={{ ...styles.stateCard, borderColor: '#ef4444' }}>
              <AlertCircle size={32} color="#ef4444" />
              <p style={{ ...styles.stateText, color: '#fca5a5' }}>{papersError}</p>
              <button onClick={fetchPapers} style={styles.retryBtn}>
                Retry Fetch
              </button>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div style={styles.stateCard}>
              <FileText size={36} color="#64748b" />
              <h3 style={styles.emptyTitle}>
                {papers.length === 0 ? 'No Question Papers Assigned' : 'No Papers Match Search Criteria'}
              </h3>
              <p style={styles.emptySubtitle}>
                {papers.length === 0
                  ? 'There are currently no examination question papers assigned to your coordinator account.'
                  : 'Try adjusting your search terms or filters.'}
              </p>
            </div>
          ) : (
            <div style={styles.tableCard}>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Subject & Paper Details</th>
                      <th style={styles.th}>Exam Info</th>
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

                      return (
                        <tr key={paper.id} style={styles.tr}>
                          {/* Subject & Title */}
                          <td style={styles.td}>
                            <div style={styles.paperSubject}>{paper.subject}</div>
                            <div style={styles.paperTitle}>{paper.title}</div>
                            <div style={styles.metaRow}>
                              <span style={styles.formatBadge}>{paper.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}</span>
                              <span style={styles.fileSizeText}>
                                {paper.fileSize ? `${(paper.fileSize / 1024).toFixed(1)} KB` : 'Protected'}
                              </span>
                            </div>
                          </td>

                          {/* Exam Info */}
                          <td style={styles.td}>
                            <div style={styles.examType}>{paper.examType}</div>
                            <div style={styles.examDate}>
                              <Calendar size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                              {paper.examDate}
                            </div>
                            <div style={styles.semesterText}>{paper.semester} ({paper.academicYear})</div>
                          </td>

                          {/* Setter / Faculty */}
                          <td style={styles.td}>
                            <div style={styles.teacherName}>
                              <User size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                              {paper.teacher?.name || 'Faculty Member'}
                            </div>
                            <div style={styles.teacherEmail}>{paper.teacher?.email || '—'}</div>
                          </td>

                          {/* Scheduled Delivery */}
                          <td style={styles.td}>
                            <div style={styles.deliveryDate}>
                              <Clock size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                              {paper.scheduledDeliveryDate || paper.assignment?.scheduledDeliveryDate || 'Scheduled Next-Day'}
                            </div>
                            <span
                              style={{
                                ...styles.deliveryBadge,
                                backgroundColor:
                                  paper.assignment?.deliveryStatus === 'DELIVERED'
                                    ? 'rgba(34, 197, 94, 0.15)'
                                    : 'rgba(234, 179, 8, 0.15)',
                                color:
                                  paper.assignment?.deliveryStatus === 'DELIVERED' ? '#86efac' : '#fde047',
                                borderColor:
                                  paper.assignment?.deliveryStatus === 'DELIVERED' ? '#22c55e' : '#eab308',
                              }}
                            >
                              {paper.assignment?.deliveryStatus || 'PENDING'}
                            </span>
                          </td>

                          {/* Digital Signature & Integrity Status */}
                          <td style={styles.td}>
                            {isVerifying ? (
                              <span style={{ ...styles.statusPill, backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', marginRight: '4px' }} />
                                Verifying...
                              </span>
                            ) : vResult?.verified ? (
                              <span style={{ ...styles.statusPill, backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#86efac', borderColor: '#22c55e' }}>
                                <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                                Verified (RSA-PSS)
                              </span>
                            ) : vResult?.tamperDetected ? (
                              <span style={{ ...styles.statusPill, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderColor: '#ef4444' }}>
                                <ShieldAlert size={12} style={{ marginRight: '4px' }} />
                                Tamper Detected!
                              </span>
                            ) : paper.digitalSignature ? (
                              <span style={{ ...styles.statusPill, backgroundColor: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1' }}>
                                <Lock size={12} style={{ marginRight: '4px' }} />
                                Signed (RSA-PSS)
                              </span>
                            ) : (
                              <span style={{ ...styles.statusPill, backgroundColor: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>
                                Encrypted
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <div style={styles.actionRow}>
                              {/* Answer Key Trigger */}
                              <button
                                onClick={() => handleOpenAnswerKeyModal(paper)}
                                style={styles.answerKeyBtn}
                                title="View & Download Answer Key"
                              >
                                <Key size={14} />
                                <span>Answer Key</span>
                              </button>

                              {/* Details Modal Trigger */}
                              <button
                                onClick={() => setSelectedPaper(paper)}
                                style={styles.viewBtn}
                                title="View Safe Metadata"
                              >
                                <Eye size={14} />
                                <span>Details</span>
                              </button>

                              {/* Verify Signature */}
                              <button
                                onClick={() => handleVerifySignature(paper.id)}
                                disabled={isVerifying}
                                style={styles.verifyBtn}
                                title="Verify RSA-PSS Signature and SHA-256 Hash"
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
                                disabled={isDownloading || vResult?.tamperDetected}
                                style={{
                                  ...styles.downloadBtn,
                                  ...(vResult?.tamperDetected
                                    ? { backgroundColor: '#475569', cursor: 'not-allowed', opacity: 0.5 }
                                    : {}),
                                }}
                                title={
                                  vResult?.tamperDetected
                                    ? 'Integrity check failed: download blocked'
                                    : 'Verify-Before-Decrypt and download'
                                }
                              >
                                {isDownloading ? (
                                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                  <Download size={14} />
                                )}
                                <span>{isDownloading ? 'Decrypting...' : 'Download'}</span>
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

        {/* Security Info Card */}
        <section style={styles.securityBanner}>
          <div style={styles.securityHeader}>
            <ShieldCheck size={20} color="#10b981" />
            <span style={styles.securityTitle}>ExamGuard End-to-End Cryptographic Security Guarantees</span>
          </div>
          <p style={styles.securityText}>
            Question papers in this repository are stored strictly in private encrypted storage. When you request a download, the server executes a strict <strong>Verify-Before-Decrypt</strong> sequence (SHA-256 integrity check → RSA-PSS signature verification → RSA-OAEP AES key unwrapping → AES-256-GCM decryption). Plaintext keys, IVs, and private keys are never exposed.
          </p>
        </section>
      </main>

      {/* Question Paper Metadata Modal */}
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
                    <span style={styles.metaLabel}>Exam Type</span>
                    <span style={styles.metaVal}>{selectedPaper.examType}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Exam Date</span>
                    <span style={styles.metaVal}>{selectedPaper.examDate}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Semester & Year</span>
                    <span style={styles.metaVal}>{selectedPaper.semester} ({selectedPaper.academicYear})</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Status</span>
                    <span style={styles.metaVal}>{selectedPaper.status}</span>
                  </div>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Faculty Setter & Workflow</div>
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
                      {selectedPaper.scheduledDeliveryDate || selectedPaper.assignment?.scheduledDeliveryDate || 'Next-Day'}
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
                  Cryptographic Protection: Plaintext AES keys and RSA private keys are strictly server-side and never returned in API responses.
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

      {/* Answer Key Inspection Modal (Module 10) */}
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
                    <div style={{ ...styles.alertBanner, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', color: '#fca5a5', marginBottom: '1rem' }}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: '0.85rem' }}>{answerKeyError}</span>
                    </div>
                  )}

                  {!answerKeyData?.submitted ? (
                    <div style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(148, 163, 184, 0.08)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      color: '#cbd5e1',
                    }}>
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
                            <span style={styles.metaVal}>{(answerKeyData.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Submission Date</span>
                            <span style={styles.metaVal}>{new Date(answerKeyData.uploadedAt).toLocaleString()}</span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Lifecycle Status</span>
                            <span style={{ ...styles.metaVal, color: '#4ade80' }}>{answerKeyData.status}</span>
                          </div>
                        </div>
                      </div>

                      <div style={styles.modalSection}>
                        <div style={styles.modalSectionTitle}>Cryptographic Security & Digital Signature</div>
                        <div style={styles.metaGrid}>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Signature Algorithm</span>
                            <span style={styles.metaValMono}>{answerKeyData.digitalSignature?.algorithm || 'RSA-PSS-SHA256'}</span>
                          </div>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Encryption Scheme</span>
                            <span style={styles.metaValMono}>AES-256-GCM (RSA-OAEP Wrapped)</span>
                          </div>
                          <div style={{ ...styles.metaItem, gridColumn: 'span 2' }}>
                            <span style={styles.metaLabel}>Ciphertext SHA-256 Digest</span>
                            <span style={styles.metaValHash}>{answerKeyData.digitalSignature?.fileHash || 'Protected Ciphertext Digest'}</span>
                          </div>
                        </div>
                      </div>

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
                              <ShieldCheck size={16} color="#22c55e" />
                              <span><strong>Answer Key Signature Verified:</strong> Integrity is intact and matches author's key.</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ShieldAlert size={16} color="#ef4444" />
                              <span><strong>Tamper Detected:</strong> Digital signature or hash validation failed!</span>
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
    padding: '1rem 1.5rem',
    backgroundColor: 'var(--color-structure)',
    borderBottom: '1px solid var(--color-structure-border)',
    boxShadow: 'var(--shadow-sm)',
    gap: '1rem',
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
  brandSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--color-structure-muted)',
    margin: 0,
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
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '1.75rem 1.25rem',
    width: '100%',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: '1.25rem',
    marginBottom: '1.5rem',
  },
  metricCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  metricIconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    marginBottom: '2px',
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    lineHeight: 1.2,
    fontFamily: 'var(--font-ibm-plex)',
  },
  metricDesc: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    marginTop: '2px',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1.25rem',
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
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  searchWrapper: {
    position: 'relative',
    flex: '1 1 min(100%, 300px)',
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
    padding: '0.65rem 0.85rem 0.65rem 2.4rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: '44px',
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
    minHeight: '44px',
  },
  select: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-text-primary)',
    fontSize: '0.85rem',
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
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '44px',
  },
  papersSection: {
    marginBottom: '2rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
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
    minWidth: '700px',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '0.85rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
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
    fontWeight: '600',
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
    gap: '0.5rem',
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
  fileSizeText: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  examType: {
    fontWeight: '500',
    color: 'var(--color-text-primary)',
  },
  examDate: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '3px',
    fontFamily: 'var(--font-ibm-plex)',
  },
  semesterText: {
    fontSize: '0.7rem',
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
    display: 'inline-block',
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
    gap: '0.5rem',
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
  stateText: {
    marginTop: '1rem',
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  retryBtn: {
    marginTop: '0.75rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--color-danger)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    minHeight: '44px',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--color-structure)',
    margin: '1rem 0 0.25rem 0',
  },
  emptySubtitle: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    margin: 0,
  },
  securityBanner: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  securityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  securityTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--color-structure)',
  },
  securityText: {
    fontSize: '0.8rem',
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
