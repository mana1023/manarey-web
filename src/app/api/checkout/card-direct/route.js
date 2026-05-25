import { NextResponse } from "next/server";
import { createOrder, markOrderPayment, syncOrderToVentas, countPreviousPaidOrders } from "@/lib/orders";
import { storeSettings, getBranchByDisplayName, storeBranches } from "@/lib/store-config";
import { sendPurchaseMessage, sendBranchOrderNotification } from "@/lib/whatsapp-sender";

function getMainStorePhone() {
  const central = storeBranches.find((b) => b.id === "longchamps");
  return central?.phone || (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
}

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
          betweenStreets: customer.betweenStreets || "",
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
      // Si el cliente no tiene email, usamos un genérico que NO sea el del vendedor
      // para evitar CPT01 (self-payment). El email del vendedor es leandromanavella2016@gmail.com.
      payer: { email: customer.email || "comprador@manarey.com.ar" },
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

      // Sincronizar con ventas del sistema de escritorio (para aparecer en envíos)
      syncOrderToVentas({
        order_code: order.orderCode,
        payment_method: "card",
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
      }).catch((e) => console.error("[card-direct] syncOrderToVentas error:", e?.message || e));

      // Notificar al local (pickup → sucursal específica, delivery → Central)
      {
        const isPickup = order.summary.shipping.id === "pickup";
        const branch = isPickup ? getBranchByDisplayName(order.customer.address || "") : null;
        const notifyPhone = isPickup ? branch?.phone : getMainStorePhone();
        if (notifyPhone) {
          sendBranchOrderNotification(notifyPhone, {
            orderCode: order.orderCode,
            customerName: order.customer.fullName,
            customerPhone: order.customer.phone,
            customerAddress: isPickup ? "" : `${order.customer.address || ""}, ${order.customer.city || ""}`.trim().replace(/^,|,$/g, ""),
            isPickup,
            branchName: branch?.shortName || branch?.name || "",
            items: order.summary.items || [],
            total: order.summary.total,
            paymentMethod: "card",
          }).catch(() => {});
        }
      }

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
