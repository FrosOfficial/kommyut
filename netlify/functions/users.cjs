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
      const { uid, email, displayName, photoURL, role, birthday, userType, idVerified, idDocumentUrl } = userData;

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
          role VARCHAR(50) DEFAULT 'user',
          points INTEGER DEFAULT 0,
          recent_searches TEXT,
          birthday DATE,
          user_type VARCHAR(20) DEFAULT 'regular',
          id_verified BOOLEAN DEFAULT FALSE,
          id_document_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create verification_history table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS verification_history (
          id SERIAL PRIMARY KEY,
          uid VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          display_name VARCHAR(255),
          user_type VARCHAR(20),
          id_document_url TEXT,
          action VARCHAR(20) NOT NULL,
          verified BOOLEAN NOT NULL,
          note TEXT,
          verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
        )
      `);

      // Add new columns if they don't exist (for existing tables)
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS birthday DATE,
        ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'regular',
        ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS id_document_url TEXT,
        ADD COLUMN IF NOT EXISTS verification_note TEXT
      `).catch(() => {}); // Ignore error if columns already exist

      // Upsert user (don't overwrite existing values if not provided)
      const result = await pool.query(`
        INSERT INTO users (uid, email, display_name, photo_url, role, birthday, user_type, id_verified, id_document_url, points, created_at, updated_at)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'user'), $6, COALESCE($7, 'regular'), COALESCE($8, FALSE), $9, 0, NOW(), NOW())
        ON CONFLICT (uid)
        DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          photo_url = EXCLUDED.photo_url,
          role = COALESCE(EXCLUDED.role, users.role),
          birthday = COALESCE(EXCLUDED.birthday, users.birthday),
          user_type = COALESCE(EXCLUDED.user_type, users.user_type),
          id_verified = CASE WHEN EXCLUDED.id_verified IS NOT NULL THEN EXCLUDED.id_verified ELSE users.id_verified END,
          id_document_url = CASE WHEN EXCLUDED.id_document_url IS NOT NULL THEN EXCLUDED.id_document_url ELSE users.id_document_url END,
          updated_at = NOW()
        RETURNING *
      `, [uid, email, displayName, photoURL, role || null, birthday || null, userType || null, idVerified !== undefined ? idVerified : null, idDocumentUrl || null]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0])
      };
    }

    // GET /users/pending-verification - Get all users with pending ID verification
    if (event.httpMethod === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'pending-verification') {
      const result = await pool.query(
        `SELECT uid, email, display_name, user_type, id_document_url, birthday, created_at, updated_at
         FROM users
         WHERE id_document_url IS NOT NULL
         AND id_verified = FALSE
         AND user_type != 'regular'
         ORDER BY updated_at DESC`
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // GET /users/verification-history - Get all verification history (approved and rejected)
    if (event.httpMethod === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'verification-history') {
      const result = await pool.query(
        `SELECT id, uid, email, display_name, user_type, id_document_url, action, verified, note, verified_at
         FROM verification_history
         ORDER BY verified_at DESC`
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // GET /users/stats - Get user statistics
    if (event.httpMethod === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'stats') {
      const totalUsersResult = await pool.query('SELECT COUNT(*) as total FROM users');
      const regularUsersResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE user_type = $1', ['regular']);
      const studentUsersResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE user_type = $1', ['student']);
      const seniorUsersResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE user_type = $1', ['senior']);
      const pwdUsersResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE user_type = $1', ['pwd']);
      const verifiedUsersResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE id_verified = TRUE');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          totalUsers: parseInt(totalUsersResult.rows[0].total),
          regularUsers: parseInt(regularUsersResult.rows[0].total),
          studentUsers: parseInt(studentUsersResult.rows[0].total),
          seniorUsers: parseInt(seniorUsersResult.rows[0].total),
          pwdUsers: parseInt(pwdUsersResult.rows[0].total),
          verifiedUsers: parseInt(verifiedUsersResult.rows[0].total)
        })
      };
    }

    // GET /users/age-demographics - Get user age demographics
    if (event.httpMethod === 'GET' && pathSegments.length === 1 && pathSegments[0] === 'age-demographics') {
      // Query to calculate age groups and total trips per age group
      const result = await pool.query(`
        SELECT
          age_group,
          COUNT(DISTINCT uid) as user_count,
          COALESCE(SUM(trip_count), 0) as total_trips
        FROM (
          SELECT
            u.uid,
            CASE
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) < 18 THEN 'Under 18'
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) BETWEEN 18 AND 24 THEN '18-24'
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) BETWEEN 25 AND 34 THEN '25-34'
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) BETWEEN 35 AND 44 THEN '35-44'
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) BETWEEN 45 AND 54 THEN '45-54'
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) BETWEEN 55 AND 64 THEN '55-64'
              WHEN EXTRACT(YEAR FROM AGE(u.birthday)) >= 65 THEN '65+'
              ELSE 'Unknown'
            END as age_group,
            COUNT(t.id) as trip_count
          FROM users u
          LEFT JOIN user_trips t ON u.uid = t.user_uid AND t.status = 'completed'
          WHERE u.birthday IS NOT NULL
          GROUP BY u.uid, u.birthday
        ) user_age_data
        GROUP BY age_group
        ORDER BY
          CASE age_group
            WHEN 'Under 18' THEN 1
            WHEN '18-24' THEN 2
            WHEN '25-34' THEN 3
            WHEN '35-44' THEN 4
            WHEN '45-54' THEN 5
            WHEN '55-64' THEN 6
            WHEN '65+' THEN 7
            ELSE 8
          END
      `);

      // Count users with unknown/no birthday
      const unknownResult = await pool.query(`
        SELECT
          'Unknown' as age_group,
          COUNT(DISTINCT uid) as user_count,
          COALESCE(SUM(trip_count), 0) as total_trips
        FROM (
          SELECT
            u.uid,
            COUNT(t.id) as trip_count
          FROM users u
          LEFT JOIN user_trips t ON u.uid = t.user_uid AND t.status = 'completed'
          WHERE u.birthday IS NULL
          GROUP BY u.uid
        ) unknown_data
      `);

      // Combine results
      const allResults = [...result.rows];
      if (parseInt(unknownResult.rows[0].user_count) > 0) {
        allResults.push(unknownResult.rows[0]);
      }

      // Calculate totals
      const totalUsers = allResults.reduce((sum, row) => sum + parseInt(row.user_count), 0);
      const totalTrips = allResults.reduce((sum, row) => sum + parseInt(row.total_trips), 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ageGroups: allResults.map(row => ({
            ageGroup: row.age_group,
            userCount: parseInt(row.user_count),
            totalTrips: parseInt(row.total_trips),
            percentage: totalUsers > 0 ? ((parseInt(row.user_count) / totalUsers) * 100).toFixed(1) : '0.0'
          })),
          summary: {
            totalUsers,
            totalTrips,
            avgTripsPerUser: totalUsers > 0 ? (totalTrips / totalUsers).toFixed(2) : '0.00'
          }
        })
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

    // PUT /users/:uid/verify - Approve, reject, or re-approve ID verification
    if (event.httpMethod === 'PUT' && pathSegments.length === 2 && pathSegments[1] === 'verify') {
      const uid = pathSegments[0];
      const { action, note } = JSON.parse(event.body);

      if (!action || (action !== 'approve' && action !== 'reject' && action !== 're-approve')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Must be "approve", "reject", or "re-approve"' })
        };
      }

      // Get user info first for history record
      const userResult = await pool.query(
        'SELECT * FROM users WHERE uid = $1',
        [uid]
      );

      if (userResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User not found' })
        };
      }

      const user = userResult.rows[0];

      if (action === 'approve') {
        // Approve verification
        const result = await pool.query(
          `UPDATE users
           SET id_verified = TRUE,
               verification_note = $1,
               updated_at = NOW()
           WHERE uid = $2
           RETURNING *`,
          [note || 'ID verified', uid]
        );

        // Insert into verification history
        await pool.query(
          `INSERT INTO verification_history (uid, email, display_name, user_type, id_document_url, action, verified, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [uid, user.email, user.display_name, user.user_type, user.id_document_url, 'approve', true, note || 'ID verified']
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'ID verified successfully', user: result.rows[0] })
        };
      } else if (action === 're-approve') {
        // Re-approve verification (for previously rejected IDs)
        const result = await pool.query(
          `UPDATE users
           SET id_verified = TRUE,
               verification_note = $1,
               updated_at = NOW()
           WHERE uid = $2
           RETURNING *`,
          [note || 'ID re-approved', uid]
        );

        // Insert into verification history with 're-approve' action
        await pool.query(
          `INSERT INTO verification_history (uid, email, display_name, user_type, id_document_url, action, verified, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [uid, user.email, user.display_name, user.user_type, user.id_document_url, 're-approve', true, note || 'ID re-approved']
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'ID re-approved successfully', user: result.rows[0] })
        };
      } else {
        // Reject verification - keep document for review but mark as rejected
        const result = await pool.query(
          `UPDATE users
           SET id_verified = FALSE,
               user_type = 'regular',
               verification_note = $1,
               updated_at = NOW()
           WHERE uid = $2
           RETURNING *`,
          [note || 'ID rejected', uid]
        );

        // Insert into verification history
        await pool.query(
          `INSERT INTO verification_history (uid, email, display_name, user_type, id_document_url, action, verified, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [uid, user.email, user.display_name, user.user_type, user.id_document_url, 'reject', false, note || 'ID rejected']
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'ID rejected, user reset to regular', user: result.rows[0] })
        };
      }
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
