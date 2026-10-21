import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clear authentication session
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  // Restore session from token on initial render or token update
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        if (isMounted && response?.success && response?.user) {
          setUser(response.user);
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (err) {
        // Token invalid or expired
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    // Listen for global unauthorized events emitted by Axios interceptor
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  // Execute login action
  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      if (data?.token && data?.user) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
      }
      throw new Error('Incomplete authentication response from server');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    role: user?.role,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
