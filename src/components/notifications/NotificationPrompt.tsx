import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

export const NotificationPrompt: React.FC = () => {
  const { permission, requestPermission } = useNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed or granted permission
    const hasDismissed = localStorage.getItem('notificationPromptDismissed');

    if (!hasDismissed && permission === 'default') {
      // Show prompt after 3 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [permission]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('notificationPromptDismissed', 'true');
  };

  if (!showPrompt || dismissed || permission !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Bell className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Stay updated with Kommyut
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Get notified about route updates, service alerts, and important announcements.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnableNotifications}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Enable Notifications
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
