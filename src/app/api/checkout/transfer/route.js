import { NextResponse } from "next/server";
import { createOrder, countPreviousPaidOrders } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/payments";
import { sendTransferPendingMessage } from "@/lib/whatsapp-sender";
import { sendEmail, buildOrderConfirmationEmail } from "@/lib/email-sender";

export async function POST(request) {
  try {
    const payload = await request.json();
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

    return NextResponse.json({
      orderCode: order.orderCode,
      preferenceId,
      initPoint,
      sandboxInitPoint,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el pago por transferencia." },
      { status: 400 },
    );
  }
}
