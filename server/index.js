const express = require('express');
const cors = require('cors');
const db = require('./db');
const gtfsRoutes = require('./routes/gtfs');
const fareRoutes = require('./routes/fares');
const tripRoutes = require('./routes/trips');
const savedRoutesRoutes = require('./routes/saved-routes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mount route handlers
app.use('/api/gtfs', gtfsRoutes);
app.use('/api/fares', fareRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/saved-routes', savedRoutesRoutes);

// Create or update user after authentication
app.post('/api/users', async (req, res) => {
  const { uid, email, displayName, photoURL } = req.body;

  try {
    // Try to update existing user
    const updateResult = await db.query(
      `
      UPDATE users 
      SET email = $1, 
          display_name = $2, 
          photo_url = $3,
          last_login = CURRENT_TIMESTAMP
      WHERE uid = $4
      RETURNING *
      `,
      [email, displayName, photoURL, uid]
    );

    // If no user was updated, create a new one
    if (updateResult.rowCount === 0) {
      const insertResult = await db.query(
        `
        INSERT INTO users (uid, email, display_name, photo_url, points)
        VALUES ($1, $2, $3, $4, 0)
        RETURNING *
        `,
        [uid, email, displayName, photoURL]
      );
      res.json(insertResult.rows[0]);
    } else {
      res.json(updateResult.rows[0]);
    }
  } catch (error) {
    console.error('Error upserting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by uid
app.get('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const result = await db.query('SELECT * FROM users WHERE uid = $1', [uid]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📡 API endpoints available:`);
  console.log(`   - GET  /api/users/:uid`);
  console.log(`   - POST /api/users`);
  console.log(`   - POST /api/trips/start`);
  console.log(`   - POST /api/trips/:id/end`);
  console.log(`   - GET  /api/trips/user/:uid`);
  console.log(`   - GET  /api/trips/user/:uid/stats`);
});