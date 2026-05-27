import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { query } from "@/lib/db";
import { storeBranches } from "@/lib/store-config";

export const dynamic = "force-dynamic";

function invalidateBranchStockCache() {
  // Invalida el cache en memoria de branch-stock-all
  if (globalThis._branchStockAllCache) {
    globalThis._branchStockAllCache = null;
  }
}

export async function PATCH(request, context) {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  try {
    const { local, delta } = await request.json();
    if (!local || typeof delta !== "number") {
      return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
    }

    // Traducir nombre display → dbName
    const branch = storeBranches.find((b) => b.name === local);
    const dbLocal = branch?.dbName ?? local;

    const { productKey } = await context.params;

    // ⚠️ Fórmula NUEVA: md5(nombre | medida | color)
    const existing = await query(
      `SELECT id, cantidad FROM public.productos
       WHERE md5(concat_ws('|',
               lower(trim(nombre)),
               lower(coalesce(trim(medida), '')),
               lower(coalesce(trim(color),  ''))
             )) = $1
         AND trim(local) = $2
       LIMIT 1`,
      [productKey, dbLocal],
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "No se encontró el producto en esa sucursal." },
        { status: 404 },
      );
    }

    const currentStock = Math.max(0, Number(existing.rows[0].cantidad || 0));
    const newStock = Math.max(0, currentStock + delta);
    const rowId = existing.rows[0].id;

    await query(`UPDATE public.productos SET cantidad = $1 WHERE id = $2`, [newStock, rowId]);

    // Invalidar cache de branch-stock-all para que el próximo request traiga datos frescos
    invalidateBranchStockCache();

    return NextResponse.json({ local, stock: newStock });
  } catch (error) {
    console.error("[stock PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar stock." },
      { status: 500 },
    );
  }
}
