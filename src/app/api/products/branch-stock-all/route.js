import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { storeBranches } from "@/lib/store-config";

// Returns stock for every product × every configured branch in a single query.
export async function GET() {
  // Map DB local name → storeBranch
  const dbToDisplay = {};
  for (const b of storeBranches) {
    dbToDisplay[b.dbName] = b.name;
  }

  try {
    const dbNames = storeBranches.map((b) => b.dbName);

    const result = await query(
      `SELECT
         md5(concat_ws('|',
           lower(trim(nombre)),
           lower(coalesce(trim(categoria), '')),
           lower(coalesce(trim(medida), '')),
           coalesce(precio_venta::text, ''),
           lower(coalesce(trim(color), ''))
         )) AS product_key,
         trim(local) AS local,
         sum(coalesce(cantidad, 0)) AS stock
       FROM public.productos
       WHERE trim(local) = ANY($1)
       GROUP BY 1, 2`,
      [dbNames],
    );

    // Build intermediate map: { productKey: { displayName: stock } }
    const intermediate = {};
    for (const row of result.rows) {
      const displayName = dbToDisplay[row.local];
      if (!displayName) continue;
      const key = row.product_key;
      if (!intermediate[key]) intermediate[key] = {};
      intermediate[key][displayName] = Number(row.stock);
    }

    // Convert to cache format: { productKey: [{ local: displayName, stock }] }
    const cache = {};
    for (const [key, byDisplay] of Object.entries(intermediate)) {
      cache[key] = storeBranches.map((b) => ({
        local: b.name,
        stock: byDisplay[b.name] ?? 0,
      }));
    }

    return NextResponse.json({ cache });
  } catch (err) {
    console.error("[branch-stock-all]", err);
    return NextResponse.json({ cache: {} });
  }
}
