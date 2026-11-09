import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { ShieldCheck, Mail, Lock, User, Phone, Building, AlertCircle, CheckCircle2, Loader2, UserPlus, LogIn } from 'lucide-react';

export default function Login() {
  const { user, login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Teacher Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

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

  const handleLoginSubmit = async (e) => {
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

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMessage('Please fill in your name, institutional email, and password.');
      return;
    }

    if (regPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password.');
      return;
    }

    if (regPhone.trim()) {
      const phoneRegex = /^\+?[0-9\s-]{10,15}$/;
      if (!phoneRegex.test(regPhone.trim())) {
        setErrorMessage('Please enter a valid 10-15 digit phone number (e.g. +91 9876543210 or 9876543210).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await authService.register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        password: regPassword,
        role: 'TEACHER',
        department: 'COMP',
      });

      setSuccessMessage('Teacher account created successfully! Signing in to your faculty workspace...');

      // Auto login immediately
      const authData = await login(regEmail.trim().toLowerCase(), regPassword);
      setTimeout(() => {
        navigate('/teacher', { replace: true });
      }, 500);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please check your information or contact administrator.';
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
          <div style={styles.badge}>
            <Building size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Department of Computer Engineering
          </div>
        </div>

        {/* Tab Toggle: Sign In vs Teacher Registration */}
        <div style={styles.tabContainer}>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={mode === 'login' ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
          >
            <LogIn size={15} style={{ marginRight: '6px' }} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={mode === 'register' ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
          >
            <UserPlus size={15} style={{ marginRight: '6px' }} />
            Teacher Registration
          </button>
        </div>

        {errorMessage && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} style={styles.alertIcon} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div style={styles.successAlert}>
            <CheckCircle2 size={18} style={styles.alertIcon} />
            <span>{successMessage}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} style={styles.form}>
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
        ) : (
          <form onSubmit={handleRegisterSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="regName">
                Full Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <User size={18} style={styles.fieldIcon} />
                <input
                  id="regName"
                  type="text"
                  placeholder="e.g. Prof. Rajesh Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  disabled={isSubmitting}
                  required
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="regEmail">
                Institutional Email Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <Mail size={18} style={styles.fieldIcon} />
                <input
                  id="regEmail"
                  type="email"
                  placeholder="faculty@college.edu"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="regPhone">
                Mobile Number (for Exam Cell Notifications)
              </label>
              <div style={styles.inputWrapper}>
                <Phone size={18} style={styles.fieldIcon} />
                <input
                  id="regPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  disabled={isSubmitting}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Department
              </label>
              <div
                style={{
                  ...styles.input,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-surface-subtle)',
                  color: 'var(--color-structure)',
                  cursor: 'not-allowed',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Department of Computer Engineering (Locked)
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="regPassword">
                Password (min. 8 characters) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.fieldIcon} />
                <input
                  id="regPassword"
                  type="password"
                  placeholder="••••••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label} htmlFor="regConfirmPassword">
                Confirm Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.fieldIcon} />
                <input
                  id="regConfirmPassword"
                  type="password"
                  placeholder="••••••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
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
                  Registering Teacher...
                </span>
              ) : (
                'Register & Access Workspace'
              )}
            </button>
          </form>
        )}
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
    maxWidth: '460px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '2.25rem 2rem',
    boxShadow: 'var(--shadow-xl)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.25rem',
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
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    padding: '0.25rem 0.75rem',
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent-hover)',
    border: '1px solid var(--color-accent-border)',
    borderRadius: 'var(--radius-full)',
    fontWeight: '600',
  },
  tabContainer: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    backgroundColor: 'var(--color-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.25rem',
    border: '1px solid var(--color-border)',
  },
  tabBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.6rem 0.75rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  tabBtnActive: {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
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
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.825rem',
    fontWeight: '600',
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
    padding: '0.7rem 0.875rem 0.7rem 2.5rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color var(--transition-fast)',
    minHeight: '42px',
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
};
