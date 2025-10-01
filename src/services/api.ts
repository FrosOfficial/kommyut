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
    const response = await fetch(`${API_URL}/gtfs/find-routes/${fromStopId}/${toStopId}`);
    if (!response.ok) {
      throw new Error('Failed to find routes between stops');
    }
    return await response.json();
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