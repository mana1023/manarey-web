/**
 * Email sender usando la API REST de Resend.
 * No requiere ningún paquete npm extra.
 *
 * Para activar: creá cuenta gratuita en https://resend.com
 * y agregá RESEND_API_KEY en las variables de entorno de Vercel.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Manarey <noreply@manarey.com.ar>";

/**
 * Envía un email con Resend.
 * Si no hay API key configurada, loguea en consola y no falla.
 */
export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[email-sender] RESEND_API_KEY no configurada. Email no enviado a ${to}: ${subject}`);
    return { ok: false, reason: "no-api-key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[email-sender] Error enviando email: ${res.status} ${err}`);
      return { ok: false, reason: err };
    }

    return { ok: true };
  } catch (err) {
    console.error("[email-sender] Error de red:", err);
    return { ok: false, reason: String(err) };
  }
}

/* ── Templates ───────────────────────────────────────────── */

/**
 * Email de confirmación de pedido (pendiente de pago / recibido).
 */
export function buildOrderConfirmationEmail({ order, paymentMethod }) {
  const methodLabel =
    paymentMethod === "card" ? "Tarjeta de crédito/débito" :
    paymentMethod === "transfer" ? "Transferencia bancaria" :
    "WhatsApp";

  const itemsRows = order.summary.items.map((item) => {
    const subtotal = item.quantity * (item.precioVenta + (item.accessoryPrice || 0));
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6d0;">
          ${item.nombre}${item.accessoryLabel ? ` <span style="color:#8b6914;font-size:0.85em">(${item.accessoryLabel})</span>` : ""}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6d0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e6d0;text-align:right;">
          $${subtotal.toLocaleString("es-AR")}
        </td>
      </tr>`;
  }).join("");

  const transferInfo = paymentMethod === "transfer"
    ? `<div style="margin:20px 0;padding:16px;background:#fffbf0;border:1px solid #e8c547;border-radius:8px;">
        <p style="margin:0 0 8px;font-weight:700;color:#4a2e00;">Datos para la transferencia</p>
        <p style="margin:0;font-size:0.9rem;color:#5a3e1b;">
          CBU: <strong>${process.env.NEXT_PUBLIC_TRANSFER_CBU || "—"}</strong><br>
          Alias: <strong>${process.env.NEXT_PUBLIC_TRANSFER_ALIAS || "—"}</strong>
        </p>
        <p style="margin:8px 0 0;font-size:0.82rem;color:#8a6030;">
          Una vez realizada la transferencia, envianos el comprobante por WhatsApp al +54 9 11 6428-2270.
        </p>
      </div>`
    : "";

  return {
    subject: `Pedido ${order.orderCode} recibido — Manarey`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3e7cf;font-family:'Georgia',serif;color:#2b1d13;">
  <div style="max-width:600px;margin:32px auto;background:#fff9ef;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(89,58,24,0.10);">

    <!-- Header -->
    <div style="background:#1f150e;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:1.8rem;font-weight:800;color:#e8c547;letter-spacing:0.08em;">MANAREY</p>
      <p style="margin:6px 0 0;font-size:0.85rem;color:rgba(255,255,255,0.5);">Muebles y artículos del hogar</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h1 style="margin:0 0 6px;font-size:1.25rem;font-weight:700;color:#2b1d13;">
        ¡Gracias por tu pedido, ${order.customer.firstName || order.customer.fullName}!
      </h1>
      <p style="margin:0 0 24px;font-size:0.93rem;color:#6f5a46;">
        Recibimos tu pedido correctamente. A continuación encontrás el resumen.
      </p>

      <!-- Código de pedido -->
      <div style="background:#ede0c4;border-radius:10px;padding:14px 18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.85rem;color:#6f5a46;">N° de pedido</span>
        <strong style="font-size:1.05rem;color:#4a2e00;letter-spacing:0.05em;">${order.orderCode}</strong>
      </div>

      <!-- Productos -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#ede0c4;">
            <th style="padding:8px 12px;text-align:left;font-size:0.82rem;color:#6f5a46;font-weight:600;">Producto</th>
            <th style="padding:8px 12px;text-align:center;font-size:0.82rem;color:#6f5a46;font-weight:600;">Cant.</th>
            <th style="padding:8px 12px;text-align:right;font-size:0.82rem;color:#6f5a46;font-weight:600;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <!-- Totales -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:6px 12px;font-size:0.9rem;color:#6f5a46;">Subtotal</td>
          <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">$${order.summary.subtotal.toLocaleString("es-AR")}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;font-size:0.9rem;color:#6f5a46;">${order.summary.shipping.label}</td>
          <td style="padding:6px 12px;text-align:right;font-size:0.9rem;">$${order.summary.shipping.cost.toLocaleString("es-AR")}</td>
        </tr>
        <tr style="border-top:2px solid #e8c547;">
          <td style="padding:10px 12px;font-weight:700;font-size:1rem;">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:1rem;color:#4a2e00;">
            $${order.summary.total.toLocaleString("es-AR")}
          </td>
        </tr>
      </table>

      <!-- Método de pago -->
      <p style="margin:0 0 4px;font-size:0.82rem;color:#6f5a46;">Método de pago</p>
      <p style="margin:0 0 20px;font-weight:600;">${methodLabel}</p>

      ${transferInfo}

      <!-- Datos de envío -->
      <div style="background:#f5efe3;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-weight:700;font-size:0.9rem;color:#4a2e00;">Datos de entrega</p>
        <p style="margin:0;font-size:0.88rem;color:#5a3e1b;line-height:1.6;">
          ${order.customer.fullName}<br>
          ${order.summary.shipping.id === "pickup"
            ? "Retiro en sucursal"
            : `${order.customer.address}, ${order.customer.city}`}
        </p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:8px;">
        <a href="https://wa.me/5491164282270?text=Hola%2C%20quiero%20consultar%20el%20pedido%20${order.orderCode}"
           style="display:inline-block;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:0.95rem;padding:13px 30px;border-radius:10px;text-decoration:none;">
          💬 Consultar por WhatsApp
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#ede0c4;padding:20px 32px;text-align:center;font-size:0.8rem;color:#8a6a40;">
      <p style="margin:0 0 4px;">
        <strong>Manarey Mueblería</strong> · Av. Hipólito Yrigoyen 19.051, Longchamps
      </p>
      <p style="margin:0;opacity:0.7;">
        Este email fue generado automáticamente. Por consultas, contactanos por WhatsApp.
      </p>
    </div>

  </div>
</body>
</html>`,
  };
}

/**
 * Email de confirmación de pago aprobado (MercadoPago webhook).
 */
export function buildPaymentApprovedEmail({ order }) {
  return {
    subject: `✅ Pago confirmado — Pedido ${order.orderCode} | Manarey`,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3e7cf;font-family:'Georgia',serif;color:#2b1d13;">
  <div style="max-width:600px;margin:32px auto;background:#fff9ef;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(89,58,24,0.10);">

    <div style="background:#1f150e;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:1.8rem;font-weight:800;color:#e8c547;letter-spacing:0.08em;">MANAREY</p>
    </div>

    <div style="padding:32px;text-align:center;">
      <div style="font-size:3rem;margin-bottom:12px;">✅</div>
      <h1 style="margin:0 0 8px;font-size:1.3rem;font-weight:700;">¡Pago confirmado!</h1>
      <p style="margin:0 0 24px;font-size:0.93rem;color:#6f5a46;">
        Recibimos el pago del pedido <strong>${order.orderCode}</strong> correctamente.<br>
        Nos pondremos en contacto para coordinar la entrega.
      </p>
      <a href="https://wa.me/5491164282270?text=Hola%2C%20pago%20confirmado%20pedido%20${order.orderCode}"
         style="display:inline-block;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:0.95rem;padding:13px 30px;border-radius:10px;text-decoration:none;">
        💬 Consultar entrega por WhatsApp
      </a>
    </div>

    <div style="background:#ede0c4;padding:20px 32px;text-align:center;font-size:0.8rem;color:#8a6a40;">
      <p style="margin:0;">Manarey Mueblería · Av. Hipólito Yrigoyen 19.051, Longchamps</p>
    </div>
  </div>
</body>
</html>`,
  };
}
