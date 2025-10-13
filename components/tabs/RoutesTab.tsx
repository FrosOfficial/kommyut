import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Loader2, Clock, ArrowRight, Star, Wallet, TrendingUp,
  Filter, ChevronRight, Sparkles, Award, Users, MapPin,
  AlertCircle, DollarSign, X, Navigation, Bookmark, Map
} from 'lucide-react';
import * as api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import RouteMap from '../map/RouteMap';
import { startTrip } from '../../services/api';

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

// Types
interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  city?: string;
}

interface GTFSRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
}

interface GTFSTrip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string;
  direction_id: string;
}

interface GTFSStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
}

interface RouteResult {
  summary: string;
  routeName: string;
  mode: string;
  fare: {
    regular: string;
    discounted?: string;
  };
  distance: string;
  origin: GTFSStop;
  destination: GTFSStop;
  routeType: number;
  routeId: string;
}

interface RecentSearch {
  id?: number;
  from: string;
  to: string;
  time: string;
  from_stop_id?: string;
  to_stop_id?: string;
}

interface PopularRoute {
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

interface TrafficIndicatorProps {
  level: number;
}

interface CrowdLevelProps {
  level: number;
}

// Utility Components
const TrafficIndicator: React.FC<TrafficIndicatorProps> = ({ level }) => {
  const colors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
  const safeLevel = Math.max(0, Math.min(level, colors.length - 1));

  return (
    <div className="flex space-x-1">
      {colors.map((color, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full transition-colors ${
            i <= safeLevel ? color : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
};

const CrowdLevel: React.FC<CrowdLevelProps> = ({ level }) => {
  const maxIcons = 5;
  const safeLevel = Math.max(0, Math.min(level, maxIcons));

  return (
    <div className="flex space-x-0.5">
      {Array.from({ length: maxIcons }).map((_, i) => (
        <Users
          key={i}
          className="h-3 w-3"
          style={{ color: i < safeLevel ? theme.primary : '#D1D5DB' }}
        />
      ))}
    </div>
  );
};

interface RoutesTabProps {
  initialFrom?: string;
  initialTo?: string;
}

const RoutesTab: React.FC<RoutesTabProps> = ({ initialFrom, initialTo }) => {
  const { currentUser } = useAuth();

  // Existing state
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [routeResults, setRouteResults] = useState<RouteResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  // Removed route preference feature
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([
  ]);
  
  // New GTFS state
  const [gtfsData, setGtfsData] = useState<{
    stops: GTFSStop[];
    routes: GTFSRoute[];
    trips: GTFSTrip[];
    stopTimes: GTFSStopTime[];
    loaded: boolean;
    error: string | null;
  }>({
    stops: [],
    routes: [],
    trips: [],
    stopTimes: [],
    loaded: false,
    error: null
  });
  
  const [fareData, setFareData] = useState<any>({
    pubTables: [],
    pujTable: [],
    maxDistances: []
  });
  const [fromSuggestions, setFromSuggestions] = useState<GTFSStop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<GTFSStop[]>([]);
  const [fromAddressSuggestions, setFromAddressSuggestions] = useState<any[]>([]);
  const [toAddressSuggestions, setToAddressSuggestions] = useState<any[]>([]);
  const [selectedFromStop, setSelectedFromStop] = useState<GTFSStop | null>(null);
  const [selectedToStop, setSelectedToStop] = useState<GTFSStop | null>(null);
  const [selectedFromAddress, setSelectedFromAddress] = useState<any | null>(null);
  const [selectedToAddress, setSelectedToAddress] = useState<any | null>(null);
  
  // Trip tracking state
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);

  // Route saving state
  const [savingRouteIndex, setSavingRouteIndex] = useState<number | null>(null);

  // Popular routes state
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[]>([]);
  const [loadingPopularRoutes, setLoadingPopularRoutes] = useState(true);

  // Map visibility state - track which route maps are expanded
  const [expandedMaps, setExpandedMaps] = useState<Set<number>>(new Set());


  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Load GTFS and fare data on component mount
  useEffect(() => {
    loadAllData();
    loadPopularRoutes();
    if (currentUser) {
      loadRecentSearches();
    }
  }, [currentUser]);

  // Listen for saved journey event from SavedTab
  useEffect(() => {
    const handleSavedJourney = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { from, to, fromStopId, toStopId, routeId, routeName, transitType } = customEvent.detail;

      if (!gtfsData.loaded) {
        console.warn('GTFS data not loaded yet');
        return;
      }

      // Find the stops
      const fromStop = gtfsData.stops.find(s => s.stop_id === fromStopId);
      const toStop = gtfsData.stops.find(s => s.stop_id === toStopId);

      if (fromStop && toStop) {
        setFromLocation(from);
        setToLocation(to);
        setSelectedFromStop(fromStop);
        setSelectedToStop(toStop);

        // Show the journey modal
        setTimeout(() => {
          const mockRoute: RouteResult = {
            summary: `${from} → ${to}`,
            routeName: routeName || 'Saved Route',
            mode: transitType || 'PUJ',
            fare: { regular: '₱13', discounted: '₱11' },
            distance: '1.77 km',
            origin: fromStop,
            destination: toStop,
            routeType: 3,
            routeId: routeId || 'unknown'
          };
          setSelectedRoute(mockRoute);
          setShowJourneyModal(true);
        }, 200);
      }
    };

    window.addEventListener('startSavedJourney', handleSavedJourney);
    return () => window.removeEventListener('startSavedJourney', handleSavedJourney);
  }, [gtfsData.loaded, gtfsData.stops]);

  // Load popular routes from trip history
  const loadPopularRoutes = async () => {
    try {
      setLoadingPopularRoutes(true);
      // TODO: Implement getPopularRoutes when trip tracking is added
      const routes: any[] = []; // await api.getPopularRoutes(3);

      // Transform API data to match PopularRoute interface
      const transformedRoutes: PopularRoute[] = routes.map((route: any) => ({
        from: route.from_location,
        to: route.to_location,
        fare: route.avg_fare ? `₱${Math.round(route.avg_fare)}` : 'N/A',
        time: route.avg_duration_minutes
          ? `${Math.round(route.avg_duration_minutes)} min`
          : 'N/A',
        rating: ((route.trip_count / 10) * 5).toFixed(1), // Simple rating based on popularity
        traffic: route.avg_duration_minutes > 45 ? 'heavy' : route.avg_duration_minutes > 30 ? 'moderate' : 'light',
        crowdLevel: Math.min(5, Math.ceil(route.trip_count / 5)),
        mode: route.transit_type || 'Unknown',
        alternatives: route.trip_count.toString()
      }));

      setPopularRoutes(transformedRoutes);
    } catch (error) {
      // Silently fail - popular routes feature not available without trip history
      setPopularRoutes([]);
    } finally {
      setLoadingPopularRoutes(false);
    }
  };

  // Load recent searches from API
  const loadRecentSearches = async () => {
    if (!currentUser) return;

    try {
      const searches = await api.getRecentSearches(currentUser.uid);

      // Transform API data to match RecentSearch interface
      const transformedSearches: RecentSearch[] = searches.map((search: api.RecentSearch) => {
        const searchDate = new Date(search.searched_at);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - searchDate.getTime()) / 60000);

        let timeStr = 'Just now';
        if (diffMinutes < 1) {
          timeStr = 'Just now';
        } else if (diffMinutes < 60) {
          timeStr = `${diffMinutes}m ago`;
        } else if (diffMinutes < 1440) {
          timeStr = `${Math.floor(diffMinutes / 60)}h ago`;
        } else {
          timeStr = `${Math.floor(diffMinutes / 1440)}d ago`;
        }

        return {
          id: search.id,
          from: search.from_location,
          to: search.to_location,
          time: timeStr,
          from_stop_id: search.from_stop_id || undefined,
          to_stop_id: search.to_stop_id || undefined
        };
      });

      setRecentSearches(transformedSearches);
    } catch (error) {
      console.error('Error loading recent searches:', error);
      // Silently fail - don't show error to user
    }
  };

  // Handle initial values from saved routes
  useEffect(() => {
    if (initialFrom) {
      setFromLocation(initialFrom);
      // Try to find matching stop
      const matchingStops = searchStops(initialFrom);
      if (matchingStops.length > 0) {
        setSelectedFromStop(matchingStops[0]);
      }
    }
    if (initialTo) {
      setToLocation(initialTo);
      // Try to find matching stop
      const matchingStops = searchStops(initialTo);
      if (matchingStops.length > 0) {
        setSelectedToStop(matchingStops[0]);
      }
    }
  }, [initialFrom, initialTo, gtfsData.stops]);

  // Load all GTFS and fare data from API
  const loadAllData = async () => {
    try {
      console.log('Loading data from API...');
      
      // Load GTFS data from API - only stops and routes initially
      const [stops, routes] = await Promise.all([
        api.getAllStops(),
        api.getGtfsRoutes()
      ]);
      
      console.log('GTFS Data loaded from API:', { 
        stopsCount: stops.length,
        routesCount: routes.length
      });
      
      // Set initial data without trips and stop_times
      // We'll load schedule data dynamically when searching for routes
      setGtfsData({
        stops,
        routes,
        trips: [], // Will be populated when needed
        stopTimes: [], // Will be populated when needed
        loaded: true,
        error: null
      });
      
      // Load fare tables from API
      const [pubTables, pujTable, maxDistances] = await Promise.all([
        api.getPubFareTables().catch(err => {
          console.warn('Failed to load PUB fare tables:', err);
          return [];
        }),
        api.getPujFareTable().catch(err => {
          console.warn('Failed to load PUJ fare table:', err);
          return [];
        }),
        api.getMaxDistances().catch(err => {
          console.warn('Failed to load max distances:', err);
          return [];
        })
      ]);
      
      console.log('Loaded fare data from API:', {
        pubTablesCount: pubTables.length,
        pujTableCount: pujTable.length,
        maxDistancesCount: maxDistances.length
      });
      
      setFareData({
        pubTables,
        pujTable,
        maxDistances
      });
      
    } catch (error) {
      console.error('Error loading data from API:', error);
      setGtfsData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load data from API',
        loaded: true
      }));
    }
  };

  // Search stops function
  const searchStops = (query: string): GTFSStop[] => {
    if (!query || query.length < 2) return [];
    
    return gtfsData.stops
      .filter(stop => 
        stop.stop_name && 
        stop.stop_name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8);
  };

  // Handle location input changes with BOTH geocoding and stop search
  const handleFromLocationChange = async (value: string) => {
    setFromLocation(value);
    setSelectedFromStop(null);
    setSelectedFromAddress(null);
    setHasSearched(false); // Reset search state when user changes input
    setRouteResults([]); // Clear previous results

    if (value.length >= 3) {
      // Search transit stops
      const stopSuggestions = searchStops(value);
      setFromSuggestions(stopSuggestions);
    } else {
      setFromSuggestions([]);
      setFromAddressSuggestions([]);
    }
  };

  const handleToLocationChange = async (value: string) => {
    setToLocation(value);
    setSelectedToStop(null);
    setSelectedToAddress(null);
    setHasSearched(false); // Reset search state when user changes input
    setRouteResults([]); // Clear previous results

    if (value.length >= 3) {
      // Search transit stops
      const stopSuggestions = searchStops(value);
      setToSuggestions(stopSuggestions);
    } else {
      setToSuggestions([]);
      setToAddressSuggestions([]);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Determine route type description for all transit types
  const getRouteTypeDescription = (routeType: number, routeId?: string): string => {
    // Route type 2 = Rail (LRT/MRT/PNR), Route type 3 = Bus/PUJ
    if (routeType === 2) {
      // Check the route ID to determine which rail system
      if (routeId?.includes('880747')) return 'LRT-1';
      if (routeId?.includes('880801')) return 'LRT-2';
      if (routeId?.includes('880854')) return 'MRT-3';
      if (routeId?.includes('880872')) return 'PNR';
      return 'Rail'; // Generic rail if can't determine
    }
    return 'PUJ'; // Route type 3
  };

  // Calculate distance-based fare using API
  const calculateDistanceFareAPI = async (distance: number, transitType: 'pub' | 'puj'): Promise<{ regular: string; discounted: string }> => {
    try {
      const distanceKm = Math.ceil(distance);
      
      // Ensure we have at least 1km for fare calculation
      const fareDistance = Math.max(1, distanceKm);
      
      if (transitType === 'pub') {
        const fareData = await api.getPubFareByDistance(fareDistance);
        // fareData is an array with aircon and ordinary fares
        const airconFare = fareData.find((f: any) => f.type === 'aircon');
        if (!airconFare) {
          console.warn('No aircon fare data found, using ordinary fare');
          const ordinaryFare = fareData.find((f: any) => f.type === 'ordinary');
          if (!ordinaryFare) {
            return { regular: 'N/A', discounted: 'N/A' };
          }
          return {
            regular: `₱${ordinaryFare.regular_fare}`,
            discounted: `₱${ordinaryFare.discounted_fare}`
          };
        }
        return {
          regular: `₱${airconFare.regular_fare}`,
          discounted: `₱${airconFare.discounted_fare}`
        };
      } else {
        const fareData = await api.getPujFareByDistance(fareDistance);
        return {
          regular: `₱${fareData.regular_fare}`,
          discounted: `₱${fareData.discounted_fare}`
        };
      }
    } catch (error) {
      console.warn(`Fare data not available for ${transitType} (${distance.toFixed(1)}km)`, error);
      return { regular: 'N/A', discounted: 'N/A' };
    }
  };

  // Calculate station-to-station fare using API
  const calculateStationFareAPI = async (originStop: GTFSStop, destinationStop: GTFSStop, transitType: string): Promise<{ regular: string; discounted?: string }> => {
    try {
      // Normalize station names - remove suffix and keep the actual station name
      const normalizeStationName = (name: string): string => {
        let normalized = name
          .replace(/\s+LRT$/i, '')
          .replace(/\s+MRT$/i, '')
          .replace(/\s+PNR$/i, '')
          .replace(/\s+Station$/i, '')
          .trim();

        // For API call, just use the station name as-is (the API will handle matching)
        return normalized;
      };

      const fromStation = normalizeStationName(originStop.stop_name);
      const toStation = normalizeStationName(destinationStop.stop_name);

      console.log(`Fetching ${transitType} fare from "${fromStation}" to "${toStation}"`);
      const fareData = await api.getFare(transitType.toLowerCase(), fromStation, toStation);
      console.log(`Fare data received:`, fareData);

      // Handle different fare structures
      // LRT1 and LRT2 have stored_value_fare and single_journey_fare
      // MRT and PNR have just fare
      if (fareData.stored_value_fare !== undefined) {
        return {
          regular: `₱${fareData.stored_value_fare}`,
          discounted: `₱${fareData.single_journey_fare || fareData.stored_value_fare}`
        };
      } else if (fareData.fare !== undefined) {
        return {
          regular: `₱${fareData.fare}`,
          discounted: `₱${Math.floor(parseFloat(fareData.fare) * 0.8)}`
        };
      } else {
        throw new Error('Invalid fare data structure');
      }
    } catch (error) {
      console.warn(`Fare data not available for ${transitType} from ${originStop.stop_name} to ${destinationStop.stop_name}`, error);
      // Return N/A instead of erroring out
      return { regular: 'N/A', discounted: 'N/A' };
    }
  };

  // Estimate fare based on distance and transport type using API (all transit types)
  const estimateFare = async (distance: number, routeType: number, originStop: GTFSStop, destStop: GTFSStop, routeId?: string) => {
    const estimates = [];

    try {
      // Route type 2 = Rail (LRT/MRT/PNR), Route type 3 = Bus/PUJ
      if (routeType === 2) {
        // Rail routes use station-based fares
        let transitType = 'lrt1'; // default
        let modeName = 'Rail';

        // Determine which rail system based on route ID
        if (routeId?.includes('880747')) {
          transitType = 'lrt1';
          modeName = 'LRT-1';
        } else if (routeId?.includes('880801')) {
          transitType = 'lrt2';
          modeName = 'LRT-2';
        } else if (routeId?.includes('880854')) {
          transitType = 'mrt';
          modeName = 'MRT-3';
        } else if (routeId?.includes('880872')) {
          transitType = 'pnr';
          modeName = 'PNR';
        }

        const railFare = await calculateStationFareAPI(originStop, destStop, transitType);
        estimates.push({
          mode: modeName,
          fare: railFare,
          description: `${modeName} Station-to-Station Fare`,
          routeType: 2
        });
      } else {
        // PUJ routes use distance-based fares
        const pujFare = await calculateDistanceFareAPI(distance, 'puj');
        estimates.push({
          mode: 'PUJ',
          fare: pujFare,
          description: 'Public Utility Jeepney',
          routeType: 3
        });
      }
    } catch (error) {
      console.error('Error estimating fare:', error);
      estimates.push({
        mode: routeType === 2 ? 'Rail' : 'PUJ',
        fare: { regular: 'N/A', discounted: 'N/A' },
        description: 'Unable to calculate fare',
        routeType: routeType
      });
    }

    return estimates;
  };

  // Find route between stops - using fast database query
  const findRoute = async (fromStop: GTFSStop, toStop: GTFSStop): Promise<{
    stops: GTFSStop[],
    route: GTFSRoute,
    trip: GTFSTrip
  }[]> => {
    try {
      console.log('Calling findRoutesBetweenStops API with:', fromStop.stop_id, toStop.stop_id);
      // Use the new fast endpoint that finds all matching routes in one query
      const matchingRoutes = await api.findRoutesBetweenStops(fromStop.stop_id, toStop.stop_id);
      console.log('API response:', matchingRoutes);

      if (!matchingRoutes || matchingRoutes.length === 0) {
        console.warn('No routes found between stops');
        return [];
      }

      // Convert to the expected format
      return matchingRoutes.map((route: any) => ({
        stops: [fromStop, toStop], // Simplified - just show origin and destination
        route: {
          route_id: route.route_id,
          route_short_name: route.route_short_name,
          route_long_name: route.route_long_name,
          route_type: route.route_type.toString(),
          agency_id: route.agency_id
        },
        trip: {
          trip_id: `${route.route_id}_trip`,
          route_id: route.route_id,
          service_id: 'default',
          trip_headsign: route.route_long_name || route.route_short_name,
          direction_id: '0'
        }
      }));
    } catch (error) {
      console.error('Error finding routes:', error);
      throw error; // Re-throw to let the calling function handle it
    }
  };

  // Removed sortByPreference function - routes shown in default order

  // Enhanced search handler using GTFS data and API
  const handleSearch = async () => {
    console.log('Search button clicked', { selectedFromStop, selectedToStop, selectedFromAddress, selectedToAddress });

    // Check if we have either stops or addresses selected
    if ((!selectedFromStop && !selectedFromAddress) || (!selectedToStop && !selectedToAddress)) {
      alert("Please select both origin and destination from the suggestions!");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      let fromStop: GTFSStop | null = selectedFromStop;
      let toStop: GTFSStop | null = selectedToStop;

      // If address was selected instead of stop, find nearest stop
      if (selectedFromAddress && !selectedFromStop) {
        console.log('Finding nearest stop to from-address:', selectedFromAddress.display_name);
        const nearestStops = await api.getNearestStops(
          parseFloat(selectedFromAddress.lat),
          parseFloat(selectedFromAddress.lon),
          1000, // 1km radius
          1
        );
        if (nearestStops.length > 0) {
          fromStop = nearestStops[0];
          console.log('Found nearest from-stop:', fromStop!.stop_name);
        } else {
          alert("No transit stops found near the selected address. Please try a different location.");
          setIsSearching(false);
          return;
        }
      }

      if (selectedToAddress && !selectedToStop) {
        console.log('Finding nearest stop to to-address:', selectedToAddress.display_name);
        const nearestStops = await api.getNearestStops(
          parseFloat(selectedToAddress.lat),
          parseFloat(selectedToAddress.lon),
          1000, // 1km radius
          1
        );
        if (nearestStops.length > 0) {
          toStop = nearestStops[0];
          console.log('Found nearest to-stop:', toStop!.stop_name);
        } else {
          alert("No transit stops found near the selected address. Please try a different location.");
          setIsSearching(false);
          return;
        }
      }

      if (!fromStop || !toStop) {
        alert("Could not find transit stops. Please try again.");
        setIsSearching(false);
        return;
      }

      console.log('Starting search with stops:', fromStop.stop_name, 'to', toStop.stop_name);

      // Save search to database if user is logged in
      if (currentUser) {
        try {
          await api.saveRecentSearch({
            user_uid: currentUser.uid,
            from_location: fromStop.stop_name,
            to_location: toStop.stop_name,
            from_stop_id: fromStop.stop_id,
            to_stop_id: toStop.stop_id
          });
          // Reload recent searches to show the updated list
          await loadRecentSearches();
        } catch (error) {
          console.error('Error saving recent search:', error);
          // Continue with search even if saving fails
        }
      } else {
        // If not logged in, just update local state
        const newSearch: RecentSearch = {
          from: fromStop.stop_name,
          to: toStop.stop_name,
          time: "Just now",
          from_stop_id: fromStop.stop_id,
          to_stop_id: toStop.stop_id
        };
        setRecentSearches(prev => [newSearch, ...prev.slice(0, 4)]);
      }

      console.log('Finding routes between stops...');

      // Find direct routes
      const directRoutes = await findRoute(fromStop, toStop);
      console.log('Direct routes found:', directRoutes.length);

      // Calculate fares for each direct route (in parallel)
      const resultsPromises = directRoutes.map(async (routeInfo) => {
        // Calculate total distance between stops
        let totalDistance = 0;
        for (let i = 0; i < routeInfo.stops.length - 1; i++) {
          const curr = routeInfo.stops[i];
          const next = routeInfo.stops[i + 1];
          totalDistance += calculateDistance(
            parseFloat(curr.stop_lat),
            parseFloat(curr.stop_lon),
            parseFloat(next.stop_lat),
            parseFloat(next.stop_lon)
          );
        }
        
        // Get route type and determine mode
        const routeType = parseInt(routeInfo.route.route_type);
        const mode = getRouteTypeDescription(routeType, routeInfo.route.route_id);
        
        // Calculate fare based on route type using API
        console.log(`Estimating fare for route ${routeInfo.route.route_id}...`);
        const fareEstimates = await estimateFare(
          totalDistance,
          routeType,
          routeInfo.stops[0],
          routeInfo.stops[routeInfo.stops.length - 1],
          routeInfo.route.route_id // Pass route ID to determine rail system
        );
        console.log('Fare estimates:', fareEstimates);

        const fareEstimate = fareEstimates[0] || {
          mode: 'Unknown',
          fare: { regular: 'N/A', discounted: 'N/A' }
        };

        // Create step-by-step summary
        const summary = routeInfo.stops
          .map(stop => stop.stop_name)
          .join(" → ");

        return {
          summary,
          routeName: `${routeInfo.route.route_long_name || routeInfo.route.route_short_name} (${routeInfo.trip.trip_headsign || mode})`,
          mode,
          fare: fareEstimate.fare,
          distance: `${totalDistance.toFixed(2)} km`,
          origin: routeInfo.stops[0],
          destination: routeInfo.stops[routeInfo.stops.length - 1],
          routeType,
          routeId: routeInfo.route.route_id || 'unknown'
        };
      });

      console.log('Waiting for all route calculations...');
      let results = await Promise.all(resultsPromises);
      console.log('Final results:', results);

      // Check if no routes found - don't show alert, just set empty results
      // The UI will handle showing a nice "no routes found" message

      setRouteResults(results);
    } catch (error) {
      console.error("Error during search:", error);
      alert("An error occurred while searching. Please try again. Check the console for details.");
    } finally {
      setIsSearching(false);
    }
  };

  // Trip tracking functions
  const handleRouteSelect = (route: RouteResult) => {
    if (!currentUser) {
      alert("Please log in to start tracking your journey!");
      return;
    }
    setSelectedRoute(route);
    setShowJourneyModal(true);
  };

  const handleStartJourney = async () => {
    if (!selectedRoute || !currentUser) return;
    
    setIsStartingTrip(true);
    try {
      // Calculate distance from route data
      const distance = parseFloat(selectedRoute.distance.replace(' km', ''));
      
      // Calculate money saved (assuming they would have taken a taxi)
      const taxiFare = distance * 12; // Rough estimate: ₱12 per km for taxi
      const publicTransportFare = parseFloat(selectedRoute.fare.regular.replace('₱', ''));
      const moneySaved = Math.max(0, taxiFare - publicTransportFare);

      // Start trip tracking
      const tripData = {
        user_uid: currentUser.uid,
        from_location: selectedRoute.origin.stop_name,
        to_location: selectedRoute.destination.stop_name,
        transit_type: selectedRoute.mode,
        route_name: selectedRoute.routeName,
        distance_km: distance,
        fare_paid: publicTransportFare,
      };
      await startTrip(tripData);

      // Close modal
      setShowJourneyModal(false);

      // Show success notification with visual design
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 z-50 animate-slide-in';
      successDiv.innerHTML = `
        <div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-2xl p-6 max-w-md">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold mb-1">🚀 Journey Started!</h3>
              <p class="text-sm text-white text-opacity-90 mb-2">Your trip is now being tracked. Check the Activity tab to see your progress!</p>
              <div class="flex items-center space-x-2 text-xs text-white text-opacity-75">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
                <span>Earning points for your commute</span>
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

      // Auto remove after 5 seconds
      setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => successDiv.remove(), 300);
      }, 5000);

      setSelectedRoute(null);
      
    } catch (error) {
      console.error('Error starting trip:', error);
      alert("Failed to start journey. Please try again.");
    } finally {
      setIsStartingTrip(false);
    }
  };

  const handleCancelJourney = () => {
    setShowJourneyModal(false);
    setSelectedRoute(null);
  };

  // Handle saving a route
  const handleSaveRoute = async (route: RouteResult, index: number) => {
    if (!currentUser) {
      alert("Please log in to save routes!");
      return;
    }

    setSavingRouteIndex(index);
    try {
      const routeName = prompt("Enter a name for this route:", `${route.origin.stop_name} to ${route.destination.stop_name}`);

      if (!routeName) {
        setSavingRouteIndex(null);
        return;
      }

      await api.saveRoute({
        user_uid: currentUser.uid,
        name: routeName,
        from_stop_id: route.origin.stop_id,
        from_stop_name: route.origin.stop_name,
        to_stop_id: route.destination.stop_id,
        to_stop_name: route.destination.stop_name,
        route_id: route.routeId,
        route_name: route.routeName,
        transit_type: route.mode
      });

      // Dispatch event to notify SavedTab to refresh
      window.dispatchEvent(new CustomEvent('routeSaved'));

      // Show success toast
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 z-50 animate-slide-in';
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
              <h3 class="text-lg font-bold mb-1">📌 Route Saved!</h3>
              <p class="text-sm text-white text-opacity-90">Check the Saved tab to view all your saved routes.</p>
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
      }, 4000);

    } catch (error) {
      console.error('Error saving route:', error);
      alert("Failed to save route. Please try again.");
    } finally {
      setSavingRouteIndex(null);
    }
  };


  // Show loading state while GTFS data loads
  if (!gtfsData.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: theme.primary }} />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 transition-colors">Loading Transit Data...</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 transition-colors">Reading GTFS stops, routes, and fare information</p>
        </div>
      </div>
    );
  }

  // Show error state if data failed to load
  if (gtfsData.error) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 mb-6">
        <div className="flex items-center mb-3">
          <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
          <h3 className="text-lg font-semibold text-red-700">Error Loading Transit Data</h3>
        </div>
        <p className="text-red-600 mb-3">{gtfsData.error}</p>
        <p className="text-sm text-gray-600">
          Make sure the GTFS and fare files are in public/data/ folder, then refresh the page.
        </p>
        <button
          onClick={loadAllData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Main Container with Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 animate-fadeIn">
        {/* Left Column - Search Section */}
        <div className="lg:w-1/2">
          <div className="relative overflow-hidden rounded-3xl shadow-2xl p-6 h-full transition-all duration-500 hover:shadow-3xl"
            style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)` }}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 animate-float" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24 animate-float" style={{ animationDelay: '1s' }} />

            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-white mb-1">Where to today?</h2>
              <p className="text-blue-100 mb-6">Find the smartest route using real transit data</p>

              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute left-4 top-4 z-20">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="From (Search addresses or transit stops...)"
                    value={fromLocation}
                    onChange={(e) => handleFromLocationChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/90 backdrop-blur rounded-2xl focus:outline-none focus:ring-4 focus:ring-white/30 transition-all"
                  />

                  {((fromSuggestions.length > 0 || fromAddressSuggestions.length > 0) && !selectedFromStop && !selectedFromAddress) && (
                    <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto transition-colors">
                      {fromAddressSuggestions.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                            📍 Addresses
                          </div>
                          {fromAddressSuggestions.map((address, idx) => (
                            <button
                              key={`address-${idx}`}
                              onClick={() => {
                                setSelectedFromAddress(address);
                                setFromLocation(address.display_name);
                                setFromAddressSuggestions([]);
                                setFromSuggestions([]);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                            >
                              <div className="font-medium text-gray-800 dark:text-white transition-colors text-sm">{address.display_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                                📍 Address
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {fromSuggestions.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                            🚏 Transit Stops
                          </div>
                          {fromSuggestions.map((stop, idx) => (
                            <button
                              key={`stop-${idx}`}
                              onClick={() => {
                                setSelectedFromStop(stop);
                                setFromLocation(stop.stop_name);
                                setFromSuggestions([]);
                                setFromAddressSuggestions([]);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                            >
                              <div className="font-medium text-gray-800 dark:text-white transition-colors">{stop.stop_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                                🚏 {stop.city || 'Transit Stop'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedFromStop || selectedFromAddress) && (
                    <div className="mt-2 p-2 bg-white/20 rounded-lg text-sm text-white">
                      ✓ Selected: <strong>{selectedFromStop?.stop_name || selectedFromAddress?.display_name}</strong>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-4 z-20">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                  <input
                    type="text"
                    placeholder="To (Search addresses or transit stops...)"
                    value={toLocation}
                    onChange={(e) => handleToLocationChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/90 backdrop-blur rounded-2xl focus:outline-none focus:ring-4 focus:ring-white/30 transition-all"
                  />

                  {((toSuggestions.length > 0 || toAddressSuggestions.length > 0) && !selectedToStop && !selectedToAddress) && (
                    <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto transition-colors">
                      {toAddressSuggestions.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                            📍 Addresses
                          </div>
                          {toAddressSuggestions.map((address, idx) => (
                            <button
                              key={`address-${idx}`}
                              onClick={() => {
                                setSelectedToAddress(address);
                                setToLocation(address.display_name);
                                setToAddressSuggestions([]);
                                setToSuggestions([]);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                            >
                              <div className="font-medium text-gray-800 dark:text-white transition-colors text-sm">{address.display_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                                📍 Address
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {toSuggestions.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                            🚏 Transit Stops
                          </div>
                          {toSuggestions.map((stop, idx) => (
                            <button
                              key={`stop-${idx}`}
                              onClick={() => {
                                setSelectedToStop(stop);
                                setToLocation(stop.stop_name);
                                setToSuggestions([]);
                                setToAddressSuggestions([]);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                            >
                              <div className="font-medium text-gray-800 dark:text-white transition-colors">{stop.stop_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                                🚏 {stop.city || 'Transit Stop'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedToStop || selectedToAddress) && (
                    <div className="mt-2 p-2 bg-white/20 rounded-lg text-sm text-white">
                      ✓ Selected: <strong>{selectedToStop?.stop_name || selectedToAddress?.display_name}</strong>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={isSearching || (!selectedFromStop && !selectedFromAddress) || (!selectedToStop && !selectedToAddress)}
                  className="w-full bg-white font-semibold py-4 rounded-2xl transition-all hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center space-x-2 group"
                  style={{ color: theme.primary }}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Finding best routes...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
                      <span>Search Routes</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column - Available Routes & Fares */}
        <div className="lg:w-1/2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 h-full transition-colors">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center transition-colors">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              Available Routes & Fares
            </h3>

            {routeResults.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {routeResults.map((route, i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-300 hover:scale-[1.02] bg-gradient-to-r from-gray-50 dark:from-gray-700 to-white dark:to-gray-800 animate-fadeIn" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors">Route steps:</div>
                          <div className="space-y-1 mb-3">
                            {route.summary.split(" → ").map((stop, idx, arr) => (
                              <div key={idx} className="flex items-center">
                                <div className="flex items-center space-x-2">
                                  <MapPin
                                    className={`h-3 w-3 ${
                                      idx === 0 ? "text-green-600" :
                                      idx === arr.length - 1 ? "text-red-600" :
                                      "text-gray-400"
                                    }`}
                                  />
                                  <span className={`text-sm ${
                                    idx === 0 || idx === arr.length - 1 ?
                                    "font-semibold text-gray-900 dark:text-white" :
                                    "text-gray-600 dark:text-gray-400"
                                  } transition-colors`}>
                                    {stop}
                                  </span>
                                </div>
                                {idx < arr.length - 1 && (
                                  <div className="w-0.5 h-4 bg-gray-300 ml-1.5 my-1" />
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 transition-colors">{route.routeName}</p>

                          <div className="flex items-center space-x-3 flex-wrap gap-2">
                            <span className="px-2 py-1 text-white text-xs font-medium rounded-full"
                              style={{ backgroundColor: theme.primary }}>
                              {route.mode}
                            </span>
                            <div className="flex items-center space-x-1">
                              <Wallet className="h-3 w-3 text-green-600" />
                              <span className="font-bold text-sm text-green-600">{route.fare.regular}</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">{route.distance}</span>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => toggleMapExpanded(i)}
                            className="flex items-center space-x-1 text-sm font-medium hover:underline"
                            style={{ color: theme.accent }}
                            title="View on map"
                          >
                            <Map className="h-4 w-4" />
                            <span>{expandedMaps.has(i) ? 'Hide' : 'Map'}</span>
                          </button>
                          <button
                            onClick={() => handleSaveRoute(route, i)}
                            disabled={savingRouteIndex === i}
                            className="flex items-center space-x-1 text-sm font-medium hover:underline"
                            style={{ color: theme.secondary }}
                            title="Save this route"
                          >
                            {savingRouteIndex === i ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-4 w-4" />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRouteSelect(route)}
                            className="flex items-center space-x-1 text-sm font-medium hover:underline"
                            style={{ color: theme.primary }}
                          >
                            <span>Start Journey</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable map section */}
                    {expandedMaps.has(i) && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                        <RouteMap
                          routeId={route.routeId}
                          originStop={route.origin}
                          destinationStop={route.destination}
                          routeName={route.routeName}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : isSearching ? (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: theme.primary }} />
                <p className="text-gray-600 dark:text-gray-300 font-medium transition-colors">Searching all transit types...</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 transition-colors">Checking PUJ, LRT, MRT, and PNR routes</p>
              </div>
            ) : hasSearched && routeResults.length === 0 && selectedFromStop && selectedToStop ? (
              <div className="py-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 border-2 border-blue-100 dark:border-gray-600 transition-colors">
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <AlertCircle className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">
                      No Direct Routes Found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4 transition-colors">
                      We couldn't find direct transit routes between <strong>{selectedFromStop.stop_name}</strong> and <strong>{selectedToStop.stop_name}</strong>
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 dark:text-blue-300 font-bold">1</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white mb-1 transition-colors">Try Different Stops</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                            These stops might be on different transit lines. Search for nearby major intersections or landmarks.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-600 dark:text-purple-300 font-bold">2</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white mb-1 transition-colors">Consider Transfers</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                            You may need to transfer between different transit lines (PUJ, LRT, MRT, or PNR) to reach your destination.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-amber-600 dark:text-amber-300 font-bold">3</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white mb-1 transition-colors">Coverage Area</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                            Some areas may have limited transit data. Try searching for stops closer to main roads or transit stations.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="flex items-center space-x-3">
                      <Sparkles className="h-6 w-6 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">Pro Tip</p>
                        <p className="text-sm text-indigo-100">
                          Popular routes include major stations like LRT Baclaran, MRT North Ave, or key PUJ terminals. Try searching from these hubs!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 animate-fadeIn">
                <div className="mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors animate-pulse-slow">
                    <MapPin className="h-10 w-10 text-blue-500 dark:text-blue-400 animate-bounce" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors">
                    Ready to Find Your Route
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 transition-colors">
                    Search for routes across all transit types
                  </p>
                  <div className="flex items-center justify-center space-x-2 mt-4 flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full transition-all hover:scale-110 cursor-default">
                      🚐 PUJ
                    </span>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium rounded-full transition-all hover:scale-110 cursor-default">
                      🚇 LRT
                    </span>
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full transition-all hover:scale-110 cursor-default">
                      🚊 MRT
                    </span>
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-medium rounded-full transition-all hover:scale-110 cursor-default">
                      🚂 PNR
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center transition-colors">
            <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 transition-colors" />
            Recent Searches
          </h3>
          <div className="space-y-3">
            {recentSearches.map((search, i) => (
              <button
                key={i}
                onClick={() => {
                  setFromLocation(search.from);
                  setToLocation(search.to);
                }}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white transition-colors">{search.from}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400 transition-colors" />
                    <span className="font-medium text-gray-900 dark:text-white transition-colors">{search.to}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">{search.time}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popular Routes Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 transition-colors animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center transition-colors">
            <TrendingUp className="h-5 w-5 text-orange-500 mr-2 animate-bounce" />
            Popular Routes
          </h3>
        </div>

        {loadingPopularRoutes ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : popularRoutes.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No popular routes yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Complete trips to see trending routes
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {popularRoutes.map((route, i) => (
            <div key={i} className="p-4 bg-gradient-to-r from-gray-50 dark:from-gray-700 to-white dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white transition-colors">{route.from}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400 transition-colors" />
                    <span className="font-semibold text-gray-900 dark:text-white transition-colors">{route.to}</span>
                  </div>
                  
                  <div className="flex items-center space-x-4 flex-wrap gap-2">
                    <div className="flex items-center space-x-1">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-bold text-green-600">{route.fare}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-600">{route.time}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-yellow-600">{route.rating}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="px-3 py-1 text-white text-xs font-medium rounded-full"
                    style={{ backgroundColor: theme.primary }}>
                    {route.mode}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">Traffic:</span>
                    <TrafficIndicator level={route.traffic === 'light' ? 0 : route.traffic === 'moderate' ? 1 : 2} />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">Crowd:</span>
                    <CrowdLevel level={route.crowdLevel} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                    {route.alternatives} alternatives
                  </span>
                </div>
                
                <button className="text-sm font-medium hover:underline flex items-center space-x-1"
                  style={{ color: theme.primary }}>
                  <span>Select</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Transportation Modes - All Transit Types */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 transition-colors animate-fadeIn" style={{ animationDelay: '0.2s' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center transition-colors">
          <Filter className="h-5 w-5 text-purple-500 mr-2" />
          Available Transportation Modes
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* PUJ */}
          <div className="p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 transition-all hover:shadow-md cursor-pointer transform hover:scale-105 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-md">
                🚐
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white transition-colors">PUJ</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors mt-1">
                Jeepney
              </p>
              <div className="mt-2 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full inline-block animate-pulse">
                Active
              </div>
            </div>
          </div>

          {/* LRT */}
          <div className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 transition-all opacity-60 cursor-not-allowed animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <div className="text-center">
              <div className="w-14 h-14 bg-gray-400 rounded-xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-md">
                🚇
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white transition-colors">LRT</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors mt-1">
                Light Rail
              </p>
              <div className="mt-2 px-2 py-0.5 bg-gray-400 text-white text-xs font-semibold rounded-full inline-block">
                Coming Soon
              </div>
            </div>
          </div>

          {/* MRT */}
          <div className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 transition-all opacity-60 cursor-not-allowed animate-fadeIn" style={{ animationDelay: '0.5s' }}>
            <div className="text-center">
              <div className="w-14 h-14 bg-gray-400 rounded-xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-md">
                🚊
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white transition-colors">MRT</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors mt-1">
                Metro Rail
              </p>
              <div className="mt-2 px-2 py-0.5 bg-gray-400 text-white text-xs font-semibold rounded-full inline-block">
                Coming Soon
              </div>
            </div>
          </div>

          {/* PNR */}
          <div className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 transition-all opacity-60 cursor-not-allowed animate-fadeIn" style={{ animationDelay: '0.6s' }}>
            <div className="text-center">
              <div className="w-14 h-14 bg-gray-400 rounded-xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-md">
                🚂
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white transition-colors">PNR</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors mt-1">
                Railway
              </p>
              <div className="mt-2 px-2 py-0.5 bg-gray-400 text-white text-xs font-semibold rounded-full inline-block">
                Coming Soon
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-xl transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white transition-colors">
                Multi-Modal Transit System
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 transition-colors">
                Search across all transportation modes to find the best route for your journey
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Journey Start Confirmation Modal */}
      {showJourneyModal && selectedRoute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full transition-colors">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Start Your Journey?</h3>
                <button
                  onClick={handleCancelJourney}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-30 rounded-lg p-4 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400 transition-colors" />
                    <span className="font-semibold text-blue-900 dark:text-blue-300 transition-colors">Route Details</span>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-1 transition-colors">
                    <strong>From:</strong> {selectedRoute.origin.stop_name}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-1 transition-colors">
                    <strong>To:</strong> {selectedRoute.destination.stop_name}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-1 transition-colors">
                    <strong>Mode:</strong> {selectedRoute.mode}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300 transition-colors">
                    <strong>Fare:</strong> {selectedRoute.fare.regular}
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-30 rounded-lg p-4 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <Award className="h-5 w-5 text-green-600 dark:text-green-400 transition-colors" />
                    <span className="font-semibold text-green-900 dark:text-green-300 transition-colors">Benefits</span>
                  </div>
                  <ul className="text-sm text-green-800 dark:text-green-300 space-y-1 transition-colors">
                    <li>• Earn points for your journey</li>
                    <li>• Track your commuter level progress</li>
                    <li>• Contribute to environmental sustainability</li>
                  </ul>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancelJourney}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartJourney}
                    disabled={isStartingTrip}
                    className="flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {isStartingTrip ? 'Starting...' : 'Yes, Start Journey!'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default RoutesTab;
