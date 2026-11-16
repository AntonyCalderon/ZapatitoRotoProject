import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from './database.js';

const PgSession = connectPgSimple(session);

// La clave debe existir en .env y no subirse a GitHub.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('Configura SESSION_SECRET en el archivo .env');
}

export const sessionMiddleware = session({
  name: 'aym.sid',

  // Guardamos las sesiones en nuestra base PostgreSQL.
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),

  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000
  }
});
