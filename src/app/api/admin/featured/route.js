import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { setProductFeatured, reorderFeaturedProducts, getCatalogProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getSessionFromCookies(cookieStore);
  return session?.isAdmin ? session : null;
}

// GET: lista de destacados en orden
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const all = await getCatalogProducts();
  const featured = all
    .filter((p) => p.isFeatured)
    .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));
  return NextResponse.json({ featured });
}

// POST: toggle featured para un producto
export async function POST(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { productKey, isFeatured } = await request.json();
  if (!productKey) return NextResponse.json({ error: "Falta productKey." }, { status: 400 });
  await setProductFeatured(productKey, Boolean(isFeatured));
  return NextResponse.json({ ok: true });
}

// PUT: reordenar destacados
export async function PUT(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { orderedKeys } = await request.json();
  if (!Array.isArray(orderedKeys)) return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  await reorderFeaturedProducts(orderedKeys);
  return NextResponse.json({ ok: true });
}
