// my-app/src/components/tabs/ActivityTab.tsx

import React from 'react';
import { 
  Navigation, BarChart3, TrendingUp 
} from 'lucide-react';

// Type definitions
interface TripHistoryItem {
  date: string;
  trips: number;
  distance: string;
  saved: string;
}

interface ActivityTabProps {
  currentTrip: boolean;
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

// ==================== ACTIVITY TAB ====================
const ActivityTab: React.FC<ActivityTabProps> = ({ currentTrip }) => {
  const tripHistory: TripHistoryItem[] = [
    { date: 'Today', trips: 3, distance: '45 km', saved: '₱120' },
    { date: 'Yesterday', trips: 5, distance: '62 km', saved: '₱180' },
    { date: 'Dec 8', trips: 2, distance: '28 km', saved: '₱75' }
  ];

  return (
    <div className="space-y-4">
      {/* Current Trip Section */}
      {currentTrip && (
        <div 
          className="text-white rounded-2xl shadow-lg p-5"
          style={{background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`}}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Current Trip</h3>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm">Active</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Navigation className="h-5 w-5" />
              <div>
                <p className="font-medium">En route to Makati CBD</p>
                <p className="text-sm opacity-90">Via MRT Line 3</p>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span>Started: 8:45 AM</span>
              <span>ETA: 9:30 AM</span>
            </div>
            <div className="bg-white/20 rounded-lg h-2 overflow-hidden">
              <div className="bg-white h-full w-3/4 transition-all" />
            </div>
          </div>
        </div>
      )}

      {/* Trip History Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Trip History</h3>
        <div className="space-y-3">
          {tripHistory.map((day, i) => (
            <div 
              key={i} 
              className="border-l-4 pl-4 py-2" 
              style={{ borderColor: theme.primary }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{day.date}</p>
                  <p className="text-sm text-gray-600">{day.trips} trips • {day.distance}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-600 font-semibold">{day.saved}</p>
                  <p className="text-xs text-gray-500">saved</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Stats Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Weekly Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div 
            className="text-center p-4 rounded-xl" 
            style={{ backgroundColor: `${theme.primary}10` }}
          >
            <BarChart3 className="h-8 w-8 mx-auto mb-2" color={theme.primary} />
            <p className="text-2xl font-bold">24</p>
            <p className="text-sm text-gray-600">Total Trips</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold">₱850</p>
            <p className="text-sm text-gray-600">Total Saved</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityTab;