import { NextResponse } from "next/server";
import { createOrder, markOrderPayment, syncOrderToVentas, countPreviousPaidOrders } from "@/lib/orders";
import { storeSettings, getBranchByDisplayName, storeBranches } from "@/lib/store-config";
import { sendPurchaseMessage, sendBranchOrderNotification } from "@/lib/whatsapp-sender";
import { sendEmail, buildOrderConfirmationEmail } from "@/lib/email-sender";
import { checkCartStock } from "@/lib/stock";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
  // ── Rate limiting: máx 8 intentos por IP por minuto ──────────────────────
  const ip = getClientIp(request);
  const rl = rateLimit({ key: `card:${ip}`, max: 8, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Esperá ${rl.resetIn} segundos e intentá de nuevo.` },
      { status: 429, headers: { "Retry-After": String(rl.resetIn) } },
    );
  }

  try {
    const body = await request.json();
    const { cardToken, paymentMethodId, installments, issuerId, items, shippingModeId, customer, selectedBranch, surchargeAmount } = body;

    if (!cardToken || !paymentMethodId) {
      return NextResponse.json({ error: "Datos del pago incompletos." }, { status: 400 });
    }

    // ── Verificar stock antes de cobrar ──────────────────────────────────────
    const stockError = await checkCartStock(items);
    if (stockError) {
      return NextResponse.json({ error: stockError.error }, { status: 409 });
    }

    // Validar recargo: solo permitimos los valores predefinidos (0%, 25%)
    const parsedSurcharge = Math.max(0, Math.round(Number(surchargeAmount) || 0));

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
      surchargeAmount: parsedSurcharge,
      installments: Number(installments || 1),
    });

    const paymentPayload = {
      transaction_amount: Number(order.totalCharged.toFixed(2)),
      token: cardToken,
      description: `Compra Manarey ${order.orderCode}`,
      installments: Number(installments || 1),
      payment_method_id: paymentMethodId,
      payer: { email: customer.email || "comprador@manarey.com.ar" },
      external_reference: order.orderCode,
      statement_descriptor: storeSettings.brandName.slice(0, 16),
      metadata: {
        order_code: order.orderCode,
        customer_phone: customer.telefono || customer.phone,
      },
      notification_url: `${storeSettings.siteUrl}/api/payments/webhook`,
      three_d_secure_mode: "optional",
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

    // Log completo para diagnóstico (visible en Vercel Functions logs)
    console.log("[card-direct] MP response:", JSON.stringify({
      status: mpData.status,
      status_detail: mpData.status_detail,
      id: mpData.id,
      payment_method_id: mpData.payment_method_id,
      issuer_id: mpData.issuer_id,
      cause: mpData.cause,
      message: mpData.message,
    }));

    if (!mpRes.ok) {
      const detail = mpData?.message || mpData?.cause?.[0]?.description || "Pago rechazado";
      return NextResponse.json({ error: detail, status: "rejected", statusDetail: mpData?.cause?.[0]?.code }, { status: 400 });
    }

    // Pago rechazado por el banco (MP devuelve 201 pero con status "rejected")
    if (mpData.status === "rejected") {
      const MP_REJECTION_MESSAGES = {
        cc_rejected_insufficient_amount: "Fondos insuficientes. Verificá el saldo de tu tarjeta.",
        cc_rejected_call_for_authorize: "Tu banco requiere que autorices este pago. Llamá al número del dorso de tu tarjeta o aprobalo desde el home banking.",
        cc_rejected_card_disabled: "La tarjeta está deshabilitada. Contactá a tu banco para activarla.",
        cc_rejected_duplicated_payment: "Ya existe un pago igual reciente. Esperá unos minutos e intentá de nuevo.",
        cc_rejected_high_risk: "El pago fue rechazado por seguridad. Intentá con otra tarjeta o contactanos por WhatsApp.",
        cc_rejected_bad_filled_security_code: "El código de seguridad (CVV) es incorrecto.",
        cc_rejected_bad_filled_date: "La fecha de vencimiento es incorrecta.",
        cc_rejected_bad_filled_card_number: "El número de tarjeta es incorrecto.",
        cc_rejected_other_reason: "El banco rechazó el pago. Intentá con otra tarjeta o contactanos por WhatsApp.",
        cc_rejected_card_type_not_allowed: "Este tipo de tarjeta no está permitido para esta operación.",
        cc_rejected_max_attempts: "Superaste el máximo de intentos. Esperá un rato e intentá de nuevo.",
      };
      const statusDetail = mpData.status_detail || "";
      const userMsg = MP_REJECTION_MESSAGES[statusDetail] || `Pago rechazado por el banco (${statusDetail || "razón desconocida"}). Intentá con otra tarjeta o pagá por transferencia.`;
      return NextResponse.json({ error: userMsg, status: "rejected", statusDetail }, { status: 400 });
    }

    if (mpData.status === "approved") {
      await markOrderPayment({
        externalReference: order.orderCode,
        paymentReference: String(mpData.id),
        paymentStatus: "approved",
        status: "paid",
        rawPayload: JSON.stringify(mpData),
      }).catch(() => {});

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

      // Notificar al local
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

      // WhatsApp al cliente
      const phone = customer.telefono || customer.phone;
      if (phone) {
        const nombre = `${customer.nombre || ""} ${customer.apellido || ""}`.trim();
        const prev = await countPreviousPaidOrders(phone, order.orderCode);
        sendPurchaseMessage(phone, nombre, order.orderCode, order.summary.total, prev);
      }

      // Email de confirmación al cliente
      if (order.customer.email) {
        const { subject, html } = buildOrderConfirmationEmail({ order, paymentMethod: "card" });
        sendEmail({ to: order.customer.email, subject, html }).catch(() => {});
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
