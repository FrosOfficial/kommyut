import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Loader2, Clock, ArrowRight, Star, Wallet, TrendingUp, 
  Filter, ChevronRight, Sparkles, Award, Zap, Users, Activity, MapPin,
  AlertCircle, DollarSign
} from 'lucide-react';
import * as api from '../../services/api';

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
  distance?: string;
  origin?: GTFSStop;
  destination?: GTFSStop;
  routeType: number;
  routeId?: string;
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
          className={`h-2 w-2 rounded-full ${
            i <= safeLevel ? color : 'bg-gray-300'
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

const RoutesTab: React.FC = () => {
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
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load GTFS and fare data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

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
      // Use the new fast endpoint that finds all matching routes in one query
      const matchingRoutes = await api.findRoutesBetweenStops(fromStop.stop_id, toStop.stop_id);
      
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
      return [];
    }
  };

  // Enhanced search handler using GTFS data and API
  const handleSearch = async () => {
    if (!selectedFromStop || !selectedToStop) {
      alert("Please select both origin and destination from the suggestions!");
      return;
    }

    setIsSearching(true);

    try {
      const newSearch: RecentSearch = {
        from: selectedFromStop.stop_name,
        to: selectedToStop.stop_name,
        time: "Just now"
      };
      setRecentSearches(prev => [newSearch, ...prev.slice(0, 4)]);
      
      // Find all possible routes between the stops (now async)
      const possibleRoutes = await findRoute(selectedFromStop, selectedToStop);
      
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
        const fareEstimates = await estimateFare(
          totalDistance, 
          routeType, 
          routeInfo.stops[0], 
          routeInfo.stops[routeInfo.stops.length - 1]
        );
        
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
          origin: selectedFromStop,
          destination: selectedToStop,
          routeType,
          routeId: routeInfo.route.route_id
        };
      });

      const results = await Promise.all(resultsPromises);
      setRouteResults(results);
    } catch (error) {
      console.error("Error during search:", error);
      alert("An error occurred while searching. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Popular routes data
  const popularRoutes: PopularRoute[] = [
    {
      from: "BGC",
      to: "Makati",
      fare: "₱15-45",
      time: "25-40 min",
      rating: "4.2",
      traffic: "moderate",
      crowdLevel: 3,
      mode: "Bus",
      alternatives: "5"
    },
    {
      from: "Ortigas",
      to: "QC",
      fare: "₱13-35",
      time: "30-50 min", 
      rating: "4.0",
      traffic: "heavy",
      crowdLevel: 4,
      mode: "MRT",
      alternatives: "8"
    },
    {
      from: "Alabang",
      to: "MOA",
      fare: "₱20-60",
      time: "45-70 min",
      rating: "3.8",
      traffic: "light",
      crowdLevel: 2,
      mode: "Bus",
      alternatives: "3"
    }
  ];

  // Show loading state while GTFS data loads
  if (!gtfsData.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: theme.primary }} />
          <h2 className="text-xl font-semibold text-gray-700">Loading Transit Data...</h2>
          <p className="text-gray-500 mt-2">Reading GTFS stops, routes, and fare information</p>
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
                    <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {fromSuggestions.map((stop, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedFromStop(stop);
                            setFromLocation(stop.stop_name);
                            setFromSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100"
                        >
                          <div className="font-medium text-gray-800">{stop.stop_name}</div>
                          <div className="text-xs text-gray-500">{stop.city || 'Unknown Location'}</div>
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
                    <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {toSuggestions.map((stop, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedToStop(stop);
                            setToLocation(stop.stop_name);
                            setToSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100"
                        >
                          <div className="font-medium text-gray-800">{stop.stop_name}</div>
                          <div className="text-xs text-gray-500">{stop.city || 'Unknown Location'}</div>
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
          <div className="bg-white rounded-2xl shadow-lg p-5 h-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              Available Routes & Fares
            </h3>
            
            {routeResults.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {routeResults.map((route, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">Route steps:</div>
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
                                  "font-semibold text-gray-900" : 
                                  "text-gray-600"
                                }`}>
                                  {stop}
                                </span>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className="w-0.5 h-4 bg-gray-300 ml-1.5 my-1" />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{route.routeName}</p>
                        
                        <div className="flex items-center space-x-3 flex-wrap gap-2">
                          <span className="px-2 py-1 text-white text-xs font-medium rounded-full"
                            style={{ backgroundColor: theme.primary }}>
                            {route.mode}
                          </span>
                          <div className="flex items-center space-x-1">
                            <Wallet className="h-3 w-3 text-green-600" />
                            <span className="font-bold text-sm text-green-600">{route.fare.regular}</span>
                          </div>
                          {route.distance && (
                            <span className="text-xs text-gray-500">{route.distance}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Search for routes to see available options</p>
                <p className="text-xs text-gray-400 mt-2">Enter origin and destination above</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Searches Section */}
      {recentSearches.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 text-gray-500 mr-2" />
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
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium text-gray-900">{search.from}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{search.to}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{search.time}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popular Routes Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="h-5 w-5 text-orange-500 mr-2" />
            Popular Routes
          </h3>
          <button className="text-sm font-medium hover:underline"
            style={{ color: theme.primary }}>
            View All
          </button>
        </div>
        
        <div className="space-y-4">
          {popularRoutes.map((route, i) => (
            <div key={i} className="p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-semibold text-gray-900">{route.from}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <span className="font-semibold text-gray-900">{route.to}</span>
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
                    <span className="text-xs text-gray-500">Traffic:</span>
                    <TrafficIndicator level={route.traffic === 'light' ? 0 : route.traffic === 'moderate' ? 1 : 2} />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">Crowd:</span>
                    <CrowdLevel level={route.crowdLevel} />
                  </div>
                  <span className="text-xs text-gray-500">
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
      </div>

      {/* Transportation Mode Filter */}
      <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
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
            <div key={mode.name} className={`p-4 rounded-xl border-2 transition-all ${mode.available ? 'hover:shadow-md cursor-pointer' : 'opacity-50'}`}>
              <div className="text-center">
                <div className={`w-12 h-12 ${mode.color} rounded-xl flex items-center justify-center mx-auto mb-2 text-xl`}>
                  {mode.icon}
                </div>
                <p className="font-medium text-gray-900">{mode.name}</p>
                <p className="text-xs text-gray-500">
                  {mode.available ? 'Available' : 'No data'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </>
  );
};

export default RoutesTab;
