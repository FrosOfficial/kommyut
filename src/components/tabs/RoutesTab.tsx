import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Loader2, Map, Clock, ArrowRight, Star, Wallet, TrendingUp, 
  Filter, ChevronRight, Sparkles, Award, Zap, Users, Activity, MapPin,
  AlertCircle, DollarSign
} from 'lucide-react';
import MapLive from '../map/MapLive'; // Import the actual MapLive component
import { ExternalLink } from "lucide-react";


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
}

interface GTFSRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
}

interface RouteResult {
  summary: string;
  routeName: string;
  mode: string;
  fare: string;
  distance?: string;
  origin?: GTFSStop;
  destination?: GTFSStop;
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
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([
    { from: "Still", to: "Broken", time: "9999 hours ago" },

  ]);
  
  // New GTFS state
  const [gtfsData, setGtfsData] = useState<{
    stops: GTFSStop[];
    routes: GTFSRoute[];
    loaded: boolean;
    error: string | null;
  }>({
    stops: [],
    routes: [],
    loaded: false,
    error: null
  });
  
  const [fareData, setFareData] = useState<any>({});
  const [fromSuggestions, setFromSuggestions] = useState<GTFSStop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<GTFSStop[]>([]);
  const [selectedFromStop, setSelectedFromStop] = useState<GTFSStop | null>(null);
  const [selectedToStop, setSelectedToStop] = useState<GTFSStop | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load GTFS and fare data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Simple CSV parser
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
    
    return rows;
  };

  // Load all GTFS and fare data
  const loadAllData = async () => {
    try {
      // Load GTFS files
      const [stopsRes, routesRes] = await Promise.all([
        fetch('/data/gtfs/stops.txt'),
        fetch('/data/gtfs/routes.txt')
      ]);
      
      if (!stopsRes.ok || !routesRes.ok) {
        throw new Error('Failed to load GTFS files');
      }
      
      const stopsText = await stopsRes.text();
      const routesText = await routesRes.text();
      
      const stops = parseCSV(stopsText) as GTFSStop[];
      const routes = parseCSV(routesText) as GTFSRoute[];
      
      setGtfsData({
        stops,
        routes,
        loaded: true,
        error: null
      });
      
      // Load fare files
      const fareFiles = [
        'puj.csv', 'pub_aircon.csv', 'pub_ordinary.csv', 
        'mrt.csv', 'lrt1_sj.csv', 'lrt1_sv.csv', 
        'lrt2_sj.csv', 'lrt2_sv.csv', 'pnr.csv'
      ];
      
      const fares: any = {};
      
      for (const file of fareFiles) {
        try {
          const response = await fetch(`/data/fares/${file}`);
          if (response.ok) {
            const text = await response.text();
            const parsed = parseCSV(text);
            fares[file.replace('.csv', '')] = parsed;
          }
        } catch (err) {
          console.warn(`Could not load ${file}:`, err);
        }
      }
      
      setFareData(fares);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setGtfsData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load data',
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
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Estimate fare based on distance and transport type
  const estimateFare = (distance: number) => {
    const estimates = [];
    
    // PUJ fare estimation
    if (fareData.puj && fareData.puj.length > 0) {
      const pujFare = Math.max(13, Math.ceil(distance * 2)); // ₱13 base + ₱2/km
      estimates.push({ mode: 'PUJ', fare: `₱${pujFare}`, description: 'Public Utility Jeepney' });
    }
    
    // Bus fare estimation
    if (fareData.pub_ordinary && fareData.pub_ordinary.length > 0) {
      const busFare = Math.max(15, Math.ceil(distance * 2.5)); // ₱15 base + ₱2.5/km
      estimates.push({ mode: 'Bus', fare: `₱${busFare}`, description: 'Public Bus' });
    }
    
    // MRT fare estimation
    if (fareData.mrt && fareData.mrt.length > 0) {
      let mrtFare = 13; // Base fare
      if (distance > 5) mrtFare = 16;
      if (distance > 10) mrtFare = 20;
      if (distance > 15) mrtFare = 24;
      if (distance > 20) mrtFare = 28;
      estimates.push({ mode: 'MRT', fare: `₱${mrtFare}`, description: 'Metro Rail Transit' });
    }
    
    return estimates;
  };

  // Enhanced search handler using GTFS data
  const handleSearch = async () => {
    if (!selectedFromStop || !selectedToStop) {
      alert("Please select both origin and destination from the suggestions!");
      return;
    }

    setIsSearching(true);

    try {
      // Add to recent searches
      const newSearch: RecentSearch = {
        from: selectedFromStop.stop_name,
        to: selectedToStop.stop_name,
        time: "Just now"
      };
      setRecentSearches(prev => [newSearch, ...prev.slice(0, 4)]);

      // Calculate distance
      const originLat = parseFloat(selectedFromStop.stop_lat);
      const originLon = parseFloat(selectedFromStop.stop_lon);
      const destLat = parseFloat(selectedToStop.stop_lat);
      const destLon = parseFloat(selectedToStop.stop_lon);
      
      const distance = calculateDistance(originLat, originLon, destLat, destLon);
      const fareEstimates = estimateFare(distance);
      
      // Create route results
      const results: RouteResult[] = fareEstimates.map(estimate => ({
        summary: `${selectedFromStop.stop_name} → ${selectedToStop.stop_name}`,
        routeName: estimate.description,
        mode: estimate.mode,
        fare: estimate.fare,
        distance: `${distance.toFixed(2)} km`,
        origin: selectedFromStop,
        destination: selectedToStop
      }));

      setRouteResults(results);
    } catch (error) {
      console.error("Error during search:", error);
      alert("An error occurred while searching. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle live map handler
  const toggleLiveMap = () => {
    setShowLiveMap(prevState => !prevState);
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
      {/* Data Status Bar */}
      <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-800 font-medium">Transit data loaded successfully</span>
          </div>
          <div className="text-sm text-green-700">
            {gtfsData.stops.length} stops • {gtfsData.routes.length} routes • {Object.keys(fareData).length} fare tables
          </div>
        </div>
      </div>

      {/* Hero Search Section */}
      <div className="relative overflow-hidden rounded-3xl shadow-2xl p-6 mb-6"
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
              
              {/* From Suggestions */}
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
                      <div className="text-xs text-gray-500">ID: {stop.stop_id}</div>
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
              
              {/* To Suggestions */}
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
                      <div className="text-xs text-gray-500">ID: {stop.stop_id}</div>
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
        </div>
      </div>

      {/* Smart Route Preferences  */}
      <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Sparkles className="h-5 w-5 text-yellow-500 mr-2" />
          Smart Route Preferences (STILL BROKEN )
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'fastest', icon: Zap, label: 'Fastest', desc: 'Quick arrival' },
            { id: 'cheapest', icon: Wallet, label: 'Cheapest', desc: 'Save money' },
            { id: 'comfort', icon: Award, label: 'Comfort', desc: 'AC & less crowd' },
            { id: 'balanced', icon: Activity, label: 'Balanced', desc: 'Best overall' }
          ].map(pref => (
            <button
              key={pref.id}
              onClick={() => setRoutePreference(pref.id)}
              className="p-4 rounded-xl border-2 transition-all"
              style={{
                borderColor: routePreference === pref.id ? theme.primary : '#E5E7EB',
                backgroundColor: routePreference === pref.id ? `${theme.primary}10` : 'white'
              }}
            >
              <pref.icon className="h-6 w-6 mb-2"
                style={{ color: routePreference === pref.id ? theme.primary : '#6B7280' }} />
              <p className="font-medium text-gray-900">{pref.label}</p>
              <p className="text-xs text-gray-500">{pref.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions - Live Map Toggle */}
      <div className="mb-6">
        <button
          onClick={toggleLiveMap}
          className={`w-full flex items-center justify-center space-x-3 p-5 rounded-2xl shadow-md transition-all hover:shadow-lg ${
            showLiveMap 
              ? 'bg-green-50 border-2 border-green-500 transform scale-[1.02]' 
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div 
            className={`p-3 rounded-xl transition-all ${
              showLiveMap ? 'bg-green-500 shadow-lg' : ''
            }`}
            style={{ backgroundColor: showLiveMap ? theme.success : theme.primary }}
          >
            <Map className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <span className="text-base font-semibold text-gray-800 block">
              {showLiveMap ? 'Hide Live Map' : 'Show Live Map'}
            </span>
            <span className="text-sm text-gray-500">
              {showLiveMap ? 'Click to collapse' : 'View real-time transit'}
            </span>
          </div>
        </button>
      </div>

      {/* Live Map Section */}
      {showLiveMap && (
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Map className="h-5 w-5 text-green-500 mr-2" />
              Live Transit Map
            </h3>
            <button
              onClick={toggleLiveMap}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Minimize
            </button>
          </div>
          
          {/* Try to render the imported MapLive component, fallback to placeholder if it fails */}
          <div className="relative">
            <MapLive height="60vh" />
          </div>
          
          {/* Optional: Add some controls or info below the map */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Real-time updates</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-600 font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Route Results with GTFS Data */}
      {routeResults.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 text-green-600 mr-2" />
            Available Routes & Fares
          </h3>
          <div className="space-y-4">
            {routeResults.map((route, i) => (
              <div key={i} className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-gray-900">{route.origin?.stop_name}</span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <MapPin className="h-4 w-4 text-red-600" />
                      <span className="font-semibold text-gray-900">{route.destination?.stop_name}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{route.routeName}</p>
                    
                    <div className="flex items-center space-x-4 flex-wrap gap-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">Mode:</span>
                        <span className="px-3 py-1 text-white text-xs font-medium rounded-full"
                          style={{ backgroundColor: theme.primary }}>
                          {route.mode}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <span className="font-bold text-lg text-green-600">{route.fare}</span>
                      </div>
                      {route.distance && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">Distance:</span>
                          <span className="text-sm font-medium">{route.distance}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
  {/* Coordinates display */}
                {route.origin && route.destination && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <strong>Origin:</strong> {route.origin.stop_lat}, {route.origin.stop_lon}
                      <br />
                      <strong>Stop ID:</strong> {route.origin.stop_id}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Destination:</strong> {route.destination.stop_lat}, {route.destination.stop_lon}
                      <br />
                      <strong>Stop ID:</strong> {route.destination.stop_id}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-4">
                  <button className="flex items-center space-x-2 text-sm font-medium hover:underline"
                    style={{ color: theme.primary }}>
                    <ExternalLink className="h-4 w-4" />
                    <span>View on Map</span>
                  </button>
                  <button className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: theme.primary }}>
                    Select Route
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && routeResults.length === 0 && (
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
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'PUJ', icon: '🚐', color: 'bg-yellow-500', available: Object.keys(fareData).includes('puj') },
            { name: 'Bus', icon: '🚌', color: 'bg-blue-500', available: Object.keys(fareData).some(k => k.includes('pub_')) },
            { name: 'MRT', icon: '🚇', color: 'bg-green-500', available: Object.keys(fareData).includes('mrt') },
            { name: 'LRT', icon: '🚊', color: 'bg-purple-500', available: Object.keys(fareData).some(k => k.includes('lrt')) },
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

      {/* Data Analytics Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="h-5 w-5 text-indigo-500 mr-2" />
          Transit Analytics
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/70 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">{gtfsData.stops.length}</div>
            <div className="text-sm text-gray-600">Transit Stops</div>
          </div>
          <div className="bg-white/70 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{gtfsData.routes.length}</div>
            <div className="text-sm text-gray-600">Routes</div>
          </div>
          <div className="bg-white/70 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{Object.keys(fareData).length}</div>
            <div className="text-sm text-gray-600">Fare Tables</div>
          </div>
          <div className="bg-white/70 backdrop-blur rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">Real-time</div>
            <div className="text-sm text-gray-600">Updates</div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white/50 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Data freshness</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-600 font-medium">Live & Updated</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RoutesTab;