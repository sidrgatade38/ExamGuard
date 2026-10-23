import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  HardDrive,
  X,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export default function DeletePaperModal({ isOpen, paper, onClose, onConfirm, isDeleting, error }) {
  const [reason, setReason] = useState('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);

  if (!isOpen || !paper) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!confirmedCheckbox) return;
    onConfirm(paper.id, reason.trim());
  };

  const fileSizeKb = paper.file_size ? (paper.file_size / 1024).toFixed(1) : 'N/A';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <div style={styles.iconBadge}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <div>
              <h2 style={styles.title}>Delete Question Paper</h2>
              <p style={styles.subtitle}>Authoritative document deletion and retention archival</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isDeleting} style={styles.closeBtn} title="Cancel and Close">
            <X size={20} />
          </button>
        </div>

        {/* Warning Banner */}
        <div style={styles.warningAlert}>
          <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={styles.warningTitle}>Permanent Storage Erasure Notice</div>
            <div style={styles.warningText}>
              This operation will permanently delete the encrypted ciphertext file from private cloud storage
              and archive the database record. <strong>This action is irreversible.</strong> Audit trail logs
              will be permanently retained for university compliance.
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={styles.errorAlert}>
            <ShieldAlert size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Paper Identifying Details */}
        <div style={styles.detailsBox}>
          <div style={styles.detailsHeader}>Question Paper Details</div>

          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Title:</span>
            <span style={styles.detailValueBold}>{paper.title}</span>
          </div>

          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Subject:</span>
              <span style={styles.detailValue}>{paper.subject}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Semester:</span>
              <span style={styles.detailValue}>{paper.semester}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Academic Year:</span>
              <span style={styles.detailValue}>{paper.academic_year || paper.academicYear || 'N/A'}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Exam Date:</span>
              <span style={styles.detailValue}>{paper.exam_date || paper.examDate}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Current Status:</span>
              <span style={styles.statusBadge}>{paper.status}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>File Size:</span>
              <span style={styles.detailValue}>{fileSizeKb} KB</span>
            </div>
          </div>
        </div>

        {/* Form Confirmation & Reason */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="deletionReason">
              Reason for Deletion (Optional - Stored in Compliance Audit Log)
            </label>
            <input
              id="deletionReason"
              type="text"
              placeholder="e.g. Uploaded revised syllabus version, drafted duplicate"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isDeleting}
              style={styles.input}
            />
          </div>

          <div style={styles.checkboxWrapper}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={confirmedCheckbox}
                onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                disabled={isDeleting}
                style={styles.checkbox}
                required
              />
              <span style={styles.checkboxText}>
                I understand this will permanently delete the encrypted file from storage and archive the paper.
              </span>
            </label>
          </div>

          <div style={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!confirmedCheckbox || isDeleting}
              style={{
                ...styles.deleteBtn,
                ...(!confirmedCheckbox || isDeleting ? styles.deleteBtnDisabled : {}),
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Deleting Paper &amp; Storage...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Confirm Delete Paper</span>
                </>
              )}
            </button>
          </div>
        </form>
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
    zIndex: 1050,
    padding: '1rem',
    backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #1e293b',
    width: '100%',
    maxWidth: '560px',
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    margin: '0.2rem 0 0 0',
    fontSize: '0.78rem',
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
  warningAlert: {
    margin: '1.25rem 1.5rem 0.75rem 1.5rem',
    padding: '0.875rem 1rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  warningTitle: {
    fontSize: '0.825rem',
    fontWeight: '700',
    color: '#fbbf24',
    marginBottom: '0.25rem',
  },
  warningText: {
    fontSize: '0.775rem',
    color: '#fef3c7',
    lineHeight: '1.45',
  },
  errorAlert: {
    margin: '0.5rem 1.5rem 0.5rem 1.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#fca5a5',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  detailsBox: {
    margin: '0.75rem 1.5rem',
    padding: '1rem',
    borderRadius: '10px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
  },
  detailsHeader: {
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#94a3b8',
    marginBottom: '0.65rem',
  },
  detailRow: {
    marginBottom: '0.65rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #334155',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem 1rem',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  detailLabel: {
    fontSize: '0.7rem',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '0.8rem',
    color: '#cbd5e1',
  },
  detailValueBold: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#f8fafc',
  },
  statusBadge: {
    fontSize: '0.725rem',
    fontWeight: '600',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: '#334155',
    color: '#93c5fd',
    display: 'inline-block',
    width: 'fit-content',
  },
  form: {
    padding: '0 1.5rem 1.25rem 1.5rem',
  },
  formGroup: {
    marginBottom: '0.875rem',
  },
  label: {
    display: 'block',
    fontSize: '0.775rem',
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: '0.35rem',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0b1120',
    color: '#f8fafc',
    fontSize: '0.825rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  checkboxWrapper: {
    marginBottom: '1.25rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: '0.2rem',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '0.775rem',
    color: '#cbd5e1',
    lineHeight: '1.4',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  cancelBtn: {
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    fontSize: '0.825rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.825rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background-color 0.15s ease',
  },
  deleteBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#7f1d1d',
  },
};
