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
  onRouteSelect: (from: string, to: string) => void;
}

export interface ActivityTabProps {
  // No props needed - component manages its own state
}

export interface ProfileTabProps {
  userPoints: number;
}

// ============================================================================
// ENHANCED TYPES FOR MULTI-LEG ROUTING & OSM INTEGRATION
// ============================================================================

export type LegType = 'walking' | 'PUJ';
export type LocationType = 'coordinate' | 'stop';
export type StopType = 'terminal' | 'regular' | 'transfer';
export type RoutePreference = 'fastest' | 'cheapest' | 'least_walking' | 'balanced';
export type OSMType = 'node' | 'way' | 'relation';

// ============================================================================
// ENHANCED STOP MODEL
// ============================================================================

export interface StopAccessibility {
  wheelchair_accessible: boolean;
  shelter: boolean;
  lighting: boolean;
}

export interface EnhancedStop {
  // Primary identifiers
  stop_id: string;
  stop_name: string;

  // Geographic data
  lat: number;
  lon: number;

  // Administrative hierarchy
  barangay?: string;
  city: string;
  region: string;
  postcode?: string;

  // OSM integration
  osm_id?: string;
  osm_type?: OSMType;

  // Enhanced metadata
  nearby_landmarks?: string[];
  stop_type?: StopType;
  accessibility?: StopAccessibility;

  // Operational data
  routes_serving?: string[];
  avg_daily_passengers?: number;
  operating_hours?: string;

  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}

// ============================================================================
// ENHANCED ROUTE MODEL
// ============================================================================

export interface EnhancedPUJRoute {
  // Primary identifiers
  route_id: string;
  route_short_name: string;
  route_long_name: string;

  // Route type (GTFS standard)
  route_type: 3; // Always 3 for PUJ

  // Terminals
  origin_stop_id?: string;
  origin_stop_name?: string;
  destination_stop_id?: string;
  destination_stop_name?: string;

  // Route geometry
  stop_sequence?: string[];
  total_stops?: number;
  shape_id?: string;

  // Operational data
  operating_hours?: string;
  headway_min?: number;
  avg_trip_duration_min?: number;

  // Distance & fare
  total_distance_km?: number;
  base_fare: number;
  fare_per_km: number;

  // Visual
  color_code: string;
  text_color?: string;

  // Metadata
  agency_id?: string;
  city_served?: string[];
  popularity_score?: number;

  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}

// ============================================================================
// LOCATION MODEL
// ============================================================================

export interface TripLocation {
  type: LocationType;
  lat: number;
  lon: number;
  name: string;

  // If type is 'stop'
  stop_id?: string;
  stop_name?: string;
}

// ============================================================================
// TRIP LEG MODEL
// ============================================================================

export interface RouteInfo {
  route_id: string;
  route_name: string;
  route_short_name: string;
  color: string;
}

export interface TripLeg {
  // Identifiers
  leg_id: string;
  leg_type: LegType;
  leg_number: number;

  // Endpoints
  from: TripLocation;
  to: TripLocation;

  // Metrics
  distance_m: number;
  duration_min: number;
  fare: number;

  // PUJ-specific data (if leg_type === 'PUJ')
  route?: RouteInfo;
  stops_count?: number;
  shape?: [number, number][]; // [[lat, lon], ...]

  // Walking-specific data (if leg_type === 'walking')
  polyline?: [number, number][];

  // Instructions
  instructions: string;
}

// ============================================================================
// TRIP OPTION MODEL
// ============================================================================

export interface TripOption {
  // Identifiers
  option_id: string;
  rank: number;

  // Journey composition
  legs: TripLeg[];

  // Aggregate metrics
  total_time_min: number;
  total_fare: number;
  total_distance_m: number;
  total_walk_m: number;

  // Route characteristics
  num_transfers: number;
  num_puj_rides: number;

  // Quality score
  confidence_score: number;

  // Optional metadata
  carbon_saved_kg?: number;
  money_saved_php?: number;
  calories_burned?: number;
}

// ============================================================================
// TRIP QUERY MODEL
// ============================================================================

export interface TripQueryLocation {
  lat: number;
  lon: number;
  address?: string;
  name?: string;
}

export interface TripQuery {
  // User input
  origin: TripQueryLocation;
  destination: TripQueryLocation;

  // Preferences
  preference: RoutePreference;
  max_walk_m: number;
  max_transfers: number;

  // Metadata
  generated_at: string;
  user_uid?: string;
}

// ============================================================================
// TRIP RESPONSE MODEL
// ============================================================================

export interface TripResponseMetadata {
  total_options: number;
  computation_time_ms: number;
  nearest_stops_found: {
    origin: number;
    destination: number;
  };
}

export interface TripResponseError {
  code: string;
  message: string;
  suggestions?: string[];
}

export interface TripResponse {
  success: boolean;
  query: TripQuery;
  options: TripOption[];
  metadata: TripResponseMetadata;
  error?: TripResponseError;
}

// ============================================================================
// GEOCODING MODELS
// ============================================================================

export interface GeocodingAddress {
  building?: string;
  road?: string;
  suburb?: string;
  barangay?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country: string;
}

export interface GeocodingResult {
  place_id: string;
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  type: string;
  importance: number;
  address: GeocodingAddress;
}

// ============================================================================
// NEAREST STOP MODELS
// ============================================================================

export interface NearestStop extends EnhancedStop {
  distance_m: number;
  bearing_degrees: number;
  direction: string; // N, NE, E, SE, S, SW, W, NW
  walking_time_min: number;
  routes_count: number;
  routes: string[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isEnhancedStop(obj: any): obj is EnhancedStop {
  return (
    typeof obj === 'object' &&
    typeof obj.stop_id === 'string' &&
    typeof obj.stop_name === 'string' &&
    typeof obj.lat === 'number' &&
    typeof obj.lon === 'number' &&
    typeof obj.city === 'string'
  );
}

export function isTripLeg(obj: any): obj is TripLeg {
  return (
    typeof obj === 'object' &&
    typeof obj.leg_id === 'string' &&
    (obj.leg_type === 'walking' || obj.leg_type === 'PUJ') &&
    typeof obj.distance_m === 'number' &&
    typeof obj.duration_min === 'number'
  );
}

export function isTripOption(obj: any): obj is TripOption {
  return (
    typeof obj === 'object' &&
    typeof obj.option_id === 'string' &&
    Array.isArray(obj.legs) &&
    obj.legs.every(isTripLeg) &&
    typeof obj.total_time_min === 'number' &&
    typeof obj.total_fare === 'number'
  );
}

export function isGeocodingResult(obj: any): obj is GeocodingResult {
  return (
    typeof obj === 'object' &&
    typeof obj.place_id === 'string' &&
    typeof obj.lat === 'number' &&
    typeof obj.lon === 'number' &&
    typeof obj.display_name === 'string'
  );
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Coordinate = {
  lat: number;
  lon: number;
};

export type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};