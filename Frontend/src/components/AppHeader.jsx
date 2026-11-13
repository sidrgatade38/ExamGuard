import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  BookOpen,
  Layers,
  LogOut,
  User,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

/**
 * AppHeader — Unified, Modern Academic Navigation System
 * Shared across TEACHER, ADMIN, and EXAM_COORDINATOR roles.
 * 
 * Features:
 * - Clean, compact white/neutral surface (60-64px height)
 * - ExamGuard primary blue branding with Computer Engineering department badge
 * - Role-specific navigation tabs directly integrated on desktop
 * - Integrated Algorithm Flow action button
 * - Clean user profile pill & sign out controls
 * - Fully responsive slide-out drawer on mobile & tablet viewports (< 1024px)
 */
export default function AppHeader({
  user,
  role,
  activeTab,
  onTabChange,
  tabs = [],
  onOpenAlgorithmFlow,
  onLogout,
  profileData,
  extraRightAction,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const roleDisplay = (role || user?.role || 'FACULTY').toUpperCase();
  const userName = user?.name || (role === 'ADMIN' ? 'Administrator' : role === 'EXAM_COORDINATOR' ? 'Exam Coordinator' : 'Faculty Member');
  const userSubtext = profileData?.designation
    ? `COMP. ENGG • ${profileData.designation}`
    : role === 'ADMIN'
    ? 'COMP DEPT • System Administrator'
    : role === 'EXAM_COORDINATOR'
    ? 'COMP DEPT • Examination Cell'
    : 'COMP. ENGG • Department Faculty';

  return (
    <>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          {/* 1. Left: Brand & Department Identification */}
          <div style={styles.brandWrapper}>
            <div style={styles.brandIconSquircle}>
              <ShieldCheck size={20} color="#2563eb" strokeWidth={2.2} />
            </div>
            <div style={styles.brandTextGroup}>
              <div style={styles.brandTitleRow}>
                <span style={styles.brandTitle}>ExamGuard</span>
                <span style={styles.deptBadge}>COMPUTER ENGG</span>
              </div>
              <span style={styles.brandTagline}>Secure Question Paper Management System</span>
            </div>
          </div>

          {/* 2. Center: Role-Specific Navigation (Desktop >= 1024px) */}
          <nav className="header-nav-desktop" style={styles.desktopNav}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isAction = !!tab.isPrimary;

              if (isAction) {
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={styles.primaryActionTab}
                    title={tab.tooltip || tab.label}
                  >
                    {Icon && <Icon size={15} strokeWidth={2} />}
                    <span>{tab.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  style={{
                    ...styles.navTab,
                    ...(isActive ? styles.navTabActive : {}),
                  }}
                  title={tab.tooltip || tab.label}
                >
                  {Icon && (
                    <Icon
                      size={15}
                      color={isActive ? '#2563eb' : '#64748b'}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                  )}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge !== null && tab.badge !== 0 && (
                    <span
                      style={{
                        ...styles.tabBadge,
                        backgroundColor: isActive
                          ? '#2563eb'
                          : tab.badgeColor || '#e2e8f0',
                        color: isActive
                          ? '#ffffff'
                          : tab.badgeColor ? '#ffffff' : '#334155',
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* 3. Right: Quick Actions, Profile & Sign Out (Desktop >= 1024px) */}
          <div className="header-actions-desktop" style={styles.desktopActions}>
            {/* Algorithm Flow Entry Point */}
            {onOpenAlgorithmFlow && (
              <button
                type="button"
                onClick={onOpenAlgorithmFlow}
                style={styles.algorithmFlowBtn}
                title="Inspect Cryptographic Security Architecture & Algorithm Flow"
              >
                <Layers size={14} color="#0284c7" />
                <span>Algorithm Flow</span>
              </button>
            )}

            {extraRightAction}

            {/* Profile Information Pill */}
            <div
              style={styles.profilePill}
              onClick={() => {
                if (role === 'TEACHER') onTabChange('profile');
              }}
              title={`Signed in as ${userName} (${roleDisplay})`}
            >
              <div style={styles.profileAvatar}>
                <User size={14} color="#ffffff" />
              </div>
              <div style={styles.profileMeta}>
                <span style={styles.profileName}>{userName}</span>
                <span style={styles.profileRoleBadge}>{roleDisplay}</span>
              </div>
            </div>

            {/* Sign Out Action */}
            <button
              type="button"
              onClick={onLogout}
              style={styles.logoutBtn}
              title="Sign Out of ExamGuard"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Mobile Navigation Toggle (< 1024px) */}
          <div className="header-mobile-toggle" style={styles.mobileToggleWrap}>
            {onOpenAlgorithmFlow && (
              <button
                type="button"
                onClick={onOpenAlgorithmFlow}
                style={styles.algorithmFlowBtnMobile}
                title="Algorithm Flow"
              >
                <Layers size={14} color="#0284c7" />
                <span>Flow</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={styles.hamburgerBtn}
              aria-label="Toggle navigation drawer"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} color="#0f172a" /> : <Menu size={20} color="#0f172a" />}
            </button>
          </div>
        </div>
      </header>

      {/* 4. Mobile Slide-Out Drawer (< 1024px) */}
      {mobileMenuOpen && (
        <div style={styles.drawerBackdrop} onClick={() => setMobileMenuOpen(false)}>
          <div
            style={styles.drawerContainer}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={styles.drawerHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={styles.brandIconSquircleSmall}>
                  <ShieldCheck size={16} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    ExamGuard
                  </div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>
                    COMP. ENGINEERING
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                style={styles.drawerCloseBtn}
                aria-label="Close menu"
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            {/* Drawer User Card */}
            <div style={styles.drawerUserCard}>
              <div style={styles.drawerAvatar}>
                <User size={18} color="#ffffff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <span style={styles.profileRoleBadge}>{roleDisplay}</span>
                </div>
              </div>
            </div>

            {/* Drawer Navigation Links */}
            <div style={styles.drawerNavList}>
              <div style={styles.drawerSectionLabel}>NAVIGATION</div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isAction = !!tab.isPrimary;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      ...styles.drawerNavItem,
                      ...(isActive ? styles.drawerNavItemActive : {}),
                      ...(isAction ? styles.drawerNavItemAction : {}),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {Icon && (
                        <Icon
                          size={18}
                          color={isAction ? '#ffffff' : isActive ? '#2563eb' : '#64748b'}
                          strokeWidth={isActive || isAction ? 2.2 : 1.8}
                        />
                      )}
                      <span>{tab.label}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {tab.badge !== undefined && tab.badge !== null && tab.badge !== 0 && (
                        <span
                          style={{
                            ...styles.tabBadge,
                            backgroundColor: isAction
                              ? '#ffffff'
                              : isActive
                              ? '#2563eb'
                              : '#e2e8f0',
                            color: isAction
                              ? '#2563eb'
                              : isActive
                              ? '#ffffff'
                              : '#334155',
                          }}
                        >
                          {tab.badge}
                        </span>
                      )}
                      {!isAction && <ChevronRight size={14} color="#94a3b8" />}
                    </div>
                  </button>
                );
              })}

              {/* Algorithm Flow Button in Mobile Menu */}
              {onOpenAlgorithmFlow && (
                <>
                  <div style={{ ...styles.drawerSectionLabel, marginTop: '14px' }}>SECURITY &amp; AUDIT</div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAlgorithmFlow();
                      setMobileMenuOpen(false);
                    }}
                    style={styles.drawerFlowBtn}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Layers size={18} color="#0284c7" />
                      <span>Algorithm Flow Diagram</span>
                    </div>
                    <ChevronRight size={14} color="#94a3b8" />
                  </button>
                </>
              )}
            </div>

            {/* Drawer Footer: Sign Out */}
            <div style={styles.drawerFooter}>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                style={styles.drawerLogoutBtn}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    width: '100%',
  },
  headerInner: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 1.25rem',
    height: '62px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },

  // 1. Brand
  brandWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  brandIconSquircle: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px 0 rgba(37, 99, 235, 0.1)',
  },
  brandIconSquircleSmall: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.2,
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  brandTitle: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  deptBadge: {
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    border: '1px solid #bfdbfe',
    padding: '1px 6px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
  brandTagline: {
    fontSize: '0.68rem',
    color: '#64748b',
    fontWeight: 500,
  },

  // 2. Desktop Navigation
  desktopNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
    justifyContent: 'center',
  },
  navTab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.45rem 0.85rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#475569',
    fontSize: '0.84rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  },
  navTabActive: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 600,
  },
  primaryActionTab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.45rem 0.95rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 2px 0 rgba(37, 99, 235, 0.2)',
  },
  tabBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 5px',
    borderRadius: '9999px',
    fontSize: '0.68rem',
    fontWeight: 700,
    lineHeight: 1,
  },

  // 3. Desktop Actions
  desktopActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  algorithmFlowBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.4rem 0.8rem',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#0369a1',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  algorithmFlowBtnMobile: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0.35rem 0.65rem',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '6px',
    fontSize: '0.74rem',
    fontWeight: 600,
    color: '#0369a1',
    cursor: 'pointer',
  },
  profilePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0.3rem 0.75rem',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  profileAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  profileName: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#1e293b',
    maxWidth: '140px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileRoleBadge: {
    fontSize: '0.625rem',
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: '#e2e8f0',
    color: '#334155',
    letterSpacing: '0.04em',
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0.4rem 0.75rem',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 500,
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  // 4. Mobile Toggle
  mobileToggleWrap: {
    display: 'none',
    alignItems: 'center',
    gap: '8px',
  },
  hamburgerBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  // 5. Mobile Drawer
  drawerBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(3px)',
    zIndex: 999,
    display: 'flex',
    justifyContent: 'flex-end',
    animation: 'drawerFadeIn 0.2s ease',
  },
  drawerContainer: {
    width: 'min(85vw, 320px)',
    height: '100%',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  drawerHeader: {
    padding: '1rem',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerUserCard: {
    padding: '1rem',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  drawerAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drawerNavList: {
    padding: '1rem 0.75rem',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  drawerSectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '0.05em',
    padding: '0 0.5rem 0.35rem 0.5rem',
  },
  drawerNavItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0.85rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#334155',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    width: '100%',
  },
  drawerNavItemActive: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 600,
  },
  drawerNavItemAction: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
  },
  drawerFlowBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0.85rem',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    fontSize: '0.84rem',
    fontWeight: 600,
    color: '#0369a1',
    cursor: 'pointer',
    width: '100%',
  },
  drawerFooter: {
    padding: '1rem',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  drawerLogoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '0.65rem',
    backgroundColor: '#ffffff',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
