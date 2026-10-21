import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RoleRoute from './components/RoleRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import AdminHome from './pages/AdminHome';
import TeacherHome from './pages/TeacherHome';
import ExamCoordinatorHome from './pages/ExamCoordinatorHome';
import { Loader2 } from 'lucide-react';

/**
 * Root index resolver redirecting authenticated users to their authorized workspace,
 * or unauthenticated users to /login.
 */
function RootRedirect() {
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
        <span>Loading ExamGuard...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role?.toUpperCase();
  if (role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (role === 'EXAM_COORDINATOR') return <Navigate to="/exam-coordinator" replace />;
  return <Navigate to="/teacher" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<Login />} />

          {/* Access Denied Feedback Route */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Role-Protected Routes */}
          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <AdminHome />
              </RoleRoute>
            }
          />

          <Route
            path="/teacher"
            element={
              <RoleRoute allowedRoles={['TEACHER']}>
                <TeacherHome />
              </RoleRoute>
            }
          />

          <Route
            path="/exam-coordinator"
            element={
              <RoleRoute allowedRoles={['EXAM_COORDINATOR']}>
                <ExamCoordinatorHome />
              </RoleRoute>
            }
          />

          {/* Default Route */}
          <Route path="/" element={<RootRedirect />} />

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
