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

    // GET /trips/route-demand - Get frequently used routes (highest demand)
    if (event.httpMethod === 'GET' && pathSegments[0] === 'route-demand' && pathSegments.length === 1) {
      const result = await pool.query(`
        SELECT
          from_location,
          to_location,
          route_name,
          transit_type,
          COUNT(*) as trip_count,
          COUNT(DISTINCT user_uid) as unique_users,
          ROUND(AVG(distance_km)::numeric, 2) as avg_distance,
          ROUND(AVG(fare_paid)::numeric, 2) as avg_fare,
          ROUND(SUM(fare_paid)::numeric, 2) as total_revenue
        FROM user_trips
        WHERE status = 'completed'
          AND transit_type IS NOT NULL
          AND transit_type != 'WALK'
          AND transit_type != 'walking'
          AND fare_paid > 0
          AND distance_km > 0.5
        GROUP BY from_location, to_location, route_name, transit_type
        ORDER BY trip_count DESC
        LIMIT 50
      `);

      return response(200, result.rows);
    }

    // GET /trips/all-stats - Get overall trip statistics (completed vs active)
    if (event.httpMethod === 'GET' && pathSegments[0] === 'all-stats' && pathSegments.length === 1) {
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as completed_trips,
          COUNT(*) FILTER (WHERE status = 'active') as active_trips,
          COUNT(*) as total_trips,
          COUNT(DISTINCT user_uid) FILTER (WHERE status = 'completed') as users_completed,
          COUNT(DISTINCT user_uid) FILTER (WHERE status = 'active') as users_active,
          COUNT(DISTINCT user_uid) as total_users,
          ROUND(COALESCE(SUM(distance_km) FILTER (WHERE status = 'completed'), 0)::numeric, 2) as total_distance_completed,
          ROUND(COALESCE(SUM(fare_paid) FILTER (WHERE status = 'completed'), 0)::numeric, 2) as total_revenue
        FROM user_trips
      `);

      return response(200, result.rows[0]);
    }

    // GET /trips/fare-analytics - Get total fare accumulated with time-based breakdown
    if (event.httpMethod === 'GET' && pathSegments[0] === 'fare-analytics' && pathSegments.length === 1) {
      const { period } = event.queryStringParameters || {};

      let timeFilter = '';
      let groupBy = '';
      let dateFormat = '';

      switch (period) {
        case 'day':
          timeFilter = `AND completed_at >= CURRENT_DATE - INTERVAL '30 days'`;
          groupBy = `DATE(completed_at AT TIME ZONE 'Asia/Manila')`;
          dateFormat = `TO_CHAR(DATE(completed_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD')`;
          break;
        case 'week':
          timeFilter = `AND completed_at >= CURRENT_DATE - INTERVAL '12 weeks'`;
          groupBy = `DATE_TRUNC('week', completed_at AT TIME ZONE 'Asia/Manila')`;
          dateFormat = `TO_CHAR(DATE_TRUNC('week', completed_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD')`;
          break;
        case 'month':
          timeFilter = `AND completed_at >= CURRENT_DATE - INTERVAL '12 months'`;
          groupBy = `DATE_TRUNC('month', completed_at AT TIME ZONE 'Asia/Manila')`;
          dateFormat = `TO_CHAR(DATE_TRUNC('month', completed_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM')`;
          break;
        default:
          // Overall stats
          const overallResult = await pool.query(`
            SELECT
              ROUND(SUM(fare_paid)::numeric, 2) as total_revenue,
              COUNT(*) as total_trips,
              COUNT(DISTINCT user_uid) as unique_users,
              ROUND(AVG(fare_paid)::numeric, 2) as avg_fare_per_trip,
              ROUND(SUM(distance_km)::numeric, 2) as total_distance
            FROM user_trips
            WHERE status = 'completed'
          `);
          return response(200, { summary: overallResult.rows[0], breakdown: [] });
      }

      const [summaryResult, breakdownResult] = await Promise.all([
        pool.query(`
          SELECT
            ROUND(SUM(fare_paid)::numeric, 2) as total_revenue,
            COUNT(*) as total_trips,
            COUNT(DISTINCT user_uid) as unique_users,
            ROUND(AVG(fare_paid)::numeric, 2) as avg_fare_per_trip,
            ROUND(SUM(distance_km)::numeric, 2) as total_distance
          FROM user_trips
          WHERE status = 'completed'
          ${timeFilter}
        `),
        pool.query(`
          SELECT
            ${dateFormat} as period,
            ROUND(SUM(fare_paid)::numeric, 2) as revenue,
            COUNT(*) as trips,
            COUNT(DISTINCT user_uid) as users
          FROM user_trips
          WHERE status = 'completed'
          ${timeFilter}
          GROUP BY ${groupBy}
          ORDER BY ${groupBy} ASC
        `)
      ]);

      return response(200, {
        summary: summaryResult.rows[0],
        breakdown: breakdownResult.rows
      });
    }

    return response(404, { error: 'Route not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};
