import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Clock, Calendar, AlertCircle, FileText, X } from 'lucide-react';
import notificationService from '../services/notificationService';

export default function NotificationBell({ onSelectPaper }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeNotice, setActiveNotice] = useState(null);

  const dropdownRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.unreadCount || res.count || 0);
    } catch (err) {
      console.warn('[NotificationBell] Failed to fetch unread count:', err.message);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await notificationService.getNotifications();
      setNotifications(list);
      const unread = list.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    setActiveNotice(null);
  };

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, status: 'READ' } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('[NotificationBell] Mark read error:', err.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, status: 'READ' }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationBell] Mark all read error:', err.message);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }

    if (notif.questionPaper) {
      const qp = notif.questionPaper;
      const today = new Date().toISOString().split('T')[0];
      const deliveryDate = qp.scheduledDeliveryDate;

      if (deliveryDate && today < deliveryDate) {
        setActiveNotice({
          paperTitle: qp.title,
          deliveryDate,
          message: `Question paper is scheduled for delivery on ${deliveryDate} and is not accessible yet.`,
        });
        return;
      }

      if (onSelectPaper && typeof onSelectPaper === 'function') {
        onSelectPaper(qp);
        setIsOpen(false);
      }
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: isOpen ? 'var(--color-structure-hover)' : 'transparent',
          border: '1px solid var(--color-structure-border)',
          color: isOpen ? 'var(--color-primary)' : 'var(--color-structure-muted)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-danger)',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: '700',
              fontFamily: 'var(--font-ibm-plex)',
              boxShadow: '0 0 0 2px var(--color-structure)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(92vw, 360px)',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-structure)',
            border: '1px solid var(--color-structure-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-structure-hover)',
              borderBottom: '1px solid var(--color-structure-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-structure-text)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    fontFamily: 'var(--font-ibm-plex)',
                    padding: '0.1rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-primary-subtle)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-primary-border)',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            {notifications.some((n) => !n.isRead) && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Delivery Schedule Alert Modal inside Dropdown */}
          {activeNotice && (
            <div
              style={{
                margin: '0.75rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-warning-subtle)',
                border: '1px solid var(--color-warning-border)',
                color: 'var(--color-warning-text)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <AlertCircle size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--color-warning)' }}>Delivery Scheduled</div>
                  <div style={{ marginTop: '2px', lineHeight: '1.4' }}>{activeNotice.message}</div>
                </div>
              </div>
              <button
                onClick={() => setActiveNotice(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                aria-label="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Notification List */}
          <div
            className="custom-scrollbar"
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-structure-muted)' }}>
                Loading notifications...
              </div>
            ) : error ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-structure-muted)' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
                    backgroundColor: !notif.isRead ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {!notif.isRead && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <h4
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: 'var(--color-structure-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          margin: 0,
                        }}
                      >
                        {notif.subject || 'Question Paper Notification'}
                      </h4>
                    </div>
                    <p
                      style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--color-structure-muted)',
                        lineHeight: '1.4',
                      }}
                    >
                      {notif.message}
                    </p>

                    {/* Question Paper details if present */}
                    {notif.questionPaper && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid var(--color-structure-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--color-structure-text)' }}>
                          <FileText size={12} color="var(--color-accent)" />
                          <span style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {notif.questionPaper.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-structure-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={11} />
                            <span className="font-numerical">{notif.questionPaper.scheduledDeliveryDate}</span>
                          </span>
                          <span
                            style={{
                              padding: '0.1rem 0.4rem',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              backgroundColor: notif.questionPaper.isDeliverable ? 'var(--color-success-subtle)' : 'var(--color-warning-subtle)',
                              color: notif.questionPaper.isDeliverable ? 'var(--color-success)' : 'var(--color-warning)',
                              border: `1px solid ${notif.questionPaper.isDeliverable ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
                            }}
                          >
                            {notif.questionPaper.isDeliverable ? 'Available' : 'Scheduled'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--color-structure-muted)' }}>
                      <Clock size={11} />
                      <span className="font-numerical">{formatTimestamp(notif.createdAt)}</span>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-structure-muted)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        borderRadius: 'var(--radius-xs)',
                      }}
                      title="Mark as read"
                      aria-label="Mark notification as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
