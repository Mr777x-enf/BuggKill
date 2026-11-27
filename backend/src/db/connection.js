
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

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = new URL(process.env.DATABASE_URL);
let connectionString = process.env.DATABASE_URL;
let ssl;

if (isProduction) {
    if (!/\.supabase\.(co|com)$/i.test(databaseUrl.hostname)) {
        throw new Error(
            "Production backend DATABASE_URL must point to Supabase PostgreSQL"
        );
    }

    for (const parameter of [
        "ssl",
        "sslmode",
        "sslrootcert",
        "sslcert",
        "sslkey",
        "uselibpqcompat"
    ]) {
        databaseUrl.searchParams.delete(parameter);
    }

    connectionString = databaseUrl.toString();
    ssl = {
        rejectUnauthorized: true
    };
} else {
    ssl = {
        rejectUnauthorized: databaseUrl.hostname.endsWith(".render.com")
    };
}

// PostgreSQL connection pool
const pool = new Pool({
    connectionString,
    ssl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// Handle unexpected pool errors
pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;
