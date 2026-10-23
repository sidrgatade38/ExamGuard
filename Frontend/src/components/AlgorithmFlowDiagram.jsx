import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Key,
  FileText,
  Upload,
  UserCheck,
  Eye,
  ArrowRight,
  ArrowDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
} from 'lucide-react';

export default function AlgorithmFlowDiagram({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('complete');

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <div style={styles.iconBadge}>
              <Layers size={22} color="#3b82f6" />
            </div>
            <div>
              <h2 style={styles.title}>ExamGuard Cryptographic Algorithm Flow</h2>
              <p style={styles.subtitle}>
                Authoritative alignment with university security architecture &amp; handwritten design specifications
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close Modal">
            <X size={20} />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div style={styles.tabBar}>
          <button
            onClick={() => setActiveTab('complete')}
            style={activeTab === 'complete' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
          >
            Complete Algorithm Flow (11 Steps)
          </button>
          <button
            onClick={() => setActiveTab('decryption')}
            style={activeTab === 'decryption' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
          >
            Decryption Breakdown Sequence
          </button>
          <button
            onClick={() => setActiveTab('guarantees')}
            style={activeTab === 'guarantees' ? { ...styles.tabBtn, ...styles.activeTabBtn } : styles.tabBtn}
          >
            Cryptographic Guarantees
          </button>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {activeTab === 'complete' && (
            <div>
              <div style={styles.infoBox}>
                <ShieldCheck size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={styles.infoText}>
                  <strong>Handwritten Algorithm Specification:</strong> Sequence strictly follows the two-sided
                  institutional model: Teacher Side (Upload &amp; Encryption) &rarr; Exam Cell / Coordinator Side (RBAC Authorization &amp; Decryption).
                </span>
              </div>

              {/* SECTION A: TEACHER SIDE */}
              <div style={styles.flowSection}>
                <div style={styles.sectionHeader}>
                  <div style={styles.teacherBadge}>Teacher Side</div>
                  <span style={styles.sectionTitle}>Document Ingestion, Envelope Encryption &amp; Digital Signing</span>
                </div>

                <div style={styles.stepGrid}>
                  {/* Step 1 */}
                  <div style={styles.stepCard}>
                    <div style={styles.stepNumberBadge}>1</div>
                    <div style={styles.stepIconWrapTeacher}>
                      <UserCheck size={20} color="#2563eb" />
                    </div>
                    <div style={styles.stepTitle}>Teacher Login</div>
                    <div style={styles.stepDesc}>
                      Authorizes faculty account status and issues signed JWT bearer token with TEACHER claim.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 2 */}
                  <div style={styles.stepCard}>
                    <div style={styles.stepNumberBadge}>2</div>
                    <div style={styles.stepIconWrapTeacher}>
                      <Upload size={20} color="#2563eb" />
                    </div>
                    <div style={styles.stepTitle}>Create / Upload Question Paper</div>
                    <div style={styles.stepDesc}>
                      Multipart PDF upload or curriculum blueprint generation; validated in memory with magic bytes.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 3 */}
                  <div style={styles.stepCard}>
                    <div style={styles.stepNumberBadge}>3</div>
                    <div style={styles.stepIconWrapTeacher}>
                      <Key size={20} color="#2563eb" />
                    </div>
                    <div style={styles.stepTitle}>Generate AES Key</div>
                    <div style={styles.stepDesc}>
                      CSPRNG generates unique 256-bit AES data-encryption key (DEK) and 96-bit initialization vector.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 4 */}
                  <div style={styles.stepCard}>
                    <div style={styles.stepNumberBadge}>4</div>
                    <div style={styles.stepIconWrapTeacher}>
                      <Lock size={20} color="#2563eb" />
                    </div>
                    <div style={styles.stepTitle}>AES Encryption</div>
                    <div style={styles.stepDesc}>
                      Encrypts PDF with AES-256-GCM producing ciphertext + 16-byte auth tag; wraps DEK with RSA-OAEP.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 5 */}
                  <div style={styles.stepCard}>
                    <div style={styles.stepNumberBadge}>5</div>
                    <div style={styles.stepIconWrapTeacher}>
                      <FileCheck size={20} color="#2563eb" />
                    </div>
                    <div style={styles.stepTitle}>Generate Digital Signature</div>
                    <div style={styles.stepDesc}>
                      Computes SHA-256 digest over ciphertext and signs with RSA-PSS private key for non-repudiation.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 6 */}
                  <div style={styles.stepCard}>
                    <div style={styles.stepNumberBadge}>6</div>
                    <div style={styles.stepIconWrapTeacher}>
                      <Shield size={20} color="#2563eb" />
                    </div>
                    <div style={styles.stepTitle}>Store Encrypted Paper + Signature</div>
                    <div style={styles.stepDesc}>
                      Stores ciphertext in private Supabase Storage (.enc) and cryptographic records in PostgreSQL.
                    </div>
                  </div>
                </div>
              </div>

              {/* CONNECTOR BRIDGE */}
              <div style={styles.bridgeWrap}>
                <div style={styles.bridgeLine}></div>
                <div style={styles.bridgeBadge}>
                  <span>Secure Storage &amp; Scheduled Delivery Transition</span>
                </div>
                <div style={styles.bridgeLine}></div>
              </div>

              {/* SECTION B: EXAM CELL SIDE */}
              <div style={styles.flowSectionCoordinator}>
                <div style={styles.sectionHeader}>
                  <div style={styles.coordBadge}>Exam Cell / Exam Coordinator Side</div>
                  <span style={styles.sectionTitle}>Authorized Retrieval, Verification &amp; Plaintext Delivery</span>
                </div>

                <div style={styles.stepGrid}>
                  {/* Step 7 */}
                  <div style={styles.stepCardCoord}>
                    <div style={styles.stepNumberBadgeCoord}>7</div>
                    <div style={styles.stepIconWrapCoord}>
                      <UserCheck size={20} color="#10b981" />
                    </div>
                    <div style={styles.stepTitle}>Exam Cell Login</div>
                    <div style={styles.stepDesc}>
                      Coordinator authenticates with credentials; server issues JWT with EXAM_COORDINATOR role.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 8 */}
                  <div style={styles.stepCardCoord}>
                    <div style={styles.stepNumberBadgeCoord}>8</div>
                    <div style={styles.stepIconWrapCoord}>
                      <ShieldCheck size={20} color="#10b981" />
                    </div>
                    <div style={styles.stepTitle}>RBAC Authorization</div>
                    <div style={styles.stepDesc}>
                      Validates active role, assignment record, and server-side scheduled delivery date gating.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 9 */}
                  <div style={styles.stepCardCoord}>
                    <div style={styles.stepNumberBadgeCoord}>9</div>
                    <div style={styles.stepIconWrapCoord}>
                      <FileCheck size={20} color="#10b981" />
                    </div>
                    <div style={styles.stepTitle}>Verify Digital Signature</div>
                    <div style={styles.stepDesc}>
                      Downloads ciphertext; recalculates SHA-256 hash and validates RSA-PSS signature BEFORE decryption.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 10 */}
                  <div style={styles.stepCardCoord}>
                    <div style={styles.stepNumberBadgeCoord}>10</div>
                    <div style={styles.stepIconWrapCoord}>
                      <Key size={20} color="#10b981" />
                    </div>
                    <div style={styles.stepTitle}>AES Decryption</div>
                    <div style={styles.stepDesc}>
                      Unwraps DEK via RSA-OAEP private key; decrypts AES-256-GCM &amp; authenticates GCM tag; wipes key memory.
                    </div>
                  </div>

                  <div style={styles.arrowWrap}>
                    <ArrowRight size={20} style={styles.desktopArrow} />
                    <ArrowDown size={20} style={styles.mobileArrow} />
                  </div>

                  {/* Step 11 */}
                  <div style={styles.stepCardCoord}>
                    <div style={styles.stepNumberBadgeCoord}>11</div>
                    <div style={styles.stepIconWrapCoord}>
                      <Eye size={20} color="#10b981" />
                    </div>
                    <div style={styles.stepTitle}>View / Download Paper</div>
                    <div style={styles.stepDesc}>
                      Streams authenticated plaintext PDF buffer directly to authorized browser with audit log record.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'decryption' && (
            <div>
              <div style={styles.infoBox}>
                <Lock size={18} color="#8b5cf6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={styles.infoText}>
                  <strong>Handwritten Decryption Sequence:</strong> Encrypted Paper &rarr; Signature Verification &rarr; RBAC Authorization &rarr; AES Decryption &rarr; Original Question Paper.
                </span>
              </div>

              <div style={styles.decryptionFlowWrap}>
                <div style={styles.decryptionStep}>
                  <div style={styles.decryptionStepHeader}>
                    <span style={styles.decStepNum}>A</span>
                    <span style={styles.decStepName}>Encrypted Paper</span>
                  </div>
                  <p style={styles.decStepDesc}>
                    Stored ciphertext (.enc) retrieved from private Supabase Storage. Plaintext never resides on storage disk.
                  </p>
                </div>

                <div style={styles.decArrowWrap}>
                  <ArrowRight size={22} style={styles.desktopArrow} color="#8b5cf6" />
                  <ArrowDown size={22} style={styles.mobileArrow} color="#8b5cf6" />
                </div>

                <div style={styles.decryptionStep}>
                  <div style={styles.decryptionStepHeader}>
                    <span style={styles.decStepNum}>B</span>
                    <span style={styles.decStepName}>Signature Verification</span>
                  </div>
                  <p style={styles.decStepDesc}>
                    Verify-Before-Decrypt: Evaluates SHA-256 digest &amp; RSA-PSS signature. Tampered ciphertext immediately aborts.
                  </p>
                </div>

                <div style={styles.decArrowWrap}>
                  <ArrowRight size={22} style={styles.desktopArrow} color="#8b5cf6" />
                  <ArrowDown size={22} style={styles.mobileArrow} color="#8b5cf6" />
                </div>

                <div style={styles.decryptionStep}>
                  <div style={styles.decryptionStepHeader}>
                    <span style={styles.decStepNum}>C</span>
                    <span style={styles.decStepName}>RBAC Authorization</span>
                  </div>
                  <p style={styles.decStepDesc}>
                    Evaluates user role, active status, specific paper assignment, and calendar delivery date gating.
                  </p>
                </div>

                <div style={styles.decArrowWrap}>
                  <ArrowRight size={22} style={styles.desktopArrow} color="#8b5cf6" />
                  <ArrowDown size={22} style={styles.mobileArrow} color="#8b5cf6" />
                </div>

                <div style={styles.decryptionStep}>
                  <div style={styles.decryptionStepHeader}>
                    <span style={styles.decStepNum}>D</span>
                    <span style={styles.decStepName}>AES Decryption</span>
                  </div>
                  <p style={styles.decStepDesc}>
                    RSA-OAEP unwraps DEK; AES-256-GCM decrypts document; verifies 16-byte authentication tag; wipes key buffer.
                  </p>
                </div>

                <div style={styles.decArrowWrap}>
                  <ArrowRight size={22} style={styles.desktopArrow} color="#8b5cf6" />
                  <ArrowDown size={22} style={styles.mobileArrow} color="#8b5cf6" />
                </div>

                <div style={styles.decryptionStepHighlight}>
                  <div style={styles.decryptionStepHeader}>
                    <span style={styles.decStepNumHighlight}>E</span>
                    <span style={styles.decStepNameHighlight}>Original Question Paper</span>
                  </div>
                  <p style={styles.decStepDesc}>
                    Authentic, validated PDF streamed directly in memory to authorized faculty/coordinator session.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guarantees' && (
            <div style={styles.guaranteeGrid}>
              <div style={styles.guaranteeCard}>
                <div style={styles.guaranteeHeader}>
                  <Lock size={20} color="#2563eb" />
                  <h4 style={styles.guaranteeTitle}>Confidentiality (AES-256-GCM)</h4>
                </div>
                <p style={styles.guaranteeDesc}>
                  Every uploaded examination document is encrypted with a unique 256-bit symmetric key. Plaintext files
                  are never persisted to disk or cloud storage. AES data keys are wrapped with RSA-OAEP (2048-bit).
                </p>
              </div>

              <div style={styles.guaranteeCard}>
                <div style={styles.guaranteeHeader}>
                  <FileCheck size={20} color="#10b981" />
                  <h4 style={styles.guaranteeTitle}>Integrity &amp; Authenticity (RSA-PSS)</h4>
                </div>
                <p style={styles.guaranteeDesc}>
                  The exact ciphertext buffer is hashed with SHA-256 and digitally signed with RSA-PSS using a dedicated
                  private signing key. Non-repudiation is strictly guaranteed across institutional governance.
                </p>
              </div>

              <div style={styles.guaranteeCard}>
                <div style={styles.guaranteeHeader}>
                  <UserCheck size={20} color="#8b5cf6" />
                  <h4 style={styles.guaranteeTitle}>Role-Based Access Control (RBAC)</h4>
                </div>
                <p style={styles.guaranteeDesc}>
                  Authoritative database role lookup prevents client JWT claim tampering. Only verified TEACHER
                  authors and assigned EXAM_COORDINATOR recipients can initiate document operations.
                </p>
              </div>

              <div style={styles.guaranteeCard}>
                <div style={styles.guaranteeHeader}>
                  <ShieldCheck size={20} color="#f59e0b" />
                  <h4 style={styles.guaranteeTitle}>Scheduled Delivery Gating</h4>
                </div>
                <p style={styles.guaranteeDesc}>
                  Assigned coordinators are prohibited from downloading or decrypting papers before the server-calculated
                  scheduled delivery date, ensuring question confidentiality prior to examination sessions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerNote}>
            ExamGuard Cryptographic Core &bull; Module 20 Alignment &bull; Zero Plaintext Storage
          </div>
          <button onClick={onClose} style={styles.closeModalBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
    backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #1e293b',
    width: '100%',
    maxWidth: '1100px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    color: '#f8fafc',
    overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1e293b',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  iconBadge: {
    padding: '0.625rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    margin: '0.2rem 0 0 0',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.4rem',
    borderRadius: '6px',
  },
  tabBar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0b1120',
    overflowX: 'auto',
  },
  tabBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontSize: '0.825rem',
    fontWeight: '600',
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  activeTabBtn: {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
  },
  body: {
    padding: '1.25rem 1.5rem',
    overflowY: 'auto',
    flex: 1,
  },
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid #334155',
    marginBottom: '1.25rem',
  },
  infoText: {
    fontSize: '0.825rem',
    color: '#cbd5e1',
    lineHeight: '1.45',
  },
  flowSection: {
    padding: '1rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    border: '1px solid rgba(37, 99, 235, 0.2)',
    marginBottom: '1rem',
  },
  flowSectionCoordinator: {
    padding: '1rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  teacherBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.25rem 0.65rem',
    borderRadius: '9999px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  coordBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.25rem 0.65rem',
    borderRadius: '9999px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sectionTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  stepGrid: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  stepCard: {
    flex: '1 1 140px',
    minWidth: '135px',
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: '0.875rem 0.75rem',
    border: '1px solid #334155',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  stepCardCoord: {
    flex: '1 1 140px',
    minWidth: '135px',
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: '0.875rem 0.75rem',
    border: '1px solid #334155',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  stepNumberBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    padding: '0.15rem 0.45rem',
    borderRadius: '6px',
  },
  stepNumberBadgeCoord: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    padding: '0.15rem 0.45rem',
    borderRadius: '6px',
  },
  stepIconWrapTeacher: {
    padding: '0.4rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    marginBottom: '0.5rem',
  },
  stepIconWrapCoord: {
    padding: '0.4rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    marginBottom: '0.5rem',
  },
  stepTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: '0.35rem',
  },
  stepDesc: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    lineHeight: '1.4',
    margin: 0,
  },
  arrowWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    padding: '0 0.2rem',
  },
  desktopArrow: {
    display: 'block',
  },
  mobileArrow: {
    display: 'none',
  },
  bridgeWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '1rem 0',
  },
  bridgeLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#334155',
  },
  bridgeBadge: {
    padding: '0.35rem 0.85rem',
    borderRadius: '9999px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    fontSize: '0.75rem',
    color: '#cbd5e1',
    fontWeight: '600',
  },
  decryptionFlowWrap: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  decryptionStep: {
    flex: '1 1 170px',
    minWidth: '150px',
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: '1rem',
    border: '1px solid #334155',
  },
  decryptionStepHighlight: {
    flex: '1 1 170px',
    minWidth: '150px',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: '10px',
    padding: '1rem',
    border: '1px solid rgba(139, 92, 246, 0.4)',
  },
  decryptionStepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  decStepNum: {
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: '#334155',
    color: '#f8fafc',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
  },
  decStepNumHighlight: {
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
  },
  decStepName: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  decStepNameHighlight: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#c4b5fd',
  },
  decStepDesc: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    lineHeight: '1.45',
    margin: 0,
  },
  decArrowWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 0.25rem',
  },
  guaranteeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  guaranteeCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid #334155',
  },
  guaranteeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    marginBottom: '0.75rem',
  },
  guaranteeTitle: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  guaranteeDesc: {
    margin: 0,
    fontSize: '0.785rem',
    color: '#94a3b8',
    lineHeight: '1.5',
  },
  footer: {
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid #1e293b',
    backgroundColor: '#0b1120',
  },
  footerNote: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  closeModalBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '0.45rem 1rem',
    borderRadius: '8px',
    fontSize: '0.825rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
