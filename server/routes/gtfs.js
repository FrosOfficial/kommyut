const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all agencies
router.get('/agencies', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM agency');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all stops
router.get('/stops', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stops ORDER BY stop_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all routes
router.get('/routes', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, a.agency_name 
      FROM routes r 
      LEFT JOIN agency a ON r.agency_id = a.agency_id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stops by route
router.get('/routes/:routeId/stops', async (req, res) => {
  try {
    const { routeId } = req.params;
    const result = await db.query(`
      SELECT DISTINCT s.* 
      FROM stops s
      JOIN stop_times st ON s.stop_id = st.stop_id
      JOIN trips t ON st.trip_id = t.trip_id
      WHERE t.route_id = $1
      ORDER BY st.stop_sequence
    `, [routeId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get route shape
router.get('/routes/:routeId/shape', async (req, res) => {
  try {
    const { routeId } = req.params;
    const result = await db.query(`
      SELECT DISTINCT s.* 
      FROM shapes s
      JOIN trips t ON s.shape_id = t.shape_id
      WHERE t.route_id = $1
      ORDER BY s.shape_pt_sequence
    `, [routeId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shape:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get schedule for a route
router.get('/routes/:routeId/schedule', async (req, res) => {
  try {
    const { routeId } = req.params;
    const result = await db.query(`
      SELECT t.trip_id, t.trip_headsign, st.*, s.stop_name 
      FROM trips t
      JOIN stop_times st ON t.trip_id = st.trip_id
      JOIN stops s ON st.stop_id = s.stop_id
      WHERE t.route_id = $1
      ORDER BY t.trip_id, st.stop_sequence
    `, [routeId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Find routes that connect two stops
router.get('/find-routes/:fromStopId/:toStopId', async (req, res) => {
  try {
    const { fromStopId, toStopId } = req.params;

    console.log('=== DEBUG: Finding routes ===');
    console.log('From Stop ID:', fromStopId);
    console.log('To Stop ID:', toStopId);

    // Check if stops exist in stop_times
    const fromStopCheck = await db.query(
      'SELECT COUNT(*) as count FROM stop_times WHERE stop_id = $1',
      [fromStopId]
    );
    const toStopCheck = await db.query(
      'SELECT COUNT(*) as count FROM stop_times WHERE stop_id = $1',
      [toStopId]
    );

    console.log('From stop in stop_times:', fromStopCheck.rows[0].count);
    console.log('To stop in stop_times:', toStopCheck.rows[0].count);

    if (fromStopCheck.rows[0].count == 0 || toStopCheck.rows[0].count == 0) {
      console.log('⚠️ One or both stops not found in stop_times table');
      return res.json([]);
    }

    // Check which routes serve each stop
    const fromRoutes = await db.query(`
      SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name
      FROM routes r
      JOIN trips t ON r.route_id = t.route_id
      JOIN stop_times st ON t.trip_id = st.trip_id
      WHERE st.stop_id = $1
    `, [fromStopId]);

    const toRoutes = await db.query(`
      SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name
      FROM routes r
      JOIN trips t ON r.route_id = t.route_id
      JOIN stop_times st ON t.trip_id = st.trip_id
      WHERE st.stop_id = $1
    `, [toStopId]);

    console.log('Routes serving FROM stop:', fromRoutes.rows);
    console.log('Routes serving TO stop:', toRoutes.rows);

    // Check if the trip_ids in stop_times actually exist in trips table
    const fromTrips = await db.query(`
      SELECT DISTINCT st.trip_id
      FROM stop_times st
      WHERE st.stop_id = $1
      LIMIT 3
    `, [fromStopId]);

    console.log('Sample trip_ids for FROM stop:', fromTrips.rows);

    // Check if those trip_ids exist in trips table
    if (fromTrips.rows.length > 0) {
      const tripCheck = await db.query(`
        SELECT trip_id, route_id, service_id
        FROM trips
        WHERE trip_id = $1
      `, [fromTrips.rows[0].trip_id]);

      console.log('Trip details from trips table:', tripCheck.rows);
    }

    // Find all routes that have both stops
    const result = await db.query(`
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

    console.log('Routes found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error finding routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;