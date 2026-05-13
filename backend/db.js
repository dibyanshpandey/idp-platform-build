const { Pool } = require('pg');
require('dotenv').config();

// Create a pool using DATABASE_URL or default local connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/idp_db',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
