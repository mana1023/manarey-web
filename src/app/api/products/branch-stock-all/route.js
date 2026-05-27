import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { storeBranches } from "@/lib/store-config";

// Cache en memoria: 30 segundos (suficiente para que el admin no pegue N requests)
const g = globalThis;
const CACHE_TTL = 30_000;

export const dynamic = "force-dynamic";

export async function GET() {
  // Servir del cache si está fresco
  if (g._branchStockAllCache && Date.now() - g._branchStockAllCache.ts < CACHE_TTL) {
    return NextResponse.json({ cache: g._branchStockAllCache.data }, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const dbToDisplay = {};
  for (const b of storeBranches) {
    dbToDisplay[b.dbName] = b.name;
  }

  try {
    const dbNames = storeBranches.map((b) => b.dbName);

    // ⚠️ Fórmula NUEVA: igual que getCatalogProducts en lib/products.js
    //    md5(nombre | medida | color)  — sin categoria ni precio_venta
    const result = await query(
      `SELECT
         md5(concat_ws('|',
           lower(trim(nombre)),
           lower(coalesce(trim(medida), '')),
           lower(coalesce(trim(color),  ''))
         )) AS product_key,
         trim(local) AS local,
         sum(greatest(coalesce(cantidad, 0), 0))::integer AS stock
       FROM public.productos
       WHERE trim(local) = ANY($1)
       GROUP BY 1, 2`,
      [dbNames],
    );

    // Construir mapa intermedio: { productKey: { displayName: stock } }
    const intermediate = {};
    for (const row of result.rows) {
      const displayName = dbToDisplay[row.local];
      if (!displayName) continue;
      if (!intermediate[row.product_key]) intermediate[row.product_key] = {};
      intermediate[row.product_key][displayName] = Number(row.stock);
    }

    // Convertir al formato del cache: { productKey: [{ local, stock }] }
    const cache = {};
    for (const [key, byDisplay] of Object.entries(intermediate)) {
      cache[key] = storeBranches.map((b) => ({
        local: b.name,
        stock: byDisplay[b.name] ?? 0,
      }));
    }

    // Guardar en cache global
    g._branchStockAllCache = { data: cache, ts: Date.now() };

    return NextResponse.json({ cache });
  } catch (err) {
    console.error("[branch-stock-all]", err);
    return NextResponse.json({ cache: {} }, { status: 500 });
  }
}
