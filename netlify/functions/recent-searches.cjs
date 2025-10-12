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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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

  const path = event.path.replace('/.netlify/functions/recent-searches', '');
  const pathSegments = path.split('/').filter(Boolean);

  try {
    // POST /recent-searches - Save a new search
    if (event.httpMethod === 'POST' && pathSegments.length === 0) {
      const searchData = JSON.parse(event.body);
      const {
        user_uid,
        from_location,
        to_location,
        from_stop_id,
        to_stop_id
      } = searchData;

      if (!user_uid || !from_location || !to_location) {
        return response(400, { error: 'Missing required fields' });
      }

      // Check if this exact search already exists
      const existingSearch = await pool.query(`
        SELECT id FROM recent_searches
        WHERE user_uid = $1
          AND from_location = $2
          AND to_location = $3
        LIMIT 1
      `, [user_uid, from_location, to_location]);

      if (existingSearch.rows.length > 0) {
        // Update the timestamp of existing search
        await pool.query(`
          UPDATE recent_searches
          SET searched_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
          WHERE id = $1
        `, [existingSearch.rows[0].id]);

        return response(200, { message: 'Search updated' });
      } else {
        // Insert new search
        await pool.query(`
          INSERT INTO recent_searches (
            user_uid, from_location, to_location, from_stop_id, to_stop_id, searched_at
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
        `, [user_uid, from_location, to_location, from_stop_id, to_stop_id]);

        // Keep only the 5 most recent searches per user
        await pool.query(`
          DELETE FROM recent_searches
          WHERE id IN (
            SELECT id FROM recent_searches
            WHERE user_uid = $1
            ORDER BY searched_at DESC
            OFFSET 5
          )
        `, [user_uid]);

        return response(201, { message: 'Search saved' });
      }
    }

    // GET /recent-searches/:userUid - Get recent searches for user
    if (event.httpMethod === 'GET' && pathSegments.length === 1) {
      const userUid = pathSegments[0];

      const result = await pool.query(`
        SELECT
          id,
          from_location,
          to_location,
          from_stop_id,
          to_stop_id,
          searched_at
        FROM recent_searches
        WHERE user_uid = $1
        ORDER BY searched_at DESC
        LIMIT 5
      `, [userUid]);

      return response(200, result.rows);
    }

    return response(404, { error: 'Route not found' });

  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};
