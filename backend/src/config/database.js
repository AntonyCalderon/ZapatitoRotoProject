/*
require('pg'): importa el módulo de PostgreSQL.
Pool: administra las conexiones.
process.env: obtiene las credenciales de .env.
module.exports: permite que otros archivos utilicen la misma conexión.
*/


import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

export default pool;