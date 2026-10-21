import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User, Award, CheckCircle, LogOut } from 'lucide-react';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>
            <ShieldCheck size={36} color="#2563eb" />
          </div>
          <h1 style={styles.title}>ExamGuard</h1>
          <p style={styles.subtitle}>Authentication Status Verification (Module 3)</p>
        </div>

        <div style={styles.statusBox}>
          <div style={styles.statusHeader}>
            <CheckCircle size={22} color="#22c55e" />
            <span style={styles.statusTitle}>Authenticated ✓</span>
          </div>
          <p style={styles.statusDesc}>
            Your session is verified with a signed JWT access token.
          </p>
        </div>

        <div style={styles.infoSection}>
          <div style={styles.infoItem}>
            <div style={styles.itemHeader}>
              <User size={16} style={styles.itemIcon} />
              <span style={styles.itemLabel}>User</span>
            </div>
            <div style={styles.itemValue}>{user?.name || 'Faculty Member'}</div>
            <div style={styles.itemSubValue}>{user?.email || 'N/A'}</div>
          </div>

          <div style={styles.infoItem}>
            <div style={styles.itemHeader}>
              <Award size={16} style={styles.itemIcon} />
              <span style={styles.itemLabel}>Role ID</span>
            </div>
            <div style={styles.itemValueMono}>{user?.roleId || 'N/A'}</div>
          </div>

          <div style={styles.infoItem}>
            <div style={styles.itemHeader}>
              <CheckCircle size={16} style={styles.itemIcon} />
              <span style={styles.itemLabel}>Authentication</span>
            </div>
            <div style={styles.itemValueGreen}>Authenticated ✓</div>
          </div>
        </div>

        <div style={styles.noticeBox}>
          <p style={styles.noticeText}>
            <strong>Note:</strong> This is a temporary authentication verification page for Module 3. Role-based dashboards (Admin, Teacher, Exam Coordinator) will be implemented in Module 4 (RBAC).
          </p>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          <LogOut size={18} style={{ marginRight: '0.5rem' }} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-background)',
    padding: '1.25rem',
    fontFamily: 'var(--font-inter)',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '2.5rem 2rem',
    boxShadow: 'var(--shadow-xl)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.75rem',
  },
  logoIcon: {
    display: 'inline-flex',
    padding: '0.75rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    marginBottom: '0.75rem',
    border: '1px solid var(--color-primary-border)',
  },
  title: {
    fontSize: '1.85rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: '0 0 0.25rem 0',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    margin: 0,
  },
  statusBox: {
    backgroundColor: 'var(--color-success-subtle)',
    border: '1px solid var(--color-success-border)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: '600',
    color: 'var(--color-success-text)',
    fontSize: '1.05rem',
  },
  statusTitle: {
    color: 'var(--color-success-text)',
  },
  statusDesc: {
    margin: '0.35rem 0 0 0',
    fontSize: '0.8rem',
    color: 'var(--color-success-text)',
  },
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  infoItem: {
    backgroundColor: 'var(--color-surface-alt)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem 1rem',
    border: '1px solid var(--color-border)',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.25rem',
  },
  itemIcon: {
    color: 'var(--color-text-muted)',
  },
  itemLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
  },
  itemValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
  },
  itemSubValue: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.15rem',
    fontFamily: 'var(--font-jetbrains)',
  },
  itemValueMono: {
    fontSize: '0.85rem',
    fontFamily: 'var(--font-jetbrains)',
    color: 'var(--color-primary)',
    wordBreak: 'break-all',
  },
  itemValueGreen: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--color-success)',
  },
  noticeBox: {
    backgroundColor: 'var(--color-accent-subtle)',
    border: '1px solid var(--color-accent-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem',
    marginBottom: '1.5rem',
  },
  noticeText: {
    fontSize: '0.785rem',
    color: 'var(--color-accent-hover)',
    margin: 0,
    lineHeight: '1.4',
  },
  logoutButton: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'var(--color-structure)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.925rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)',
    minHeight: '44px',
  },
};
