const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const query = (text, params) => pool.query(text, params);

// Helper to create response
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/.netlify/functions/fares', '');
  
  try {
    // GET /:transitType/:fromStation/:toStation - Station-to-station fare
    const stationFareMatch = path.match(/^\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
    if (stationFareMatch && event.httpMethod === 'GET') {
      const [, transitType, fromStation, toStation] = stationFareMatch;
      
      let tableName;
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
          return response(400, { error: 'Invalid transit type' });
      }

      const result = await query(
        `SELECT fare FROM ${tableName} WHERE from_station = $1 AND to_station = $2`,
        [fromStation, toStation]
      );

      if (result.rows.length === 0) {
        return response(404, { error: 'Fare not found', from: fromStation, to: toStation, table: tableName });
      }
      
      return response(200, result.rows[0]);
    }

    // GET /pub/distance/:distance - PUB distance fare
    const pubDistanceMatch = path.match(/^\/pub\/distance\/(\d+)$/);
    if (pubDistanceMatch && event.httpMethod === 'GET') {
      const distance = parseInt(pubDistanceMatch[1]);
      
      if (isNaN(distance) || distance < 0) {
        return response(400, { error: 'Invalid distance parameter', received: distance });
      }

      const result = await query(`
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
      `, [distance]);

      if (result.rows.length === 0) {
        return response(404, { error: 'Fare not found for the given distance' });
      }
      
      return response(200, result.rows);
    }

    // GET /puj/distance/:distance - PUJ distance fare
    const pujDistanceMatch = path.match(/^\/puj\/distance\/(\d+)$/);
    if (pujDistanceMatch && event.httpMethod === 'GET') {
      const distance = parseInt(pujDistanceMatch[1]);
      
      if (isNaN(distance) || distance < 0) {
        return response(400, { error: 'Invalid distance parameter', received: distance });
      }

      const result = await query(`
        SELECT regular_fare, discounted_fare
        FROM puj_fares
        WHERE distance <= $1
        ORDER BY distance DESC
        LIMIT 1
      `, [distance]);

      if (result.rows.length === 0) {
        return response(404, { error: 'Fare not found for the given distance' });
      }
      
      return response(200, result.rows[0]);
    }

    // GET /pub/tables - PUB fare tables
    if (path === '/pub/tables' && event.httpMethod === 'GET') {
      const result = await query(`
        SELECT 'aircon' as type, distance, regular_fare, discounted_fare
        FROM pub_aircon_fares
        ORDER BY distance
        UNION ALL
        SELECT 'ordinary' as type, distance, regular_fare, discounted_fare
        FROM pub_ordinary_fares
        ORDER BY distance
      `);
      return response(200, result.rows);
    }

    // GET /puj/table - PUJ fare table
    if (path === '/puj/table' && event.httpMethod === 'GET') {
      const result = await query(`
        SELECT distance, regular_fare, discounted_fare
        FROM puj_fares
        ORDER BY distance
      `);
      return response(200, result.rows);
    }

    // GET /distances - Max distances
    if (path === '/distances' && event.httpMethod === 'GET') {
      const result = await query(`
        SELECT 
          'pub' as type,
          MAX(distance) as max_distance
        FROM pub_aircon_fares
        UNION ALL
        SELECT 
          'puj' as type,
          MAX(distance) as max_distance
        FROM puj_fares
      `);
      return response(200, result.rows);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};

