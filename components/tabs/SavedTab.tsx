import React, { useState, useEffect } from 'react';
import { Bookmark, Heart, MapPin, Trash2, Navigation, Loader2, Map, PlayCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import LoginPrompt from '../common/LoginPrompt';
import RouteMap from '../map/RouteMap';

interface SavedRoute {
  id: number;
  user_uid: string;
  name: string;
  from_stop_id: string;
  from_stop_name: string;
  from_stop_lat?: string;
  from_stop_lon?: string;
  to_stop_id: string;
  to_stop_name: string;
  to_stop_lat?: string;
  to_stop_lon?: string;
  route_id: string;
  route_name: string;
  transit_type: string;
  created_at: string;
}

const SavedTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedMaps, setExpandedMaps] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadSavedRoutes();
  }, [currentUser]);

  // Listen for route saved events to auto-refresh
  useEffect(() => {
    const handleRouteSaved = () => {
      loadSavedRoutes();
    };

    window.addEventListener('routeSaved', handleRouteSaved);
    return () => window.removeEventListener('routeSaved', handleRouteSaved);
  }, [currentUser]);

  const loadSavedRoutes = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const routes = await api.getSavedRoutes(currentUser.uid);

      // Fetch stop coordinates for each route
      const routesWithCoords = await Promise.all(
        routes.map(async (route: SavedRoute) => {
          try {
            const [fromStops, toStops] = await Promise.all([
              api.getAllStops().then(stops => stops.filter((s: any) => s.stop_id === route.from_stop_id)),
              api.getAllStops().then(stops => stops.filter((s: any) => s.stop_id === route.to_stop_id))
            ]);

            return {
              ...route,
              from_stop_lat: fromStops[0]?.stop_lat || '0',
              from_stop_lon: fromStops[0]?.stop_lon || '0',
              to_stop_lat: toStops[0]?.stop_lat || '0',
              to_stop_lon: toStops[0]?.stop_lon || '0'
            };
          } catch (err) {
            console.error('Error fetching stop coords:', err);
            return route;
          }
        })
      );

      setSavedRoutes(routesWithCoords);
    } catch (error) {
      console.error('Error loading saved routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!confirm('Are you sure you want to delete this saved route?')) {
      return;
    }

    try {
      setDeletingId(routeId);
      await api.deleteSavedRoute(routeId);
      // Remove from local state
      setSavedRoutes(savedRoutes.filter(route => route.id !== routeId));
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Failed to delete route');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleMapExpanded = (index: number) => {
    setExpandedMaps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleStartJourney = (route: SavedRoute) => {
    // Switch to Routes tab first
    const routesTabButton = document.querySelector('[data-tab="routes"]') as HTMLButtonElement;
    if (routesTabButton) {
      routesTabButton.click();
    }

    // Dispatch event with route data after a short delay to ensure tab switch completes
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('startSavedJourney', {
        detail: {
          from: route.from_stop_name,
          to: route.to_stop_name,
          fromStopId: route.from_stop_id,
          toStopId: route.to_stop_id,
          routeId: route.route_id,
          routeName: route.route_name,
          transitType: route.transit_type
        }
      }));
    }, 150);
  };

  if (!currentUser) {
    return (
      <LoginPrompt
        icon={Bookmark}
        title="Saved Routes"
        description="Quick access to your favorite routes"
        gradientFrom="from-purple-500"
        gradientTo="to-pink-600"
        onLoginClick={() => {
          document.querySelector<HTMLButtonElement>('[data-login-button]')?.click();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Bookmark className="h-8 w-8 animate-bounce" />
              <h2 className="text-2xl font-bold">Saved Routes</h2>
            </div>
            <p className="text-purple-100">Quick access to your favorites</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold animate-pulse-slow">{savedRoutes.length}</div>
            <div className="text-sm text-purple-100">Total Saved</div>
          </div>
        </div>
      </div>

      {/* All Saved Routes Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          All Saved Routes
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            {savedRoutes.length} routes
          </span>
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">Loading saved routes...</p>
            </div>
          </div>
        ) : savedRoutes.length === 0 ? (
          <div className="text-center py-12 animate-fadeIn">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-slow">
              <Heart className="h-10 w-10 text-purple-600 dark:text-purple-400 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              No Saved Routes Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Start saving your favorite routes for quick access!
              <br />
              Look for the <Heart className="inline h-4 w-4" /> icon when viewing routes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedRoutes.map((route, index) => (
              <div
                key={route.id}
                className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all duration-300 hover:scale-[1.02] bg-gradient-to-r from-purple-50 dark:from-gray-700 to-white dark:to-gray-800 animate-fadeIn"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Bookmark className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        {route.name}
                      </h4>
                    </div>

                    <div className="space-y-2">
                      {/* Route Info */}
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {route.from_stop_name}
                          </span>
                        </div>
                        <span className="text-gray-400">→</span>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-red-600" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {route.to_stop_name}
                          </span>
                        </div>
                      </div>

                      {/* Transit Info */}
                      {route.route_name && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Navigation className="h-4 w-4 text-blue-600" />
                          <span className="text-gray-600 dark:text-gray-400">
                            {route.route_name}
                          </span>
                          {route.transit_type && (
                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                              {route.transit_type}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Saved Date */}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Saved {new Date(route.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => handleStartJourney(route)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      title="Start journey with this route"
                    >
                      <PlayCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => toggleMapExpanded(index)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="View map"
                    >
                      <Map className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      disabled={deletingId === route.id}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete saved route"
                    >
                      {deletingId === route.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable map section */}
                {expandedMaps.has(index) && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <RouteMap
                      routeId={route.route_id}
                      originStop={{
                        stop_id: route.from_stop_id,
                        stop_name: route.from_stop_name,
                        stop_lat: route.from_stop_lat || '0',
                        stop_lon: route.from_stop_lon || '0'
                      }}
                      destinationStop={{
                        stop_id: route.to_stop_id,
                        stop_name: route.to_stop_name,
                        stop_lat: route.to_stop_lat || '0',
                        stop_lon: route.to_stop_lon || '0'
                      }}
                      routeName={route.route_name}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedTab;
