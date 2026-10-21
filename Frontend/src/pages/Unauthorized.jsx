import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBackToDashboard = () => {
    // Navigate to root route, which automatically redirects to role-appropriate home
    navigate('/', { replace: true });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <ShieldAlert size={44} color="#ef4444" />
        </div>
        <h1 style={styles.title}>Access Denied</h1>
        <p style={styles.message}>
          You do not have permission to access this page.
        </p>

        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Signed in as:</span>
            <span style={styles.infoValue}>{user?.email || 'Authenticated User'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Current Role:</span>
            <span style={styles.roleBadge}>{user?.role || 'UNKNOWN'}</span>
          </div>
        </div>

        <button onClick={handleBackToDashboard} style={styles.button}>
          <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} />
          Back to Dashboard
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
    maxWidth: '440px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '2.5rem 2rem',
    boxShadow: 'var(--shadow-xl)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    textAlign: 'center',
  },
  iconWrapper: {
    display: 'inline-flex',
    padding: '1rem',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-danger-subtle)',
    color: 'var(--color-danger)',
    marginBottom: '1.25rem',
    border: '1px solid var(--color-danger-border)',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--color-structure)',
    margin: '0 0 0.5rem 0',
  },
  message: {
    fontSize: '0.95rem',
    color: 'var(--color-text-secondary)',
    margin: '0 0 1.5rem 0',
    lineHeight: '1.5',
  },
  infoBox: {
    backgroundColor: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    marginBottom: '1.75rem',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
  },
  infoLabel: {
    color: 'var(--color-text-muted)',
  },
  infoValue: {
    color: 'var(--color-text-primary)',
    fontWeight: '500',
    fontFamily: 'var(--font-jetbrains)',
  },
  roleBadge: {
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent-hover)',
    padding: '0.2rem 0.55rem',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '600',
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    border: '1px solid var(--color-accent-border)',
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)',
    minHeight: '44px',
  },
};
