const express = require('express');
const router = express.Router();
const db = require('../db');

// Get fare between two stations for a specific transit type
router.get('/:transitType/:fromStation/:toStation', async (req, res) => {
  try {
    const { transitType, fromStation, toStation } = req.params;
    let tableName;
    
    console.log(`Fetching ${transitType} fare from ${fromStation} to ${toStation}`);
    
    switch (transitType.toLowerCase()) {
      case 'lrt1':
        tableName = 'lrt1_fares';
        break;
      case 'lrt2':
        tableName = 'lrt2_fares';
        break;
      case 'mrt':
        tableName = 'mrt_fares';
        break;
      case 'pnr':
        tableName = 'pnr_fares';
        break;
      default:
        console.error(`Invalid transit type: ${transitType}`);
        return res.status(400).json({ error: 'Invalid transit type' });
    }

    const result = await db.query(
      `SELECT fare FROM ${tableName} WHERE from_station = $1 AND to_station = $2`,
      [fromStation, toStation]
    );

    if (result.rows.length === 0) {
      console.warn(`No fare found in ${tableName} from ${fromStation} to ${toStation}`);
      res.status(404).json({ error: 'Fare not found', from: fromStation, to: toStation, table: tableName });
    } else {
      console.log(`Found fare: ${result.rows[0].fare}`);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching fare:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get PUB fare for a given distance
router.get('/pub/distance/:distance', async (req, res) => {
  try {
    const { distance } = req.params;
    console.log(`PUB fare request - raw distance param: "${distance}" (type: ${typeof distance})`);
    
    const distanceNum = parseInt(distance);
    console.log(`Parsed distance: ${distanceNum} (isNaN: ${isNaN(distanceNum)})`);

    if (isNaN(distanceNum) || distanceNum < 0) {
      console.error(`Invalid distance: ${distance} -> ${distanceNum}`);
      return res.status(400).json({ error: 'Invalid distance parameter', received: distance });
    }

    console.log(`Fetching PUB fare for distance: ${distanceNum}km`);

    // Get both aircon and ordinary fares for the distance
    const result = await db.query(`
      SELECT 
        'aircon' as type,
        a.regular_fare,
        a.discounted_fare
      FROM pub_aircon_fares a
      WHERE a.distance <= $1
      ORDER BY a.distance DESC
      LIMIT 1
      UNION ALL
      SELECT 
        'ordinary' as type,
        o.regular_fare,
        o.discounted_fare
      FROM pub_ordinary_fares o
      WHERE o.distance <= $1
      ORDER BY o.distance DESC
      LIMIT 1
    `, [distanceNum]);

    if (result.rows.length === 0) {
      console.warn(`No PUB fare found for distance ${distanceNum}km`);
      res.status(404).json({ error: 'Fare not found for the given distance' });
    } else {
      console.log(`Found PUB fares:`, result.rows);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching PUB fare:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get PUJ fare for a given distance
router.get('/puj/distance/:distance', async (req, res) => {
  try {
    const { distance } = req.params;
    const distanceNum = parseInt(distance);

    // Get fare for the distance
    const result = await db.query(`
      SELECT regular_fare, discounted_fare
      FROM puj_fares
      WHERE distance <= $1
      ORDER BY distance DESC
      LIMIT 1
    `, [distanceNum]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Fare not found for the given distance' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching PUJ fare:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get complete PUB fare tables
router.get('/pub/tables', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        'aircon' as type,
        a.distance,
        a.regular_fare,
        a.discounted_fare
      FROM pub_aircon_fares a
      UNION ALL
      SELECT 
        'ordinary' as type,
        o.distance,
        o.regular_fare,
        o.discounted_fare
      FROM pub_ordinary_fares o
      ORDER BY type, distance
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching PUB fare tables:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get complete PUJ fare table
router.get('/puj/table', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM puj_fares ORDER BY distance');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching PUJ fare table:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get max distances for PUB and PUJ
router.get('/distances', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        'pub_aircon' as type,
        MAX(distance) as max_distance
      FROM pub_aircon_fares
      UNION ALL
      SELECT 
        'pub_ordinary' as type,
        MAX(distance) as max_distance
      FROM pub_ordinary_fares
      UNION ALL
      SELECT 
        'puj' as type,
        MAX(distance) as max_distance
      FROM puj_fares
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching max distances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;