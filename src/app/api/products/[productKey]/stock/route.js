import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { query } from "@/lib/db";

export async function PATCH(request, context) {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  try {
    const { local, delta } = await request.json();
    if (!local || typeof delta !== "number") return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });

    const { productKey } = await context.params;

    // Find rows matching this product_key and local, update cantidad
    const existing = await query(
      `select id, cantidad from public.productos
       where md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(categoria),'')), lower(coalesce(trim(medida),'')), coalesce(precio_venta::text,''), lower(coalesce(trim(color),'')))) = $1
       and lower(trim(local)) = lower(trim($2))
       limit 1`,
      [productKey, local],
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "No se encontro el producto en esa sucursal." }, { status: 404 });
    }

    const currentStock = Number(existing.rows[0].cantidad || 0);
    const newStock = Math.max(0, currentStock + delta);
    const rowId = existing.rows[0].id;

    await query(`update public.productos set cantidad = $1 where id = $2`, [newStock, rowId]);

    return NextResponse.json({ local, stock: newStock });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al actualizar stock." }, { status: 500 });
  }
}
