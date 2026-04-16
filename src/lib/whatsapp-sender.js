/**
 * Envío automático de mensajes de WhatsApp via Meta Cloud API
 * Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 *
 * Variables requeridas en .env.local:
 *   WHATSAPP_API_TOKEN       → token permanente de Meta Business
 *   WHATSAPP_PHONE_NUMBER_ID → ID del número en Meta Business
 *
 * Si no están configuradas, las funciones simplemente no hacen nada (sin error).
 */

const currencyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/**
 * Normaliza un número argentino al formato E.164 para Meta API.
 * Ejemplos:
 *   "11 3250-7516"       → "5491132507516"
 *   "011 4555-1234"      → "5491145551234"
 *   "+54 9 11 3250-7516" → "5491132507516"
 */
function normalizeArgPhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("54")) {
    if (!digits.startsWith("549")) digits = "549" + digits.slice(2);
    return digits;
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("15")) digits = digits.slice(2);
  return "549" + digits;
}

/**
 * Envía un mensaje de texto simple por WhatsApp.
 */
export async function sendWhatsAppMessage(toPhone, message) {
  const token = (process.env.WHATSAPP_API_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneNumberId) return false;

  const to = normalizeArgPhone(toPhone);
  if (!to || to.length < 10) return false;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
        cache: "no-store",
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Mensaje de bienvenida al registrarse por primera vez.
 * Siempre incluye el texto de "te agendamos" porque aún no compraron.
 */
export function sendWelcomeMessage(phone, nombre) {
  if (!phone) return Promise.resolve(false);
  const msg =
    `¡Hola ${nombre}! 👋 Gracias por registrarte en *Manarey*.\n\n` +
    `En breve te agregaremos a nuestros contactos para que puedas ver nuestros estados ` +
    `y hacernos consultas o pedidos directamente desde acá.\n\n` +
    `🛋️ ¡Bienvenido/a a la familia Manarey!`;
  return sendWhatsAppMessage(phone, msg).catch(() => false);
}

/**
 * Mensaje cuando el cliente hace una compra.
 * - previousPaidOrders === 0 → primera compra: incluye "te agendamos"
 * - previousPaidOrders > 0  → ya es cliente agendado: solo gracias corto
 *
 * @param {string}  phone
 * @param {string}  nombre
 * @param {string}  orderCode
 * @param {number}  total
 * @param {number}  previousPaidOrders - cuántas compras pagas tenía ANTES de ésta
 */
export function sendPurchaseMessage(phone, nombre, orderCode, total, previousPaidOrders = 0) {
  if (!phone) return Promise.resolve(false);

  const primerNombre = (nombre || "").split(" ")[0] || "cliente";
  const totalFmt = currencyFmt.format(total);

  let msg;
  if (previousPaidOrders === 0) {
    // Primera compra: todavía no lo tenemos agendado
    msg =
      `¡Hola ${primerNombre}! 🎉 Recibimos tu pedido *${orderCode}* por *${totalFmt}*.\n\n` +
      `Como es tu primera compra, en breve te vamos a agendar para que puedas ver ` +
      `nuestros estados y consultarnos directamente desde WhatsApp.\n\n` +
      `¡Gracias por elegir *Manarey*! 🛋️`;
  } else {
    // Cliente recurrente: ya está agendado, solo gracias
    msg =
      `¡Hola ${primerNombre}! Gracias por volver a elegirnos 🛋️\n\n` +
      `Recibimos tu pedido *${orderCode}* por *${totalFmt}*. ` +
      `En breve nos comunicamos para coordinar la entrega. ¡Hasta pronto!`;
  }

  return sendWhatsAppMessage(phone, msg).catch(() => false);
}

/**
 * Mensaje cuando se crea un pedido por transferencia (aún no pagado).
 * Mismo criterio: si ya compró antes → corto, si es nuevo → con agendamiento.
 */
export function sendTransferPendingMessage(phone, nombre, orderCode, total, previousPaidOrders = 0) {
  if (!phone) return Promise.resolve(false);

  const primerNombre = (nombre || "").split(" ")[0] || "cliente";
  const totalFmt = currencyFmt.format(total);

  let msg;
  if (previousPaidOrders === 0) {
    msg =
      `¡Hola ${primerNombre}! 🛋️ Registramos tu pedido *${orderCode}* por *${totalFmt}*.\n\n` +
      `Una vez que realices la transferencia lo detectaremos automáticamente. ` +
      `Además, en breve te vamos a agendar para que puedas consultarnos directamente desde WhatsApp.\n\n` +
      `¡Gracias por elegir *Manarey*!`;
  } else {
    msg =
      `¡Hola ${primerNombre}! Registramos tu pedido *${orderCode}* por *${totalFmt}* 🛋️\n\n` +
      `Una vez que realices la transferencia lo detectaremos automáticamente y coordinaremos la entrega.`;
  }

  return sendWhatsAppMessage(phone, msg).catch(() => false);
}
