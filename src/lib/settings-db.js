/**
 * settings-db.js
 * Lee y escribe configuraciones de la tienda en la base de datos.
 * Tabla: store_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ)
 */

import { query } from "@/lib/db";
import { storeSettings } from "@/lib/store-config";

// Crea la tabla si no existe (se llama una vez por server start)
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  tableEnsured = true;
}

export async function getSetting(key, fallback = null) {
  await ensureTable();
  const res = await query("SELECT value FROM store_settings WHERE key = $1", [key]);
  if (res.rows.length === 0) return fallback;
  return res.rows[0].value;
}

export async function setSetting(key, value) {
  await ensureTable();
  await query(
    `INSERT INTO store_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, String(value)],
  );
}

export async function getShippingSettings() {
  const [baseRaw, perKmRaw] = await Promise.all([
    getSetting("shipping_base_cost"),
    getSetting("shipping_cost_per_km"),
  ]);

  return {
    shippingBaseCost:
      baseRaw !== null ? Number(baseRaw) : storeSettings.shippingBaseCost,
    shippingCostPerKm:
      perKmRaw !== null ? Number(perKmRaw) : storeSettings.shippingCostPerKm,
  };
}
