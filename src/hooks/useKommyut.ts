// my-app/src/hooks/useKommyut.ts

import { useState, useRef } from 'react';
import type { RecentSearch, LiveActivity, Route } from '../types';
import type { SavedRoute, PopularRoute } from '../types';


export const useKommyut = () => {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [activeTab, setActiveTab] = useState('routes');
  const [selectedMode, setSelectedMode] = useState<string | null>(null); // Properly typed
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]); // Fixed: using SavedRoute[] instead of Route[]
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [routePreference, setRoutePreference] = useState('balanced');
  const [userPoints, setUserPoints] = useState(1250);
  const [currentTrip, setCurrentTrip] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null); // Fixed: removed | null

  const handleSearch = () => {
    if (fromLocation && toLocation) {
      setIsSearching(true);
      
      const newSearch: RecentSearch = {
        from: fromLocation,
        to: toLocation,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setRecentSearches(prev => [newSearch, ...prev.slice(0, 4)]);
      
      setTimeout(() => {
        setIsSearching(false);
      }, 2000);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return {
    // State
    fromLocation,
    setFromLocation,
    toLocation,
    setToLocation,
    isOfflineMode,
    setIsOfflineMode,
    activeTab,
    setActiveTab,
    selectedMode,
    setSelectedMode,
    isSearching,
    setIsSearching,
    showFilters,
    setShowFilters,
    showNotifications,
    setShowNotifications,
    savedRoutes,
    setSavedRoutes,
    recentSearches,
    setRecentSearches,
    routePreference,
    setRoutePreference,
    userPoints,
    setUserPoints,
    currentTrip,
    setCurrentTrip,
    
    // Refs
    searchInputRef,
    
    // Functions
    handleSearch,
    handleTabChange,
  };
};