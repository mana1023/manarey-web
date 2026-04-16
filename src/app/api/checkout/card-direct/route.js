import { NextResponse } from "next/server";
import { createOrder, markOrderPayment, countPreviousPaidOrders } from "@/lib/orders";
import { storeSettings } from "@/lib/store-config";
import { sendPurchaseMessage } from "@/lib/whatsapp-sender";

function getMpToken() {
  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN no esta configurado.");
  return token;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { cardToken, paymentMethodId, installments, issuerId, items, shippingModeId, customer, selectedBranch } =
      body;

    if (!cardToken || !paymentMethodId) {
      return NextResponse.json({ error: "Datos del pago incompletos." }, { status: 400 });
    }

    const order = await createOrder({
      paymentMethod: "card",
      payload: {
        items,
        shippingModeId: shippingModeId || "pickup",
        customer: {
          fullName: `${customer.nombre} ${customer.apellido}`.trim(),
          email: customer.email || "",
          phone: customer.telefono || customer.phone || "",
          address: customer.address || selectedBranch || "",
          city: customer.city || "Retiro en sucursal",
          distanceKm: customer.distanceKm || "",
          notes: customer.notes || "",
        },
      },
    });

    const paymentPayload = {
      transaction_amount: Number(order.summary.total.toFixed(2)),
      token: cardToken,
      description: `Compra Manarey ${order.orderCode}`,
      installments: Number(installments || 1),
      payment_method_id: paymentMethodId,
      payer: { email: customer.email || "cliente@manarey.com" },
      external_reference: order.orderCode,
      statement_descriptor: storeSettings.brandName.slice(0, 16),
      metadata: {
        order_code: order.orderCode,
        customer_phone: customer.telefono || customer.phone,
      },
      notification_url: `${storeSettings.siteUrl}/api/payments/webhook`,
    };
    if (issuerId) paymentPayload.issuer_id = String(issuerId);

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getMpToken()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.orderCode,
      },
      body: JSON.stringify(paymentPayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      const detail = mpData?.message || mpData?.cause?.[0]?.description || "Pago rechazado";
      return NextResponse.json({ error: detail, status: "rejected" }, { status: 400 });
    }

    if (mpData.status === "approved") {
      await markOrderPayment({
        externalReference: order.orderCode,
        paymentReference: String(mpData.id),
        paymentStatus: "approved",
        status: "paid",
        rawPayload: JSON.stringify(mpData),
      }).catch(() => {});

      const phone = customer.telefono || customer.phone;
      if (phone) {
        const nombre = `${customer.nombre || ""} ${customer.apellido || ""}`.trim();
        // Contar compras previas para decidir qué mensaje enviar
        const prev = await countPreviousPaidOrders(phone, order.orderCode);
        sendPurchaseMessage(phone, nombre, order.orderCode, order.summary.total, prev);
      }
    }

    return NextResponse.json({
      status: mpData.status,
      orderCode: order.orderCode,
      paymentId: mpData.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el pago." },
      { status: 500 },
    );
  }
}
