const express = require('express');
const router = express.Router();
const db = require('../db');

// Start a new trip
router.post('/start', async (req, res) => {
  try {
    const { user_uid, from_location, to_location, transit_type, route_name, distance_km, fare_paid, money_saved } = req.body;
    
    // Calculate points earned: 10 points per trip
    const points_earned = 10;
    
    console.log('Starting trip for user:', user_uid);
    console.log('Trip data:', { from_location, to_location, transit_type, distance_km, fare_paid, money_saved, points_earned });
    
    const result = await db.query(`
      INSERT INTO user_trips (user_uid, from_location, to_location, transit_type, route_name, distance_km, fare_paid, money_saved, points_earned, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *
    `, [user_uid, from_location, to_location, transit_type, route_name, distance_km, fare_paid, money_saved, points_earned]);
    
    // Update user points
    await db.query(`
      UPDATE users 
      SET points = points + $1 
      WHERE uid = $2
    `, [points_earned, user_uid]);
    
    console.log('Trip started successfully:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error starting trip:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// End a trip
router.post('/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    const tripId = id;
    const { end_time } = req.body;
    
    const result = await db.query(`
      UPDATE user_trips 
      SET end_time = $1, status = 'completed'
      WHERE id = $2 AND status = 'active'
      RETURNING *
    `, [end_time || new Date(), tripId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found or already completed' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error ending trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get popular routes (most frequently traveled by all users)
router.get('/popular-routes', async (req, res) => {
  try {
    const { limit = 3 } = req.query;

    const result = await db.query(`
      SELECT
        from_location,
        to_location,
        transit_type,
        COUNT(*) as trip_count,
        AVG(fare_paid) as avg_fare,
        AVG(distance_km) as avg_distance,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60) as avg_duration_minutes
      FROM user_trips
      WHERE status = 'completed'
        AND from_location IS NOT NULL
        AND to_location IS NOT NULL
        AND end_time IS NOT NULL
      GROUP BY from_location, to_location, transit_type
      ORDER BY trip_count DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's trip history
router.get('/user/:user_uid', async (req, res) => {
  try {
    const { user_uid } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(`
      SELECT * FROM user_trips
      WHERE user_uid = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [user_uid, limit, offset]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching trip history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's current active trip
router.get('/user/:user_uid/active', async (req, res) => {
  try {
    const { user_uid } = req.params;
    
    const result = await db.query(`
      SELECT * FROM user_trips 
      WHERE user_uid = $1 AND status = 'active'
      ORDER BY start_time DESC 
      LIMIT 1
    `, [user_uid]);
    
    if (result.rows.length === 0) {
      return res.json(null);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching active trip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's trip statistics
router.get('/user/:user_uid/stats', async (req, res) => {
  try {
    const { user_uid } = req.params;
    const { period = 'week' } = req.query;
    
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }
    
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_trips,
        COALESCE(SUM(distance_km), 0) as total_distance,
        COALESCE(SUM(money_saved), 0) as total_saved,
        COALESCE(SUM(points_earned), 0) as total_points,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_trips
      FROM user_trips 
      WHERE user_uid = $1 ${dateFilter}
    `, [user_uid]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching trip stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily trip history for a user
router.get('/user/:user_uid/daily', async (req, res) => {
  try {
    const { user_uid } = req.params;
    const { days = 7 } = req.query;
    
    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as trips,
        COALESCE(SUM(distance_km), 0) as distance,
        COALESCE(SUM(money_saved), 0) as saved
      FROM user_trips 
      WHERE user_uid = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [user_uid]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily trip history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
