const express = require('express');
const router = express.Router();
const db = require('../db');

// Get user's saved routes
router.get('/user/:user_uid', async (req, res) => {
  try {
    const { user_uid } = req.params;

    const result = await db.query(`
      SELECT * FROM saved_routes
      WHERE user_uid = $1
      ORDER BY times_used DESC, created_at DESC
    `, [user_uid]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching saved routes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save a new route
router.post('/', async (req, res) => {
  try {
    const { user_uid, name, from_stop_id, from_stop_name, to_stop_id, to_stop_name, route_id, route_name, transit_type } = req.body;

    // Check if route already exists
    const existing = await db.query(`
      SELECT * FROM saved_routes
      WHERE user_uid = $1 AND from_stop_id = $2 AND to_stop_id = $3
    `, [user_uid, from_stop_id, to_stop_id]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Route already saved' });
    }

    const result = await db.query(`
      INSERT INTO saved_routes (user_uid, name, from_stop_id, from_stop_name, to_stop_id, to_stop_name, route_id, route_name, transit_type, times_used)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
      RETURNING *
    `, [user_uid, name, from_stop_id, from_stop_name, to_stop_id, to_stop_name, route_id, route_name, transit_type]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update saved route (rename or increment usage)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, times_used } = req.body;

    let query = 'UPDATE saved_routes SET ';
    const values = [];
    const updates = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (times_used !== undefined) {
      updates.push(`times_used = $${paramIndex}`);
      values.push(times_used);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    query += updates.join(', ') + ` WHERE id = $${paramIndex} RETURNING *`;
    values.push(id);

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Saved route not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating saved route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Increment usage count for a saved route
router.post('/:id/use', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE saved_routes
      SET times_used = times_used + 1, last_used = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Saved route not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error incrementing route usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a saved route
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM saved_routes
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Saved route not found' });
    }

    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting saved route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
