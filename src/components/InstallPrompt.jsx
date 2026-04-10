import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { pushAPI, notificationAPI } from '../services/api';
import './InstallPrompt.css';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function InstallPrompt() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications(user);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // In-app notifications
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    if (!user?.companyId) return;
    try {
      const { data } = await notificationAPI.getByCompany(user.companyId);
      setNotifications(data);
    } catch {
      // silent — bell still works without notifications
    }
  }, [user?.companyId]);

  // Poll notifications every 60 s
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsPwaInstalled(true);
    }
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsPwaInstalled(true); setShowInstallBanner(false); setDeferredPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setShowInstallBanner(false); setDeferredPrompt(null); }
  };

  const handleTestNotification = async () => {
    setTestSending(true);
    try {
      await pushAPI.send({ userId: user.id, title: 'FlyerBox Test', body: 'Push notifications are working!', url: '/' });
    } catch (err) {
      console.error('Test notification failed:', err);
      alert('Failed to send test notification.');
    } finally {
      setTestSending(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    if (!user?.companyId) return;
    try {
      await notificationAPI.markAllRead(user.companyId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  if (!user) return null;

  return (
    <>
      {/* Install banner */}
      {showInstallBanner && !isPwaInstalled && (
        <div className="install-banner">
          <div className="install-banner-content">
            <img src="/flyer-logo.png" alt="FlyerBox" className="install-banner-icon" />
            <div className="install-banner-text">
              <strong>Add FlyerBox to your home screen</strong>
              <span>Install the app for quick access</span>
            </div>
          </div>
          <div className="install-banner-actions">
            <button className="install-btn-primary" onClick={handleInstall}>Install</button>
            <button className="install-btn-dismiss" onClick={() => setShowInstallBanner(false)}>&#x2715;</button>
          </div>
        </div>
      )}

      {/* Notification bell */}
      <div className="notif-bell-wrapper">
        <button
          className={`notif-bell-btn ${isSubscribed ? 'notif-active' : ''}`}
          onClick={() => { setShowNotifPanel((p) => !p); if (!showNotifPanel) fetchNotifications(); }}
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        {showNotifPanel && (
          <div className="notif-panel">
            {/* Header */}
            <div className="notif-panel-header">
              <p className="notif-panel-title">Notifications</p>
              {unreadCount > 0 && (
                <button className="notif-mark-all" onClick={handleMarkAllRead}>Mark all read</button>
              )}
            </div>

            {/* Notification list */}
            <div className="notif-list">
              {notifications.length === 0 ? (
                <p className="notif-empty">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.isRead ? '' : 'notif-unread'}`}
                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                  >
                    <div className="notif-item-dot">{!n.isRead && <span />}</div>
                    <div className="notif-item-content">
                      <p className="notif-item-title">{n.title}</p>
                      <p className="notif-item-body">{n.body}</p>
                      <p className="notif-item-time">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Push settings footer */}
            <div className="notif-panel-footer">
              {isSupported && (
                <>
                  {isSubscribed ? (
                    <div className="notif-footer-actions">
                      <button className="notif-toggle-btn notif-test" onClick={handleTestNotification} disabled={testSending}>
                        {testSending ? 'Sending...' : 'Test push'}
                      </button>
                      <button className="notif-toggle-btn notif-off" onClick={unsubscribe} disabled={isLoading}>
                        {isLoading ? 'Turning off...' : 'Disable push'}
                      </button>
                    </div>
                  ) : (
                    <button className="notif-toggle-btn notif-on" onClick={subscribe} disabled={isLoading}>
                      {isLoading ? 'Enabling...' : 'Enable push notifications'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
