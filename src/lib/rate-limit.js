/**
 * Rate limiter en memoria para endpoints de checkout.
 * En producción escala con Upstash Redis; para localhost esto es suficiente.
 */

const store = new Map(); // key → [timestamp, ...]

/**
 * @param {object} opts
 * @param {string} opts.key        - identificador único (IP, user ID, etc.)
 * @param {number} opts.max        - máximo de requests permitidos en la ventana
 * @param {number} opts.windowMs   - tamaño de la ventana en ms (default: 60_000)
 * @returns {{ ok: boolean, remaining: number, resetIn: number }}
 */
export function rateLimit({ key, max = 10, windowMs = 60_000 }) {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Limpiar timestamps viejos
  const prev = (store.get(key) || []).filter((t) => t > windowStart);

  if (prev.length >= max) {
    const oldest = prev[0];
    const resetIn = Math.ceil((oldest + windowMs - now) / 1000);
    return { ok: false, remaining: 0, resetIn };
  }

  prev.push(now);
  store.set(key, prev);

  // Limpiar store si crece demasiado (previene memory leak en dev)
  if (store.size > 50_000) {
    for (const [k, ts] of store.entries()) {
      if (ts.every((t) => t <= windowStart)) store.delete(k);
    }
  }

  return { ok: true, remaining: max - prev.length, resetIn: 0 };
}

/**
 * Extrae la IP real del request (compatible con Vercel + Next.js).
 */
export function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
