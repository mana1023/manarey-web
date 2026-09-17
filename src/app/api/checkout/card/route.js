import { NextResponse } from "next/server";
import { createOrder, respuestaDeErrorDeCheckout } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/payments";
import { sendEmail, buildOrderConfirmationEmail } from "@/lib/email-sender";

export async function POST(request) {
  try {
    const payload = await request.json();
    const order = await createOrder({ paymentMethod: "card", payload });
    const preference = await createMercadoPagoPreference({ order, customer: order.customer });

    // Enviar email de confirmación (no bloquea si falla)
    if (order.customer.email) {
      const { subject, html } = buildOrderConfirmationEmail({ order, paymentMethod: "card" });
      sendEmail({ to: order.customer.email, subject, html }).catch(() => {});
    }

    // Al local no se le avisa acá: el cliente todavía no pagó y un checkout
    // de tarjeta abandonado no es una venta. El aviso sale del webhook cuando
    // Mercado Pago aprueba el pago.

    return NextResponse.json({
      orderCode: order.orderCode,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (error) {
    const { status, body } = respuestaDeErrorDeCheckout(error, "No se pudo iniciar el checkout con tarjeta.");
    return NextResponse.json(body, { status });
  }
}
