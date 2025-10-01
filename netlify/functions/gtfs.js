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

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/.netlify/functions/gtfs', '');
  
  try {
    // GET /stops - Get all stops
    if (path === '/stops' && event.httpMethod === 'GET') {
      const result = await query('SELECT * FROM stops ORDER BY stop_name');
      return response(200, result.rows);
    }

    // GET /routes - Get all routes
    if (path === '/routes' && event.httpMethod === 'GET') {
      const result = await query(`
        SELECT DISTINCT 
          r.route_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.agency_id,
          a.agency_name
        FROM routes r
        LEFT JOIN agency a ON r.agency_id = a.agency_id
        ORDER BY r.route_short_name
      `);
      return response(200, result.rows);
    }

    // GET /routes/:routeId/stops - Get stops for a specific route
    const routeStopsMatch = path.match(/^\/routes\/([^\/]+)\/stops$/);
    if (routeStopsMatch && event.httpMethod === 'GET') {
      const routeId = routeStopsMatch[1];
      const result = await query(`
        SELECT DISTINCT 
          s.stop_id,
          s.stop_name,
          s.stop_lat,
          s.stop_lon,
          s.city
        FROM stops s
        JOIN stop_times st ON s.stop_id = st.stop_id
        JOIN trips t ON st.trip_id = t.trip_id
        WHERE t.route_id = $1
        ORDER BY s.stop_name
      `, [routeId]);
      return response(200, result.rows);
    }

    // GET /routes/:routeId/schedule - Get schedule for a specific route
    const routeScheduleMatch = path.match(/^\/routes\/([^\/]+)\/schedule$/);
    if (routeScheduleMatch && event.httpMethod === 'GET') {
      const routeId = routeScheduleMatch[1];
      const result = await query(`
        SELECT 
          st.stop_id,
          st.arrival_time,
          st.departure_time,
          st.stop_sequence,
          s.stop_name
        FROM stop_times st
        JOIN trips t ON st.trip_id = t.trip_id
        JOIN stops s ON st.stop_id = s.stop_id
        WHERE t.route_id = $1
        ORDER BY st.stop_sequence
        LIMIT 100
      `, [routeId]);
      return response(200, result.rows);
    }

    // GET /find-routes/:fromStopId/:toStopId - Find routes connecting two stops
    const findRoutesMatch = path.match(/^\/find-routes\/([^\/]+)\/([^\/]+)$/);
    if (findRoutesMatch && event.httpMethod === 'GET') {
      const [, fromStopId, toStopId] = findRoutesMatch;
      const result = await query(`
        SELECT DISTINCT 
          r.route_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.agency_id,
          a.agency_name
        FROM routes r
        LEFT JOIN agency a ON r.agency_id = a.agency_id
        WHERE EXISTS (
          SELECT 1 FROM stop_times st1
          JOIN trips t1 ON st1.trip_id = t1.trip_id
          WHERE t1.route_id = r.route_id AND st1.stop_id = $1
        )
        AND EXISTS (
          SELECT 1 FROM stop_times st2
          JOIN trips t2 ON st2.trip_id = t2.trip_id
          WHERE t2.route_id = r.route_id AND st2.stop_id = $2
        )
      `, [fromStopId, toStopId]);
      return response(200, result.rows);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};

