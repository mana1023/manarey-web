import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/payments";
import { sendEmail, buildOrderConfirmationEmail, notificarAlLocal } from "@/lib/email-sender";

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

    // Aviso al local. Va fuera del if de arriba a proposito: el negocio
    // tiene que enterarse aunque el cliente no haya dejado mail.
    notificarAlLocal(order, "card", false);

    return NextResponse.json({
      orderCode: order.orderCode,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el checkout con tarjeta." },
      { status: 400 },
    );
  }
}
