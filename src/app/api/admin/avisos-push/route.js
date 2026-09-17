import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { borrarSuscripcion, clavesVapid, guardarSuscripcion, listarSuscripciones } from "@/lib/avisos-push";

export const dynamic = "force-dynamic";

/**
 * Avisos push de pedidos en el celular.
 *   GET    → clave pública para suscribirse y cuántos celulares reciben avisos
 *   POST   → guarda la suscripción de este celular
 *   DELETE → deja de mandarle avisos a este celular
 */

async function soloAdmin() {
  const session = await getSessionFromCookies(await cookies());
  return session.isAdmin ? null : NextResponse.json({ error: "No autorizado." }, { status: 403 });
}

export async function GET() {
  const denegado = await soloAdmin();
  if (denegado) return denegado;
  try {
    const { publicKey } = await clavesVapid();
    const celulares = await listarSuscripciones();
    return NextResponse.json({ publicKey, celulares: celulares.length });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "No se pudo preparar los avisos." }, { status: 500 });
  }
}

export async function POST(request) {
  const denegado = await soloAdmin();
  if (denegado) return denegado;
  try {
    const { subscription, etiqueta } = await request.json();
    await guardarSuscripcion(subscription, {
      etiqueta: String(etiqueta || ""),
      userAgent: request.headers.get("user-agent") || "",
    });
    const celulares = await listarSuscripciones();
    return NextResponse.json({ ok: true, celulares: celulares.length });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "No se pudo activar los avisos." }, { status: 400 });
  }
}

export async function DELETE(request) {
  const denegado = await soloAdmin();
  if (denegado) return denegado;
  try {
    const { endpoint } = await request.json();
    await borrarSuscripcion(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "No se pudo desactivar los avisos." }, { status: 400 });
  }
}
