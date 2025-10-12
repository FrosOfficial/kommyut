const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const query = (text, params) => pool.query(text, params);

// Helper to create response
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

// Simple PUJ fare calculation based on distance (2024 rates)
const calculatePUJFare = (distanceKm) => {
  if (distanceKm <= 5) {
    return { regular_fare: 13, discounted_fare: 10 };
  } else if (distanceKm <= 10) {
    return { regular_fare: 15, discounted_fare: 12 };
  } else if (distanceKm <= 15) {
    return { regular_fare: 18, discounted_fare: 14 };
  } else {
    return { regular_fare: 20, discounted_fare: 16 };
  }
};

// Simple PUB fare calculation based on distance (2024 rates)
const calculatePUBFare = (distanceKm, type = 'aircon') => {
  if (type === 'aircon') {
    if (distanceKm <= 5) {
      return { regular_fare: 15, discounted_fare: 12 };
    } else if (distanceKm <= 10) {
      return { regular_fare: 20, discounted_fare: 16 };
    } else if (distanceKm <= 15) {
      return { regular_fare: 25, discounted_fare: 20 };
    } else {
      return { regular_fare: 30, discounted_fare: 24 };
    }
  } else {
    // ordinary
    if (distanceKm <= 5) {
      return { regular_fare: 12, discounted_fare: 10 };
    } else if (distanceKm <= 10) {
      return { regular_fare: 15, discounted_fare: 12 };
    } else if (distanceKm <= 15) {
      return { regular_fare: 18, discounted_fare: 14 };
    } else {
      return { regular_fare: 22, discounted_fare: 18 };
    }
  }
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/.netlify/functions/fares', '');

  try {
    // GET /puj/distance/:distance - PUJ distance fare
    const pujDistanceMatch = path.match(/^\/puj\/distance\/([0-9.]+)$/);
    if (pujDistanceMatch && event.httpMethod === 'GET') {
      const distance = parseFloat(pujDistanceMatch[1]);

      if (isNaN(distance) || distance < 0) {
        return response(400, { error: 'Invalid distance parameter', received: pujDistanceMatch[1] });
      }

      const fare = calculatePUJFare(distance);
      return response(200, fare);
    }

    // GET /pub/distance/:distance - PUB distance fare
    const pubDistanceMatch = path.match(/^\/pub\/distance\/([0-9.]+)$/);
    if (pubDistanceMatch && event.httpMethod === 'GET') {
      const distance = parseFloat(pubDistanceMatch[1]);

      if (isNaN(distance) || distance < 0) {
        return response(400, { error: 'Invalid distance parameter', received: pubDistanceMatch[1] });
      }

      const airconFare = calculatePUBFare(distance, 'aircon');
      const ordinaryFare = calculatePUBFare(distance, 'ordinary');

      return response(200, [
        { type: 'aircon', ...airconFare },
        { type: 'ordinary', ...ordinaryFare }
      ]);
    }

    // GET /pub/tables - PUB fare tables
    if (path === '/pub/tables' && event.httpMethod === 'GET') {
      const distances = [5, 10, 15, 20];
      const tables = [];

      distances.forEach(dist => {
        const aircon = calculatePUBFare(dist, 'aircon');
        const ordinary = calculatePUBFare(dist, 'ordinary');
        tables.push({ type: 'aircon', distance: dist, ...aircon });
        tables.push({ type: 'ordinary', distance: dist, ...ordinary });
      });

      return response(200, tables);
    }

    // GET /puj/table - PUJ fare table
    if (path === '/puj/table' && event.httpMethod === 'GET') {
      const distances = [5, 10, 15, 20];
      const table = distances.map(dist => ({
        distance: dist,
        ...calculatePUJFare(dist)
      }));

      return response(200, table);
    }

    // GET /distances - Max distances
    if (path === '/distances' && event.httpMethod === 'GET') {
      return response(200, [
        { type: 'pub', max_distance: 20 },
        { type: 'puj', max_distance: 20 }
      ]);
    }

    // GET /gtfs/:routeId/:fromStopId/:toStopId - GTFS fare from database
    const gtfsFareMatch = path.match(/^\/gtfs\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
    if (gtfsFareMatch && event.httpMethod === 'GET') {
      const [, routeId, fromStopId, toStopId] = gtfsFareMatch;

      const result = await query(`
        SELECT fa.price, fa.currency_type
        FROM fare_rules fr
        JOIN fare_attributes fa ON fr.fare_id = fa.fare_id
        WHERE fr.route_id = $1
          AND fr.origin_id = $2
          AND fr.destination_id = $3
        LIMIT 1
      `, [routeId, fromStopId, toStopId]);

      if (result.rows.length === 0) {
        // Return default jeepney fare if no specific fare found
        return response(200, {
          regular_fare: 13,
          discounted_fare: 10,
          currency: 'PHP',
          note: 'Default jeepney fare applied'
        });
      }

      return response(200, {
        regular_fare: parseFloat(result.rows[0].price),
        discounted_fare: parseFloat(result.rows[0].price) * 0.8,
        currency: result.rows[0].currency_type
      });
    }

    // GET /:transitType/:fromStation/:toStation - Legacy station-to-station fare
    const stationFareMatch = path.match(/^\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
    if (stationFareMatch && event.httpMethod === 'GET') {
      const [, transitType] = stationFareMatch;

      // For now, return default fares for rail systems
      const railFares = {
        lrt1: { fare: 15 },
        lrt2: { fare: 15 },
        mrt: { fare: 15 },
        pnr: { fare: 20 }
      };

      const fare = railFares[transitType.toLowerCase()];
      if (fare) {
        return response(200, fare);
      }

      return response(400, { error: 'Invalid transit type' });
    }

    return response(404, { error: 'Not found', path });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};
