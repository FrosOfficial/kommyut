import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Loader2, Clock, ArrowRight, Star, Wallet, TrendingUp,
  Filter, ChevronRight, Sparkles, Award, Zap, Users, Activity, MapPin,
  AlertCircle, DollarSign, X, Navigation, Bookmark
} from 'lucide-react';
import * as api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
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
  from: string;
  to: string;
  time: string;
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
  const [routePreference, setRoutePreference] = useState("fastest");
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
  const [selectedFromStop, setSelectedFromStop] = useState<GTFSStop | null>(null);
  const [selectedToStop, setSelectedToStop] = useState<GTFSStop | null>(null);
  
  // Trip tracking state
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);

  // Route saving state
  const [savingRouteIndex, setSavingRouteIndex] = useState<number | null>(null);

  // Popular routes state
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[]>([]);
  const [loadingPopularRoutes, setLoadingPopularRoutes] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load GTFS and fare data on component mount
  useEffect(() => {
    loadAllData();
    loadPopularRoutes();
  }, []);

  // Load popular routes from trip history
  const loadPopularRoutes = async () => {
    try {
      setLoadingPopularRoutes(true);
      const routes = await api.getPopularRoutes(3);

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
      console.error('Error loading popular routes:', error);
      // Keep empty array if no data
      setPopularRoutes([]);
    } finally {
      setLoadingPopularRoutes(false);
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

  // Handle location input changes
  const handleFromLocationChange = (value: string) => {
    setFromLocation(value);
    setSelectedFromStop(null);
    if (value.length >= 2) {
      const suggestions = searchStops(value);
      setFromSuggestions(suggestions);
    } else {
      setFromSuggestions([]);
    }
  };

  const handleToLocationChange = (value: string) => {
    setToLocation(value);
    setSelectedToStop(null);
    if (value.length >= 2) {
      const suggestions = searchStops(value);
      setToSuggestions(suggestions);
    } else {
      setToSuggestions([]);
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

  // Determine route type description
  const getRouteTypeDescription = (routeType: number, routeId?: string): string => {
    if (routeId) {
      if (routeId.startsWith('LRT1_') || routeId.toLowerCase().includes('lrt1') || routeId.toLowerCase().includes('lrt-1')) {
        return 'LRT-1';
      }
      if (routeId.startsWith('LRT2_') || routeId.toLowerCase().includes('lrt2') || routeId.toLowerCase().includes('lrt-2')) {
        return 'LRT-2';
      }
      if (routeId.toLowerCase().includes('mrt3') || routeId.toLowerCase().includes('mrt-3')) {
        return 'MRT-3';
      }
      if (routeId.toLowerCase().includes('pnr')) {
        return 'PNR';
      }
    }

    switch (routeType) {
      case 0: return 'Light Rail';
      case 1: return 'Metro Rail';
      case 2: return 'Heavy Rail';
      case 3: return 'Bus';
      case 700: return 'Public Utility Jeepney';
      default: return 'Unknown';
    }
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
      // Normalize station names
      const normalizeStationName = (name: string): string => 
        name.toLowerCase()
          .replace(/\s+lrt\s*$/i, '')
          .replace(/\s+mrt\s*$/i, '')
          .replace(/\s+pnr\s*$/i, '')
          .replace(/\s+station\s*$/i, '')
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '')
          .trim();
      
      const fromStation = normalizeStationName(originStop.stop_name);
      const toStation = normalizeStationName(destinationStop.stop_name);
      
      const fareData = await api.getFare(transitType.toLowerCase(), fromStation, toStation);
      
      return {
        regular: `₱${fareData.fare}`,
        discounted: `₱${Math.floor(fareData.fare * 0.8)}`
      };
    } catch (error) {
      console.warn(`Fare data not available for ${transitType} from ${originStop.stop_name} to ${destinationStop.stop_name}`);
      // Return N/A instead of erroring out
      return { regular: 'N/A', discounted: 'N/A' };
    }
  };

  // Estimate fare based on distance and transport type using API
  const estimateFare = async (distance: number, routeType: number, originStop: GTFSStop, destStop: GTFSStop) => {
    const estimates = [];
    
    try {
      switch (routeType) {
        case 700: // PUJ
          const pujFare = await calculateDistanceFareAPI(distance, 'puj');
          estimates.push({
            mode: 'PUJ',
            fare: pujFare,
            description: 'Public Utility Jeepney',
            routeType
          });
          break;

        case 3: // Bus
          const busFare = await calculateDistanceFareAPI(distance, 'pub');
          estimates.push({
            mode: 'Bus (Aircon)',
            fare: busFare,
            description: 'Public Utility Bus (Aircon)',
            routeType
          });
          break;

        case 0: // Light Rail
        case 1: // Metro Rail
        case 2: // Heavy Rail
          // Determine transit type from stop_id, not just route type
          let transitType = 'lrt1';
          if (originStop.stop_id.includes('LRT1') || originStop.stop_name.toLowerCase().includes('lrt') || originStop.stop_name.toLowerCase().includes('baclaran') || originStop.stop_name.toLowerCase().includes('roosevelt')) {
            transitType = 'lrt1';
          } else if (originStop.stop_id.includes('LRT2') || originStop.stop_name.toLowerCase().includes('lrt2') || originStop.stop_name.toLowerCase().includes('recto') || originStop.stop_name.toLowerCase().includes('santolan')) {
            transitType = 'lrt2';
          } else if (originStop.stop_id.includes('MRT') || originStop.stop_name.toLowerCase().includes('mrt') || originStop.stop_name.toLowerCase().includes('north avenue') || originStop.stop_name.toLowerCase().includes('taft')) {
            transitType = 'mrt';
          } else if (originStop.stop_id.includes('PNR') || originStop.stop_name.toLowerCase().includes('pnr') || originStop.stop_name.toLowerCase().includes('tutuban') || originStop.stop_name.toLowerCase().includes('calamba')) {
            transitType = 'pnr';
          }

          const railFare = await calculateStationFareAPI(originStop, destStop, transitType);
          estimates.push({
            mode: getRouteTypeDescription(routeType, originStop.stop_id),
            fare: railFare,
            description: `${getRouteTypeDescription(routeType, originStop.stop_id)} Transit`,
            routeType
          });
          break;
      }
    } catch (error) {
      console.error('Error estimating fare:', error);
      estimates.push({
        mode: 'Unknown',
        fare: { regular: 'N/A', discounted: 'N/A' },
        description: 'Unable to calculate fare',
        routeType
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

  // Sort routes based on user preference
  const sortByPreference = (routes: RouteResult[], preference: string): RouteResult[] => {
    const sortedRoutes = [...routes];

    switch (preference) {
      case 'cheapest':
        // Sort by fare (lowest first)
        return sortedRoutes.sort((a, b) => {
          const fareA = parseFloat(a.fare.regular.replace('₱', '').replace('N/A', '999999'));
          const fareB = parseFloat(b.fare.regular.replace('₱', '').replace('N/A', '999999'));
          return fareA - fareB;
        });

      case 'fastest':
        // Sort by distance (shortest distance = fastest, assuming similar speeds)
        return sortedRoutes.sort((a, b) => {
          const distA = parseFloat(a.distance.replace(' km', ''));
          const distB = parseFloat(b.distance.replace(' km', ''));
          return distA - distB;
        });

      case 'comfort':
        // Prioritize rail (LRT/MRT) over bus/jeep for comfort
        return sortedRoutes.sort((a, b) => {
          const comfortScore = (route: RouteResult) => {
            if (route.mode.includes('LRT') || route.mode.includes('MRT')) return 3;
            if (route.mode.includes('Bus')) return 2;
            return 1;
          };
          return comfortScore(b) - comfortScore(a);
        });

      case 'balanced':
        // Balance between cost and distance
        return sortedRoutes.sort((a, b) => {
          const scoreRoute = (route: RouteResult) => {
            const fare = parseFloat(route.fare.regular.replace('₱', '').replace('N/A', '999999'));
            const distance = parseFloat(route.distance.replace(' km', ''));
            // Normalize and combine (lower is better)
            return (fare / 50) + (distance / 10);
          };
          return scoreRoute(a) - scoreRoute(b);
        });

      default:
        return sortedRoutes;
    }
  };

  // Enhanced search handler using GTFS data and API
  const handleSearch = async () => {
    console.log('Search button clicked', { selectedFromStop, selectedToStop });

    if (!selectedFromStop || !selectedToStop) {
      alert("Please select both origin and destination from the suggestions!");
      return;
    }

    setIsSearching(true);
    console.log('Starting search with stops:', selectedFromStop.stop_name, 'to', selectedToStop.stop_name);

    try {
      const newSearch: RecentSearch = {
        from: selectedFromStop.stop_name,
        to: selectedToStop.stop_name,
        time: "Just now"
      };
      setRecentSearches(prev => [newSearch, ...prev.slice(0, 4)]);

      console.log('Finding routes between stops...');
      // Find all possible routes between the stops (now async)
      const possibleRoutes = await findRoute(selectedFromStop, selectedToStop);
      console.log('Found routes:', possibleRoutes.length);

      // Calculate fares for each route (in parallel)
      const resultsPromises = possibleRoutes.map(async (routeInfo) => {
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
          routeInfo.stops[routeInfo.stops.length - 1]
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
      console.log('Final results before sorting:', results);

      // Apply route preference sorting
      results = sortByPreference(results, routePreference);
      console.log('Final results after sorting:', results);

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
      
      const tripData = {
        user_uid: currentUser.uid,
        from_location: selectedRoute.origin.stop_name,
        to_location: selectedRoute.destination.stop_name,
        transit_type: selectedRoute.mode,
        route_name: selectedRoute.routeName,
        distance_km: distance,
        fare_paid: publicTransportFare,
        money_saved: moneySaved
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
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Left Column - Search Section */}
        <div className="lg:w-1/2">
          <div className="relative overflow-hidden rounded-3xl shadow-2xl p-6 h-full"
            style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)` }}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24" />

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
                    placeholder="From (Search transit stops...)"
                    value={fromLocation}
                    onChange={(e) => handleFromLocationChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/90 backdrop-blur rounded-2xl focus:outline-none focus:ring-4 focus:ring-white/30 transition-all"
                  />
                  
                  {fromSuggestions.length > 0 && !selectedFromStop && (
                    <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto transition-colors">
                      {fromSuggestions.map((stop, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedFromStop(stop);
                            setFromLocation(stop.stop_name);
                            setFromSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                        >
                          <div className="font-medium text-gray-800 dark:text-white transition-colors">{stop.stop_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">{stop.city || 'Unknown Location'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedFromStop && (
                    <div className="mt-2 p-2 bg-white/20 rounded-lg text-sm text-white">
                      ✓ Selected: <strong>{selectedFromStop.stop_name}</strong>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-4 z-20">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                  </div>
                  <input
                    type="text"
                    placeholder="To (Search destination stops...)"
                    value={toLocation}
                    onChange={(e) => handleToLocationChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/90 backdrop-blur rounded-2xl focus:outline-none focus:ring-4 focus:ring-white/30 transition-all"
                  />
                  
                  {toSuggestions.length > 0 && !selectedToStop && (
                    <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto transition-colors">
                      {toSuggestions.map((stop, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedToStop(stop);
                            setToLocation(stop.stop_name);
                            setToSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors"
                        >
                          <div className="font-medium text-gray-800 dark:text-white transition-colors">{stop.stop_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">{stop.city || 'Unknown Location'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedToStop && (
                    <div className="mt-2 p-2 bg-white/20 rounded-lg text-sm text-white">
                      ✓ Selected: <strong>{selectedToStop.stop_name}</strong>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={isSearching || !selectedFromStop || !selectedToStop}
                  className="w-full bg-white font-semibold py-4 rounded-2xl transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                  style={{ color: theme.primary }}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Finding best routes...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      <span>Search Routes</span>
                    </>
                  )}
                </button>
              </div>

              {/* Smart Route Preferences */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <Sparkles className="h-5 w-5 text-yellow-300 mr-2" />
                  Smart Route Preferences
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'fastest', icon: Zap, label: 'Fastest' },
                    { id: 'cheapest', icon: Wallet, label: 'Cheapest' },
                    { id: 'comfort', icon: Award, label: 'Comfort' },
                    { id: 'balanced', icon: Activity, label: 'Balanced' }
                  ].map(pref => (
                    <button
                      key={pref.id}
                      onClick={() => setRoutePreference(pref.id)}
                      className="p-3 rounded-xl border-2 transition-all bg-white/10 backdrop-blur"
                      style={{
                        borderColor: routePreference === pref.id ? 'white' : 'rgba(255,255,255,0.3)',
                        backgroundColor: routePreference === pref.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
                      }}
                    >
                      <pref.icon className={`h-5 w-5 mb-1 ${routePreference === pref.id ? 'text-white' : 'text-blue-100'}`} />
                      <p className={`text-sm font-medium ${routePreference === pref.id ? 'text-white' : 'text-blue-100'}`}>
                        {pref.label}
                      </p>
                    </button>
                  ))}
                </div>
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
                  <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all bg-gradient-to-r from-gray-50 dark:from-gray-700 to-white dark:to-gray-800">
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
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3 transition-colors" />
                <p className="text-gray-500 dark:text-gray-400 transition-colors">Search for routes to see available options</p>
                <p className="text-xs text-gray-400 mt-2 transition-colors">Enter origin and destination above</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center transition-colors">
            <TrendingUp className="h-5 w-5 text-orange-500 mr-2" />
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

      {/* Transportation Mode Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 mb-6 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center transition-colors">
          <Filter className="h-5 w-5 text-purple-500 mr-2" />
          Transportation Modes
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { name: 'PUJ', icon: '🚐', color: 'bg-yellow-500', available: fareData.pujTable?.length > 0 },
            { name: 'Bus', icon: '🚌', color: 'bg-blue-500', available: fareData.pubTables?.length > 0 },
            { name: 'MRT', icon: '🚇', color: 'bg-green-500', available: true },
            { name: 'LRT', icon: '🚊', color: 'bg-purple-500', available: true },
            { name: 'Trike', icon: '🛺', color: 'bg-red-500', available: true },
          ].map(mode => (
            <div key={mode.name} className={`p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 transition-all ${mode.available ? 'hover:shadow-md cursor-pointer' : 'opacity-50'}`}>
              <div className="text-center">
                <div className={`w-12 h-12 ${mode.color} rounded-xl flex items-center justify-center mx-auto mb-2 text-xl`}>
                  {mode.icon}
                </div>
                <p className="font-medium text-gray-900 dark:text-white transition-colors">{mode.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                  {mode.available ? 'Available' : 'No data'}
                </p>
              </div>
            </div>
          ))}
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
                    <li>• Save money vs. private transport</li>
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
