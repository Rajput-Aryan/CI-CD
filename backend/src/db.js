// Simple shared Postgres connection pool.
// Every other file that needs the DB just does: const db = require('../db')

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
