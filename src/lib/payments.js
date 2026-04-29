import { attachPaymentReference } from "@/lib/orders";
import { storeSettings } from "@/lib/store-config";

function getMercadoPagoToken() {
  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim().replace(/\\n$/, "").trim();

  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN no esta configurado.");
  }

  return token;
}

function canUseRedirectUrls() {
  try {
    const url = new URL(storeSettings.siteUrl);
    return !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function createMercadoPagoPreference({ order, customer }) {
  const externalReference = order.orderCode;
  const withRedirectUrls = canUseRedirectUrls();
  const payload = {
    items: [
      ...order.summary.items.map((item) => ({
        id: item.productKey || item.lineKey,
        title: item.accessoryLabel ? `${item.nombre} + ${item.accessoryLabel}` : item.nombre,
        quantity: item.quantity,
        currency_id: storeSettings.currency,
        unit_price: Number((item.precioVenta + item.accessoryPrice).toFixed(2)),
      })),
      ...(order.summary.shipping.cost > 0
        ? [
            {
              id: `shipping-${order.summary.shipping.id}`,
              title: `Envio ${order.summary.shipping.label}`,
              quantity: 1,
              currency_id: storeSettings.currency,
              unit_price: Number(order.summary.shipping.cost.toFixed(2)),
            },
          ]
        : []),
    ],
    // No incluimos el email del comprador para evitar el error CPT01
    // (MercadoPago rechaza cuando el email del comprador = email del vendedor)
    payer: {
      name: customer.fullName || "Cliente",
    },
    external_reference: externalReference,
    statement_descriptor: storeSettings.brandName.slice(0, 16),
    metadata: {
      order_code: order.orderCode,
      customer_phone: customer.phone,
      shipping_zone: order.summary.shipping.label,
    },
  };

  if (withRedirectUrls) {
    // Siempre usar el dominio de producción limpio para back_urls —
    // MercadoPago requiere URLs HTTPS válidas sin trailing slash ni espacios.
    const baseUrl = storeSettings.siteUrl.trim().replace(/\/+$/, "");
    payload.back_urls = {
      success: `${baseUrl}/checkout/success`,
      failure: `${baseUrl}/checkout/failure`,
      pending: `${baseUrl}/checkout/pending`,
    };
    payload.auto_return = "approved";
    payload.notification_url = `${baseUrl}/api/payments/webhook`;
  }

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getMercadoPagoToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago rechazo la preferencia: ${errorText}`);
  }

  const preference = await response.json();

  await attachPaymentReference({
    orderCode: order.orderCode,
    externalReference,
    preferenceId: preference.id,
  });

  return preference;
}

export async function fetchMercadoPagoPayment(paymentId) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${getMercadoPagoToken()}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchMercadoPagoPayment] HTTP ${response.status} para pago ${paymentId}:`, errorText);
    throw new Error(`No se pudo consultar el pago (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log(`[fetchMercadoPagoPayment] pago ${paymentId} status=${data.status} detail=${data.status_detail}`);
  return data;
}
