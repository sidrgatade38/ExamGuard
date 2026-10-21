import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Route protection wrapper enforcing specific role permissions.
 * Redirects to /login if unauthenticated, or /unauthorized if role mismatch.
 *
 * @param {Object} props
 * @param {string[]} props.allowedRoles - Array of allowed role names ('ADMIN', 'TEACHER', 'EXAM_COORDINATOR')
 * @param {React.ReactNode} props.children - Protected component to render
 */
export default function RoleRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#38bdf8',
          gap: '0.75rem',
          fontFamily: 'sans-serif',
        }}
      >
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Verifying authorization...</span>
      </div>
    );
  }

  // If not authenticated, redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user's role is permitted
  const userRole = user?.role?.toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  if (!userRole || !normalizedAllowed.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
