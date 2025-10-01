// my-app/src/components/layout/BottomNav.tsx

import React from 'react';
import { Navigation, Heart, Activity, User } from 'lucide-react';
import { theme } from '../../theme';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'routes', label: 'Routes', icon: Navigation },
    { id: 'saved', label: 'Saved', icon: Heart },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center space-y-1 py-2 px-4 transition-all ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{
              backgroundColor: activeTab === tab.id ? theme.primary : 'transparent',
              borderRadius: activeTab === tab.id ? '12px' : '0',
            }}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;