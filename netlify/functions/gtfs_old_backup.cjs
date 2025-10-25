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

    // GET /routes/:routeId/shape - Get shape data for a specific route
    const routeShapeMatch = path.match(/^\/routes\/([^\/]+)\/shape$/);
    if (routeShapeMatch && event.httpMethod === 'GET') {
      const routeId = routeShapeMatch[1];
      // First, find a trip with this route_id that has a shape_id
      const tripResult = await query(`
        SELECT shape_id
        FROM trips
        WHERE route_id = $1 AND shape_id IS NOT NULL
        LIMIT 1
      `, [routeId]);

      if (tripResult.rows.length === 0) {
        return response(200, []); // No shape data available
      }

      const shapeId = tripResult.rows[0].shape_id;

      // Get all shape points for this shape_id
      const shapeResult = await query(`
        SELECT
          shape_id,
          shape_pt_lat,
          shape_pt_lon,
          shape_pt_sequence,
          shape_dist_traveled
        FROM shapes
        WHERE shape_id = $1
        ORDER BY shape_pt_sequence
      `, [shapeId]);

      return response(200, shapeResult.rows);
    }

    // GET /trip-shapes/:fromStopId/:toStopId - Get all shapes for a complete journey
    const tripShapesMatch = path.match(/^\/trip-shapes\/([^\/]+)\/([^\/]+)$/);
    if (tripShapesMatch && event.httpMethod === 'GET') {
      const [, fromStopId, toStopId] = tripShapesMatch;

      // Find the route that connects these stops (allows multi-modal trips)
      const routeResult = await query(`
        SELECT DISTINCT r.route_id
        FROM routes r
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
        LIMIT 1
      `, [fromStopId, toStopId]);

      if (routeResult.rows.length === 0) {
        return response(200, { segments: [] });
      }

      const routeId = routeResult.rows[0].route_id;

      // First, try to find trips that directly connect origin to destination
      const directTripsResult = await query(`
        SELECT DISTINCT
          t.trip_id,
          t.trip_headsign,
          t.shape_id
        FROM trips t
        WHERE t.route_id = $1
          AND EXISTS (
            SELECT 1 FROM stop_times st1
            WHERE st1.trip_id = t.trip_id AND st1.stop_id = $2
          )
          AND EXISTS (
            SELECT 1 FROM stop_times st2
            WHERE st2.trip_id = t.trip_id AND st2.stop_id = $3
          )
        ORDER BY t.trip_id
      `, [routeId, fromStopId, toStopId]);

      let tripsResult;

      if (directTripsResult.rows.length > 0) {
        // Found direct trip(s) - use only those
        tripsResult = directTripsResult;
      } else {
        // No direct trip - get connected segments (multi-modal)
        tripsResult = await query(`
          WITH trip_stops AS (
            SELECT
              t.trip_id,
              t.trip_headsign,
              t.shape_id,
              st.stop_id,
              st.stop_sequence
            FROM trips t
            JOIN stop_times st ON t.trip_id = st.trip_id
            WHERE t.route_id = $1
          ),
          origin_trips AS (
            SELECT trip_id FROM trip_stops WHERE stop_id = $2
          ),
          dest_trips AS (
            SELECT trip_id FROM trip_stops WHERE stop_id = $3
          )
          SELECT DISTINCT
            t.trip_id,
            t.trip_headsign,
            t.shape_id,
            MIN(ts.stop_sequence) as min_seq
          FROM trips t
          JOIN trip_stops ts ON t.trip_id = ts.trip_id
          WHERE t.route_id = $1
            AND (
              t.trip_id IN (SELECT trip_id FROM origin_trips)
              OR t.trip_id IN (SELECT trip_id FROM dest_trips)
            )
          GROUP BY t.trip_id, t.trip_headsign, t.shape_id
          ORDER BY MIN(ts.stop_sequence)
        `, [routeId, fromStopId, toStopId]);
      }

      if (tripsResult.rows.length === 0) {
        return response(200, { segments: [] });
      }

      // Get shapes for all trips, avoiding duplicates by shape_id
      const segments = [];
      const seenShapeIds = new Set();

      for (const trip of tripsResult.rows) {
        if (trip.shape_id && !seenShapeIds.has(trip.shape_id)) {
          seenShapeIds.add(trip.shape_id);

          const shapesResult = await query(`
            SELECT
              shape_id,
              shape_pt_lat,
              shape_pt_lon,
              shape_pt_sequence,
              shape_dist_traveled
            FROM shapes
            WHERE shape_id = $1
            ORDER BY shape_pt_sequence
          `, [trip.shape_id]);

          if (shapesResult.rows.length > 0) {
            segments.push({
              trip_id: trip.trip_id,
              trip_headsign: trip.trip_headsign,
              shape_id: trip.shape_id,
              points: shapesResult.rows
            });
          }
        }
      }

      return response(200, { segments });
    }

    // GET /nearest-stop - Find nearest stops to a lat/lon
    const nearestStopMatch = path.match(/^\/nearest-stop$/);
    if (nearestStopMatch && event.httpMethod === 'GET') {
      const { lat, lon, radius = 1000, limit = 5 } = event.queryStringParameters || {};

      if (!lat || !lon) {
        return response(400, { error: 'Missing lat or lon parameters' });
      }

      // Use Haversine formula to find nearest stops
      const result = await query(`
        SELECT
          stop_id,
          stop_name,
          stop_lat,
          stop_lon,
          city,
          (
            6371000 * acos(
              cos(radians($1)) * cos(radians(CAST(stop_lat AS FLOAT))) *
              cos(radians(CAST(stop_lon AS FLOAT)) - radians($2)) +
              sin(radians($1)) * sin(radians(CAST(stop_lat AS FLOAT)))
            )
          ) AS distance
        FROM stops
        WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL
        HAVING distance <= $3
        ORDER BY distance
        LIMIT $4
      `, [parseFloat(lat), parseFloat(lon), parseFloat(radius), parseInt(limit)]);

      return response(200, { stops: result.rows });
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};

