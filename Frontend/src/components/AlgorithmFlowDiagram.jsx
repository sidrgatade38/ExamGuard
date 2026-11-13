import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
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
  Database,
  Clock,
  Send,
  Award,
  Hash,
  RefreshCw,
  Cpu,
} from 'lucide-react';

/**
 * ExamGuard Cryptographic Algorithm Flow Diagram
 * Complete visual security architecture redesign.
 * 
 * Accurately visualizes:
 * - Phase 1: Ingestion & Symmetric AES-256-GCM Encryption
 * - Phase 2: RSA-OAEP 2048-bit Key Wrapping (DEK Envelope)
 * - Phase 3: SHA-256 Digest & RSA-PSS Digital Signatures (Non-repudiation)
 * - Phase 4: Zero-Knowledge Private Storage (.enc Isolation)
 * - Phase 5: RBAC Role Verification & Time-Lock Scheduled Gating
 * - Phase 6: Verify-Before-Decrypt Invariant & Plaintext Stream Release
 */
export default function AlgorithmFlowDiagram({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('architecture'); // 'architecture' | 'sequence' | 'invariants'
  const [selectedStage, setSelectedStage] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const stages = [
    {
      id: 1,
      phase: 'Teacher Side: Ingestion',
      phaseColor: '#2563eb',
      phaseBg: '#eff6ff',
      phaseBorder: '#bfdbfe',
      title: 'Question Paper Preparation',
      shortTitle: '1. Ingestion',
      icon: FileText,
      tech: 'In-Memory PDF Buffer',
      cipherTerm: 'Plaintext Buffer (%PDF-1.x)',
      summary: 'Curriculum blueprint generation or multipart PDF upload validated in RAM with magic bytes. No plaintext touches server disk.',
      detail: 'The authoring faculty finalizes the question paper in the 5-step generator. The Node.js runtime creates an in-memory stream buffer. Content is strictly kept in volatile process memory.',
    },
    {
      id: 2,
      phase: 'Teacher Side: Key Generation',
      phaseColor: '#2563eb',
      phaseBg: '#eff6ff',
      phaseBorder: '#bfdbfe',
      title: 'Per-Paper DEK Generation',
      shortTitle: '2. DEK Gen',
      icon: Key,
      tech: 'CSPRNG (Crypto API)',
      cipherTerm: '256-bit Symmetric DEK + 96-bit IV',
      summary: 'Generates a unique, cryptographically random 256-bit Data Encryption Key (DEK) and 96-bit initialization vector.',
      detail: 'Every single question paper receives its own unique 256-bit key. Keys are never reused across sets or subjects.',
    },
    {
      id: 3,
      phase: 'Teacher Side: Symmetric Encryption',
      phaseColor: '#2563eb',
      phaseBg: '#eff6ff',
      phaseBorder: '#bfdbfe',
      title: 'AES-256-GCM Encryption',
      shortTitle: '3. AES-GCM',
      icon: Lock,
      tech: 'Authenticated AES-256-GCM',
      cipherTerm: 'Ciphertext + 128-bit GCM Auth Tag',
      summary: 'Encrypts the plaintext PDF using AES-256 in Galois/Counter Mode, outputting authenticated ciphertext and a 16-byte authentication tag.',
      detail: 'AES-GCM provides both confidentiality and built-in authenticity. Any tampering with a single bit of the ciphertext will cause the GCM tag verification to fail closed.',
    },
    {
      id: 4,
      phase: 'Teacher Side: Envelope Encryption',
      phaseColor: '#0284c7',
      phaseBg: '#f0f9ff',
      phaseBorder: '#bae6fd',
      title: 'RSA-OAEP Key Wrapping',
      shortTitle: '4. Key Wrap',
      icon: ShieldCheck,
      tech: '2048-bit RSA-OAEP (SHA-256)',
      cipherTerm: 'Wrapped AES Key (Envelope Scheme)',
      summary: 'Wraps the symmetric DEK using the Examination Cell 2048-bit RSA public key. The plaintext DEK is immediately zeroized from memory.',
      detail: 'Envelope encryption isolates key management from data storage. Only the entity possessing the private RSA master key can unwrap the symmetric key.',
    },
    {
      id: 5,
      phase: 'Teacher Side: Integrity Digest',
      phaseColor: '#0891b2',
      phaseBg: '#ecfeff',
      phaseBorder: '#a5f3fc',
      title: 'SHA-256 Integrity Digest',
      shortTitle: '5. SHA-256',
      icon: Hash,
      tech: 'Cryptographic Hash Function',
      cipherTerm: 'Deterministic SHA-256 Digest',
      summary: 'Computes a deterministic SHA-256 hash across the encrypted ciphertext buffer prior to persistence.',
      detail: 'This hash serves as the invariant anchor for digital signing and the Verify-Before-Decrypt pipeline.',
    },
    {
      id: 6,
      phase: 'Teacher Side: Digital Signature',
      phaseColor: '#0891b2',
      phaseBg: '#ecfeff',
      phaseBorder: '#a5f3fc',
      title: 'RSA-PSS Digital Signature',
      shortTitle: '6. RSA-PSS',
      icon: Award,
      tech: 'RSA-PSS Signature Scheme',
      cipherTerm: 'Salted RSA Signature (32-byte salt)',
      summary: 'Signs the SHA-256 ciphertext digest using the faculty author private key to guarantee document origin and non-repudiation.',
      detail: 'RSA-PSS (Probabilistic Signature Scheme) is mathematically immune to classic RSA signature forging attacks.',
    },
    {
      id: 7,
      phase: 'Storage Architecture: Zero Knowledge',
      phaseColor: '#475569',
      phaseBg: '#f8fafc',
      phaseBorder: '#cbd5e1',
      title: 'Secure Private Storage Isolation',
      shortTitle: '7. Storage',
      icon: Database,
      tech: 'Supabase Storage (.enc) & PostgreSQL',
      cipherTerm: 'Ciphertext Object (.enc) + Paper Keys',
      summary: 'Encrypted ciphertext is stored with a .enc extension in a private storage bucket. Cryptographic metadata resides in relational database tables.',
      detail: 'Zero plaintext stored on disk. Ciphertext storage is isolated by teacher ID and paper ID paths with directory traversal defenses.',
    },
    {
      id: 8,
      phase: 'Coordinator Side: Access Control',
      phaseColor: '#059669',
      phaseBg: '#ecfdf5',
      phaseBorder: '#a7f3d0',
      title: 'RBAC & Scheduled Delivery Gating',
      shortTitle: '8. Access Gate',
      icon: UserCheck,
      tech: 'Role Authorization & Time-Lock Gate',
      cipherTerm: 'EXAM_COORDINATOR Claim + Exam Window',
      summary: 'Validates active JWT coordinator claims, assignment mapping, and server-enforced examination time window (1 hour prior to exam).',
      detail: 'Strict role-based access control. Early decryption requests before the authorized examination window are rejected with a 403 Forbidden time-lock barrier.',
    },
    {
      id: 9,
      phase: 'Coordinator Side: Verify-Before-Decrypt',
      phaseColor: '#059669',
      phaseBg: '#ecfdf5',
      phaseBorder: '#a7f3d0',
      title: 'Verify-Before-Decrypt Invariant',
      shortTitle: '9. Verify',
      icon: ShieldAlert,
      tech: 'Public Key Verification (RSA-PSS)',
      cipherTerm: 'Ciphertext SHA-256 Match Verification',
      summary: 'Downloads ciphertext and validates the author RSA-PSS signature against the live hash BEFORE touching any decryption keys.',
      detail: 'Core security invariant: If signature verification or digest comparison fails, key unwrapping is completely aborted and decryption fails closed.',
    },
    {
      id: 10,
      phase: 'Coordinator Side: Plaintext Recovery',
      phaseColor: '#7c3aed',
      phaseBg: '#f5f3ff',
      phaseBorder: '#ddd6fe',
      title: 'DEK Recovery & AES Decryption',
      shortTitle: '10. Decrypt',
      icon: Unlock,
      tech: 'RSA-OAEP Unwrap + AES-256-GCM',
      cipherTerm: 'Plaintext Buffer + Key Zeroization',
      summary: 'Unwraps the DEK using the private RSA key, checks the 16-byte GCM tag, and decrypts ciphertext into an in-memory stream.',
      detail: 'Symmetric DEK is wiped from RAM immediately upon stream completion, preventing memory inspection leaks.',
    },
    {
      id: 11,
      phase: 'Coordinator Side: Secure Delivery',
      phaseColor: '#7c3aed',
      phaseBg: '#f5f3ff',
      phaseBorder: '#ddd6fe',
      title: 'Secure Document Delivery & Audit',
      shortTitle: '11. Delivery',
      icon: Send,
      tech: 'Direct Browser Stream & Audit Log',
      cipherTerm: 'Authenticated PDF Delivery Record',
      summary: 'Streams the decrypted PDF directly to the coordinator verified browser session and logs an immutable audit event.',
      detail: 'Paper delivery is logged with coordinator ID, timestamp, and client IP. Download is recorded as DELIVERED.',
    },
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="flow-dialog-title"
      >
        {/* Modal Header */}
        <div style={styles.dialogHeader}>
          <div style={styles.headerLeft}>
            <div style={styles.headerIconBadge}>
              <Layers size={22} color="#2563eb" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 id="flow-dialog-title" style={styles.dialogTitle}>
                  ExamGuard Cryptographic Architecture Flow
                </h2>
                <span style={styles.securityBadge}>AES-256-GCM + RSA-PSS</span>
              </div>
              <p style={styles.dialogSubtitle}>
                Formal cryptographic execution pipeline: Ingestion &rarr; Envelope Encryption &rarr; Digital Signing &rarr; Verify-Before-Decrypt &rarr; Plaintext Delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            title="Close Diagram (Esc)"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div style={styles.tabBar}>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'architecture' ? styles.tabBtnActive : {}),
            }}
          >
            <Layers size={15} />
            <span>Security Architecture Pipeline (Grouped by Phase)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sequence')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'sequence' ? styles.tabBtnActive : {}),
            }}
          >
            <ShieldCheck size={15} />
            <span>11-Stage End-to-End Execution Sequence</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invariants')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'invariants' ? styles.tabBtnActive : {}),
            }}
          >
            <Lock size={15} />
            <span>Formal Security Guarantees &amp; Invariants</span>
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div style={styles.dialogBody}>
          {/* TAB 1: ARCHITECTURE PIPELINE */}
          {activeTab === 'architecture' && (
            <div style={styles.tabContent}>
              {/* Architecture Legend Banner */}
              <div style={styles.legendBanner}>
                <div style={styles.legendTitle}>TWO-SIDED INSTITUTIONAL SECURITY MODEL</div>
                <div style={styles.legendRow}>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#2563eb' }}></span>
                    <strong>Teacher Workspace</strong>: Ingestion, AES-256-GCM Encryption, RSA-OAEP Key Wrap &amp; RSA-PSS Signing
                  </div>
                  <div style={styles.legendDivider}>&rarr;</div>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#475569' }}></span>
                    <strong>Storage Layer</strong>: Isolated Ciphertext (.enc) &amp; Relational Key Isolation
                  </div>
                  <div style={styles.legendDivider}>&rarr;</div>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#059669' }}></span>
                    <strong>Exam Cell Workspace</strong>: RBAC Time-Lock Gate &amp; Verify-Before-Decrypt Pipeline
                  </div>
                </div>
              </div>

              {/* SECTION A: ENCRYPTION & SIGNING PIPELINE (Teacher Side) */}
              <div style={styles.phaseContainer}>
                <div style={styles.phaseHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...styles.phaseBadge, backgroundColor: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                      PATH A: INGESTION, ENCRYPTION &amp; DIGITAL SIGNING
                    </span>
                    <span style={styles.phaseSubtext}>Faculty Workspace • In-Memory Execution</span>
                  </div>
                </div>

                <div style={styles.cardsGrid}>
                  {stages.slice(0, 6).map((stg) => {
                    const Icon = stg.icon;
                    return (
                      <div
                        key={stg.id}
                        style={{
                          ...styles.stageCard,
                          borderColor: stg.phaseBorder,
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div style={styles.cardTopRow}>
                          <span style={{ ...styles.stageNumberBadge, backgroundColor: stg.phaseBg, color: stg.phaseColor, borderColor: stg.phaseBorder }}>
                            STAGE {stg.id}
                          </span>
                          <div style={{ ...styles.stageIconSquircle, backgroundColor: stg.phaseBg }}>
                            <Icon size={16} color={stg.phaseColor} />
                          </div>
                        </div>

                        <h4 style={styles.stageTitle}>{stg.title}</h4>
                        <div style={styles.cipherTermPill}>{stg.cipherTerm}</div>
                        <p style={styles.stageSummary}>{stg.summary}</p>

                        <div style={styles.stageFooter}>
                          <span style={styles.techTag}>{stg.tech}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CONNECTOR BRIDGE: STORAGE TRANSITION */}
              <div style={styles.bridgeContainer}>
                <div style={styles.bridgeLine}></div>
                <div style={styles.bridgeBadge}>
                  <Database size={15} color="#475569" />
                  <span>STAGE 7: ZERO-KNOWLEDGE CIPHERTEXT STORAGE ISOLATION (.enc)</span>
                </div>
                <div style={styles.bridgeLine}></div>
              </div>

              {/* SECTION B: VERIFY-BEFORE-DECRYPT PIPELINE (Exam Coordinator Side) */}
              <div style={styles.phaseContainer}>
                <div style={styles.phaseHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...styles.phaseBadge, backgroundColor: '#d1fae5', color: '#047857', borderColor: '#a7f3d0' }}>
                      PATH B: VERIFY-BEFORE-DECRYPT &amp; PLAINTEXT RELEASE
                    </span>
                    <span style={styles.phaseSubtext}>Exam Cell Workspace • Strict Integrity Barrier</span>
                  </div>
                </div>

                <div style={styles.cardsGrid}>
                  {stages.slice(7, 11).map((stg) => {
                    const Icon = stg.icon;
                    return (
                      <div
                        key={stg.id}
                        style={{
                          ...styles.stageCard,
                          borderColor: stg.phaseBorder,
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div style={styles.cardTopRow}>
                          <span style={{ ...styles.stageNumberBadge, backgroundColor: stg.phaseBg, color: stg.phaseColor, borderColor: stg.phaseBorder }}>
                            STAGE {stg.id}
                          </span>
                          <div style={{ ...styles.stageIconSquircle, backgroundColor: stg.phaseBg }}>
                            <Icon size={16} color={stg.phaseColor} />
                          </div>
                        </div>

                        <h4 style={styles.stageTitle}>{stg.title}</h4>
                        <div style={styles.cipherTermPill}>{stg.cipherTerm}</div>
                        <p style={styles.stageSummary}>{stg.summary}</p>

                        <div style={styles.stageFooter}>
                          <span style={styles.techTag}>{stg.tech}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 11-STAGE SEQUENTIAL FLOW */}
          {activeTab === 'sequence' && (
            <div style={styles.tabContent}>
              <div style={styles.sequenceContainer}>
                {stages.map((stg, index) => {
                  const Icon = stg.icon;
                  const isLast = index === stages.length - 1;

                  return (
                    <React.Fragment key={stg.id}>
                      <div style={styles.sequenceItem}>
                        <div style={styles.sequenceLeft}>
                          <div
                            style={{
                              ...styles.seqNumberCircle,
                              backgroundColor: stg.phaseBg,
                              color: stg.phaseColor,
                              borderColor: stg.phaseBorder,
                            }}
                          >
                            {stg.id}
                          </div>
                          {!isLast && <div style={styles.seqConnectingLine}></div>}
                        </div>

                        <div style={styles.sequenceCard}>
                          <div style={styles.seqCardHeader}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ ...styles.phaseBadgeSmall, color: stg.phaseColor, backgroundColor: stg.phaseBg }}>
                                  {stg.phase}
                                </span>
                                <span style={styles.cipherTermPillSmall}>{stg.cipherTerm}</span>
                              </div>
                              <h4 style={styles.seqCardTitle}>{stg.title}</h4>
                            </div>
                            <div style={{ ...styles.stageIconSquircle, backgroundColor: stg.phaseBg }}>
                              <Icon size={18} color={stg.phaseColor} />
                            </div>
                          </div>

                          <p style={styles.seqCardDesc}>{stg.detail}</p>

                          <div style={styles.seqCardMeta}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Cpu size={13} color="#64748b" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                Standard: {stg.tech}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FORMAL INVARIANTS & GUARANTEES */}
          {activeTab === 'invariants' && (
            <div style={styles.tabContent}>
              <div style={styles.invariantsGrid}>
                {/* Invariant 1 */}
                <div style={styles.invariantCard}>
                  <div style={styles.invIconWrapBlue}>
                    <ShieldAlert size={24} color="#2563eb" />
                  </div>
                  <h3 style={styles.invTitle}>Verify-Before-Decrypt Invariant</h3>
                  <div style={styles.invRule}>
                    RULE: Decryption key is never unwrapped unless SHA-256 digest matches author RSA-PSS signature.
                  </div>
                  <p style={styles.invDesc}>
                    The ExamGuard server strictly calculates the SHA-256 hash of the retrieved ciphertext buffer and verifies the teacher&apos;s digital signature against the public key certificate. If a single bit has been altered in transit or storage, decryption aborts immediately without attempting key recovery.
                  </p>
                  <div style={styles.invProof}>
                    &bull; Mathematical guarantee: RSA-PSS non-repudiation protects against tampering and insider manipulation.
                  </div>
                </div>

                {/* Invariant 2 */}
                <div style={styles.invariantCard}>
                  <div style={styles.invIconWrapGreen}>
                    <Key size={24} color="#059669" />
                  </div>
                  <h3 style={styles.invTitle}>Envelope Encryption Scheme</h3>
                  <div style={styles.invRule}>
                    RULE: 256-bit symmetric DEK is wrapped using 2048-bit RSA-OAEP public key.
                  </div>
                  <p style={styles.invDesc}>
                    Direct storage of symmetric keys is forbidden. Each question paper is encrypted with a unique single-use AES key. The symmetric key is encrypted using the Examination Cell&apos;s asymmetric public key and stored separately from the encrypted ciphertext.
                  </p>
                  <div style={styles.invProof}>
                    &bull; Mathematical guarantee: Hybrid cryptography combines AES speed with RSA public-key distribution security.
                  </div>
                </div>

                {/* Invariant 3 */}
                <div style={styles.invariantCard}>
                  <div style={styles.invIconWrapPurple}>
                    <Clock size={24} color="#7c3aed" />
                  </div>
                  <h3 style={styles.invTitle}>Time-Gated Scheduled Release</h3>
                  <div style={styles.invRule}>
                    RULE: Early access requests prior to scheduled exam date are rejected (403 Forbidden).
                  </div>
                  <p style={styles.invDesc}>
                    Regardless of coordinator credentials, the server checks the scheduled examination date and start time. Decryption is locked until the server-controlled 1-hour pre-examination release window, preventing early paper leaks.
                  </p>
                  <div style={styles.invProof}>
                    &bull; Security invariant: Gating operates at the API route, service layer, and storage retrieval boundary.
                  </div>
                </div>

                {/* Invariant 4 */}
                <div style={styles.invariantCard}>
                  <div style={styles.invIconWrapSlate}>
                    <Database size={24} color="#475569" />
                  </div>
                  <h3 style={styles.invTitle}>Zero Secret Leakage &amp; Memory Hygiene</h3>
                  <div style={styles.invRule}>
                    RULE: Plaintext keys, IVs, and deciphered streams are zeroized after stream delivery.
                  </div>
                  <p style={styles.invDesc}>
                    Neither the React frontend, browser storage, nor API JSON payloads ever contain plaintext AES keys, IVs, or authentication tags. Decryption operates via ephemeral in-memory Node.js Buffers which are immediately garbage collected and zeroized.
                  </p>
                  <div style={styles.invProof}>
                    &bull; Defense guarantee: Complete defense against heap dumps, browser cache inspection, and unauthorized downloads.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={styles.dialogFooter}>
          <div style={styles.footerInfo}>
            <ShieldCheck size={16} color="#059669" />
            <span>Strict institutional compliance with Computer Engineering Department cryptographic protocols.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.footerCloseBtn}
          >
            Close Diagram
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    overflowY: 'auto',
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '1060px',
    maxHeight: 'min(92vh, 880px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
    border: '1px solid #e2e8f0',
    margin: 'auto',
    animation: 'modalEnter 0.2s ease-out',
  },
  dialogHeader: {
    padding: '16px 22px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIconBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dialogTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  securityBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    border: '1px solid #bfdbfe',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
  dialogSubtitle: {
    margin: '3px 0 0 0',
    fontSize: '0.78rem',
    color: '#64748b',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },

  // Tab Switcher
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 22px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#475569',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#1d4ed8',
    fontWeight: 600,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },

  // Dialog Body
  dialogBody: {
    padding: '20px 22px',
    overflowY: 'auto',
    flex: '1 1 auto',
    WebkitOverflowScrolling: 'touch',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  // Legend Banner
  legendBanner: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  legendTitle: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    fontSize: '0.78rem',
    color: '#334155',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  legendDivider: {
    color: '#cbd5e1',
    fontWeight: 700,
  },

  // Phases & Grids
  phaseContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  phaseHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '9999px',
    border: '1px solid',
    letterSpacing: '0.04em',
  },
  phaseSubtext: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  },
  stageCard: {
    border: '1px solid',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  cardTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageNumberBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid',
    letterSpacing: '0.05em',
  },
  stageIconSquircle: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTitle: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  cipherTermPill: {
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    display: 'inline-block',
  },
  stageSummary: {
    margin: 0,
    fontSize: '0.78rem',
    color: '#475569',
    lineHeight: 1.45,
    flex: 1,
  },
  stageFooter: {
    marginTop: '6px',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  techTag: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#64748b',
  },

  // Bridge
  bridgeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '4px 0',
  },
  bridgeLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#cbd5e1',
  },
  bridgeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '9999px',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#334155',
    letterSpacing: '0.03em',
  },

  // Sequence Flow
  sequenceContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sequenceItem: {
    display: 'flex',
    gap: '16px',
  },
  sequenceLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '36px',
  },
  seqNumberCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  seqConnectingLine: {
    flex: 1,
    width: '2px',
    backgroundColor: '#e2e8f0',
    margin: '4px 0',
  },
  sequenceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px 18px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  seqCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  phaseBadgeSmall: {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
  cipherTermPillSmall: {
    fontSize: '0.7rem',
    fontFamily: 'monospace',
    color: '#64748b',
  },
  seqCardTitle: {
    margin: '4px 0 0 0',
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  seqCardDesc: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#475569',
    lineHeight: 1.5,
  },
  seqCardMeta: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },

  // Invariants Grid
  invariantsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '16px',
  },
  invariantCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  invIconWrapBlue: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invIconWrapGreen: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invIconWrapPurple: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#f5f3ff',
    border: '1px solid #ddd6fe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invIconWrapSlate: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
  },
  invRule: {
    fontSize: '0.75rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#1e293b',
    backgroundColor: '#f1f5f9',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  invDesc: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#475569',
    lineHeight: 1.5,
  },
  invProof: {
    fontSize: '0.74rem',
    fontWeight: 600,
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #a7f3d0',
  },

  // Footer
  dialogFooter: {
    padding: '14px 22px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexShrink: 0,
  },
  footerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.75rem',
    color: '#334155',
    fontWeight: 500,
  },
  footerCloseBtn: {
    padding: '8px 18px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
