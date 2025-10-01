// my-app/src/types/index.ts

export interface TrafficIndicatorProps {
  level: 0 | 1 | 2 | 3;
}

export interface CrowdLevelProps {
  level: number;
}

export interface Route {
  from: string;
  to: string;
  fare: string;
  time: string;
  rating: string;
  traffic: 'light' | 'moderate' | 'heavy';
  crowdLevel: number;
  mode: string;
  alternatives: string;
}

export interface RecentSearch {
  from: string;
  to: string;
  time: string;
}

export interface LiveActivity {
  user: string;
  action: string;
  rating?: string;
  time: string;
}

// Additional interfaces needed for your app
export interface PopularRoute {
  from: string;
  to: string;
  fare: string;
  time: string;
  rating: string;
  traffic: 'light' | 'moderate' | 'heavy';
  crowdLevel: number;
  mode: string;
  alternatives: string;
}

export interface SavedRoute {
  id: number;
  name: string;
  from: string;
  to: string;
  icon: any; // You might want to be more specific about the icon type
  used: number;
}

export interface TripHistory {
  date: string;
  trips: number;
  distance: string;
  saved: string;
}

export interface Achievement {
  icon: any;
  label: string;
  desc: string;
}

export interface Setting {
  icon: any;
  label: string;
  value: string;
}

// Tab component props interfaces
export interface RoutesTabProps {
  fromLocation: string;
  setFromLocation: (value: string) => void;
  toLocation: string;
  setToLocation: (value: string) => void;
  handleSearch: () => void;
  isSearching: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;  // Add | null here
  recentSearches: RecentSearch[];
  setRecentSearches: (searches: RecentSearch[]) => void;
  liveActivities: LiveActivity[];
  routePreference: string;
  setRoutePreference: (preference: string) => void;
  popularRoutes: PopularRoute[];
}

export interface SavedTabProps {
  savedRoutes: SavedRoute[];
}

export interface ActivityTabProps {
  currentTrip: boolean;
}

export interface ProfileTabProps {
  userPoints: number;
}