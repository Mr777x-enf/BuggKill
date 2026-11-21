
const path = require("path");
const { Pool } = require("pg");

// Load local .env only during development
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config({
        path: path.resolve(__dirname, "../../.env")
    });
}

// Ensure database URL exists
if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
}

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// Handle unexpected pool errors
pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;
