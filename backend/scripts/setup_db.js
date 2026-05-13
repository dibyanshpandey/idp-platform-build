const { Pool } = require('pg');

const defaultPool = new Pool({
  connectionString: 'postgres://localhost:5432/postgres', // connect to default DB to create our new one
});

async function setup() {
  try {
    // 1. Create database if it doesn't exist
    const res = await defaultPool.query(`SELECT 1 FROM pg_database WHERE datname = 'idp_db'`);
    if (res.rowCount === 0) {
      console.log('Creating database idp_db...');
      await defaultPool.query('CREATE DATABASE idp_db');
    } else {
      console.log('Database idp_db already exists.');
    }
  } catch (err) {
    console.error('Error creating DB:', err);
  } finally {
    await defaultPool.end();
  }

  // 2. Connect to the new database and create tables
  const pool = new Pool({
    connectionString: 'postgres://localhost:5432/idp_db',
  });

  try {
    console.log('Creating tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('Org_Admin', 'Developer', 'Indexer'))
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        document_name VARCHAR(255) NOT NULL,
        field_key VARCHAR(255) NOT NULL,
        original_value TEXT,
        new_value TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Seed users
    console.log('Seeding users...');
    await pool.query(`
      INSERT INTO users (username, role) 
      VALUES 
        ('admin_user', 'Org_Admin'),
        ('dev_user', 'Developer'),
        ('indexer_user', 'Indexer')
      ON CONFLICT (username) DO NOTHING;
    `);

    console.log('Database setup complete!');
  } catch (err) {
    console.error('Error setting up tables/seeds:', err);
  } finally {
    await pool.end();
  }
}

setup();
