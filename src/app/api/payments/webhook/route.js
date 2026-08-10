import { NextResponse } from "next/server";
import crypto from "crypto";
import { fetchMercadoPagoPayment } from "@/lib/payments";
import { markOrderPayment } from "@/lib/orders";
import { query } from "@/lib/db";
import { sendEmail, buildPaymentApprovedEmail, notificarAlLocal } from "@/lib/email-sender";

// ── Verificación de firma MP ─────────────────────────────────────────────────
//
// MP envía el header:  x-signature: ts=TIMESTAMP,v1=HMAC_SHA256_HEX
// El mensaje a firmar: "id:PAYMENT_ID;request-date:TIMESTAMP;"
// Secret: configurado en MP Developer Panel → Webhooks → tu webhook → Secret
//
// Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks

function verifyMpSignature(request, paymentId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  // Si no hay secret configurado, loguear advertencia pero dejar pasar
  // (permite desarrollo sin configurar el secret todavía)
  if (!secret) {
    console.warn("[webhook] MERCADO_PAGO_WEBHOOK_SECRET no configurado — saltando verificación de firma.");
    return true;
  }

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";

  // Parsear ts y v1 del header
  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=").map((s) => s.trim())),
  );
  const ts = parts.ts;
  const v1 = parts.v1;

  if (!ts || !v1) {
    console.warn("[webhook] Header x-signature mal formado:", xSignature);
    return false;
  }

  // Construir el mensaje
  const manifest = [
    paymentId ? `id:${paymentId};` : "",
    xRequestId ? `request-id:${xRequestId};` : "",
    `request-date:${ts};`,
  ]
    .filter(Boolean)
    .join("");

  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const isValid =
    expectedHmac.length === v1.length &&
    crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(v1));

  if (!isValid) {
    console.warn("[webhook] Firma inválida. Expected:", expectedHmac, "Got:", v1);
  }

  return isValid;
}

// ── Status mapping ────────────────────────────────────────────────────────────
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
    const clone = request.clone();
    const body = await clone.json();
    return body?.data?.id || body?.id || null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(request) {
  const paymentId = await getPaymentId(request);

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Verificar firma
  if (!verifyMpSignature(request, paymentId)) {
    console.error("[webhook] Firma inválida — request rechazado.");
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  try {
    let payment;
    try {
      payment = await fetchMercadoPagoPayment(paymentId);
    } catch (fetchErr) {
      console.error("[webhook] No se pudo obtener el pago MP:", paymentId, fetchErr?.message || fetchErr);
      return NextResponse.json({ ok: true, ignored: true, reason: "fetch_failed" });
    }

    const mapped = mapMercadoPagoStatus(payment.status);

    await markOrderPayment({
      externalReference: payment.external_reference,
      paymentReference: String(payment.id),
      paymentStatus: mapped.paymentStatus,
      status: mapped.orderStatus,
      rawPayload: JSON.stringify(payment),
    });

    // Email de pago aprobado
    if (mapped.paymentStatus === "approved") {
      try {
        const result = await query(
          `SELECT customer_email, customer_name, customer_phone, customer_address, customer_city,
                  order_code, payment_method, subtotal, shipping_cost, total, shipping_zone_id
             FROM public.web_orders
            WHERE external_reference = $1 OR order_code = $1 LIMIT 1`,
          [payment.external_reference],
        );
        const row = result.rows[0];
        if (row?.customer_email) {
          const { subject, html } = buildPaymentApprovedEmail({ order: { orderCode: row.order_code } });
          sendEmail({ to: row.customer_email, subject, html }).catch(() => {});
        }

        // Aviso al local de que ESTE pedido ya está pagado. Es el momento que
        // más importa: hasta acá el pedido podía quedarse sin cobrar, y ahora
        // hay plata puesta y alguien esperando su mueble.
        if (row) {
          notificarAlLocal(
            {
              orderCode: row.order_code,
              customer: {
                fullName: row.customer_name,
                email: row.customer_email,
                phone: row.customer_phone,
                address: row.customer_address,
                city: row.customer_city,
              },
              summary: {
                items: [],
                subtotal: Number(row.subtotal || 0),
                shipping: { id: row.shipping_zone_id, cost: Number(row.shipping_cost || 0) },
                total: Number(row.total || 0),
              },
            },
            row.payment_method || "transfer",
            true,
          );
        }
      } catch (err) {
        // No bloquear el flujo por el email
        console.error("[webhook] Error avisando del pago:", err?.message || err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Error inesperado:", err?.message || err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}
