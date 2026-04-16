import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no esta configurada.");
}

const globalForDb = globalThis;

export const db =
  globalForDb.manareyDb ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

if (!globalForDb.manareyDb) {
  globalForDb.manareyDb = db;
}

export async function query(text, params = []) {
  return db.query(text, params);
}
