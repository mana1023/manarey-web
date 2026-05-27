/**
 * Utilidades de verificación de stock.
 * Consulta la tabla productos en tiempo real antes de procesar un pago.
 */
import { query } from "@/lib/db";

/**
 * Retorna el stock total de un producto (suma de todas las sucursales).
 */
export async function getProductStock(productKey) {
  if (!productKey) return 0;
  try {
    const result = await query(
      `SELECT coalesce(sum(coalesce(cantidad, 0)), 0) AS stock
       FROM public.productos
       WHERE md5(concat_ws('|',
         lower(trim(nombre)),
         lower(coalesce(trim(medida), '')),
         lower(coalesce(trim(color),  ''))
       )) = $1`,
      [productKey],
    );
    return Number(result.rows[0]?.stock ?? 0);
  } catch {
    return -1; // -1 = error al consultar, dejar pasar
  }
}

/**
 * Verifica stock para todos los items del carrito.
 * Retorna null si todo OK, o un objeto { ok: false, error, items } si hay problema.
 */
export async function checkCartStock(items = []) {
  if (!items?.length) return null;

  const errors = [];

  await Promise.all(
    items.map(async (item) => {
      if (!item.productKey) return;
      const available = await getProductStock(item.productKey);
      if (available === -1) return; // error de DB → dejar pasar
      if (available < (item.quantity || 1)) {
        errors.push({
          name: item.name || item.nombre || item.productKey,
          requested: item.quantity,
          available,
        });
      }
    }),
  );

  if (errors.length === 0) return null;

  const message = errors
    .map((e) =>
      e.available === 0
        ? `"${e.name}" no tiene stock disponible.`
        : `"${e.name}" — pediste ${e.requested} pero solo hay ${e.available}.`,
    )
    .join(" ");

  return { ok: false, error: message, items: errors };
}
