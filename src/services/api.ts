// Use Netlify Functions in production, localhost in development
const API_URL = import.meta.env.PROD 
  ? '/.netlify/functions' 
  : 'http://localhost:5000/api';

// User API
export const createOrUpdateUser = async (user: any) => {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
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
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

// Trip API
export const startTrip = async (tripData: {
  user_uid: string;
  from_location: string;
  to_location: string;
  transit_type?: string;
  route_name?: string;
  distance_km?: number;
  fare_paid?: number;
  money_saved?: number;
}) => {
  try {
    const response = await fetch(`${API_URL}/trips/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error starting trip:', error);
    throw error;
  }
};

export const endTrip = async (tripId: number, end_time?: string) => {
  try {
    const response = await fetch(`${API_URL}/trips/${tripId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ end_time }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error ending trip:', error);
    throw error;
  }
};

export const getUserTrips = async (user_uid: string, limit = 50, offset = 0) => {
  try {
    const response = await fetch(`${API_URL}/trips/user/${user_uid}?limit=${limit}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user trips:', error);
    throw error;
  }
};

export const getActiveTrip = async (user_uid: string) => {
  try {
    const response = await fetch(`${API_URL}/trips/user/${user_uid}/active`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching active trip:', error);
    throw error;
  }
};

export const getUserTripStats = async (user_uid: string, period = 'week') => {
  try {
    const response = await fetch(`${API_URL}/trips/user/${user_uid}/stats?period=${period}`);

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching trip stats:', error);
    throw error;
  }
};

export const getPopularRoutes = async (limit = 3) => {
  try {
    const response = await fetch(`${API_URL}/trips/popular-routes?limit=${limit}`);

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching popular routes:', error);
    throw error;
  }
};

export const getDailyTripHistory = async (user_uid: string, days = 7) => {
  try {
    const response = await fetch(`${API_URL}/trips/user/${user_uid}/daily?days=${days}`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching daily trip history:', error);
    throw error;
  }
};

// GTFS API
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

// Fare API
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

// Saved Routes API
export const getSavedRoutes = async (user_uid: string) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes/user/${user_uid}`);
    if (!response.ok) {
      throw new Error('Failed to fetch saved routes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching saved routes:', error);
    throw error;
  }
};

export const saveRoute = async (routeData: {
  user_uid: string;
  name: string;
  from_stop_id: string;
  from_stop_name: string;
  to_stop_id: string;
  to_stop_name: string;
  route_id?: string;
  route_name?: string;
  transit_type?: string;
}) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(routeData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save route');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving route:', error);
    throw error;
  }
};

export const updateSavedRoute = async (id: number, updates: { name?: string; times_used?: number }) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update saved route');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating saved route:', error);
    throw error;
  }
};

export const incrementRouteUsage = async (id: number) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes/${id}/use`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to increment route usage');
    }

    return await response.json();
  } catch (error) {
    console.error('Error incrementing route usage:', error);
    throw error;
  }
};

export const deleteSavedRoute = async (id: number) => {
  try {
    const response = await fetch(`${API_URL}/saved-routes/${id}`, {
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