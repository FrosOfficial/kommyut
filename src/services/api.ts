// Use Netlify Functions in both production and development (when using netlify dev)
// For development: run `netlify dev` instead of `npm run dev`
const API_URL = import.meta.env.PROD
  ? '/.netlify/functions'
  : '/.netlify/functions'; // Use Netlify Dev's proxy in development too

// ============================================================================
// GTFS API - Transit Data (Routes, Stops, etc.)
// ============================================================================

export const getAllStops = async () => {
  try {
    const response = await fetch(`${API_URL}/gtfs/stops`);
    if (!response.ok) {
      throw new Error('Failed to fetch stops');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching stops:', error);
    throw error;
  }
};

export const getGtfsRoutes = async () => {
  try {
    const response = await fetch(`${API_URL}/gtfs/routes`);
    if (!response.ok) {
      throw new Error('Failed to fetch GTFS routes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching GTFS routes:', error);
    throw error;
  }
};

export const getGtfsStops = async (routeId?: string) => {
  try {
    const url = routeId
      ? `${API_URL}/gtfs/routes/${routeId}/stops`
      : `${API_URL}/gtfs/stops`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch GTFS stops');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching GTFS stops:', error);
    throw error;
  }
};

export const getRouteStops = async (routeId: string) => {
  try {
    const response = await fetch(`${API_URL}/gtfs/routes/${routeId}/stops`);
    if (!response.ok) {
      throw new Error('Failed to fetch route stops');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching route stops:', error);
    throw error;
  }
};

export const getRouteSchedule = async (routeId: string) => {
  try {
    const response = await fetch(`${API_URL}/gtfs/routes/${routeId}/schedule`);
    if (!response.ok) {
      throw new Error('Failed to fetch route schedule');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching route schedule:', error);
    throw error;
  }
};

export const getRouteShape = async (routeId: string) => {
  try {
    const response = await fetch(`${API_URL}/gtfs/routes/${routeId}/shape`);
    if (!response.ok) {
      // Shape data is optional - silently return empty array
      return [];
    }
    return await response.json();
  } catch (error) {
    // Shape data is optional - return empty array instead of throwing
    return [];
  }
};

export const getTripShapes = async (fromStopId: string, toStopId: string) => {
  try {
    const response = await fetch(`${API_URL}/gtfs/trip-shapes/${fromStopId}/${toStopId}`);
    if (!response.ok) {
      return { segments: [] };
    }
    return await response.json();
  } catch (error) {
    return { segments: [] };
  }
};

export const findRoutesBetweenStops = async (fromStopId: string, toStopId: string) => {
  try {
    console.log('API: Calling findRoutesBetweenStops with:', fromStopId, toStopId);
    const url = `${API_URL}/gtfs/find-routes/${fromStopId}/${toStopId}`;
    console.log('API: Full URL:', url);
    const response = await fetch(url);
    console.log('API: Response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API: Response error:', errorText);
      throw new Error(`Failed to find routes between stops: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    console.log('API: Response data:', data);
    return data;
  } catch (error) {
    console.error('Error finding routes between stops:', error);
    throw error;
  }
};

// ============================================================================
// FARE API - Transit Fares
// ============================================================================

export const getFare = async (transitType: string, fromStation: string, toStation: string) => {
  try {
    const response = await fetch(`${API_URL}/fares/${transitType}/${fromStation}/${toStation}`);
    if (!response.ok) {
      throw new Error('Failed to fetch fare');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching fare:', error);
    throw error;
  }
};

export const getPubFareByDistance = async (distance: number) => {
  try {
    const response = await fetch(`${API_URL}/fares/pub/distance/${distance}`);
    if (!response.ok) {
      throw new Error('Failed to fetch PUB fare');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching PUB fare:', error);
    throw error;
  }
};

export const getPujFareByDistance = async (distance: number) => {
  try {
    const response = await fetch(`${API_URL}/fares/puj/distance/${distance}`);
    if (!response.ok) {
      throw new Error('Failed to fetch PUJ fare');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching PUJ fare:', error);
    throw error;
  }
};

export const getPubFareTables = async () => {
  try {
    const response = await fetch(`${API_URL}/fares/pub/tables`);
    if (!response.ok) {
      throw new Error('Failed to fetch PUB fare tables');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching PUB fare tables:', error);
    throw error;
  }
};

export const getPujFareTable = async () => {
  try {
    const response = await fetch(`${API_URL}/fares/puj/table`);
    if (!response.ok) {
      throw new Error('Failed to fetch PUJ fare table');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching PUJ fare table:', error);
    throw error;
  }
};

export const getMaxDistances = async () => {
  try {
    const response = await fetch(`${API_URL}/fares/distances`);
    if (!response.ok) {
      throw new Error('Failed to fetch max distances');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching max distances:', error);
    throw error;
  }
};

// ============================================================================
// GEOCODING API - Address Search
// ============================================================================

export interface GeocodingResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    city?: string;
    municipality?: string;
    province?: string;
    country?: string;
  };
}

// ============================================================================
// NEAREST STOP API
// ============================================================================

export const getNearestStops = async (
  lat: number,
  lon: number,
  radius: number = 700,
  limit: number = 5
) => {
  try {
    const response = await fetch(
      `${API_URL}/gtfs/nearest-stop?lat=${lat}&lon=${lon}&radius=${radius}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error('Failed to find nearest stops');
    }

    const data = await response.json();
    return data.stops || [];
  } catch (error) {
    console.error('Error finding nearest stops:', error);
    throw error;
  }
};

// ============================================================================
// USER MANAGEMENT API
// ============================================================================

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export const createOrUpdateUser = async (userData: UserData) => {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Failed to create or update user');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
};

export const getUserByUid = async (uid: string) => {
  try {
    const response = await fetch(`${API_URL}/users/${uid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

// ============================================================================
// SAVED ROUTES API
// ============================================================================

export interface SavedRouteData {
  user_uid: string;
  name: string;
  from_stop_id: string;
  from_stop_name: string;
  to_stop_id: string;
  to_stop_name: string;
  route_id?: string;
  route_name?: string;
  transit_type?: string;
}

export const saveRoute = async (routeData: SavedRouteData) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(routeData),
    });

    if (!response.ok) {
      throw new Error('Failed to save route');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving route:', error);
    throw error;
  }
};

export const getSavedRoutes = async (userUid: string) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes/${userUid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch saved routes');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching saved routes:', error);
    throw error;
  }
};

export const deleteSavedRoute = async (routeId: number) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes/${routeId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete saved route');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting saved route:', error);
    throw error;
  }
};

// ============================================================================
// TRIPS API - User Trip Tracking
// ============================================================================

export interface TripData {
  user_uid: string;
  from_location: string;
  to_location: string;
  route_name?: string;
  transit_type?: string;
  distance_km?: number;
  fare_paid?: number;
}

export interface Trip {
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

export const startTrip = async (tripData: TripData) => {
  try {
    const response = await fetch(`${API_URL}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData),
    });

    if (!response.ok) {
      throw new Error('Failed to start trip');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting trip:', error);
    throw error;
  }
};

export const getActiveTrips = async (userUid: string) => {
  try {
    const response = await fetch(`${API_URL}/trips/active/${userUid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch active trips');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching active trips:', error);
    throw error;
  }
};

export const getCompletedTrips = async (userUid: string) => {
  try {
    const response = await fetch(`${API_URL}/trips/completed/${userUid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch completed trips');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching completed trips:', error);
    throw error;
  }
};

export const completeTrip = async (tripId: number) => {
  try {
    const response = await fetch(`${API_URL}/trips/${tripId}/complete`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Failed to complete trip');
    }

    return await response.json();
  } catch (error) {
    console.error('Error completing trip:', error);
    throw error;
  }
};

export const getTripStats = async (userUid: string) => {
  try {
    const response = await fetch(`${API_URL}/trips/stats/${userUid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch trip stats');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching trip stats:', error);
    throw error;
  }
};

// ============================================================================
// RECENT SEARCHES API
// ============================================================================

export interface RecentSearchData {
  user_uid: string;
  from_location: string;
  to_location: string;
  from_stop_id?: string;
  to_stop_id?: string;
}

export interface RecentSearch {
  id: number;
  from_location: string;
  to_location: string;
  from_stop_id: string | null;
  to_stop_id: string | null;
  searched_at: string;
}

export const saveRecentSearch = async (searchData: RecentSearchData) => {
  try {
    const response = await fetch(`${API_URL}/recent-searches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchData),
    });

    if (!response.ok) {
      throw new Error('Failed to save recent search');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving recent search:', error);
    throw error;
  }
};

export const getRecentSearches = async (userUid: string) => {
  try {
    const response = await fetch(`${API_URL}/recent-searches/${userUid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch recent searches');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    throw error;
  }
};
