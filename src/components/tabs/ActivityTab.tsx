import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, MapPin, CheckCircle, Clock, Loader2, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import LoginPrompt from '../common/LoginPrompt';

interface Trip {
  id: number;
  user_uid: string;
  from_location: string;
  to_location: string;
  route_name: string;
  transit_type: string;
  distance_km: number;
  fare_paid: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

interface TripStats {
  total_trips: number;
  total_distance: number;
  total_spent: number;
}

const ActivityTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<TripStats>({ total_trips: 0, total_distance: 0, total_spent: 0 });
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);

  useEffect(() => {
    loadTrips(true); // Show loading on initial load

    // Auto-refresh trips every 5 seconds to show new active trips
    const intervalId = setInterval(() => {
      if (currentUser) {
        loadTrips(false); // Don't show loading spinner on auto-refresh
      }
    }, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [currentUser]);

  const loadTrips = async (showLoading = false) => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      const [active, completed, tripStats] = await Promise.all([
        api.getActiveTrips(currentUser.uid),
        api.getCompletedTrips(currentUser.uid),
        api.getTripStats(currentUser.uid)
      ]);

      setActiveTrips(active);
      setCompletedTrips(completed);
      setStats(tripStats);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleCompleteTrip = async (tripId: number) => {
    try {
      setCompletingId(tripId);
      await api.completeTrip(tripId);
      // Reload trips to update UI
      await loadTrips();
    } catch (error) {
      console.error('Error completing trip:', error);
      alert('Failed to complete trip');
    } finally {
      setCompletingId(null);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!currentUser) {
    return (
      <LoginPrompt
        icon={Activity}
        title="Activity"
        description="Track your journey and earn rewards"
        gradientFrom="from-blue-500"
        gradientTo="to-purple-600"
        onLoginClick={() => {
          document.querySelector<HTMLButtonElement>('[data-login-button]')?.click();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div className="flex items-center space-x-3 mb-2">
          <Activity className="h-8 w-8 animate-bounce" />
          <h2 className="text-2xl font-bold">Activity</h2>
        </div>
        <p className="text-blue-100">Your commute activity and insights</p>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center transition-colors">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading activity...</p>
        </div>
      ) : (
        <>
          {/* Weekly Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
              Weekly Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Total Trips */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center transition-all hover:scale-105 cursor-default">
                <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white animate-pulse-slow">
                  {stats.total_trips || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Trips</div>
              </div>

              {/* Total Spent - Removed money saved */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center transition-all hover:scale-105 cursor-default">
                <div className="text-2xl mb-2">₱</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white animate-pulse-slow">
                  {stats.total_spent ? parseFloat(stats.total_spent.toString()).toFixed(0) : 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Spent</div>
              </div>
            </div>
          </div>

          {/* Active Trips */}
          {activeTrips.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors animate-fadeIn" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Active Trips
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                  {activeTrips.length} ongoing
                </span>
              </h3>

              <div className="space-y-3">
                {activeTrips.map((trip, index) => (
                  <div
                    key={trip.id}
                    className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20 animate-fadeIn hover:shadow-lg transition-all duration-300"
                    style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            In Progress
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Started at {formatTime(trip.started_at)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {/* Route */}
                          <div className="flex items-center space-x-2 text-sm">
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-green-600" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {trip.from_location}
                              </span>
                            </div>
                            <span className="text-gray-400">→</span>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-red-600" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {trip.to_location}
                              </span>
                            </div>
                          </div>

                          {/* Trip Details */}
                          {trip.route_name && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                              <span>{trip.route_name}</span>
                              {trip.transit_type && (
                                <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                                  {trip.transit_type}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Fare */}
                          {trip.fare_paid && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Fare: ₱{parseFloat(trip.fare_paid.toString()).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Complete Button */}
                      <button
                        onClick={() => handleCompleteTrip(trip.id)}
                        disabled={completingId === trip.id}
                        className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center space-x-2"
                      >
                        {completingId === trip.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Completing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            <span>Complete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trip History */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Trip History
            </h3>

            {completedTrips.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  {activeTrips.length > 0
                    ? 'No trip history yet'
                    : 'Start your first trip to see your activity here!'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Look for the "Start Journey" button when viewing routes
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Started: {formatTime(trip.started_at)} • Completed: {formatTime(trip.completed_at!)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {/* Route */}
                          <div className="flex items-center space-x-2 text-sm">
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-green-600" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {trip.from_location}
                              </span>
                            </div>
                            <span className="text-gray-400">→</span>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-red-600" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {trip.to_location}
                              </span>
                            </div>
                          </div>

                          {/* Trip Details */}
                          <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                            {trip.route_name && <span>{trip.route_name}</span>}
                            {trip.transit_type && (
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                                {trip.transit_type}
                              </span>
                            )}
                            {trip.fare_paid && (
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                ₱{parseFloat(trip.fare_paid.toString()).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityTab;
