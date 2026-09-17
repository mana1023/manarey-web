/**
 * Guarda las fotos de los productos en Supabase Storage.
 *
 * Por qué acá: Vercel Blob (plan gratis, 1 GB) se llenó y bloqueó TODAS las
 * fotos de la web por 30 días, y sus términos son para uso personal. Supabase
 * ya se usa para la base de datos, así que no hay una cuenta nueva que crear,
 * permite uso comercial y su plan gratis da 1 GB de archivos. Con las fotos
 * comprimidas al subirlas (~250 KB) entran unas 4.000.
 *
 * El tráfico gratis de Supabase es de 5 GB por mes y, si se pasa, las
 * restricciones alcanzan a TODO el proyecto, base de datos incluida. Por eso
 * estas fotos se muestran a través del optimizador de Vercel (ver
 * product-image.jsx): Vercel las cachea y le pide a Supabase una sola vez cada
 * foto, no una por visita.
 *
 * Variables en Vercel:
 *   SUPABASE_SERVICE_ROLE_KEY  (obligatoria) clave secreta del proyecto
 *   SUPABASE_URL               (opcional) por defecto, el proyecto Manarey
 */

const URL_POR_DEFECTO = "https://bcdgkbptzogowbexcybn.supabase.co";
const DEPOSITO = "productos";

function credenciales() {
  const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!clave) return null;
  const url = (process.env.SUPABASE_URL || URL_POR_DEFECTO).trim().replace(/\/$/, "");
  return { url, clave };
}

export function supabaseStorageConfigurado() {
  return Boolean(credenciales());
}

/** URL pública de una foto ya guardada. */
export function urlPublicaDeSupabase(url, ruta) {
  return `${url}/storage/v1/object/public/${DEPOSITO}/${ruta}`;
}

const EXTENSIONES = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * Sube una imagen y devuelve su URL pública. `archivo` es el File que llegó
 * del navegador, ya comprimido.
 */
export async function subirImagenASupabase(archivo) {
  const cred = credenciales();
  if (!cred) throw new Error("Supabase Storage no está configurado.");

  const extension = EXTENSIONES[archivo.type] || (archivo.name || "").split(".").pop() || "jpg";
  const fecha = new Date();
  const ruta = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}/foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const res = await fetch(`${cred.url}/storage/v1/object/${DEPOSITO}/${ruta}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cred.clave}`,
      apikey: cred.clave,
      "Content-Type": archivo.type || "image/jpeg",
      // Un año de caché: la foto nunca cambia, cada subida usa otro nombre. Va
      // con "max-age=" porque Supabase copia este valor tal cual a la respuesta
      // y sin eso el navegador lo ignora y vuelve a pedir la foto cada vez.
      "cache-control": "max-age=31536000",
    },
    body: archivo,
    cache: "no-store",
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    console.error("[supabase-storage] Subida rechazada:", res.status, detalle.slice(0, 300));
    if (res.status === 401 || res.status === 403) {
      throw new Error("La clave de Supabase no es válida o no tiene permiso para subir fotos.");
    }
    throw new Error(`Supabase rechazó la foto (${res.status}).`);
  }

  return urlPublicaDeSupabase(cred.url, ruta);
}

/** Uso del depósito, para el estado de las fotos en el panel. */
export async function usoDeSupabaseStorage() {
  const cred = credenciales();
  if (!cred) return { configurado: false };
  try {
    const res = await fetch(`${cred.url}/storage/v1/object/list/${DEPOSITO}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.clave}`,
        apikey: cred.clave,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 1, prefix: "" }),
      cache: "no-store",
    });
    if (!res.ok) return { configurado: true, ok: false, error: `HTTP ${res.status}` };
    return { configurado: true, ok: true, deposito: DEPOSITO, proyecto: cred.url };
  } catch (err) {
    return { configurado: true, ok: false, error: err?.message || String(err) };
  }
}
