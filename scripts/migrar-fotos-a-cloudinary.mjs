/**
 * Pasa las fotos de los productos de Vercel Blob a Cloudinary y deja la base
 * apuntando a las nuevas URLs.
 *
 * Sólo se puede correr cuando Vercel haya desbloqueado el almacenamiento:
 * mientras esté bloqueado, las fotos no se pueden descargar (403) y el script
 * lo avisa sin tocar nada.
 *
 * No borra nada de Vercel: las fotos viejas quedan ahí como respaldo.
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrar-fotos-a-cloudinary.mjs            (vista previa)
 *   node --env-file=.env.local scripts/migrar-fotos-a-cloudinary.mjs --confirmar
 */

import crypto from "node:crypto";
import pg from "pg";

const CONFIRMAR = process.argv.includes("--confirmar");
const RE_BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

function credenciales() {
  const url = (process.env.CLOUDINARY_URL || "").trim();
  if (url.startsWith("cloudinary://")) {
    const u = new URL(url);
    return { cloudName: u.hostname, apiKey: u.username, apiSecret: decodeURIComponent(u.password) };
  }
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Faltan las credenciales de Cloudinary.");
  return { cloudName, apiKey, apiSecret };
}

const cred = credenciales();

async function subir(url) {
  const descarga = await fetch(url);
  if (!descarga.ok) {
    throw new Error(
      descarga.status === 403
        ? "Vercel todavía tiene bloqueado el almacenamiento: no se pueden bajar las fotos."
        : `no se pudo bajar (HTTP ${descarga.status})`,
    );
  }
  const archivo = new Blob([await descarga.arrayBuffer()]);
  const timestamp = Math.floor(Date.now() / 1000);
  const carpeta = "manarey/productos";
  const cadena = `folder=${carpeta}&timestamp=${timestamp}`;
  const firma = crypto.createHash("sha1").update(`${cadena}${cred.apiSecret}`).digest("hex");

  const form = new FormData();
  form.append("file", archivo);
  form.append("api_key", cred.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", carpeta);
  form.append("signature", firma);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cred.cloudName}/image/upload`, { method: "POST", body: form });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok || !datos.secure_url) throw new Error(datos?.error?.message || `Cloudinary respondió ${res.status}`);
  return datos.secure_url;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const filas = (await pool.query(
  `select product_key, image_data, images_data from public.productos_web_metadata
    where image_data like '%blob.vercel-storage.com%' or images_data like '%blob.vercel-storage.com%'`,
)).rows;

const aMigrar = new Set();
for (const f of filas) {
  if (f.image_data && RE_BLOB.test(f.image_data)) aMigrar.add(f.image_data);
  try {
    for (const u of JSON.parse(f.images_data || "[]")) if (RE_BLOB.test(u)) aMigrar.add(u);
  } catch { /* images_data mal formado: se ignora */ }
}
// Los videos se quedan en Vercel: Cloudinary cobra aparte por video.
const fotos = [...aMigrar].filter((u) => !/\.(mp4|mov|webm|ogg)$/i.test(u));

console.log(`Fichas con fotos en Vercel: ${filas.length}`);
console.log(`Fotos distintas a migrar: ${fotos.length} (los videos quedan en Vercel)`);
if (!CONFIRMAR) {
  console.log("\nVista previa: no se subió ni se cambió nada. Para hacerlo, agregá --confirmar.");
  await pool.end();
  process.exit(0);
}

const nuevas = new Map();
let fallos = 0;
for (const [i, url] of fotos.entries()) {
  try {
    nuevas.set(url, await subir(url));
    if ((i + 1) % 25 === 0 || i + 1 === fotos.length) console.log(`  subidas ${i + 1} de ${fotos.length}`);
  } catch (err) {
    fallos++;
    console.error(`  ✗ ${url.split("/").pop()}: ${err.message}`);
    if (/bloqueado/.test(err.message)) break;
  }
}

let fichas = 0;
for (const f of filas) {
  const image = f.image_data && nuevas.get(f.image_data);
  let lista = null;
  try {
    const original = JSON.parse(f.images_data || "[]");
    if (original.some((u) => nuevas.has(u))) lista = original.map((u) => nuevas.get(u) || u);
  } catch { /* se deja como está */ }
  if (!image && !lista) continue;
  await pool.query(
    `update public.productos_web_metadata
        set image_data = coalesce($2, image_data),
            images_data = coalesce($3, images_data),
            updated_at = now()
      where product_key = $1`,
    [f.product_key, image || null, lista ? JSON.stringify(lista) : null],
  );
  fichas++;
}

console.log(`\nFotos migradas: ${nuevas.size}${fallos ? ` · fallaron ${fallos}` : ""}`);
console.log(`Fichas actualizadas: ${fichas}`);
console.log("Las fotos viejas siguen en Vercel como respaldo: no se borró nada.");
await pool.end();
