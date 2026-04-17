import { NextResponse } from "next/server";
import { fetchMercadoPagoPayment } from "@/lib/payments";
import { markOrderPayment } from "@/lib/orders";
import { query } from "@/lib/db";
import { sendEmail, buildPaymentApprovedEmail } from "@/lib/email-sender";

function mapMercadoPagoStatus(status) {
  switch (status) {
    case "approved":
      return { orderStatus: "paid", paymentStatus: "approved" };
    case "pending":
    case "in_process":
      return { orderStatus: "pending", paymentStatus: status };
    case "rejected":
    case "cancelled":
      return { orderStatus: "cancelled", paymentStatus: status };
    default:
      return { orderStatus: "pending", paymentStatus: status || "pending" };
  }
}

async function getPaymentId(request) {
  const url = new URL(request.url);
  const searchPaymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  if (searchPaymentId) return searchPaymentId;

  try {
    const body = await request.json();
    return body?.data?.id || body?.id || null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const paymentId = await getPaymentId(request);

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const payment = await fetchMercadoPagoPayment(paymentId);
    const mapped = mapMercadoPagoStatus(payment.status);

    await markOrderPayment({
      externalReference: payment.external_reference,
      paymentReference: String(payment.id),
      paymentStatus: mapped.paymentStatus,
      status: mapped.orderStatus,
      rawPayload: JSON.stringify(payment),
    });

    // Si el pago fue aprobado, enviar email de confirmación al cliente
    if (mapped.paymentStatus === "approved") {
      try {
        const result = await query(
          `SELECT customer_email, order_code FROM public.web_orders
           WHERE external_reference = $1 OR order_code = $1 LIMIT 1`,
          [payment.external_reference],
        );
        const row = result.rows[0];
        if (row?.customer_email) {
          const fakeOrder = { orderCode: row.order_code };
          const { subject, html } = buildPaymentApprovedEmail({ order: fakeOrder });
          sendEmail({ to: row.customer_email, subject, html }).catch(() => {});
        }
      } catch {
        // No bloquear el flujo
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}
