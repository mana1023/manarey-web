import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { getShippingSettings, setSetting } from "@/lib/settings-db";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getSessionFromCookies(cookieStore);
  if (!session?.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const settings = await getShippingSettings();
  return NextResponse.json(settings);
}

export async function PUT(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const baseCost = Number(body.shippingBaseCost);
  const perKm = Number(body.shippingCostPerKm);

  if (!Number.isFinite(baseCost) || baseCost < 0) {
    return NextResponse.json({ error: "Costo base inválido." }, { status: 400 });
  }
  if (!Number.isFinite(perKm) || perKm < 0) {
    return NextResponse.json({ error: "Costo por km inválido." }, { status: 400 });
  }

  await Promise.all([
    setSetting("shipping_base_cost", baseCost),
    setSetting("shipping_cost_per_km", perKm),
  ]);

  return NextResponse.json({ ok: true, shippingBaseCost: baseCost, shippingCostPerKm: perKm });
}
