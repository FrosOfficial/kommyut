// my-app/src/components/tabs/ProfileTab.tsx

import React from 'react';
import { 
  User, Award, BarChart3, Wallet, Star, Zap, Bell, Globe, Shield, 
  Info, ChevronRight 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Type definitions
interface Achievement {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  desc: string;
}

interface Setting {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}


interface ProfileTabProps {
  userPoints: number;
}

// Theme colors based on logo
const theme = {
  primary: '#2B5F88',
  primaryDark: '#1E4463',
  primaryLight: '#3B7FB8',
  secondary: '#4A90C2',
  accent: '#5BA3D5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

// ==================== PROFILE TAB ====================
const ProfileTab: React.FC<ProfileTabProps> = ({ userPoints }) => {
  const { currentUser } = useAuth();

  const settings: Setting[] = [
    { icon: Info, label: 'About', value: 'v2.0.1' }
  ];

  return (
    <div className="space-y-4">
      {/* User Profile Header */}
      <div className="rounded-2xl p-6 text-white"
           style={{background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`}}>
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt={currentUser.displayName || 'Profile'} 
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <User className="h-10 w-10" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              {currentUser ? (currentUser.displayName || currentUser.email) : 'Guest User'}
            </h2>
            <p className="text-blue-100">Commuter Level: Bronze</p>
            <div className="flex items-center space-x-2 mt-2">
              <Award className="h-5 w-5 text-yellow-300" />
              <span className="font-semibold">{userPoints} Points</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commute Stats */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Commute Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${theme.primary}10` }}>
            <BarChart3 className="h-8 w-8 mx-auto mb-2" color={theme.primary} />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-600">Trips this month</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <Wallet className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">₱0</p>
            <p className="text-sm text-gray-600">Money saved</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Settings</h3>
        <div className="space-y-3">
          {settings.map((setting, i) => (
            <button 
              key={i} 
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all"
            >
              <div className="flex items-center space-x-3">
                <setting.icon className="h-5 w-5" style={{ color: theme.primary }} />
                <span className="font-medium text-gray-900">{setting.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">{setting.value}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;