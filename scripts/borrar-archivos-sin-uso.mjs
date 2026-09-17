/**
 * Libera espacio en Vercel Blob borrando lo que la web no usa.
 *
 * Sin --confirmar sólo muestra qué borraría. Con --confirmar borra, y no se
 * puede deshacer.
 *
 * Qué borra:
 *   - Archivos que no aparecen en NINGUNA columna de texto de la base ni en el
 *     código (fotos y videos que se subieron y después se sacaron de los
 *     productos).
 *   - Las versiones viejas de la app del jefe. La app se actualiza sola
 *     leyendo `movil_version` y baja la de version_codigo más alto, así que
 *     esa se conserva.
 * Qué nunca borra:
 *   - Nada subido en las últimas 24 horas, por si alguien está editando.
 *
 * Uso:  node --env-file=.env.local scripts/borrar-archivos-sin-uso.mjs [--confirmar]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { del, list } from "@vercel/blob";

const CONFIRMAR = process.argv.includes("--confirmar");
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RE_URL = /https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[A-Za-z0-9._~%\/-]+/g;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const suma = (a) => a.reduce((s, b) => s + b.size, 0);

const blobs = [];
let cursor;
do {
  const r = await list({ cursor, limit: 1000 });
  blobs.push(...r.blobs);
  cursor = r.cursor;
} while (cursor);

// Referencias en la base: todas las columnas de texto de todas las tablas.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const referenciadas = new Set();
const columnas = (await pool.query(`
  select table_schema, table_name, column_name from information_schema.columns
  where table_schema not in ('pg_catalog', 'information_schema')
    and data_type in ('text', 'character varying', 'json', 'jsonb')`)).rows;
for (const c of columnas) {
  const r = await pool
    .query(`select "${c.column_name}"::text v from "${c.table_schema}"."${c.table_name}" where "${c.column_name}"::text like '%blob.vercel-storage.com%'`)
    .catch(() => ({ rows: [] }));
  for (const { v } of r.rows) for (const u of v.match(RE_URL) || []) referenciadas.add(decodeURI(u));
}

// Versiones viejas de la app: todas menos la de version_codigo más alto.
const versiones = (await pool.query(`select url, version_codigo from movil_version order by version_codigo desc`)).rows;
const apksViejos = new Set(versiones.slice(1).map((v) => decodeURI(v.url)));
await pool.end();

// Referencias en el código del proyecto.
const recorrer = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(f.name)) recorrer(p);
    } else if (
      /\.(js|jsx|mjs|json|css|md)$/.test(f.name) &&
      !p.endsWith("borrar-archivos-sin-uso.mjs") &&
      // El respaldo que deja comprimir-fotos-subidas.mjs guarda justamente las
      // URLs de las fotos VIEJAS. Es una lista histórica, no un uso: si contara
      // como referencia, protegería para siempre lo único que hay para borrar.
      !/^respaldo-fotos-.*\.json$/.test(f.name)
    ) {
      for (const u of fs.readFileSync(p, "utf8").match(RE_URL) || []) referenciadas.add(decodeURI(u));
    }
  }
};
recorrer(RAIZ);

const hace24h = Date.now() - 24 * 60 * 60 * 1000;
const aBorrar = blobs.filter((b) => {
  const url = decodeURI(b.url);
  if (new Date(b.uploadedAt).getTime() > hace24h) return false;
  return apksViejos.has(url) || !referenciadas.has(url);
});

const sinUso = aBorrar.filter((b) => !apksViejos.has(decodeURI(b.url)));
const viejos = aBorrar.filter((b) => apksViejos.has(decodeURI(b.url)));
console.log(`Almacenamiento ahora: ${blobs.length} archivos · ${mb(suma(blobs))}`);
console.log(`A borrar: ${aBorrar.length} archivos · ${mb(suma(aBorrar))}`);
console.log(`  - sin uso en la web: ${sinUso.length} · ${mb(suma(sinUso))}`);
console.log(`  - versiones viejas de la app del jefe: ${viejos.length} · ${mb(suma(viejos))}`);
console.log(`Queda: ${mb(suma(blobs) - suma(aBorrar))} de 1 GB`);

if (!CONFIRMAR) {
  console.log("\nVista previa: no se borró nada. Para borrar, agregá --confirmar.");
  process.exit(0);
}

for (let i = 0; i < aBorrar.length; i += 100) {
  await del(aBorrar.slice(i, i + 100).map((b) => b.url));
  console.log(`Borrados ${Math.min(i + 100, aBorrar.length)} de ${aBorrar.length}…`);
}

let restante = 0;
cursor = undefined;
do {
  const r = await list({ cursor, limit: 1000 });
  restante += suma(r.blobs);
  cursor = r.cursor;
} while (cursor);
console.log(`\nListo. Almacenamiento ahora: ${mb(restante)} de 1 GB.`);
