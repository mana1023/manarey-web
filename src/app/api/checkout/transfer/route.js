import { NextResponse } from "next/server";
import { createOrder, countPreviousPaidOrders } from "@/lib/orders";
import { createMercadoPagoPreference } from "@/lib/payments";
import { sendTransferPendingMessage } from "@/lib/whatsapp-sender";
import { sendEmail, buildOrderConfirmationEmail } from "@/lib/email-sender";

export async function POST(request) {
  try {
    const payload = await request.json();
    const order = await createOrder({ paymentMethod: "transfer", payload });
    const preference = await createMercadoPagoPreference({
      order,
      customer: order.customer,
    });

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

    // Enviar email de confirmación con datos de transferencia (no bloquea si falla)
    if (order.customer.email) {
      const { subject, html } = buildOrderConfirmationEmail({ order, paymentMethod: "transfer" });
      sendEmail({ to: order.customer.email, subject, html }).catch(() => {});
    }

    return NextResponse.json({
      orderCode: order.orderCode,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el pago por transferencia." },
      { status: 400 },
    );
  }
}
