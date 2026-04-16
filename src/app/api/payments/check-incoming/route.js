import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { markOrderPayment, syncOrderToVentas, countPreviousPaidOrders } from "@/lib/orders";
import { sendPurchaseMessage } from "@/lib/whatsapp-sender";

function getMpToken() {
  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN no configurado.");
  return token;
}

/**
 * Busca en la API de Mercado Pago pagos entrantes (transferencias bancarias y
 * dinero en cuenta) de los ultimos 30 minutos que no esten aun asociados a una
 * orden pagada, y los matchea por monto.
 */
async function fetchRecentMpPayments() {
  // Buscar pagos aprobados de los ultimos 60 minutos
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("status", "approved");
  url.searchParams.set("begin_date", since);
  url.searchParams.set("limit", "50");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getMpToken()}` },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data?.results || [];
}

/**
 * Busca ordenes pendientes de pago en los ultimos 90 minutos.
 */
async function fetchPendingOrders() {
  const result = await query(`
    select order_code, total, payment_method, customer_name, customer_email,
           customer_phone, customer_address, customer_city, customer_notes,
           shipping_zone_id, shipping_cost, subtotal, raw_payload,
           preference_id, external_reference, created_at
    from public.web_orders
    where status in ('pending')
      and payment_status not in ('approved')
      and payment_method in ('transfer', 'card', 'whatsapp')
      and created_at > now() - interval '90 minutes'
  `);
  return result.rows;
}

export async function POST() {
  try {
    const [mpPayments, pendingOrders] = await Promise.all([
      fetchRecentMpPayments(),
      fetchPendingOrders(),
    ]);

    if (!pendingOrders.length || !mpPayments.length) {
      return NextResponse.json({ checked: 0, matched: 0 });
    }

    let matched = 0;

    for (const order of pendingOrders) {
      const orderTotal = Number(order.total);

      // Buscar un pago de MP que coincida:
      // 1. Por external_reference (si se creo via preferencia MP)
      // 2. Por monto exacto (para transferencias manuales al CVU)
      const mpMatch = mpPayments.find((p) => {
        // Match por external_reference (pago via checkout MP)
        if (p.external_reference && p.external_reference === order.order_code) {
          return true;
        }
        if (p.external_reference && p.external_reference === order.external_reference) {
          return true;
        }

        // Match por preference_id
        if (order.preference_id && p.preference_id === order.preference_id) {
          return true;
        }

        // Match por monto exacto para transferencias manuales
        // Solo si el pago es tipo bank_transfer o account_money
        const isTransferType = ["bank_transfer", "account_money"].includes(
          p.payment_type_id,
        );
        if (isTransferType) {
          const mpAmount = Number(p.transaction_amount || 0);
          const tolerance = orderTotal * 0.01; // 1% tolerancia
          if (Math.abs(mpAmount - orderTotal) <= tolerance) {
            // Verificar que el pago sea reciente (dentro de 30min de la orden)
            const orderTime = new Date(order.created_at).getTime();
            const payTime = new Date(p.date_created).getTime();
            const diffMs = payTime - orderTime;
            if (diffMs >= -60000 && diffMs <= 45 * 60 * 1000) {
              return true;
            }
          }
        }

        return false;
      });

      if (mpMatch) {
        // Marcar orden como pagada
        await markOrderPayment({
          externalReference: order.order_code,
          paymentReference: String(mpMatch.id),
          paymentStatus: "approved",
          status: "paid",
          rawPayload: JSON.stringify(mpMatch),
        });

        // Sincronizar a envios y notificar al cliente
        const updatedOrder = await query(
          `select * from public.web_orders where order_code = $1 limit 1`,
          [order.order_code],
        );
        if (updatedOrder.rows[0]) {
          await syncOrderToVentas(updatedOrder.rows[0]).catch(() => {});

          // Mensaje de confirmación al cliente (personalizado según si es nuevo o recurrente)
          const phone = updatedOrder.rows[0].customer_phone;
          const nombre = updatedOrder.rows[0].customer_name || "";
          const total = Number(updatedOrder.rows[0].total || 0);
          const orderCode = updatedOrder.rows[0].order_code;
          if (phone) {
            const prev = await countPreviousPaidOrders(phone, orderCode).catch(() => 0);
            sendPurchaseMessage(phone, nombre, orderCode, total, prev);
          }
        }

        matched++;
      }
    }

    return NextResponse.json({ checked: pendingOrders.length, matched });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al verificar pagos." },
      { status: 500 },
    );
  }
}

// GET: para verificar el estado de una orden especifica y matchear si hay pago
export async function GET(request) {
  const url = new URL(request.url);
  const orderCode = (url.searchParams.get("code") || "").trim();

  if (!orderCode) {
    return NextResponse.json({ isPaid: false });
  }

  try {
    // Primero verificar si ya esta pagada en nuestra DB
    const existing = await query(
      `select status, payment_status, payment_reference from public.web_orders where order_code = $1 limit 1`,
      [orderCode],
    );

    const order = existing.rows[0];
    if (!order) return NextResponse.json({ isPaid: false });

    if (order.status === "paid" || order.payment_status === "approved") {
      return NextResponse.json({ isPaid: true, alreadyInVentas: true });
    }

    // Buscar en MP si hay un pago reciente que coincida
    const orderData = await query(
      `select * from public.web_orders where order_code = $1 limit 1`,
      [orderCode],
    );
    const fullOrder = orderData.rows[0];
    if (!fullOrder) return NextResponse.json({ isPaid: false });

    const orderTotal = Number(fullOrder.total);
    const since = new Date(new Date(fullOrder.created_at).getTime() - 5 * 60 * 1000).toISOString();

    const searchUrl = new URL("https://api.mercadopago.com/v1/payments/search");
    searchUrl.searchParams.set("status", "approved");
    searchUrl.searchParams.set("begin_date", since);
    searchUrl.searchParams.set("limit", "30");
    searchUrl.searchParams.set("sort", "date_created");
    searchUrl.searchParams.set("criteria", "desc");

    const mpRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${getMpToken()}` },
      cache: "no-store",
    });

    if (!mpRes.ok) return NextResponse.json({ isPaid: false });

    const mpData = await mpRes.json();
    const payments = mpData?.results || [];

    const match = payments.find((p) => {
      if (p.external_reference === orderCode) return true;
      if (fullOrder.preference_id && p.preference_id === fullOrder.preference_id) return true;
      if (fullOrder.external_reference && p.external_reference === fullOrder.external_reference) return true;

      // Match por monto para transferencias directas al CVU
      const isTransfer = ["bank_transfer", "account_money"].includes(p.payment_type_id);
      if (isTransfer) {
        const diff = Math.abs(Number(p.transaction_amount) - orderTotal);
        if (diff <= orderTotal * 0.01) {
          const orderTime = new Date(fullOrder.created_at).getTime();
          const payTime = new Date(p.date_created).getTime();
          const diffMs = payTime - orderTime;
          return diffMs >= -60000 && diffMs <= 45 * 60 * 1000;
        }
      }
      return false;
    });

    if (match) {
      // Confirmar el pago
      await markOrderPayment({
        externalReference: orderCode,
        paymentReference: String(match.id),
        paymentStatus: "approved",
        status: "paid",
        rawPayload: JSON.stringify(match),
      });
      await syncOrderToVentas(fullOrder).catch(() => {});

      // Notificar al cliente (personalizado: nuevo vs recurrente)
      const phone = fullOrder.customer_phone;
      if (phone) {
        const prev = await countPreviousPaidOrders(phone, orderCode).catch(() => 0);
        sendPurchaseMessage(phone, fullOrder.customer_name || "", orderCode, Number(fullOrder.total || 0), prev);
      }

      return NextResponse.json({ isPaid: true, paymentId: match.id, justConfirmed: true });
    }

    return NextResponse.json({ isPaid: false });
  } catch {
    return NextResponse.json({ isPaid: false });
  }
}
