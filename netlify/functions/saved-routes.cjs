const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/saved-routes', '');
    const pathSegments = path.split('/').filter(Boolean);

    // Create saved_routes table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_routes (
        id SERIAL PRIMARY KEY,
        user_uid VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        from_stop_id VARCHAR(100),
        from_stop_name VARCHAR(255) NOT NULL,
        to_stop_id VARCHAR(100),
        to_stop_name VARCHAR(255) NOT NULL,
        route_id VARCHAR(100),
        route_name VARCHAR(255),
        transit_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // POST /saved-routes - Create new saved route
    if (event.httpMethod === 'POST' && pathSegments.length === 0) {
      const routeData = JSON.parse(event.body);
      const {
        user_uid,
        name,
        from_stop_id,
        from_stop_name,
        to_stop_id,
        to_stop_name,
        route_id,
        route_name,
        transit_type
      } = routeData;

      if (!user_uid || !name || !from_stop_name || !to_stop_name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      const result = await pool.query(`
        INSERT INTO saved_routes (
          user_uid, name, from_stop_id, from_stop_name,
          to_stop_id, to_stop_name, route_id, route_name, transit_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        user_uid, name, from_stop_id, from_stop_name,
        to_stop_id, to_stop_name, route_id, route_name, transit_type
      ]);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(result.rows[0])
      };
    }

    // GET /saved-routes/:userUid - Get user's saved routes
    if (event.httpMethod === 'GET' && pathSegments.length === 1) {
      const userUid = pathSegments[0];

      const result = await pool.query(
        'SELECT * FROM saved_routes WHERE user_uid = $1 ORDER BY created_at DESC',
        [userUid]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // DELETE /saved-routes/:routeId - Delete saved route
    if (event.httpMethod === 'DELETE' && pathSegments.length === 1) {
      const routeId = pathSegments[0];

      const result = await pool.query(
        'DELETE FROM saved_routes WHERE id = $1 RETURNING *',
        [routeId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Route not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Route deleted successfully' })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
