const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
};

const response = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body)
});

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/.netlify/functions/trips', '');
  const pathSegments = path.split('/').filter(Boolean);

  try {
    // POST /trips - Start a new trip
    if (event.httpMethod === 'POST' && pathSegments.length === 0) {
      const tripData = JSON.parse(event.body);
      const {
        user_uid,
        from_location,
        to_location,
        route_name,
        transit_type,
        distance_km,
        fare_paid
      } = tripData;

      if (!user_uid || !from_location || !to_location) {
        return response(400, { error: 'Missing required fields' });
      }

      const result = await pool.query(`
        INSERT INTO user_trips (
          user_uid, from_location, to_location, route_name,
          transit_type, distance_km, fare_paid, status, started_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
        RETURNING *
      `, [user_uid, from_location, to_location, route_name, transit_type, distance_km, fare_paid]);

      return response(201, result.rows[0]);
    }

    // GET /trips/active/:userUid - Get active trips for user
    if (event.httpMethod === 'GET' && pathSegments[0] === 'active' && pathSegments.length === 2) {
      const userUid = pathSegments[1];

      const result = await pool.query(`
        SELECT * FROM user_trips
        WHERE user_uid = $1 AND status = 'active'
        ORDER BY started_at DESC
      `, [userUid]);

      return response(200, result.rows);
    }

    // GET /trips/completed/:userUid - Get completed trips for user
    if (event.httpMethod === 'GET' && pathSegments[0] === 'completed' && pathSegments.length === 2) {
      const userUid = pathSegments[1];

      const result = await pool.query(`
        SELECT * FROM user_trips
        WHERE user_uid = $1 AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 50
      `, [userUid]);

      return response(200, result.rows);
    }

    // PUT /trips/:tripId/complete - Mark trip as completed
    if (event.httpMethod === 'PUT' && pathSegments.length === 2 && pathSegments[1] === 'complete') {
      const tripId = pathSegments[0];

      const result = await pool.query(`
        UPDATE user_trips
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = $1 AND status = 'active'
        RETURNING *
      `, [tripId]);

      if (result.rows.length === 0) {
        return response(404, { error: 'Trip not found or already completed' });
      }

      // Award 10 points to the user for completing the trip
      const trip = result.rows[0];
      console.log(`Awarding 10 points to user: ${trip.user_uid}`);

      try {
        const pointsResult = await pool.query(`
          UPDATE users
          SET points = COALESCE(points, 0) + 10
          WHERE uid = $1
          RETURNING points
        `, [trip.user_uid]);

        if (pointsResult.rows.length > 0) {
          console.log(`✓ User now has ${pointsResult.rows[0].points} points`);
        } else {
          console.warn(`⚠ User ${trip.user_uid} not found in users table`);
        }
      } catch (pointsError) {
        console.error('Error updating points:', pointsError);
        // Don't fail the trip completion if points update fails
      }

      return response(200, result.rows[0]);
    }

    // GET /trips/stats/:userUid - Get trip statistics
    if (event.httpMethod === 'GET' && pathSegments[0] === 'stats' && pathSegments.length === 2) {
      const userUid = pathSegments[1];

      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as total_trips,
          COALESCE(SUM(distance_km) FILTER (WHERE status = 'completed'), 0) as total_distance,
          COALESCE(SUM(fare_paid) FILTER (WHERE status = 'completed'), 0) as total_spent
        FROM user_trips
        WHERE user_uid = $1
      `, [userUid]);

      return response(200, result.rows[0]);
    }

    return response(404, { error: 'Route not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};
