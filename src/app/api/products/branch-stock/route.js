import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { storeBranches } from "@/lib/store-config";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const productKey = (url.searchParams.get("productKey") || "").trim();
  const allBranches = url.searchParams.get("allBranches") === "true";

  if (!productKey) return NextResponse.json({ branches: [] });

  try {
    // ⚠️ Fórmula NUEVA: md5(nombre | medida | color) — sin categoria ni precio_venta
    const result = await query(
      `SELECT trim(local) AS local, sum(greatest(coalesce(cantidad, 0), 0))::integer AS stock
       FROM public.productos
       WHERE md5(concat_ws('|',
               lower(trim(nombre)),
               lower(coalesce(trim(medida), '')),
               lower(coalesce(trim(color),  ''))
             )) = $1
       GROUP BY local
       ORDER BY local`,
      [productKey],
    );

    // Mapear dbName → stock
    const stockByDbName = {};
    for (const row of result.rows) {
      stockByDbName[row.local] = Number(row.stock);
    }

    let branches;
    if (allBranches) {
      // Devolver TODAS las sucursales (incluso con stock 0) para el panel admin
      branches = storeBranches.map((b) => ({
        local: b.name,
        stock: stockByDbName[b.dbName] ?? 0,
      }));
    } else {
      // Solo las que tienen stock (para mostrar en la ficha del producto)
      branches = storeBranches
        .filter((b) => (stockByDbName[b.dbName] ?? 0) > 0)
        .map((b) => ({ local: b.name, stock: stockByDbName[b.dbName] }));
    }

    return NextResponse.json({ branches });
  } catch (err) {
    console.error("[branch-stock]", err);
    return NextResponse.json({ branches: [] });
  }
}
