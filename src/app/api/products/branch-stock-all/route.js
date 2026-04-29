import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { storeBranches } from "@/lib/store-config";

// Returns stock for every product × every branch in a single query.
// Used by the admin catalog to sort products by stock when a branch filter is active.
export async function GET() {
  try {
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
       GROUP BY 1, 2
       ORDER BY 1, 2`,
    );

    // Build cache in the same shape the client already uses:
    // { [productKey]: [{ local, stock }, ...] }
    const branchNames = storeBranches.map((b) => b.name);
    const cacheMap = {};

    for (const row of result.rows) {
      const key = row.product_key;
      if (!cacheMap[key]) cacheMap[key] = {};
      cacheMap[key][row.local] = Number(row.stock);
    }

    // Convert to array format, ensuring every configured branch is present
    const cache = {};
    for (const [key, stockByLocal] of Object.entries(cacheMap)) {
      cache[key] = branchNames.map((name) => ({
        local: name,
        stock: stockByLocal[name] ?? 0,
      }));
    }

    return NextResponse.json({ cache });
  } catch (err) {
    console.error("[branch-stock-all]", err);
    return NextResponse.json({ cache: {} });
  }
}
