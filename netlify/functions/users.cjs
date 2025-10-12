const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/users', '');
    const pathSegments = path.split('/').filter(Boolean);

    // POST /users - Create or update user
    if (event.httpMethod === 'POST' && pathSegments.length === 0) {
      const userData = JSON.parse(event.body);
      const { uid, email, displayName, photoURL } = userData;

      if (!uid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'uid is required' })
        };
      }

      // Create users table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          uid VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255),
          display_name VARCHAR(255),
          photo_url TEXT,
          points INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Upsert user
      const result = await pool.query(`
        INSERT INTO users (uid, email, display_name, photo_url, points, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
        ON CONFLICT (uid)
        DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          photo_url = EXCLUDED.photo_url,
          updated_at = NOW()
        RETURNING *
      `, [uid, email, displayName, photoURL]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0])
      };
    }

    // GET /users/:uid - Get user by UID
    if (event.httpMethod === 'GET' && pathSegments.length === 1) {
      const uid = pathSegments[0];

      const result = await pool.query(
        'SELECT * FROM users WHERE uid = $1',
        [uid]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0])
      };
    }

    // Route not found
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
