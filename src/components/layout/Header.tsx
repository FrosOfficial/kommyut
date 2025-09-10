// my-app/src/components/layout/Header.tsx

import React from 'react';
import { Bell, Menu, WifiOff, Wifi, AlertCircle, Star } from 'lucide-react';
import { KommyutLogo } from '../ui/KommyutLogo';
import { theme } from '../../theme';

interface HeaderProps {
  isOfflineMode: boolean;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isOfflineMode, 
  showNotifications, 
  setShowNotifications 
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <KommyutLogo className="w-10 h-10" />
          <div>
            <h1 className="text-xl font-bold" style={{ color: theme.primary }}>Kommyut</h1>
            <div className="flex items-center space-x-1">
              {isOfflineMode ? (
                <WifiOff className="h-3 w-3 text-red-500" />
              ) : (
                <Wifi className="h-3 w-3 text-green-500" />
              )}
              <span className="text-xs text-gray-500">
                {isOfflineMode ? 'Offline' : 'Connected'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-gray-100 rounded-lg relative"
          >
            <Bell className="h-5 w-5" style={{ color: theme.primary }} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu className="h-5 w-5" style={{ color: theme.primary }} />
          </button>
        </div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="absolute right-4 top-16 w-80 bg-white rounded-xl shadow-lg border z-50">
          <div className="p-4">
            <h3 className="font-semibold mb-3">Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Route Update</p>
                  <p className="text-xs text-gray-600">MRT Line 3 experiencing delays</p>
                  <span className="text-xs text-blue-600">5 min ago</span>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                <Star className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Achievement Unlocked!</p>
                  <p className="text-xs text-gray-600">You've completed 50 trips this month</p>
                  <span className="text-xs text-gray-500">1 hour ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;