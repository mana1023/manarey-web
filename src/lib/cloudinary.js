/**
 * Subida de fotos a Cloudinary (plan gratis).
 *
 * Por qué Cloudinary y no seguir en Vercel Blob: el plan gratis de Vercel da
 * 1 GB y, al pasarlo, bloqueó TODAS las fotos de la web por 30 días. Además
 * sus términos son para uso personal y Manarey es un negocio. Cloudinary da
 * ~25 GB por mes entre guardar y mostrar, permite uso comercial, no pide
 * tarjeta, y si algún día se pasa el límite corta las fotos nuevas pero avisa
 * antes.
 *
 * Variables en Vercel (cualquiera de las dos formas):
 *   CLOUDINARY_URL                → cloudinary://<api_key>:<api_secret>@<cloud_name>
 *   o CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET
 *
 * Sin configurar, la web sigue subiendo a Vercel Blob como hasta ahora.
 */

import crypto from "crypto";

export function credencialesDeCloudinary() {
  const url = (process.env.CLOUDINARY_URL || "").trim();
  if (url.startsWith("cloudinary://")) {
    try {
      const u = new URL(url);
      if (u.hostname && u.username && u.password) {
        return { cloudName: u.hostname, apiKey: u.username, apiSecret: decodeURIComponent(u.password) };
      }
    } catch {
      // Si está mal escrita se ignora y se prueban las variables sueltas.
    }
  }
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export function cloudinaryConfigurado() {
  return Boolean(credencialesDeCloudinary());
}

/**
 * Firma de la subida, como la pide Cloudinary: todos los parámetros menos
 * file, api_key, cloud_name y resource_type, ordenados por nombre, unidos con
 * "&", con el secreto pegado al final y todo pasado por SHA-1.
 */
export function firmarParametros(parametros, apiSecret) {
  const cadena = Object.keys(parametros)
    .sort()
    .map((clave) => `${clave}=${parametros[clave]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${cadena}${apiSecret}`).digest("hex");
}

/**
 * Sube una imagen y devuelve su URL. `archivo` es el File/Blob que llegó del
 * navegador (ya comprimido) o un Buffer.
 */
export async function subirImagenACloudinary(archivo, { carpeta = "manarey/productos", nombre } = {}) {
  const cred = credencialesDeCloudinary();
  if (!cred) throw new Error("Cloudinary no está configurado.");

  const timestamp = Math.floor(Date.now() / 1000);
  const aFirmar = { folder: carpeta, timestamp };
  if (nombre) aFirmar.public_id = nombre;

  const form = new FormData();
  form.append("file", archivo instanceof Blob ? archivo : new Blob([archivo]));
  form.append("api_key", cred.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", carpeta);
  if (nombre) form.append("public_id", nombre);
  form.append("signature", firmarParametros(aFirmar, cred.apiSecret));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cred.cloudName}/image/upload`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok || !datos.secure_url) {
    // El mensaje de Cloudinary incluye la cadena que esperaba firmar, así que
    // se registra completo: es lo que permite arreglar una firma mal armada.
    console.error("[cloudinary] Subida rechazada:", res.status, JSON.stringify(datos).slice(0, 500));
    throw new Error(datos?.error?.message || `Cloudinary rechazó la foto (${res.status}).`);
  }
  return datos.secure_url;
}

/** Consulta de uso, para verificar que las credenciales andan. */
export async function usoDeCloudinary() {
  const cred = credencialesDeCloudinary();
  if (!cred) return { configurado: false };
  const auth = Buffer.from(`${cred.apiKey}:${cred.apiSecret}`).toString("base64");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cred.cloudName}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { configurado: true, ok: false, error: datos?.error?.message || `HTTP ${res.status}` };
  }
  return {
    configurado: true,
    ok: true,
    cuenta: cred.cloudName,
    plan: datos.plan,
    creditosUsados: datos.credits?.usage,
    creditosDelPlan: datos.credits?.limit,
    fotosGuardadas: datos.resources,
  };
}
