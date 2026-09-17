import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { contenidoPushDelPedido, enviarPush, listarSuscripciones } from "@/lib/avisos-push";

export const dynamic = "force-dynamic";

/**
 * Manda un pedido de ejemplo por push, para confirmar que el aviso llega sin
 * hacer una compra de verdad. Con { endpoint } va sólo a ese celular; sin él,
 * a todos los que tienen los avisos activados.
 */

const PEDIDO_DE_EJEMPLO = {
  orderCode: "PRUEBA-0001",
  customer: {
    fullName: "Cliente de prueba",
    email: "prueba@manarey.com.ar",
    phone: "11 0000-0000",
    address: "Av. San Martín 1234",
    city: "Glew",
    betweenStreets: "Lavalle y Mitre",
    notes: "Esto es una prueba, no hay que despachar nada.",
  },
  summary: {
    items: [
      { nombre: "Alacena", medida: "1,20m", materialSistema: "pino", quantity: 1, precioVenta: 77500, accessoryPrice: 0 },
      { nombre: "Cocina Candor", color: "negro gas natural", materialSistema: "gas natural", quantity: 1, precioVenta: 408000, accessoryPrice: 0 },
    ],
    subtotal: 485500,
    shipping: { id: "delivery", cost: 0, otroDia: false, zoneLabel: "Zona cercana" },
    total: 485500,
  },
  installments: 1,
};

export async function POST(request) {
  const session = await getSessionFromCookies(await cookies());
  if (!session.isAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { endpoint } = await request.json().catch(() => ({}));
  const celulares = (await listarSuscripciones()).filter((c) => !endpoint || c.endpoint === endpoint);
  if (!celulares.length) {
    return NextResponse.json({ error: "No hay ningún celular con los avisos activados." }, { status: 400 });
  }

  const contenido = contenidoPushDelPedido(PEDIDO_DE_EJEMPLO, { metodo: "card", etapa: "pagado" });
  contenido.title = `🧪 Prueba · ${contenido.title}`;
  contenido.tag = `prueba-${Date.now()}`;

  const resultados = [];
  for (const celular of celulares) {
    try {
      const r = await enviarPush(celular, contenido);
      resultados.push({ etiqueta: celular.etiqueta, ok: r.ok, vencida: Boolean(r.vencida) });
    } catch (err) {
      resultados.push({ etiqueta: celular.etiqueta, ok: false, error: err?.message || String(err) });
    }
  }

  return NextResponse.json({ resultados }, { status: resultados.some((r) => r.ok) ? 200 : 502 });
}
