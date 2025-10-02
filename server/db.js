const { Pool } = require('pg');
require('dotenv').config();

let pool;
let useMockDb = false;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  // Test connection
  pool.query('SELECT 1').then(() => {
    console.log('✅ Connected to PostgreSQL database');
  }).catch(() => {
    console.log('⚠️ PostgreSQL not available, using mock database');
    useMockDb = true;
  });
} catch (error) {
  console.log('⚠️ Database connection failed, using mock database');
  useMockDb = true;
}

// Use mock database if PostgreSQL is not available
if (useMockDb) {
  const mockDb = require('./mock-db');
  module.exports = mockDb;
} else {
  module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
  };
}


module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};