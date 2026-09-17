import { NextResponse, after } from "next/server";
import { createOrder, syncOrderToVentas, countPreviousPaidOrders, respuestaDeErrorDeCheckout } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/payments";
import { sendTransferPendingMessage } from "@/lib/whatsapp-sender";
import { sendEmail, buildOrderConfirmationEmail } from "@/lib/email-sender";
import { avisarPedidoAlLocal } from "@/lib/avisos-pedido";
import { checkCartStock } from "@/lib/stock";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request) {
  const ip = getClientIp(request);
  const rl = rateLimit({ key: `transfer:${ip}`, max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Esperá ${rl.resetIn} segundos.` },
      { status: 429 },
    );
  }

  try {
    const payload = await request.json();

    // Verificar stock
    const stockError = await checkCartStock(payload.items);
    if (stockError) {
      return NextResponse.json({ error: stockError.error }, { status: 409 });
    }

    const order = await createOrder({ paymentMethod: "transfer", payload });

    // MercadoPago es opcional para transferencia — si no está configurado o falla, igual se crea el pedido
    let preferenceId = null;
    let initPoint = null;
    let sandboxInitPoint = null;
    try {
      const preference = await createMercadoPagoPreference({ order, customer: order.customer });
      preferenceId = preference.id;
      initPoint = preference.init_point;
      sandboxInitPoint = preference.sandbox_init_point;
    } catch (mpErr) {
      console.error("[transfer] MP preference error:", mpErr?.message || mpErr);
    }

    // Sincronizar con ventas del sistema de escritorio (para aparecer en envíos)
    syncOrderToVentas({
      order_code: order.orderCode,
      payment_method: "transfer",
      customer_name: order.customer.fullName,
      customer_phone: order.customer.phone,
      customer_address: order.customer.address,
      customer_city: order.customer.city,
      customer_notes: order.customer.notes,
      shipping_zone_id: order.summary.shipping.id,
      shipping_cost: order.summary.shipping.cost,
      subtotal: order.summary.subtotal,
      total: order.summary.total,
      raw_payload: JSON.stringify({ customer: order.customer, summary: order.summary }),
    }).catch((e) => console.error("[transfer] syncOrderToVentas error:", e?.message || e));

    const phone = order.customer.phone;
    if (phone) {
      const prev = await countPreviousPaidOrders(phone, order.orderCode);
      sendTransferPendingMessage(
        phone,
        order.customer.fullName,
        order.orderCode,
        order.summary.total,
        prev,
      );
    }

    if (order.customer.email) {
      const { subject, html } = buildOrderConfirmationEmail({ order, paymentMethod: "transfer" });
      sendEmail({ to: order.customer.email, subject, html }).catch(() => {});
    }

    // Aviso al local por mail y WhatsApp: todavía no pagó, así que el
    // mensaje dice que no se prepare hasta que entre la plata.
    after(() => avisarPedidoAlLocal(order, { metodo: "transfer", etapa: "nuevo" }));

    return NextResponse.json({
      orderCode: order.orderCode,
      preferenceId,
      initPoint,
      sandboxInitPoint,
    });
  } catch (error) {
    const { status, body } = respuestaDeErrorDeCheckout(error, "No se pudo iniciar el pago por transferencia.");
    return NextResponse.json(body, { status });
  }
}
