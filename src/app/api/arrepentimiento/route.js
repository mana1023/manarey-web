import { NextResponse } from "next/server";
import { sendEmail, getOrdersNotifyEmail } from "@/lib/email-sender";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Recibe los pedidos de arrepentimiento (Resolución 424/2020 y Ley 24.240).
 *
 * El cliente tiene 10 días corridos desde que recibe el producto para
 * arrepentirse, sin dar explicaciones y sin costo. La ley pide que el pedido se
 * pueda hacer desde la web, no sólo por teléfono, y que quede constancia.
 *
 * Le llega al local por mail. No hace falta que el cliente tenga cuenta.
 */
function limpiar(texto, maximo) {
  return String(texto || "").replace(/\s+/g, " ").trim().slice(0, maximo);
}

export async function POST(request) {
  const limite = rateLimit({
    key: `arrepentimiento:${getClientIp(request)}`,
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limite.ok) {
    return NextResponse.json(
      { error: "Recibimos varios pedidos desde este dispositivo. Probá de nuevo en un rato o escribinos por WhatsApp." },
      { status: 429 },
    );
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 });
  }

  const nombre = limpiar(cuerpo.nombre, 120);
  const contacto = limpiar(cuerpo.contacto, 120);
  const pedido = limpiar(cuerpo.pedido, 60);
  const detalle = limpiar(cuerpo.detalle, 1500);

  if (!nombre || !contacto) {
    return NextResponse.json(
      { error: "Necesitamos tu nombre y un teléfono o mail para poder contestarte." },
      { status: 400 },
    );
  }

  const fecha = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const fila = (titulo, valor) =>
    `<tr><td style="padding:6px 12px;color:#6b5744;white-space:nowrap">${titulo}</td>
         <td style="padding:6px 12px;color:#2c1e12"><strong>${valor}</strong></td></tr>`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
      <h2 style="color:#ab5443;margin:0 0 4px">Pedido de arrepentimiento</h2>
      <p style="color:#6b5744;margin:0 0 16px;font-size:14px">
        Un cliente ejerció el derecho de arrepentimiento desde la web. Por ley hay
        <strong>10 días corridos</strong> desde la entrega y la devolución del dinero
        no puede tener costo para el cliente. Conviene contestarle hoy.
      </p>
      <table style="border-collapse:collapse;background:#faf5ec;border-radius:10px;font-size:14px">
        ${fila("Nombre", nombre)}
        ${fila("Contacto", contacto)}
        ${pedido ? fila("N° de pedido", pedido) : ""}
        ${fila("Fecha del pedido", fecha)}
      </table>
      ${detalle ? `<p style="margin:16px 0 0;color:#2c1e12;font-size:14px"><strong>Lo que cuenta:</strong><br>${detalle}</p>` : ""}
    </div>
  `;

  const destino = getOrdersNotifyEmail();
  const envio = await sendEmail({
    to: destino,
    subject: `Arrepentimiento de ${nombre}${pedido ? ` · pedido ${pedido}` : ""}`,
    html,
  });

  // Aunque el mail falle, al cliente se le confirma: la ley no lo puede dejar
  // sin constancia por un problema nuestro. Queda en el log para recuperarlo.
  if (!envio?.ok) {
    console.error("[arrepentimiento] No se pudo avisar por mail:", envio?.reason, { nombre, contacto, pedido, detalle });
  }

  return NextResponse.json({ ok: true });
}
