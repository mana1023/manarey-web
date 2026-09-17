/**
 * Avisos al local cuando entra un pedido: mail, push al celular y WhatsApp.
 *
 * Todo pasa por acá para que haya un solo lugar que decida qué se avisa y
 * cuándo. Antes cada ruta avisaba a su manera: la de tarjeta mandaba WhatsApp
 * a la sucursal, la de transferencia sólo mail, el webhook mandaba el mail
 * sin productos, y la detección de transferencias no mandaba mail.
 *
 * Etapas:
 *   "nuevo"  → el cliente eligió transferencia o efectivo: hay que esperar la
 *              plata o escribirle. (Con tarjeta no se avisa en esta etapa: un
 *              checkout de tarjeta abandonado no es una venta.)
 *   "pagado" → la plata entró: tarjeta aprobada o transferencia detectada.
 *              Con origen "deteccion" el pago se encontró por monto y no por
 *              código de pedido, y el mensaje pide confirmarlo.
 *
 * Cada aviso se manda UNA vez por pedido, etapa y destinatario. Mercado Pago
 * reintenta el webhook y además el pago con tarjeta se confirma por dos
 * caminos (la respuesta directa y el webhook): sin esto a la misma persona le
 * llegaban dos o tres mensajes por la misma venta.
 */

import { query } from "@/lib/db";
import { sendEmail, buildNewOrderAlertEmail, getOrdersNotifyEmail } from "@/lib/email-sender";
import { destinatariosDeAvisos, enviarAvisoPedidoWhatsApp } from "@/lib/whatsapp-sender";
import { contenidoPushDelPedido, enviarPush, idDeSuscripcion, listarSuscripciones } from "@/lib/avisos-push";

const g = globalThis;

async function asegurarTabla() {
  if (g._manareyAvisosTabla) return;
  await query(`
    create table if not exists public.web_order_avisos (
      order_code text not null,
      etapa text not null,
      canal text not null,
      enviado_at timestamp without time zone default now(),
      primary key (order_code, etapa, canal)
    )
  `);
  g._manareyAvisosTabla = true;
}

/**
 * Reserva el envío antes de hacerlo. Devuelve false si ya se mandó. Si la
 * base falla, deja pasar: un aviso repetido es mejor que uno perdido.
 */
async function reservar(orderCode, etapa, canal) {
  try {
    await asegurarTabla();
    const r = await query(
      `insert into public.web_order_avisos (order_code, etapa, canal)
       values ($1, $2, $3) on conflict do nothing returning 1`,
      [orderCode, etapa, canal],
    );
    return r.rowCount > 0;
  } catch (err) {
    console.error("[avisos] No se pudo reservar el aviso, se manda igual:", err?.message || err);
    return true;
  }
}

/** Si el envío falló, se libera para que un reintento lo pueda mandar. */
async function liberar(orderCode, etapa, canal) {
  await query(
    `delete from public.web_order_avisos where order_code = $1 and etapa = $2 and canal = $3`,
    [orderCode, etapa, canal],
  ).catch(() => {});
}

async function unaVez(orderCode, etapa, canal, enviar) {
  if (!(await reservar(orderCode, etapa, canal))) return;
  try {
    await enviar();
  } catch (err) {
    await liberar(orderCode, etapa, canal);
    console.error(`[avisos] Falló el aviso ${canal} del pedido ${orderCode} (${etapa}):`, err?.message || err);
  }
}

/**
 * Avisa al local. Nunca tira: un aviso que falla no puede romper un pedido.
 * Llamarla dentro de after() para que la función siga viva hasta terminar de
 * mandar — en Vercel, lo que queda sin esperar después de responder se corta.
 */
export async function avisarPedidoAlLocal(order, { metodo, etapa, origen }) {
  if (!order?.orderCode) return;
  const tareas = [];

  const mail = getOrdersNotifyEmail();
  if (mail) {
    tareas.push(
      unaVez(order.orderCode, etapa, "email", async () => {
        const { subject, html } = buildNewOrderAlertEmail({
          order,
          paymentMethod: metodo,
          isPaid: etapa === "pagado",
        });
        const r = await sendEmail({ to: mail, subject, html });
        if (!r?.ok) throw new Error(r?.reason || "Resend rechazó el mail");
      }),
    );
  } else {
    console.warn("[avisos] Sin ORDERS_EMAIL ni ADMIN_EMAIL: no se mandó el mail del pedido", order.orderCode);
  }

  // Push a cada celular que activó los avisos desde /admin.
  const celulares = await listarSuscripciones().catch((err) => {
    console.error("[avisos] No se pudieron leer los celulares con avisos:", err?.message || err);
    return [];
  });
  const contenido = celulares.length ? contenidoPushDelPedido(order, { metodo, etapa, origen }) : null;
  for (const celular of celulares) {
    tareas.push(
      unaVez(order.orderCode, etapa, `push:${idDeSuscripcion(celular.endpoint)}`, () =>
        enviarPush(celular, contenido),
      ),
    );
  }

  for (const numero of destinatariosDeAvisos()) {
    tareas.push(
      unaVez(order.orderCode, etapa, `whatsapp:${numero}`, () =>
        enviarAvisoPedidoWhatsApp(numero, order, { metodo, etapa, origen }),
      ),
    );
  }

  await Promise.allSettled(tareas);
}

/**
 * Arma el pedido a partir de una fila de web_orders, para las rutas que no lo
 * tienen en memoria (webhook, detección de transferencias).
 */
export function pedidoDesdeFila(row) {
  let raw = row?.raw_payload;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  raw = raw || {};
  const customer = raw.customer || {};
  const summary = raw.summary || {};

  return {
    orderCode: row.order_code,
    customer: {
      fullName: row.customer_name || customer.fullName || "",
      email: row.customer_email || customer.email || "",
      phone: row.customer_phone || customer.phone || "",
      address: row.customer_address || customer.address || "",
      city: row.customer_city || customer.city || "",
      betweenStreets: customer.betweenStreets || "",
      notes: row.customer_notes || customer.notes || "",
    },
    summary: {
      items: summary.items || [],
      subtotal: Number(row.subtotal ?? summary.subtotal ?? 0),
      shipping: {
        ...(summary.shipping || {}),
        id: row.shipping_zone_id || summary.shipping?.id,
        cost: Number(row.shipping_cost ?? summary.shipping?.cost ?? 0),
      },
      total: Number(row.total ?? summary.total ?? 0),
    },
    installments: Number(row.installments || raw.installments || 1),
  };
}
