import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  UserPlus,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Filter,
  Eye,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Clock,
  Activity,
  FileText,
  KeyRound,
  Key,
  X,
  Search,
  Check,
  UserCheck,
  UserX,
  Lock,
  Menu,
  BookOpen,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import auditLogService from '../services/auditLogService';
import adminService from '../services/adminService';
import academicService from '../services/academicService';
import AppHeader from '../components/AppHeader';
import AlgorithmFlowDiagram from '../components/AlgorithmFlowDiagram';

export default function AdminHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active top tab: 'users' or 'academic'
  const [activeTab, setActiveTab] = useState('users');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAlgorithmModal, setShowAlgorithmModal] = useState(false);

  // ==========================================
  // SECTION A: User Management States
  // ==========================================
  const [usersList, setUsersList] = useState([]);
  const [usersPagination, setUsersPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  // Alerts with auto-dismissal (3-5s success, 5-7s error)
  const [userActionError, setUserActionErrorState] = useState(null);
  const [userActionSuccess, setUserActionSuccessState] = useState(null);
  const successTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  const setUserActionSuccess = useCallback((msg) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setUserActionSuccessState(msg);
    if (msg) {
      successTimerRef.current = setTimeout(() => {
        setUserActionSuccessState(null);
      }, 4000);
    }
  }, []);

  const setUserActionError = useCallback((msg) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setUserActionErrorState(msg);
    if (msg) {
      errorTimerRef.current = setTimeout(() => {
        setUserActionErrorState(null);
      }, 6000);
    }
  }, []);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'TEACHER',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit User State
  const [userToEdit, setUserToEdit] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'TEACHER',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete / Safe Archival State
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [selectedUserDetail, setSelectedUserDetail] = useState(null);

  const [statusConfirmTarget, setStatusConfirmTarget] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [roleChangeTarget, setRoleChangeTarget] = useState(null);
  const [selectedNewRole, setSelectedNewRole] = useState('');
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [passwordResetTarget, setPasswordResetTarget] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // ==========================================
  // SECTION B: Audit Log States (Module 13)
  // ==========================================
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    totalEvents: 0,
    successCount: 0,
    failureCount: 0,
    deniedCount: 0,
  });
  const [auditPagination, setAuditPagination] = useState({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  // ==========================================
  // User Management Handlers
  // ==========================================
  const fetchUsers = useCallback(
    async (pageToLoad = 1) => {
      setUsersLoading(true);
      setUserActionError(null);
      try {
        const params = {
          page: pageToLoad,
          limit: usersPagination.limit,
        };
        if (userSearch) params.search = userSearch;
        if (userRoleFilter) params.role = userRoleFilter;
        if (userStatusFilter) params.status = userStatusFilter;

        const result = await adminService.getUsers(params);
        setUsersList(result.users || []);
        setUsersPagination(
          result.pagination || {
            total: 0,
            page: pageToLoad,
            limit: usersPagination.limit,
            totalPages: 1,
          }
        );
      } catch (err) {
        console.error('Error fetching users:', err);
        setUserActionError(
          err.response?.data?.message || err.message || 'Failed to load user list.'
        );
      } finally {
        setUsersLoading(false);
      }
    },
    [userSearch, userRoleFilter, userStatusFilter, usersPagination.limit]
  );

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(1);
    }
  }, [fetchUsers, activeTab]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserActionError(null);
    setUserActionSuccess(null);

    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      setUserActionError('Please fill in all required fields.');
      return;
    }
    if (createForm.password.length < 8) {
      setUserActionError('Password must be at least 8 characters long.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await adminService.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
      });

      setUserActionSuccess(`User "${res.user?.email || createForm.email}" created successfully.`);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'TEACHER' });
      fetchUsers(1);
    } catch (err) {
      setUserActionError(
        err.response?.data?.message || err.message || 'Failed to create user.'
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusConfirmTarget) return;
    setUserActionError(null);
    setUserActionSuccess(null);
    setStatusSubmitting(true);

    try {
      const targetIsActive = !statusConfirmTarget.isActive;
      const res = await adminService.updateUserStatus(statusConfirmTarget.id, targetIsActive);

      setUserActionSuccess(
        `User "${statusConfirmTarget.email}" successfully ${
          targetIsActive ? 'activated' : 'deactivated'
        }.`
      );
      setStatusConfirmTarget(null);
      fetchUsers(usersPagination.page);
    } catch (err) {
      setUserActionError(
        err.response?.data?.message || err.message || 'Failed to update account status.'
      );
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget || !selectedNewRole) return;
    setUserActionError(null);
    setUserActionSuccess(null);
    setRoleSubmitting(true);

    try {
      const res = await adminService.updateUserRole(roleChangeTarget.id, selectedNewRole);
      setUserActionSuccess(
        `Role for "${roleChangeTarget.email}" successfully changed to ${selectedNewRole}.`
      );
      setRoleChangeTarget(null);
      setSelectedNewRole('');
      fetchUsers(usersPagination.page);
    } catch (err) {
      setUserActionError(
        err.response?.data?.message || err.message || 'Failed to change user role.'
      );
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleConfirmPasswordReset = async (e) => {
    e.preventDefault();
    if (!passwordResetTarget) return;
    setUserActionError(null);
    setUserActionSuccess(null);

    if (newPasswordInput.length < 8) {
      setUserActionError('New password must be at least 8 characters long.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setUserActionError('Passwords do not match. Please re-enter.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await adminService.resetPassword(passwordResetTarget.id, newPasswordInput);
      setUserActionSuccess(`Password for "${passwordResetTarget.email}" reset successfully.`);
      setPasswordResetTarget(null);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err) {
      setUserActionError(
        err.response?.data?.message || err.message || 'Failed to reset password.'
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Safe User Deletion & Archival Handler (Sprint Section 2)
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteSubmitting(true);
    setUserActionError(null);
    setUserActionSuccess(null);
    try {
      const res = await adminService.deleteUser(userToDelete.id);
      setUserActionSuccess(res.message || `User account for "${userToDelete.email}" has been safely archived. Active login access revoked while historical records and question papers remain preserved.`);
      setUserToDelete(null);
      fetchUsers(usersPagination.page);
    } catch (err) {
      setUserActionError(err.response?.data?.message || err.message || 'Failed to archive user account.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Edit User Account Information Handler (Sprint Section 2)
  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setUserActionError('Name and Email are required.');
      return;
    }
    setEditSubmitting(true);
    setUserActionError(null);
    setUserActionSuccess(null);
    try {
      await adminService.updateUser(userToEdit.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        role: editForm.role,
      });
      setUserActionSuccess(`User account "${editForm.email}" updated successfully.`);
      setUserToEdit(null);
      fetchUsers(usersPagination.page);
    } catch (err) {
      setUserActionError(err.response?.data?.message || err.message || 'Failed to update user account.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ==========================================
  // Audit Log Handlers (Module 13)
  // ==========================================
  const fetchSummary = useCallback(async () => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const data = await auditLogService.getAuditSummary(params);
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch audit summary:', err);
    }
  }, [startDate, endDate]);

  const fetchLogs = useCallback(
    async (pageToLoad = 1) => {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const params = {
          page: pageToLoad,
          limit: auditPagination.limit,
        };
        if (actionFilter) params.action = actionFilter;
        if (outcomeFilter) params.outcome = outcomeFilter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const result = await auditLogService.getAuditLogs(params);
        setLogs(result.logs || []);
        setAuditPagination(
          result.pagination || {
            total: 0,
            page: pageToLoad,
            limit: auditPagination.limit,
            totalPages: 1,
          }
        );
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setAuditError(err.response?.data?.message || err.message || 'Failed to load audit logs.');
      } finally {
        setAuditLoading(false);
      }
    },
    [actionFilter, outcomeFilter, startDate, endDate, auditPagination.limit]
  );

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchSummary();
      fetchLogs(1);
    }
  }, [fetchSummary, fetchLogs, activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ==========================================
  // SECTION D: Academic Master Configuration CRUD (Part 3)
  // ==========================================
  const [academicConfigSubTab, setAcademicConfigSubTab] = useState('titles'); // 'titles' | 'patterns' | 'subjects' | 'courses' | 'designations'
  const [paperTitles, setPaperTitles] = useState([]);
  const [academicPatterns, setAcademicPatterns] = useState([]);
  const [academicSubjects, setAcademicSubjects] = useState([]);
  const [academicCourses, setAcademicCourses] = useState([]);
  const [academicDesignations, setAcademicDesignations] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Modal / form states for Academic CRUD
  const [academicModalOpen, setAcademicModalOpen] = useState(false);
  const [academicModalType, setAcademicModalType] = useState('title'); // 'title' | 'pattern' | 'subject' | 'course' | 'designation'
  const [academicEditingItem, setAcademicEditingItem] = useState(null);
  const [academicForm, setAcademicForm] = useState({});

  const fetchAcademicConfigs = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const [tRes, pRes, sRes, cRes, dRes] = await Promise.all([
        academicService.getPaperTitles().catch(() => ({ data: [] })),
        academicService.getPatterns().catch(() => ({ data: [] })),
        academicService.getSubjects().catch(() => ({ data: [] })),
        academicService.getCourses().catch(() => ({ data: [] })),
        academicService.getDesignations().catch(() => ({ data: [] })),
      ]);
      setPaperTitles(tRes.data || []);
      setAcademicPatterns(pRes.data || []);
      setAcademicSubjects(sRes.data || []);
      setAcademicCourses(cRes.data || []);
      setAcademicDesignations(dRes.data || []);
    } catch (err) {
      console.warn('Failed loading academic configurations:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'academic') {
      fetchAcademicConfigs();
    }
  }, [activeTab, fetchAcademicConfigs]);

  const handleOpenAcademicModal = (type, item = null) => {
    setAcademicModalType(type);
    setAcademicEditingItem(item);
    if (type === 'title') {
      setAcademicForm({
        title: item?.title || '',
        code: item?.code || '',
      });
    } else if (type === 'pattern') {
      setAcademicForm({
        name: item?.name || '',
        code: item?.code || '',
        revisionYear: item?.revisionYear || item?.revision_year || new Date().getFullYear(),
      });
    } else if (type === 'subject') {
      setAcademicForm({
        title: item?.title || '',
        code: item?.code || '',
        shortName: item?.shortName || item?.short_name || '',
        semester: item?.semester || 'Semester 5',
        totalMarks: item?.totalMarks || item?.total_marks || 70,
        durationHours: item?.durationHours || item?.duration_hours || 2.5,
      });
    } else if (type === 'course') {
      setAcademicForm({
        name: item?.name || '',
        code: item?.code || '',
        degree: item?.degree || 'B.E.',
      });
    } else if (type === 'designation') {
      setAcademicForm({
        name: item?.name || (typeof item === 'string' ? item : ''),
      });
    }
    setAcademicModalOpen(true);
  };

  const handleSaveAcademicItem = async (e) => {
    e.preventDefault();
    setUserActionError(null);
    setUserActionSuccess(null);
    try {
      if (academicModalType === 'title') {
        if (academicEditingItem) {
          await academicService.updatePaperTitle(academicEditingItem.id, academicForm);
          setUserActionSuccess(`Paper title updated successfully.`);
        } else {
          await academicService.createPaperTitle(academicForm);
          setUserActionSuccess(`New paper title added successfully.`);
        }
      } else if (academicModalType === 'pattern') {
        if (academicEditingItem) {
          await academicService.updatePattern(academicEditingItem.id, academicForm);
          setUserActionSuccess(`Academic pattern updated successfully.`);
        } else {
          await academicService.createPattern(academicForm);
          setUserActionSuccess(`New academic pattern added successfully.`);
        }
      } else if (academicModalType === 'subject') {
        if (academicEditingItem) {
          await academicService.updateSubject(academicEditingItem.id, academicForm);
          setUserActionSuccess(`Subject updated successfully.`);
        } else {
          await academicService.createSubject(academicForm);
          setUserActionSuccess(`New subject added successfully.`);
        }
      } else if (academicModalType === 'course') {
        if (academicEditingItem) {
          await academicService.updateCourse(academicEditingItem.id, academicForm);
          setUserActionSuccess(`Course updated successfully.`);
        } else {
          await academicService.createCourse(academicForm);
          setUserActionSuccess(`New course added successfully.`);
        }
      } else if (academicModalType === 'designation') {
        await academicService.createDesignation(academicForm.name.trim());
        setUserActionSuccess(`Designation "${academicForm.name.trim()}" added successfully.`);
      }
      setAcademicModalOpen(false);
      fetchAcademicConfigs();
    } catch (err) {
      setUserActionError(err.response?.data?.message || err.message || 'Operation failed');
    }
  };

  const handleDeleteAcademicItem = async (type, item) => {
    const itemName = item?.title || item?.name || (typeof item === 'string' ? item : 'item');
    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) return;
    setUserActionError(null);
    setUserActionSuccess(null);
    try {
      if (type === 'title') {
        await academicService.deletePaperTitle(item.id);
      } else if (type === 'pattern') {
        await academicService.deletePattern(item.id);
      } else if (type === 'subject') {
        await academicService.deleteSubject(item.id);
      } else if (type === 'course') {
        await academicService.deleteCourse(item.id);
      } else if (type === 'designation') {
        await academicService.deleteDesignation(itemName);
      }
      setUserActionSuccess(`Deleted successfully.`);
      fetchAcademicConfigs();
    } catch (err) {
      setUserActionError(err.response?.data?.message || err.message || 'Delete failed');
    }
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return isoStr;
    }
  };

  const getRoleBadgeStyle = (roleName) => {
    switch ((roleName || '').toUpperCase()) {
      case 'ADMIN':
        return { bg: '#4c1d95', color: '#e9d5ff', border: '1px solid #7c3aed' };
      case 'EXAM_COORDINATOR':
        return { bg: '#78350f', color: '#fef3c7', border: '1px solid #d97706' };
      case 'TEACHER':
        return { bg: '#1e3a8a', color: '#bfdbfe', border: '1px solid #2563eb' };
      default:
        return { bg: '#334155', color: '#cbd5e1', border: '1px solid #475569' };
    }
  };

  const getOutcomeBadgeStyle = (outcome) => {
    switch (outcome) {
      case 'SUCCESS':
        return { bg: '#064e3b', color: '#6ee7b7', border: '1px solid #059669' };
      case 'FAILURE':
        return { bg: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626' };
      case 'DENIED':
        return { bg: '#78350f', color: '#fde68a', border: '1px solid #d97706' };
      default:
        return { bg: '#1e293b', color: '#94a3b8', border: '1px solid #334155' };
    }
  };

  const adminNavTabs = React.useMemo(() => [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      badge: usersList.filter((u) => u.status === 'PENDING').length || null,
    },
    {
      id: 'academic',
      label: 'Academic & Paper Config',
      icon: BookOpen,
    },
  ], [usersList]);

  return (
    <div style={styles.container}>
      {/* Unified Modern Academic Navigation Header */}
      <AppHeader
        user={user}
        role="ADMIN"
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        tabs={adminNavTabs}
        onOpenAlgorithmFlow={() => setShowAlgorithmModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Body */}
      <main style={styles.main}>
        {/* Global Success / Error Alerts */}
        {userActionSuccess && (
          <div style={styles.successBox}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{userActionSuccess}</span>
            <button
              onClick={() => setUserActionSuccess(null)}
              style={styles.alertDismissBtn}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {userActionError && (
          <div style={styles.errorBox}>
            <XCircle size={18} color="#ef4444" />
            <span>{userActionError}</span>
            <button
              onClick={() => setUserActionError(null)}
              style={styles.alertDismissBtn}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: USER MANAGEMENT                                         */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <div>
            {/* User Search & Filter Toolbar */}
            <section style={styles.filterCard}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Search size={14} style={{ marginRight: '0.35rem' }} />
                  Search Name or Email
                </label>
                <input
                  type="text"
                  placeholder="Filter by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={styles.textInput}
                />
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Filter size={14} style={{ marginRight: '0.35rem' }} />
                  Filter Role
                </label>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="TEACHER">TEACHER</option>
                  <option value="EXAM_COORDINATOR">EXAM_COORDINATOR</option>
                </select>
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Account Status</label>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="archived">Archived / Access Revoked</option>
                </select>
              </div>

              <div style={styles.filterActions}>
                <button
                  onClick={() => fetchUsers(1)}
                  style={styles.refreshBtn}
                  disabled={usersLoading}
                  title="Refresh Users"
                >
                  <RefreshCw
                    size={16}
                    style={{
                      animation: usersLoading ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => {
                    setUserActionError(null);
                    setShowCreateModal(true);
                  }}
                  style={styles.createUserBtn}
                >
                  <UserPlus size={16} style={{ marginRight: '0.4rem' }} />
                  <span>Create User</span>
                </button>
              </div>
            </section>

            {/* Users Table Card */}
            <section style={styles.tableCard}>
              <div style={styles.tableHeaderBar}>
                <div>
                  <h2 style={styles.tableTitle}>Registered System Accounts</h2>
                  <p style={styles.tableSubtitle}>
                    Manage identity lifecycles, role delegations, and account activations
                  </p>
                </div>
                <span style={styles.recordsCountBadge}>
                  {usersPagination.total} Total Users
                </span>
              </div>

              {usersLoading ? (
                <div style={styles.loadingContainer}>
                  <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
                  <p style={styles.loadingText}>Loading user registry from database...</p>
                </div>
              ) : usersList.length === 0 ? (
                <div style={styles.emptyContainer}>
                  <Users size={48} color="#64748b" />
                  <h3 style={styles.emptyTitle}>No Users Found</h3>
                  <p style={styles.emptyText}>
                    No registered user accounts match your search or filter criteria.
                  </p>
                </div>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeadRow}>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Email Address</th>
                        <th style={styles.th}>Role</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Created Date</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => {
                        const roleStyle = getRoleBadgeStyle(u.role);
                        const isSelf = u.id === user?.userId || u.id === user?.id;

                        return (
                          <tr key={u.id} style={styles.tableRow}>
                            <td style={styles.td}>
                              <div style={styles.userNameBlock}>
                                <span style={styles.userNameText}>{u.name}</span>
                                {isSelf && (
                                  <span style={styles.selfPill}>You</span>
                                )}
                              </div>
                            </td>
                            <td style={styles.tdMono}>{u.email}</td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.rolePill,
                                  backgroundColor: roleStyle.bg,
                                  color: roleStyle.color,
                                  border: roleStyle.border,
                                }}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {u.isDeleted ? (
                                <span style={{ ...styles.statusInactivePill, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                                  <XCircle size={12} style={{ marginRight: '0.25rem' }} />
                                  Archived
                                </span>
                              ) : u.isActive ? (
                                <span style={styles.statusActivePill}>
                                  <CheckCircle2 size={12} style={{ marginRight: '0.25rem' }} />
                                  Active
                                </span>
                              ) : (
                                <span style={styles.statusInactivePill}>
                                  <XCircle size={12} style={{ marginRight: '0.25rem' }} />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td style={styles.tdTime}>
                              {formatTimestamp(u.createdAt)}
                            </td>
                            <td style={{ ...styles.tdAction, textAlign: 'right' }}>
                              <div style={styles.rowActions}>
                                {/* View details */}
                                <button
                                  onClick={() => setSelectedUserDetail(u)}
                                  style={styles.actionIconBtn}
                                  title="View User Details"
                                >
                                  <Eye size={15} />
                                </button>

                                {/* Edit Account */}
                                <button
                                  onClick={() => {
                                    setUserToEdit(u);
                                    setEditForm({
                                      name: u.name || '',
                                      email: u.email || '',
                                      phone: u.phone || '',
                                      role: u.role || 'TEACHER',
                                    });
                                  }}
                                  style={styles.actionIconBtn}
                                  title="Edit Account Details"
                                >
                                  <Edit size={15} color="#3b82f6" />
                                </button>

                                {/* Change Role */}
                                <button
                                  onClick={() => {
                                    setRoleChangeTarget(u);
                                    setSelectedNewRole(u.role);
                                  }}
                                  style={styles.actionIconBtn}
                                  title="Change User Role"
                                >
                                  <ShieldCheck size={15} color="#a855f7" />
                                </button>

                                {/* Reset Password */}
                                <button
                                  onClick={() => {
                                    setPasswordResetTarget(u);
                                    setNewPasswordInput('');
                                    setConfirmPasswordInput('');
                                  }}
                                  style={styles.actionIconBtn}
                                  title="Reset Password"
                                >
                                  <Key size={15} color="#38bdf8" />
                                </button>

                                {/* Toggle Active Status */}
                                <button
                                  onClick={() => setStatusConfirmTarget(u)}
                                  style={{
                                    ...styles.actionIconBtn,
                                    color: u.isActive ? '#ef4444' : '#10b981',
                                  }}
                                  title={u.isActive ? 'Deactivate User' : 'Activate User'}
                                >
                                  {u.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                                </button>

                                {/* Safe Account Deletion & Archival */}
                                <button
                                  onClick={() => setUserToDelete(u)}
                                  disabled={isSelf || u.isDeleted}
                                  style={{
                                    ...styles.actionIconBtn,
                                    color: '#ef4444',
                                    ...(isSelf || u.isDeleted ? { opacity: 0.35, cursor: 'not-allowed' } : {}),
                                  }}
                                  title={isSelf ? 'Cannot delete your own admin account' : u.isDeleted ? 'Account already archived' : 'Delete / Safely Revoke Access'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Users Pagination */}
              {usersPagination.totalPages > 1 && (
                <div style={styles.paginationBar}>
                  <div style={styles.paginationInfo}>
                    Page {usersPagination.page} of {usersPagination.totalPages} ({usersPagination.total} users)
                  </div>
                  <div style={styles.paginationBtns}>
                    <button
                      onClick={() => fetchUsers(usersPagination.page - 1)}
                      disabled={usersPagination.page <= 1}
                      style={styles.pageBtn}
                    >
                      <ArrowLeft size={14} style={{ marginRight: '0.35rem' }} />
                      Prev
                    </button>
                    <button
                      onClick={() => fetchUsers(usersPagination.page + 1)}
                      disabled={usersPagination.page >= usersPagination.totalPages}
                      style={styles.pageBtn}
                    >
                      Next
                      <ArrowRight size={14} style={{ marginLeft: '0.35rem' }} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: QUESTION PAPER APPROVAL WORKFLOW (Module 22)            */}
        {/* ============================================================== */}
        {activeTab === 'academic' && (
          <div>
            {/* Header info */}
            <section style={{ ...styles.filterCard, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-structure)' }}>
                  Academic &amp; Question Paper Configuration Control
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  Exclusively for Department of Computer Engineering. Manage titles, patterns, courses, and subjects dynamically.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenAcademicModal(academicConfigSubTab === 'titles' ? 'title' : academicConfigSubTab === 'patterns' ? 'pattern' : academicConfigSubTab === 'courses' ? 'course' : academicConfigSubTab === 'designations' ? 'designation' : 'subject')}
                  style={{ ...styles.submitBtn, width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.55rem 1rem' }}
                >
                  <Plus size={16} />
                  <span>
                    Add {academicConfigSubTab === 'titles' ? 'Paper Title' : academicConfigSubTab === 'patterns' ? 'Academic Pattern' : academicConfigSubTab === 'courses' ? 'Course' : academicConfigSubTab === 'designations' ? 'Designation' : 'Subject'}
                  </span>
                </button>
              </div>
            </section>

            {/* Sub-tab navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAcademicConfigSubTab('titles')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'titles' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'titles' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Paper Titles ({paperTitles.length})
              </button>

              <button
                type="button"
                onClick={() => setAcademicConfigSubTab('patterns')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'patterns' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'patterns' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Academic Patterns ({academicPatterns.length})
              </button>

              <button
                type="button"
                onClick={() => setAcademicConfigSubTab('subjects')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'subjects' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'subjects' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Subjects &amp; Codes ({academicSubjects.length})
              </button>

              <button
                type="button"
                onClick={() => setAcademicConfigSubTab('courses')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'courses' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'courses' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Courses / Degrees ({academicCourses.length})
              </button>

              <button
                type="button"
                onClick={() => setAcademicConfigSubTab('designations')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'designations' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'designations' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Designations ({academicDesignations.length})
              </button>
            </div>

            {/* Sub-tab 1: Paper Titles */}
            {academicConfigSubTab === 'titles' && (
              <section style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.th}>Title Option</th>
                      <th style={styles.th}>Code Identifier</th>
                      <th style={styles.th}>Status</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paperTitles.map((t) => (
                      <tr key={t.id} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{t.title}</strong>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.8rem', color: '#64748b' }}>
                            {t.code || t.title.toUpperCase().replace(/\s+/g, '_')}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#166534' }}>
                            ACTIVE
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenAcademicModal('title', t)}
                            style={{ ...styles.iconBtn, marginRight: '6px' }}
                            title="Edit Title"
                          >
                            <Edit size={14} color="#0284c7" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAcademicItem('title', t)}
                            style={styles.iconBtn}
                            title="Delete Title"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Sub-tab 2: Patterns */}
            {academicConfigSubTab === 'patterns' && (
              <section style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.th}>Pattern Name</th>
                      <th style={styles.th}>Code</th>
                      <th style={styles.th}>Revision Year</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicPatterns.map((p) => (
                      <tr key={p.id} style={styles.tr}>
                        <td style={styles.td}><strong>{p.name}</strong></td>
                        <td style={styles.td}><span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.8rem' }}>{p.code}</span></td>
                        <td style={styles.td}>{p.revisionYear || p.revision_year || 'N/A'}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenAcademicModal('pattern', p)}
                            style={{ ...styles.iconBtn, marginRight: '6px' }}
                            title="Edit Pattern"
                          >
                            <Edit size={14} color="#0284c7" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAcademicItem('pattern', p)}
                            style={styles.iconBtn}
                            title="Delete Pattern"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Sub-tab 3: Subjects */}
            {academicConfigSubTab === 'subjects' && (
              <section style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.th}>Subject Title</th>
                      <th style={styles.th}>Code / Acronym</th>
                      <th style={styles.th}>Semester</th>
                      <th style={styles.th}>Marks &amp; Duration</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicSubjects.map((s) => (
                      <tr key={s.id} style={styles.tr}>
                        <td style={styles.td}><strong>{s.title}</strong></td>
                        <td style={styles.td}>
                          <span style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 600 }}>{s.code}</span>
                          {s.shortName && <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#64748b' }}>({s.shortName})</span>}
                        </td>
                        <td style={styles.td}>{s.semester}</td>
                        <td style={styles.td}>{s.totalMarks} Marks • {s.durationHours}h</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenAcademicModal('subject', s)}
                            style={{ ...styles.iconBtn, marginRight: '6px' }}
                            title="Edit Subject"
                          >
                            <Edit size={14} color="#0284c7" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAcademicItem('subject', s)}
                            style={styles.iconBtn}
                            title="Delete Subject"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Sub-tab 4: Courses */}
            {academicConfigSubTab === 'courses' && (
              <section style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.th}>Course Name</th>
                      <th style={styles.th}>Code</th>
                      <th style={styles.th}>Degree</th>
                      <th style={styles.th}>Department</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicCourses.map((c) => (
                      <tr key={c.id} style={styles.tr}>
                        <td style={styles.td}><strong>{c.name}</strong></td>
                        <td style={styles.td}><span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.8rem' }}>{c.code}</span></td>
                        <td style={styles.td}>{c.degree || 'B.E.'}</td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                            Computer Engineering
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenAcademicModal('course', c)}
                            style={{ ...styles.iconBtn, marginRight: '6px' }}
                            title="Edit Course"
                          >
                            <Edit size={14} color="#0284c7" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAcademicItem('course', c)}
                            style={styles.iconBtn}
                            title="Delete Course"
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {/* Sub-tab 5: Designations */}
            {academicConfigSubTab === 'designations' && (
              <section style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.th}>Designation Title</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Status</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicDesignations.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No designations configured yet. Click "Add Designation" above.
                        </td>
                      </tr>
                    ) : (
                      academicDesignations.map((d, idx) => {
                        const dName = typeof d === 'string' ? d : d.name;
                        return (
                          <tr key={idx} style={styles.tr}>
                            <td style={styles.td}>
                              <strong>{dName}</strong>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                                Faculty Designation
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                                Active
                              </span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteAcademicItem('designation', dName)}
                                style={styles.iconBtn}
                                title="Delete Designation"
                              >
                                <Trash2 size={14} color="#dc2626" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </section>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: AUDIT LOGS (Module 13 preserved in full)                */}
        {/* ============================================================== */}
        {activeTab === 'audit' && (
          <div>
            {/* Summary Metrics Cards */}
            <section style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statIconBoxTotal}>
                  <Activity size={22} color="#38bdf8" />
                </div>
                <div>
                  <div style={styles.statLabel}>Total Security Events</div>
                  <div style={styles.statValue}>{summary.totalEvents.toLocaleString()}</div>
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statIconBoxSuccess}>
                  <CheckCircle2 size={22} color="#10b981" />
                </div>
                <div>
                  <div style={styles.statLabel}>Successful Operations</div>
                  <div style={styles.statValue}>{summary.successCount.toLocaleString()}</div>
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statIconBoxDenied}>
                  <AlertTriangle size={22} color="#f59e0b" />
                </div>
                <div>
                  <div style={styles.statLabel}>Access Denials (403)</div>
                  <div style={styles.statValue}>{summary.deniedCount.toLocaleString()}</div>
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statIconBoxFail}>
                  <XCircle size={22} color="#ef4444" />
                </div>
                <div>
                  <div style={styles.statLabel}>Security Failures</div>
                  <div style={styles.statValue}>{summary.failureCount.toLocaleString()}</div>
                </div>
              </div>
            </section>

            {/* Filter Toolbar */}
            <section style={styles.filterCard}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Filter size={14} style={{ marginRight: '0.35rem' }} />
                  Action Type
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="">All Actions</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="FAILED_LOGIN">FAILED_LOGIN</option>
                  <option value="QUESTION_PAPER_SUBMITTED">QUESTION_PAPER_SUBMITTED</option>
                  <option value="QUESTION_PAPER_ACCESSED">QUESTION_PAPER_ACCESSED</option>
                  <option value="QUESTION_PAPER_SCHEDULED">QUESTION_PAPER_SCHEDULED</option>
                  <option value="SIGNATURE_VERIFIED">SIGNATURE_VERIFIED</option>
                  <option value="DECRYPTION_REQUESTED">DECRYPTION_REQUESTED</option>
                  <option value="DOWNLOAD">DOWNLOAD</option>
                  <option value="ANSWER_KEY_UPLOADED">ANSWER_KEY_UPLOADED</option>
                  <option value="UNAUTHORIZED_ACCESS">UNAUTHORIZED_ACCESS</option>
                </select>
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Outcome</label>
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="">All Outcomes</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILURE">FAILURE</option>
                  <option value="DENIED">DENIED</option>
                </select>
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Calendar size={14} style={{ marginRight: '0.35rem' }} />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={styles.dateInput}
                />
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Calendar size={14} style={{ marginRight: '0.35rem' }} />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={styles.dateInput}
                />
              </div>

              <button
                onClick={() => {
                  fetchSummary();
                  fetchLogs(1);
                }}
                style={styles.refreshBtn}
                disabled={auditLoading}
                title="Refresh Logs"
              >
                <RefreshCw
                  size={16}
                  style={{
                    animation: auditLoading ? 'spin 1s linear infinite' : 'none',
                  }}
                />
                <span>Refresh</span>
              </button>
            </section>

            {auditError && (
              <div style={styles.errorBox}>
                <XCircle size={18} color="#ef4444" />
                <span>{auditError}</span>
              </div>
            )}

            {/* Audit Log Table Container */}
            <section style={styles.tableCard}>
              <div style={styles.tableHeaderBar}>
                <h2 style={styles.tableTitle}>Security Activity Stream</h2>
                <span style={styles.recordsCountBadge}>
                  {auditPagination.total} Total Records
                </span>
              </div>

              {auditLoading ? (
                <div style={styles.loadingContainer}>
                  <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#38bdf8' }} />
                  <p style={styles.loadingText}>Loading audit logs from database...</p>
                </div>
              ) : logs.length === 0 ? (
                <div style={styles.emptyContainer}>
                  <ShieldCheck size={48} color="#64748b" />
                  <h3 style={styles.emptyTitle}>No Audit Records Found</h3>
                  <p style={styles.emptyText}>
                    No events match the selected criteria. Try adjusting the filters.
                  </p>
                </div>
              ) : (
                <div style={styles.tableResponsive}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeadRow}>
                        <th style={styles.th}>Timestamp</th>
                        <th style={styles.th}>Action</th>
                        <th style={styles.th}>Outcome</th>
                        <th style={styles.th}>Actor</th>
                        <th style={styles.th}>Resource</th>
                        <th style={styles.th}>Summary</th>
                        <th style={styles.th}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const badge = getOutcomeBadgeStyle(log.outcome);
                        return (
                          <tr key={log.id} style={styles.tableRow}>
                            <td style={styles.tdTime}>
                              <Clock size={12} style={{ marginRight: '0.3rem', color: '#64748b' }} />
                              {formatTimestamp(log.createdAt)}
                            </td>
                            <td style={styles.td}>
                              <span style={styles.actionPill}>{log.action}</span>
                            </td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.outcomePill,
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: badge.border,
                                }}
                              >
                                {log.outcome}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.actorBlock}>
                                <span style={styles.actorName}>
                                  {log.user?.name || log.role || 'Unauthenticated'}
                                </span>
                                {log.user?.email && (
                                  <span style={styles.actorEmail}>{log.user.email}</span>
                                )}
                              </div>
                            </td>
                            <td style={styles.td}>
                              {log.resourceType ? (
                                <span style={styles.resourceBadge}>
                                  {log.resourceType}
                                  {log.resourceId && (
                                    <span style={styles.resourceIdMono}>
                                      :{log.resourceId.slice(0, 8)}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ color: '#64748b' }}>-</span>
                              )}
                            </td>
                            <td style={styles.tdSummary} title={log.summary}>
                              {log.summary || 'Operation recorded'}
                            </td>
                            <td style={styles.tdAction}>
                              <button
                                onClick={() => setSelectedLog(log)}
                                style={styles.detailBtn}
                                title="Inspect Audit Metadata"
                              >
                                <Eye size={14} style={{ marginRight: '0.25rem' }} />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {auditPagination.totalPages > 1 && (
                <div style={styles.paginationBar}>
                  <div style={styles.paginationInfo}>
                    Page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.total} records)
                  </div>
                  <div style={styles.paginationBtns}>
                    <button
                      onClick={() => fetchLogs(auditPagination.page - 1)}
                      disabled={auditPagination.page <= 1}
                      style={styles.pageBtn}
                    >
                      <ArrowLeft size={14} style={{ marginRight: '0.35rem' }} />
                      Prev
                    </button>
                    <button
                      onClick={() => fetchLogs(auditPagination.page + 1)}
                      disabled={auditPagination.page >= auditPagination.totalPages}
                      style={styles.pageBtn}
                    >
                      Next
                      <ArrowRight size={14} style={{ marginLeft: '0.35rem' }} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODAL 1: CREATE USER                                           */}
      {/* ============================================================== */}
      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Register New ExamGuard Account</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={styles.modalBody}>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Alan Turing"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Institutional Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. alan.turing@examguard.edu"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Assigned Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    style={styles.modalSelect}
                  >
                    <option value="TEACHER">TEACHER (Question Paper Author & Answer Keys)</option>
                    <option value="EXAM_COORDINATOR">EXAM_COORDINATOR (Distribution & Materials)</option>
                    <option value="ADMIN">ADMIN (System Administrator)</option>
                  </select>
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Initial Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 characters with letter and number"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    style={styles.modalInput}
                  />
                  <p style={styles.formHint}>
                    Password will be hashed using bcrypt (12 rounds) server-side and never exposed.
                  </p>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={styles.modalDismissBtn}
                  disabled={createSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.modalSubmitBtn}
                  disabled={createSubmitting}
                >
                  {createSubmitting ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '0.4rem' }} />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: USER DETAILS INSPECTION                               */}
      {/* ============================================================== */}
      {selectedUserDetail && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>User Account Profile</h3>
              <button
                onClick={() => setSelectedUserDetail(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalGrid}>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>User ID</span>
                  <span style={styles.modalMono}>{selectedUserDetail.id}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Account Status</span>
                  <span>
                    {selectedUserDetail.isActive ? (
                      <span style={styles.statusActivePill}>Active</span>
                    ) : (
                      <span style={styles.statusInactivePill}>Inactive</span>
                    )}
                  </span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Full Name</span>
                  <span style={styles.modalFieldValue}>{selectedUserDetail.name}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Email Address</span>
                  <span style={styles.modalMono}>{selectedUserDetail.email}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>System Role</span>
                  <span>
                    <span style={styles.rolePill}>{selectedUserDetail.role}</span>
                  </span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Created At</span>
                  <span style={styles.modalFieldValue}>
                    {formatTimestamp(selectedUserDetail.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setSelectedUserDetail(null)}
                style={styles.modalDismissBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: STATUS CONFIRMATION                                   */}
      {/* ============================================================== */}
      {statusConfirmTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {statusConfirmTarget.isActive ? 'Deactivate User Account' : 'Activate User Account'}
              </h3>
              <button
                onClick={() => setStatusConfirmTarget(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.5 }}>
                Are you sure you want to{' '}
                <strong>{statusConfirmTarget.isActive ? 'deactivate' : 'activate'}</strong> the account
                for <strong>{statusConfirmTarget.name}</strong> ({statusConfirmTarget.email})?
              </p>
              {statusConfirmTarget.isActive && (
                <div style={styles.warningAlert}>
                  <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span>
                    Deactivating this account will immediately revoke all JWT sessions and prevent future logins.
                  </span>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setStatusConfirmTarget(null)}
                style={styles.modalDismissBtn}
                disabled={statusSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                style={{
                  ...styles.modalSubmitBtn,
                  backgroundColor: statusConfirmTarget.isActive ? '#dc2626' : '#10b981',
                }}
                disabled={statusSubmitting}
              >
                {statusSubmitting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : statusConfirmTarget.isActive ? (
                  'Deactivate Account'
                ) : (
                  'Activate Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ROLE CHANGE                                           */}
      {/* ============================================================== */}
      {roleChangeTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Assign System Role</h3>
              <button
                onClick={() => setRoleChangeTarget(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.5 }}>
                Select a new system role for <strong>{roleChangeTarget.name}</strong> ({roleChangeTarget.email}).
              </p>

              <div style={styles.formField}>
                <label style={styles.formLabel}>Current Role</label>
                <span style={styles.rolePill}>{roleChangeTarget.role}</span>
              </div>

              <div style={styles.formField}>
                <label style={styles.formLabel}>New Target Role</label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value)}
                  style={styles.modalSelect}
                >
                  <option value="TEACHER">TEACHER</option>
                  <option value="EXAM_COORDINATOR">EXAM_COORDINATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              {roleChangeTarget.role === 'ADMIN' && selectedNewRole !== 'ADMIN' && (
                <div style={styles.warningAlert}>
                  <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span>
                    Warning: Demoting an administrator removes full audit and user management privileges.
                  </span>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setRoleChangeTarget(null)}
                style={styles.modalDismissBtn}
                disabled={roleSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                style={styles.modalSubmitBtn}
                disabled={roleSubmitting || selectedNewRole === roleChangeTarget.role}
              >
                {roleSubmitting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  'Update Role'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: PASSWORD RESET                                        */}
      {/* ============================================================== */}
      {passwordResetTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Reset User Password</h3>
              <button
                onClick={() => setPasswordResetTarget(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPasswordReset}>
              <div style={styles.modalBody}>
                <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.5 }}>
                  Set a new initial password for <strong>{passwordResetTarget.name}</strong> ({passwordResetTarget.email}).
                </p>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 characters with letter and number"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Confirm Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-type new password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setPasswordResetTarget(null)}
                  style={styles.modalDismissBtn}
                  disabled={passwordSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.modalSubmitBtn}
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT USER ACCOUNT INFORMATION (Sprint Section 2)        */}
      {/* ============================================================== */}
      {userToEdit && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit User Account Information</h3>
              <button
                onClick={() => setUserToEdit(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div style={styles.modalBody}>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Institutional Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Mobile / Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={styles.modalInput}
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.formLabel}>Assigned Role *</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={styles.modalSelect}
                  >
                    <option value="TEACHER">TEACHER (Question Paper Author & Answer Keys)</option>
                    <option value="EXAM_COORDINATOR">EXAM_COORDINATOR (Distribution & Materials)</option>
                    <option value="ADMIN">ADMIN (System Administrator)</option>
                  </select>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  style={styles.modalDismissBtn}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.modalSubmitBtn}
                  disabled={editSubmitting}
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '0.4rem' }} />
                      Saving...
                    </>
                  ) : (
                    'Save Account Details'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SAFE ACCOUNT DELETION & ARCHIVAL (Sprint Section 2)     */}
      {/* ============================================================== */}
      {userToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={20} color="#ef4444" />
                <h3 style={{ ...styles.modalTitle, color: '#ef4444' }}>Safe Account Deletion & Archival</h3>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                  color: '#f87171',
                  fontSize: '13px',
                }}
              >
                <strong>Account to be deactivated:</strong> {userToDelete.name} ({userToDelete.email}) • Role: <strong>{userToDelete.role}</strong>
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
                Consequences of Account Deletion:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                <li>All active user sessions and authentication tokens are immediately revoked.</li>
                <li>The user is permanently blocked from logging in to ExamGuard.</li>
                <li><strong>Institutional Records Preserved:</strong> All question papers, digital signatures, cryptographic verification logs, and audit entries authored by or assigned to this user will remain safely preserved in the database.</li>
                <li>Foreign-key constraints and historical academic integrity are fully maintained.</li>
              </ul>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                style={styles.modalDismissBtn}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteSubmitting}
                style={{
                  ...styles.modalSubmitBtn,
                  backgroundColor: '#dc2626',
                }}
              >
                {deleteSubmitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '0.4rem' }} />
                    Archiving Account...
                  </>
                ) : (
                  'Confirm Account Deletion'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: AUDIT DETAIL INSPECTOR (Module 13)                    */}
      {/* ============================================================== */}
      {selectedLog && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Forensic Audit Event Inspector</h3>
              <button onClick={() => setSelectedLog(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalGrid}>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Event ID</span>
                  <span style={styles.modalMono}>{selectedLog.id}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Timestamp (UTC)</span>
                  <span style={styles.modalMono}>{selectedLog.createdAt}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Action</span>
                  <span style={styles.modalMono}>{selectedLog.action}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Outcome</span>
                  <span style={styles.modalMono}>{selectedLog.outcome}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Actor User ID</span>
                  <span style={styles.modalMono}>{selectedLog.userId || 'N/A (Unauthenticated)'}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Actor Role</span>
                  <span style={styles.modalMono}>{selectedLog.role || selectedLog.user?.role || 'N/A'}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Client IP</span>
                  <span style={styles.modalMono}>{selectedLog.ipAddress || 'Unknown'}</span>
                </div>
                <div style={styles.modalField}>
                  <span style={styles.modalFieldLabel}>Correlation ID</span>
                  <span style={styles.modalMono}>{selectedLog.correlationId || 'N/A'}</span>
                </div>
              </div>

              <div style={styles.modalSummaryBox}>
                <span style={styles.modalFieldLabel}>Event Summary</span>
                <p style={styles.modalSummaryText}>{selectedLog.summary || 'None'}</p>
              </div>

              <div style={styles.modalDetailsBox}>
                <span style={styles.modalFieldLabel}>Sanitized Event Metadata (Redacted JSON)</span>
                <pre style={styles.modalJson}>
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setSelectedLog(null)} style={styles.modalDismissBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 7: QUESTION PAPER APPROVAL DECISION (Module 22)          */}
      {/* ============================================================== */}
      {/* MODAL 5: ACADEMIC CONFIGURATION MODAL (Part 3)                  */}
      {/* ============================================================== */}
      {academicModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {academicEditingItem ? 'Edit' : 'Add New'}{' '}
                {academicModalType === 'title' ? 'Paper Title' : academicModalType === 'pattern' ? 'Academic Pattern' : academicModalType === 'course' ? 'Course' : academicModalType === 'designation' ? 'Designation' : 'Subject'}
              </h3>
              <button onClick={() => setAcademicModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAcademicItem}>
              <div style={styles.modalBody}>
                {academicModalType === 'title' && (
                  <>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Title Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Open Book Test, CCE Exam, End Sem Exam"
                        value={academicForm.title || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, title: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Code Identifier</label>
                      <input
                        type="text"
                        placeholder="e.g. OBT, CCE, END_SEM"
                        value={academicForm.code || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, code: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                  </>
                )}

                {academicModalType === 'pattern' && (
                  <>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Pattern Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 2019, 2024, 2025"
                        value={academicForm.name || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, name: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Code</label>
                      <input
                        type="text"
                        placeholder="e.g. PAT_2019, PAT_2024"
                        value={academicForm.code || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, code: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Revision Year</label>
                      <input
                        type="number"
                        placeholder="e.g. 2024"
                        value={academicForm.revisionYear || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, revisionYear: parseInt(e.target.value, 10) })}
                        style={styles.formInput}
                      />
                    </div>
                  </>
                )}

                {academicModalType === 'subject' && (
                  <>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Subject Title <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Advanced Artificial Intelligence"
                        value={academicForm.title || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, title: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={styles.formField}>
                        <label style={styles.formLabel}>Subject Code</label>
                        <input
                          type="text"
                          placeholder="e.g. 410250"
                          value={academicForm.code || ''}
                          onChange={(e) => setAcademicForm({ ...academicForm, code: e.target.value })}
                          style={styles.formInput}
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.formLabel}>Short Name / Acronym</label>
                        <input
                          type="text"
                          placeholder="e.g. AAI"
                          value={academicForm.shortName || ''}
                          onChange={(e) => setAcademicForm({ ...academicForm, shortName: e.target.value })}
                          style={styles.formInput}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={styles.formField}>
                        <label style={styles.formLabel}>Semester</label>
                        <select
                          value={academicForm.semester || 'Semester 5'}
                          onChange={(e) => setAcademicForm({ ...academicForm, semester: e.target.value })}
                          style={styles.formSelect}
                        >
                          {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
                        </select>
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.formLabel}>Total Marks</label>
                        <input
                          type="number"
                          value={academicForm.totalMarks || 70}
                          onChange={(e) => setAcademicForm({ ...academicForm, totalMarks: parseInt(e.target.value, 10) })}
                          style={styles.formInput}
                        />
                      </div>
                    </div>
                  </>
                )}

                {academicModalType === 'course' && (
                  <>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Course Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B.E. (Computer Engineering)"
                        value={academicForm.name || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, name: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Course Code</label>
                      <input
                        type="text"
                        placeholder="e.g. BE_COMP"
                        value={academicForm.code || ''}
                        onChange={(e) => setAcademicForm({ ...academicForm, code: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>Degree Level</label>
                      <input
                        type="text"
                        placeholder="e.g. B.E. / M.E."
                        value={academicForm.degree || 'B.E.'}
                        onChange={(e) => setAcademicForm({ ...academicForm, degree: e.target.value })}
                        style={styles.formInput}
                      />
                    </div>
                  </>
                )}
                {academicModalType === 'designation' && (
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>
                      Designation Title <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Professor, Associate Professor, Assistant Professor, Lecturer"
                      value={academicForm.name || ''}
                      onChange={(e) => setAcademicForm({ ...academicForm, name: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                )}

              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setAcademicModalOpen(false)}
                  style={styles.modalDismissBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.modalSubmitBtn}>
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cryptographic Algorithm Flow Modal */}
      <AlgorithmFlowDiagram
        isOpen={showAlgorithmModal}
        onClose={() => setShowAlgorithmModal(false)}
      />
    </div>
  );
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-inter)',
  },
  header: {
    backgroundColor: 'var(--color-structure)',
    borderBottom: '1px solid var(--color-structure-border)',
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  brandIconWrapper: {
    backgroundColor: 'var(--color-primary-subtle)',
    border: '1px solid var(--color-primary-border)',
    padding: '0.65rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    margin: 0,
    color: 'var(--color-structure-text)',
    letterSpacing: '-0.02em',
  },
  headerSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--color-structure-muted)',
    margin: '0.15rem 0 0 0',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navMobileControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  mobileMenuToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-structure-border)',
    color: 'var(--color-structure-text)',
    cursor: 'pointer',
  },
  mobileDrawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-overlay)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  mobileDrawerContent: {
    width: 'min(85vw, 320px)',
    height: '100%',
    backgroundColor: 'var(--color-structure)',
    borderLeft: '1px solid var(--color-structure-border)',
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    overflowY: 'auto',
  },
  mobileUserBox: {
    backgroundColor: 'var(--color-structure-hover)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-structure-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  mobileUserIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent)',
  },
  mobileUserName: {
    fontWeight: '600',
    color: 'var(--color-structure-text)',
    fontSize: '0.875rem',
  },
  mobileUserEmail: {
    fontSize: '0.75rem',
    color: 'var(--color-structure-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  mobileNavGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  mobileNavBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-structure-muted)',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: '44px',
  },
  mobileNavBtnActive: {
    backgroundColor: 'var(--color-structure-hover)',
    color: 'var(--color-accent)',
  },
  mobileLogoutWrapper: {
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid var(--color-structure-border)',
  },
  mobileLogoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger)',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  userProfilePill: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-structure-hover)',
    padding: '0.45rem 0.9rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--color-structure-border)',
    fontSize: '0.85rem',
  },
  userName: {
    fontWeight: '600',
    color: 'var(--color-structure-text)',
    marginRight: '0.5rem',
  },
  roleBadge: {
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent-hover)',
    border: '1px solid var(--color-accent-border)',
    fontSize: '0.7rem',
    fontWeight: '800',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-sm)',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-jetbrains)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    backgroundColor: 'var(--color-structure-hover)',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-structure-border)',
    padding: '0.45rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '38px',
  },
  tabNav: {
    display: 'flex',
    backgroundColor: 'var(--color-structure)',
    borderBottom: '1px solid var(--color-structure-border)',
    padding: '0 1.5rem',
    gap: '0.75rem',
    overflowX: 'auto',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'transparent',
    color: 'var(--color-structure-muted)',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '0.85rem 0.75rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease-in-out',
  },
  tabBtnActive: {
    color: 'var(--color-accent)',
    borderBottomColor: 'var(--color-accent)',
  },
  main: {
    padding: '1.75rem 1.25rem',
    maxWidth: '1360px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-success-subtle)',
    border: '1px solid var(--color-success-border)',
    color: 'var(--color-success)',
    padding: '0.85rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-danger-subtle)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger)',
    padding: '0.85rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  alertDismissBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '0.2rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '1.25rem',
  },
  statCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: 'var(--shadow-sm)',
  },
  statIconBoxTotal: {
    backgroundColor: 'var(--color-accent-subtle)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-accent)',
  },
  statIconBoxSuccess: {
    backgroundColor: 'var(--color-success-subtle)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-success)',
  },
  statIconBoxDenied: {
    backgroundColor: 'var(--color-warning-subtle)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-warning)',
  },
  statIconBoxFail: {
    backgroundColor: 'var(--color-danger-subtle)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-danger)',
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--color-text-primary)',
    marginTop: '0.2rem',
    fontFamily: 'var(--font-ibm-plex)',
    fontVariantNumeric: 'tabular-nums',
  },
  filterCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    alignItems: 'flex-end',
    boxShadow: 'var(--shadow-sm)',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: '1 1 180px',
  },
  filterLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
  },
  filterActions: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  textInput: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.55rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    outline: 'none',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  selectInput: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.55rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    outline: 'none',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  dateInput: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    outline: 'none',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.55rem 1.1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  createUserBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    color: '#ffffff',
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '44px',
  },
  tableCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  tableHeaderBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--color-border)',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  tableTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    margin: 0,
    color: 'var(--color-text-primary)',
  },
  tableSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    margin: '0.2rem 0 0 0',
  },
  recordsCountBadge: {
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '0.25rem 0.65rem',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--color-border)',
    fontFamily: 'var(--font-ibm-plex)',
  },
  tableResponsive: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  table: {
    width: '100%',
    minWidth: '700px',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHeadRow: {
    backgroundColor: 'var(--color-surface-subtle)',
    borderBottom: '1px solid var(--color-border)',
  },
  th: {
    padding: '0.85rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tableRow: {
    borderBottom: '1px solid var(--color-border-subtle)',
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '1rem 1.25rem',
    fontSize: '0.85rem',
    color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  },
  tdMono: {
    padding: '1rem 1.25rem',
    fontSize: '0.825rem',
    fontFamily: 'var(--font-jetbrains)',
    color: 'var(--color-text-secondary)',
    verticalAlign: 'middle',
  },
  tdTime: {
    padding: '1rem 1.25rem',
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    fontFamily: 'var(--font-ibm-plex)',
  },
  userNameBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  userNameText: {
    fontWeight: '600',
    color: 'var(--color-text-primary)',
  },
  selfPill: {
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '0.1rem 0.4rem',
    borderRadius: 'var(--radius-sm)',
  },
  rolePill: {
    fontSize: '0.725rem',
    fontWeight: '700',
    padding: '0.2rem 0.55rem',
    borderRadius: 'var(--radius-sm)',
    display: 'inline-block',
    letterSpacing: '0.03em',
    fontFamily: 'var(--font-jetbrains)',
  },
  statusActivePill: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-success-subtle)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success-border)',
    fontSize: '0.725rem',
    fontWeight: '700',
    padding: '0.2rem 0.55rem',
    borderRadius: 'var(--radius-sm)',
  },
  statusInactivePill: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-danger-subtle)',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-danger-border)',
    fontSize: '0.725rem',
    fontWeight: '700',
    padding: '0.2rem 0.55rem',
    borderRadius: 'var(--radius-sm)',
  },
  rowActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.4rem',
  },
  actionIconBtn: {
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    padding: '0.45rem',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    minHeight: '32px',
  },
  tdSummary: {
    padding: '1rem 1.25rem',
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    maxWidth: '300px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
  },
  tdAction: {
    padding: '1rem 1.25rem',
    verticalAlign: 'middle',
  },
  actionPill: {
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-accent)',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '700',
    border: '1px solid var(--color-accent-border)',
    display: 'inline-block',
    fontFamily: 'var(--font-jetbrains)',
  },
  outcomePill: {
    padding: '0.2rem 0.55rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.725rem',
    fontWeight: '700',
    display: 'inline-block',
    letterSpacing: '0.03em',
    fontFamily: 'var(--font-jetbrains)',
  },
  actorBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  actorName: {
    fontWeight: '600',
    color: 'var(--color-text-primary)',
  },
  actorEmail: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-jetbrains)',
  },
  resourceBadge: {
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-text-secondary)',
    padding: '0.15rem 0.45rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.725rem',
    fontWeight: '600',
    border: '1px solid var(--color-border)',
  },
  resourceIdMono: {
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-jetbrains)',
    marginLeft: '0.2rem',
  },
  detailBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface-subtle)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-primary)',
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.775rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '32px',
  },
  paginationBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-subtle)',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  paginationInfo: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-ibm-plex)',
  },
  paginationBtns: {
    display: 'flex',
    gap: '0.5rem',
  },
  pageBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.4rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    minHeight: '36px',
  },
  loadingContainer: {
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  loadingText: {
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
    margin: 0,
  },
  emptyContainer: {
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  emptyText: {
    color: 'var(--color-text-muted)',
    fontSize: '0.85rem',
    margin: 0,
    maxWidth: '400px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-overlay)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--color-border)',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-xl)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-subtle)',
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    margin: 0,
    color: 'var(--color-text-primary)',
  },
  modalCloseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  modalBody: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: '1rem',
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.85rem',
  },
  modalFieldLabel: {
    fontSize: '0.725rem',
    fontWeight: '600',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  modalFieldValue: {
    color: 'var(--color-text-primary)',
    fontWeight: '500',
  },
  modalMono: {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: '0.785rem',
    color: 'var(--color-text-secondary)',
    wordBreak: 'break-all',
  },
  modalSummaryBox: {
    backgroundColor: 'var(--color-surface-subtle)',
    padding: '0.85rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  modalSummaryText: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    lineHeight: 1.4,
  },
  modalDetailsBox: {
    backgroundColor: 'var(--color-surface-subtle)',
    padding: '0.85rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  modalJson: {
    margin: 0,
    fontSize: '0.75rem',
    fontFamily: 'var(--font-jetbrains)',
    color: 'var(--color-structure)',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-subtle)',
    flexWrap: 'wrap',
  },
  modalDismissBtn: {
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minHeight: '40px',
  },
  modalSubmitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '0.55rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minHeight: '40px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  formLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--color-text-secondary)',
  },
  formHint: {
    fontSize: '0.725rem',
    color: 'var(--color-text-muted)',
    margin: '0.2rem 0 0 0',
  },
  modalInput: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.6rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    outline: 'none',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  modalSelect: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    padding: '0.6rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    outline: 'none',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  warningAlert: {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'center',
    backgroundColor: 'var(--color-warning-subtle)',
    border: '1px solid var(--color-warning-border)',
    color: 'var(--color-warning)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
  },
};
