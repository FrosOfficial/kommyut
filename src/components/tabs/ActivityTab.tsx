// my-app/src/components/tabs/ActivityTab.tsx

import React, { useState, useEffect } from 'react';
import {
  Navigation, BarChart3, TrendingUp, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getActiveTrip, getUserTripStats, getDailyTripHistory, endTrip } from '../../services/api';

// Type definitions
interface TripHistoryItem {
  date: string;
  trips: number;
  distance: string;
  saved: string;
}

interface TripData {
  id: number;
  from_location: string;
  to_location: string;
  transit_type: string;
  route_name: string;
  distance_km: number;
  fare_paid: number;
  money_saved: number;
  points_earned: number;
  start_time: string;
  end_time?: string;
  status: string;
}

interface TripStats {
  total_trips: number;
  total_distance: number;
  total_saved: number;
  total_points: number;
  completed_trips: number;
}

interface ActivityTabProps {}

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
const ActivityTab: React.FC<ActivityTabProps> = () => {
  const { currentUser } = useAuth();
  const [activeTrip, setActiveTrip] = useState<TripData | null>(null);
  const [tripStats, setTripStats] = useState<TripStats>({
    total_trips: 0,
    total_distance: 0,
    total_saved: 0,
    total_points: 0,
    completed_trips: 0
  });
  const [tripHistory, setTripHistory] = useState<TripHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTrip, setCompletingTrip] = useState(false);

  const handleCompleteTrip = async () => {
    if (!activeTrip || !currentUser) return;

    setCompletingTrip(true);
    try {
      await endTrip(activeTrip.id);

      // Show success notification
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 z-50';
      successDiv.innerHTML = `
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl shadow-2xl p-6 max-w-md">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold mb-1">🎉 Trip Completed!</h3>
              <p class="text-sm text-white text-opacity-90 mb-2">You've earned ${activeTrip.points_earned || 0} points for this commute!</p>
              <div class="flex items-center space-x-2 text-xs text-white text-opacity-75">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Saved ₱${Number(activeTrip.money_saved || 0).toFixed(2)}</span>
              </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white text-opacity-75 hover:text-opacity-100 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(successDiv);

      setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => successDiv.remove(), 300);
      }, 5000);

      // Refresh data
      setActiveTrip(null);
      const [statsData, dailyHistory] = await Promise.all([
        getUserTripStats(currentUser.uid, 'week'),
        getDailyTripHistory(currentUser.uid, 7)
      ]);
      setTripStats(statsData);
      const formattedHistory = dailyHistory.map((day: any) => ({
        date: new Date(day.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        trips: parseInt(day.trips),
        distance: `${Math.round(day.distance)} km`,
        saved: `₱${Math.round(day.saved)}`
      }));
      setTripHistory(formattedHistory);
    } catch (error) {
      console.error('Error completing trip:', error);
      alert('Failed to complete trip. Please try again.');
    } finally {
      setCompletingTrip(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Fetch active trip
        const activeTripData = await getActiveTrip(currentUser.uid);
        setActiveTrip(activeTripData);

        // Fetch trip stats
        const statsData = await getUserTripStats(currentUser.uid, 'week');
        setTripStats(statsData);

        // Fetch daily trip history
        const dailyHistory = await getDailyTripHistory(currentUser.uid, 7);
        const formattedHistory = dailyHistory.map((day: any) => ({
          date: new Date(day.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          trips: parseInt(day.trips),
          distance: `${Math.round(day.distance)} km`,
          saved: `₱${Math.round(day.saved)}`
        }));
        setTripHistory(formattedHistory);
      } catch (error) {
        console.error('Error fetching trip data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4 transition-colors"></div>
            <div className="space-y-3">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded transition-colors"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 transition-colors"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Trip Section */}
      {activeTrip && (
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
                <p className="font-medium">En route to {activeTrip.to_location}</p>
                <p className="text-sm opacity-90">Via {activeTrip.route_name || activeTrip.transit_type}</p>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span>Started: {new Date(activeTrip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Distance: {activeTrip.distance_km} km</span>
            </div>
            <div className="bg-white/20 rounded-lg h-2 overflow-hidden mb-4">
              <div className="bg-white h-full w-3/4 transition-all" />
            </div>
            <button
              onClick={handleCompleteTrip}
              disabled={completingTrip}
              className="w-full bg-white text-gray-900 font-semibold py-3 rounded-xl transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {completingTrip ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Complete Trip</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Trip History Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors">Trip History</h3>
        <div className="space-y-3">
          {tripHistory.length > 0 ? (
            tripHistory.map((day, i) => (
              <div 
                key={i} 
                className="border-l-4 pl-4 py-2" 
                style={{ borderColor: theme.primary }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white transition-colors">{day.date}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{day.trips} trips • {day.distance}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-600 font-semibold">{day.saved}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">saved</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 transition-colors">
              <p>No trip history yet</p>
              <p className="text-sm">Start your first trip to see your activity here!</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Stats Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 transition-colors">Weekly Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div
            className="text-center p-4 rounded-xl transition-colors"
            style={{ backgroundColor: `${theme.primary}10` }}
          >
            <BarChart3 className="h-8 w-8 mx-auto mb-2" color={theme.primary} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">{tripStats.total_trips}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Total Trips</p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900 dark:bg-opacity-30 rounded-xl transition-colors">
            <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2 transition-colors" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">₱{Math.round(tripStats.total_saved)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Total Saved</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityTab;