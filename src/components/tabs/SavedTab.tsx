import React, { useState, useEffect } from 'react';
import {
  MapPin, ChevronRight, Heart, Star, Trash2, Edit2, Play, Clock,
  TrendingUp, Sparkles, Bookmark, Navigation2, Plus, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSavedRoutes, deleteSavedRoute, updateSavedRoute, incrementRouteUsage } from '../../services/api';

// Theme colors
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

interface SavedRoute {
  id: number;
  name: string;
  from_stop_id: string;
  from_stop_name: string;
  to_stop_id: string;
  to_stop_name: string;
  route_id?: string;
  route_name?: string;
  transit_type?: string;
  times_used: number;
  last_used?: string;
  created_at: string;
}

interface SavedTabProps {
  onRouteSelect?: (from: string, to: string) => void;
}

const SavedTab: React.FC<SavedTabProps> = ({ onRouteSelect }) => {
  const { currentUser } = useAuth();
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadSavedRoutes();
  }, [currentUser]);

  const loadSavedRoutes = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const routes = await getSavedRoutes(currentUser.uid);
      setSavedRoutes(routes);
    } catch (error) {
      console.error('Error loading saved routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseRoute = async (route: SavedRoute) => {
    try {
      await incrementRouteUsage(route.id);
      loadSavedRoutes(); // Refresh to show updated usage count

      // Notify parent component to switch to Routes tab and fill in the search
      if (onRouteSelect) {
        onRouteSelect(route.from_stop_name, route.to_stop_name);
      }

      // Show success toast
      showToast('Route loaded! Check the Routes tab.', 'success');
    } catch (error) {
      console.error('Error using route:', error);
      showToast('Failed to use route', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteSavedRoute(id);
      setSavedRoutes(savedRoutes.filter(r => r.id !== id));
      showToast('Route deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting route:', error);
      showToast('Failed to delete route', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartEdit = (route: SavedRoute) => {
    setEditingId(route.id);
    setEditName(route.name);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      showToast('Route name cannot be empty', 'error');
      return;
    }

    try {
      await updateSavedRoute(id, { name: editName });
      setSavedRoutes(savedRoutes.map(r =>
        r.id === id ? { ...r, name: editName } : r
      ));
      setEditingId(null);
      showToast('Route renamed successfully', 'success');
    } catch (error) {
      console.error('Error updating route:', error);
      showToast('Failed to rename route', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 z-50 animate-slide-in';
    const bgColor = type === 'success' ? 'from-green-500 to-emerald-600' : 'from-red-500 to-red-600';
    toast.innerHTML = `
      <div class="bg-gradient-to-r ${bgColor} text-white rounded-xl shadow-2xl px-6 py-4 flex items-center space-x-3">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-opacity-75">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const getMostUsedRoutes = () => {
    return [...savedRoutes].sort((a, b) => b.times_used - a.times_used).slice(0, 3);
  };

  const getRecentRoutes = () => {
    return [...savedRoutes]
      .filter(r => r.last_used)
      .sort((a, b) => new Date(b.last_used!).getTime() - new Date(a.last_used!).getTime())
      .slice(0, 3);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 transition-colors"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl transition-colors"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center transition-colors">
        <Bookmark className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 transition-colors" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Sign In to Save Routes</h3>
        <p className="text-gray-600 dark:text-gray-400 transition-colors">
          Log in to save your favorite routes and access them quickly anytime!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card with Stats */}
      <div
        className="rounded-3xl shadow-xl p-6 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)` }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Bookmark className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Saved Routes</h2>
                <p className="text-sm text-blue-100">Quick access to your favorites</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{savedRoutes.length}</p>
              <p className="text-xs text-blue-100">Total Saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Most Used Routes */}
      {getMostUsedRoutes().length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5" style={{ color: theme.primary }} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">Most Used</h3>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="space-y-3">
            {getMostUsedRoutes().map((route) => (
              <div
                key={route.id}
                className="group relative bg-gradient-to-r from-blue-50 dark:from-gray-700 to-white dark:to-gray-800 border border-blue-100 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {editingId === route.id ? (
                      <div className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(route.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 mb-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <p className="font-semibold text-gray-900 dark:text-white transition-colors">{route.name}</p>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                      <MapPin className="h-3 w-3 text-green-600" />
                      <span>{route.from_stop_name}</span>
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                      <MapPin className="h-3 w-3 text-red-600" />
                      <span>{route.to_stop_name}</span>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400 transition-colors">
                      {route.transit_type && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                          {route.transit_type}
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>Used {route.times_used} times</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleUseRoute(route)}
                      className="p-2 rounded-lg transition-all text-white"
                      style={{ backgroundColor: theme.primary }}
                      title="Use this route"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(route)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
                      title="Rename route"
                    >
                      <Edit2 className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors" />
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      disabled={deletingId === route.id}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                      title="Delete route"
                    >
                      {deletingId === route.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Used Routes */}
      {getRecentRoutes().length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="h-5 w-5" style={{ color: theme.primary }} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">Recently Used</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {getRecentRoutes().map((route) => (
              <div
                key={route.id}
                onClick={() => handleUseRoute(route)}
                className="group p-4 bg-gradient-to-br from-gray-50 dark:from-gray-700 to-white dark:to-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <Navigation2 className="h-5 w-5 text-blue-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                    {new Date(route.last_used!).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate transition-colors">{route.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate transition-colors">
                  {route.from_stop_name} → {route.to_stop_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Saved Routes */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">All Saved Routes</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">{savedRoutes.length} routes</span>
        </div>

        {savedRoutes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
              <Heart className="h-10 w-10 text-gray-300 dark:text-gray-600 transition-colors" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors">No Saved Routes Yet</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4 transition-colors">
              Start saving your favorite routes for quick access!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">
              Look for the <Heart className="h-4 w-4 inline" /> icon when viewing routes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedRoutes.map((route) => (
              <div
                key={route.id}
                className="group border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {editingId === route.id ? (
                      <div className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(route.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="font-semibold text-gray-900 dark:text-white mb-2 transition-colors">{route.name}</p>
                    )}
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-2 transition-colors">
                      <MapPin className="h-3 w-3 text-green-600" />
                      <span className="truncate">{route.from_stop_name}</span>
                      <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <MapPin className="h-3 w-3 text-red-600 flex-shrink-0" />
                      <span className="truncate">{route.to_stop_name}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 transition-colors">
                      {route.route_name && (
                        <span className="truncate">{route.route_name}</span>
                      )}
                      <span>• Used {route.times_used} times</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleUseRoute(route)}
                      className="p-2 rounded-lg transition-all text-white"
                      style={{ backgroundColor: theme.primary }}
                      title="Use this route"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(route)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
                      title="Rename route"
                    >
                      <Edit2 className="h-4 w-4 text-gray-600 dark:text-gray-400 transition-colors" />
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      disabled={deletingId === route.id}
                      className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                      title="Delete route"
                    >
                      {deletingId === route.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedTab;
