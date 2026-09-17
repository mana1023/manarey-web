import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import { destinatariosDeAvisos, enviarAvisoPedidoWhatsApp } from "@/lib/whatsapp-sender";

export const dynamic = "force-dynamic";

/**
 * Para probar el aviso de WhatsApp de pedidos sin tener que comprar nada.
 *   GET  → dice qué falta configurar y a quién le llegaría.
 *   POST → manda un pedido de ejemplo a esos números y devuelve lo que
 *          contestó Meta, error incluido.
 * No pasa por el control de "una vez por pedido": se puede repetir.
 */

async function soloAdmin() {
  const session = await getSessionFromCookies(await cookies());
  return session.isAdmin
    ? null
    : NextResponse.json({ error: "No autorizado." }, { status: 403 });
}

function diagnostico() {
  const faltan = ["WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"].filter(
    (k) => !(process.env[k] || "").trim(),
  );
  return {
    configurado: faltan.length === 0,
    faltan,
    destinatarios: destinatariosDeAvisos(),
    plantilla: (process.env.WHATSAPP_PLANTILLA_PEDIDO || "aviso_pedido_web").trim(),
    idioma: (process.env.WHATSAPP_PLANTILLA_IDIOMA || "es_AR").trim(),
  };
}

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
      { nombre: "Cocina Candor", color: "negro gas natural", materialSistema: "gas natural", quantity: 1, precioVenta: 365000, accessoryPrice: 0 },
    ],
    subtotal: 442500,
    shipping: { id: "delivery", cost: 0, otroDia: false, zoneLabel: "Zona cercana" },
    total: 442500,
  },
  installments: 1,
};

export async function GET() {
  const denegado = await soloAdmin();
  if (denegado) return denegado;
  return NextResponse.json(diagnostico());
}

export async function POST() {
  const denegado = await soloAdmin();
  if (denegado) return denegado;

  const estado = diagnostico();
  if (!estado.configurado) {
    return NextResponse.json({ ...estado, error: `Faltan variables: ${estado.faltan.join(", ")}` }, { status: 400 });
  }
  if (!estado.destinatarios.length) {
    return NextResponse.json(
      { ...estado, error: "No hay a quién mandarle: revisá WHATSAPP_AVISOS_A." },
      { status: 400 },
    );
  }

  const resultados = [];
  for (const numero of estado.destinatarios) {
    try {
      const r = await enviarAvisoPedidoWhatsApp(numero, PEDIDO_DE_EJEMPLO, { metodo: "card", etapa: "pagado" });
      resultados.push({ numero, ok: true, id: r.id });
    } catch (err) {
      resultados.push({ numero, ok: false, error: err?.message || String(err) });
    }
  }

  return NextResponse.json({ ...estado, resultados }, { status: resultados.every((r) => r.ok) ? 200 : 502 });
}
