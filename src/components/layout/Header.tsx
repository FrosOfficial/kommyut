import React, { useState, useEffect } from 'react';
import { Bell, WifiOff, Wifi, AlertCircle, Star, LogOut } from 'lucide-react';
import { KommyutLogo } from '../ui/KommyutLogo';
import { theme } from '../../theme';
import LoginModal from '../auth/LoginModal';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';

interface HeaderProps {
  isOfflineMode: boolean;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  created_at: string;
}

const Header: React.FC<HeaderProps> = ({
  isOfflineMode,
  showNotifications,
  setShowNotifications
}) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const { currentUser } = useAuth();

  // Check for new notifications periodically
  useEffect(() => {
    checkForNewNotifications();

    // Check every 30 seconds
    const interval = setInterval(checkForNewNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
      markNotificationsAsRead();
    }
  }, [showNotifications]);

  const checkForNewNotifications = async () => {
    try {
      const response = await fetch('/.netlify/functions/push-notifications/all');
      if (response.ok) {
        const data = await response.json();
        const latestNotifications = data.notifications || [];

        if (latestNotifications.length > 0) {
          const lastViewedTime = localStorage.getItem('lastNotificationViewTime');
          const latestNotifTime = new Date(latestNotifications[0].created_at).getTime();

          if (!lastViewedTime || latestNotifTime > parseInt(lastViewedTime)) {
            setHasUnread(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  };

  const markNotificationsAsRead = () => {
    localStorage.setItem('lastNotificationViewTime', Date.now().toString());
    setHasUnread(false);
  };

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const response = await fetch('/.netlify/functions/push-notifications/all');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Reload the page to clear all user data and reset the app state
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <KommyutLogo className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-bold dark:text-white" style={{ color: theme.primary }}>Kommyut</h1>
              <div className="flex items-center space-x-1">
                {isOfflineMode ? (
                  <WifiOff className="h-3 w-3 text-red-500" />
                ) : (
                  <Wifi className="h-3 w-3 text-green-500" />
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isOfflineMode ? 'Offline' : 'Connected'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative transition-colors"
            >
              <Bell className="h-5 w-5 dark:text-white" style={{ color: theme.primary }} />
              {hasUnread && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 animate-pulse"></span>
              )}
            </button>

            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 py-2 px-3 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-semibold">{((currentUser as any).customDisplayName || currentUser.displayName || currentUser.email)?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-white">{(currentUser as any).customDisplayName || currentUser.displayName || currentUser.email}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Signed in</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5 dark:text-white" style={{ color: theme.primary }} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                data-login-button
                className="px-4 py-2 text-white font-semibold rounded-lg hover:opacity-90 transition-all flex items-center space-x-2"
                style={{ backgroundColor: theme.primary }}
              >
                <span>Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute right-4 top-16 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 z-50 transition-colors max-h-[500px] overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Notifications</h3>

              {loadingNotifications ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  <p className="text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white mb-1">
                        {notif.title}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {notif.message}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(notif.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Check back later for updates</p>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        theme={theme}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-slideUp transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <LogOut className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
                Log Out
              </h2>

              {/* Description */}
              <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to log out? Your recent searches and activity will be saved for when you return.
              </p>

              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutModal(false);
                    handleSignOut();
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;