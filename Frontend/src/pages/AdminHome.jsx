import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import auditLogService from '../services/auditLogService';
import adminService from '../services/adminService';

export default function AdminHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active top tab: 'users' or 'audit'
  const [activeTab, setActiveTab] = useState('users');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [userActionError, setUserActionError] = useState(null);
  const [userActionSuccess, setUserActionSuccess] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'TEACHER',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

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

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.brandIconWrapper}>
            <ShieldAlert size={26} color="var(--color-primary)" />
          </div>
          <div>
            <h1 style={styles.headerTitle}>ExamGuard Administration</h1>
            <p style={styles.headerSubtitle}>
              Enterprise Security Oversight, User Administration & Cryptographic Audit
            </p>
          </div>
        </div>

        {/* Desktop Profile Section */}
        <div className="nav-desktop" style={styles.headerRight}>
          <div style={styles.userProfilePill}>
            <User size={16} color="var(--color-accent)" style={{ marginRight: '0.4rem' }} />
            <span style={styles.userName}>{user?.name || 'Administrator'}</span>
            <span style={styles.roleBadge}>ADMIN</span>
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn} title="Sign Out">
            <LogOut size={16} style={{ marginRight: '0.4rem' }} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Mobile Navigation Controls */}
        <div className="nav-mobile-controls" style={styles.navMobileControls}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={styles.mobileMenuToggle}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={styles.mobileDrawer}>
          <div style={styles.mobileDrawerContent}>
            <div style={styles.mobileUserBox}>
              <div style={styles.mobileUserIcon}>
                <User size={18} color="var(--color-accent)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.mobileUserName}>
                  {user?.name || 'Administrator'}
                </div>
                <div style={styles.mobileUserEmail}>
                  {user?.email}
                </div>
              </div>
              <span style={styles.roleBadge}>ADMIN</span>
            </div>

            <div style={styles.mobileNavGroup}>
              <button
                onClick={() => {
                  setActiveTab('users');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.mobileNavBtn,
                  ...(activeTab === 'users' ? styles.mobileNavBtnActive : {}),
                }}
              >
                <Users size={18} />
                <span>User Management</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('audit');
                  setMobileMenuOpen(false);
                }}
                style={{
                  ...styles.mobileNavBtn,
                  ...(activeTab === 'audit' ? styles.mobileNavBtnActive : {}),
                }}
              >
                <Activity size={18} />
                <span>Security Audit Logs</span>
              </button>
            </div>

            <div style={styles.mobileLogoutWrapper}>
              <button onClick={handleLogout} style={styles.mobileLogoutBtn}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <nav style={styles.tabNav}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'users' ? styles.tabBtnActive : {}),
          }}
        >
          <Users size={18} style={{ marginRight: '0.5rem' }} />
          <span>User Management</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'audit' ? styles.tabBtnActive : {}),
          }}
        >
          <Activity size={18} style={{ marginRight: '0.5rem' }} />
          <span>Security Audit Logs</span>
        </button>
      </nav>

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
                              {u.isActive ? (
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
        {/* TAB 2: AUDIT LOGS (Module 13 preserved in full)                */}
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
