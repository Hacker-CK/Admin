import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from '../shared/schema';
import 'dotenv/config'; // Ensure environment variables are loaded

const { Pool } = pkg;

// Log database connection details (without sensitive information)
console.log(`Connecting to database in ${process.env.NODE_ENV} mode...`);
console.log(`Host: ${process.env.PGHOST}`);
console.log(`Database: ${process.env.PGDATABASE}`);
console.log(`User: ${process.env.PGUSER}`);
console.log(`Port: ${process.env.PGPORT}`);

// Create a PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add some connection retry logic for production
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Set timezone for all database connections
  options: '-c timezone=Asia/Kolkata',
});

// Add error handler to log database connection issues
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  if (process.env.NODE_ENV === 'production') {
    console.error('Database connection error in production. Retrying connection...');
  }
});

// Test the connection and log the result
pool.query('SELECT NOW()')
  .then(() => console.log('Database connection successful'))
  .catch(err => {
    console.error('Error connecting to database:', err.message);
    console.error('Make sure your DATABASE_URL environment variable is correctly set');
  });

// For async query execution
export const query = (text: string, params: any[] = []) => pool.query(text, params);

// Create a Drizzle instance using the PostgreSQL driver
export const db = drizzle(pool, { schema });

// Export for easy access
export default db;