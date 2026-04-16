import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { storeBranches } from "@/lib/store-config";

export async function GET(request) {
  const url = new URL(request.url);
  const productKey = (url.searchParams.get("productKey") || "").trim();
  const allBranches = url.searchParams.get("allBranches") === "true";

  if (!productKey) return NextResponse.json({ branches: [] });

  try {
    const result = await query(
      `select local, sum(coalesce(cantidad, 0)) as stock
       from public.productos
       where md5(concat_ws('|', lower(trim(nombre)), lower(coalesce(trim(categoria),'')), lower(coalesce(trim(medida),'')), coalesce(precio_venta::text,''), lower(coalesce(trim(color),'')))) = $1
       group by local
       order by local`,
      [productKey],
    );

    const stockByLocal = {};
    for (const row of result.rows) {
      stockByLocal[row.local] = Number(row.stock);
    }

    let branches;
    if (allBranches) {
      // Return all configured branches, even those with 0 stock
      branches = storeBranches.map((b) => ({ local: b.name, stock: stockByLocal[b.name] || 0 }));
    } else {
      branches = result.rows.filter((r) => Number(r.stock) > 0).map((r) => ({ local: r.local, stock: Number(r.stock) }));
    }

    return NextResponse.json({ branches });
  } catch {
    return NextResponse.json({ branches: [] });
  }
}
