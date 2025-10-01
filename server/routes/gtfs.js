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
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error finding routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;