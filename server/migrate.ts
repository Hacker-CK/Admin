import pkg from 'pg';

const { Pool } = pkg;

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Query function to execute SQL
const query = (text, params = []) => pool.query(text, params);

// This script will automatically migrate your database to the latest schema
async function main() {
  console.log("Migration started...");
  
  try {
    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        wallet_balance NUMERIC NOT NULL DEFAULT '0',
        commission NUMERIC NOT NULL DEFAULT '0',
        name TEXT,
        email TEXT,
        gender TEXT,
        state TEXT,
        city TEXT,
        address TEXT,
        is_admin BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        mpin TEXT,
        is_first_login BOOLEAN DEFAULT true,
        referral_code TEXT UNIQUE,
        referred_by TEXT,
        referral_pending BOOLEAN DEFAULT false,
        referral_count INTEGER DEFAULT 0,
        referral_earnings NUMERIC DEFAULT '0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS operators (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        commission NUMERIC NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        logo TEXT
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        transaction_id TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
        recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ip_address TEXT,
        device_info TEXT
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // No sample/demo data - using only database values
    
    console.log("Database schema created successfully!");
    
    // Close the pool
    await pool.end();
  } catch (error) {
    console.error("Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

main();