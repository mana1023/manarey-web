/**
 * Comprime las fotos que ya están guardadas en Vercel Blob.
 *
 * Las fotos viejas se subieron tal cual salían del celular: hay JPEG de 3 MB
 * para mostrar una mesa de 300 píxeles. Así se llenó el almacenamiento y Vercel
 * bloqueó toda la web. Desde el commit 86c714f las fotos NUEVAS se comprimen en
 * el navegador antes de subirse, pero las viejas siguen pesando igual.
 *
 * Qué hace con cada foto de más de 400 KB: la baja, la achica a 1600 px de lado
 * mayor, la pasa a WebP y sube la versión liviana. Después deja la base
 * apuntando a la nueva. Si la comprimida no ahorra al menos un 15 %, la deja
 * como está.
 *
 * NO borra nada: las fotos originales quedan en Vercel como respaldo y, al no
 * estar más en la base, `borrar-archivos-sin-uso.mjs` las puede limpiar después.
 * Antes de tocar la base guarda un respaldo con las URLs viejas.
 *
 * Uso:
 *   node --env-file=.env.local scripts/comprimir-fotos-subidas.mjs             (vista previa)
 *   node --env-file=.env.local scripts/comprimir-fotos-subidas.mjs --confirmar
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import sharp from "sharp";
import { put } from "@vercel/blob";

const CONFIRMAR = process.argv.includes("--confirmar");
const RE_BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;
const RE_FOTO = /\.(png|jpe?g|webp)$/i;
const MINIMO = 400 * 1024; // debajo de esto no vale la pena
const ANCHO_MAXIMO = 1600;
const AHORRO_MINIMO = 0.15; // si no ahorra al menos el 15 %, se deja la original

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const filas = (
  await pool.query(
    `select product_key, image_data, images_data
       from public.productos_web_metadata
      where image_data like '%blob.vercel-storage.com%'
         or images_data like '%blob.vercel-storage.com%'`,
  )
).rows;

// Una misma foto puede estar en varias fichas: se comprime una sola vez.
const usadas = new Set();
for (const f of filas) {
  if (f.image_data && RE_BLOB.test(f.image_data) && RE_FOTO.test(f.image_data)) usadas.add(f.image_data);
  try {
    for (const u of JSON.parse(f.images_data || "[]")) {
      if (RE_BLOB.test(u) && RE_FOTO.test(u)) usadas.add(u);
    }
  } catch {
    /* images_data mal formado: se ignora */
  }
}

console.log(`Fichas con fotos en Vercel: ${filas.length}`);
console.log(`Fotos distintas en uso: ${usadas.size}`);
console.log("Midiendo cuáles conviene comprimir...\n");

const candidatas = [];
for (const url of usadas) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const tamano = Number(res.headers.get("content-length") || 0);
    if (res.ok && tamano > MINIMO) candidatas.push({ url, tamano });
  } catch {
    /* si no se puede medir, se saltea */
  }
}

const totalAntes = candidatas.reduce((s, c) => s + c.tamano, 0);
console.log(`Fotos de más de 400 KB: ${candidatas.length} · ocupan ${mb(totalAntes)}`);

if (!CONFIRMAR) {
  console.log("\nVista previa: no se subió ni se cambió nada.");
  console.log("Para hacerlo de verdad, agregá --confirmar.");
  await pool.end();
  process.exit(0);
}

const nuevas = new Map();
let ahorrado = 0;
let saltadas = 0;
let fallos = 0;

for (const [i, { url, tamano }] of candidatas.entries()) {
  try {
    const descarga = await fetch(url);
    if (!descarga.ok) throw new Error(`no se pudo bajar (HTTP ${descarga.status})`);
    const original = Buffer.from(await descarga.arrayBuffer());

    const comprimida = await sharp(original)
      .rotate() // respeta la orientación con que salió del celular
      .resize({ width: ANCHO_MAXIMO, height: ANCHO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }) // WebP conserva lo transparente de las fotos recortadas
      .toBuffer();

    if (comprimida.length > tamano * (1 - AHORRO_MINIMO)) {
      saltadas++;
      continue;
    }

    const nombre = `productos/foto-${Date.now()}-${i}.webp`;
    const subida = await put(nombre, comprimida, { access: "public", contentType: "image/webp" });
    nuevas.set(url, subida.url);
    ahorrado += tamano - comprimida.length;

    if ((i + 1) % 20 === 0 || i + 1 === candidatas.length) {
      console.log(`  ${i + 1} de ${candidatas.length} · ahorrado hasta ahora ${mb(ahorrado)}`);
    }
  } catch (err) {
    fallos++;
    console.error(`  ✗ ${url.split("/").pop()}: ${err.message}`);
  }
}

if (!nuevas.size) {
  console.log("\nNo hubo ninguna foto para reemplazar.");
  await pool.end();
  process.exit(0);
}

// Respaldo antes de tocar la base: si algo sale mal, acá están las URLs viejas.
const respaldo = path.join(process.cwd(), `respaldo-fotos-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(respaldo, JSON.stringify(Object.fromEntries(nuevas), null, 2));
console.log(`\nRespaldo de las URLs viejas: ${respaldo}`);

let fichas = 0;
for (const f of filas) {
  const image = f.image_data && nuevas.get(f.image_data);
  let lista = null;
  try {
    const original = JSON.parse(f.images_data || "[]");
    if (original.some((u) => nuevas.has(u))) lista = original.map((u) => nuevas.get(u) || u);
  } catch {
    /* se deja como está */
  }
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

console.log(`\nFotos comprimidas: ${nuevas.size}${saltadas ? ` · sin cambios ${saltadas}` : ""}${fallos ? ` · fallaron ${fallos}` : ""}`);
console.log(`Fichas actualizadas: ${fichas}`);
console.log(`Espacio ahorrado: ${mb(ahorrado)}`);
console.log("\nLas fotos originales siguen en Vercel como respaldo: no se borró nada.");
console.log("Para recuperar ese espacio, después correr:");
console.log("  node --env-file=.env.local scripts/borrar-archivos-sin-uso.mjs --confirmar");
await pool.end();
