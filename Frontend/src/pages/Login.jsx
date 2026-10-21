import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const { user, login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // If already authenticated and not loading, redirect to role-appropriate home
  if (isAuthenticated && !authLoading && !isSubmitting && !successMessage) {
    const role = user?.role?.toUpperCase();
    if (role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (role === 'EXAM_COORDINATOR') return <Navigate to="/exam-coordinator" replace />;
    return <Navigate to="/teacher" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const authData = await login(email.trim(), password);
      setSuccessMessage('Authentication successful! Redirecting...');
      setTimeout(() => {
        const role = (authData?.user?.role || user?.role)?.toUpperCase();
        if (role === 'ADMIN') {
          navigate('/admin', { replace: true });
        } else if (role === 'EXAM_COORDINATOR') {
          navigate('/exam-coordinator', { replace: true });
        } else {
          navigate('/teacher', { replace: true });
        }
      }, 400);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Unable to complete login. Please check credentials or server connection.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>
            <ShieldCheck size={32} color="#2563eb" />
          </div>
          <h1 style={styles.title}>ExamGuard</h1>
          <p style={styles.subtitle}>Secure Question Paper Management System</p>
          <div style={styles.badge}>Secure Examination Management System</div>
        </div>

        {errorMessage && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} style={styles.alertIcon} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div style={styles.successAlert}>
            <ShieldCheck size={18} style={styles.alertIcon} />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="email">
              Email Address
            </label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.fieldIcon} />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="faculty@examguard.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="password">
              Password
            </label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.fieldIcon} />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                style={styles.input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={isSubmitting ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
          >
            {isSubmitting ? (
              <span style={styles.buttonContent}>
                <Loader2 size={18} style={styles.spinner} />
                Authenticating...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Protected by bcrypt password hashing &amp; signed JWT access tokens.
          </p>
        </div>
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
    maxWidth: '420px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '2.25rem 2rem',
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
    fontSize: '1.75rem',
    fontWeight: '700',
    letterSpacing: '-0.025em',
    color: 'var(--color-structure)',
    margin: '0 0 0.25rem 0',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    margin: '0 0 0.75rem 0',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    padding: '0.25rem 0.75rem',
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent-hover)',
    border: '1px solid var(--color-accent-border)',
    borderRadius: 'var(--radius-full)',
    fontWeight: '600',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    marginBottom: '1.25rem',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-danger-text)',
    fontSize: '0.875rem',
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    marginBottom: '1.25rem',
    backgroundColor: 'var(--color-success-subtle)',
    border: '1px solid var(--color-success-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-success-text)',
    fontSize: '0.875rem',
  },
  alertIcon: {
    marginRight: '0.5rem',
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--color-text-secondary)',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute',
    left: '0.875rem',
    color: 'var(--color-text-muted)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '0.75rem 0.875rem 0.75rem 2.5rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.925rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color var(--transition-fast)',
    minHeight: '44px',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'var(--color-primary-active)',
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  footer: {
    marginTop: '1.75rem',
    textAlign: 'center',
    borderTop: '1px solid var(--color-border)',
    paddingTop: '1rem',
  },
  footerText: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    margin: 0,
    fontFamily: 'var(--font-jetbrains)',
  },
};
