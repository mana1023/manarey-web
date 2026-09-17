/**
 * WhatsApp via Meta Cloud API.
 * Doc: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
 *
 * Variables de entorno:
 *   WHATSAPP_API_TOKEN          token permanente (usuario del sistema de Meta Business)
 *   WHATSAPP_PHONE_NUMBER_ID    ID del número que MANDA los mensajes
 *   WHATSAPP_AVISOS_A           a quién le llegan los avisos de pedidos. Uno o
 *                               varios separados por coma. Si falta, se usa
 *                               NEXT_PUBLIC_WHATSAPP_NUMBER (el de la web).
 *   WHATSAPP_PLANTILLA_PEDIDO   nombre de la plantilla (default: aviso_pedido_web)
 *   WHATSAPP_PLANTILLA_IDIOMA   idioma de la plantilla (default: es_AR)
 *
 * Sin token o sin ID, nada se manda y nada falla: el checkout sigue igual.
 *
 * ── Por qué plantilla y no texto libre ─────────────────────────────────────
 * WhatsApp no deja que una empresa le escriba primero a nadie con texto libre:
 * sólo se puede dentro de las 24 h después de que esa persona le escribió.
 * Fuera de esa ventana Meta rechaza el mensaje (error 131047). Un aviso de
 * pedido siempre cae fuera, así que va con una plantilla aprobada. La versión
 * anterior de este archivo mandaba texto libre y tragaba el error: aunque se
 * hubieran cargado las credenciales, no le iba a llegar nada a nadie.
 *
 * ── La plantilla, tal cual hay que cargarla en Meta ────────────────────────
 * Nombre: aviso_pedido_web · Categoría: Utilidad · Idioma: Spanish (ARG)
 * Cuerpo:
 *
 *   Hola! Entró un pedido nuevo en la web de Manarey. Código: {{1}}
 *
 *   Estado del pago: {{2}}
 *
 *   Nombre del cliente: {{3}}
 *   Teléfono del cliente: {{4}}
 *   Forma de entrega: {{5}}
 *
 *   Productos pedidos: {{6}}
 *
 *   Total del pedido: {{7}}
 *   Notas del cliente: {{8}}
 *
 *   Este es un aviso automático de la tienda online. Revisá el pedido y
 *   comunicate con el cliente para coordinar.
 *
 * Si se cambia el texto en Meta, el orden de los {{n}} tiene que seguir
 * siendo el de parametrosAvisoPedido().
 */

import { DIA_DE_ENTREGA } from "@/lib/store-config";

const GRAPH_API = "https://graph.facebook.com/v23.0";

const currencyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function credenciales() {
  const token = (process.env.WHATSAPP_API_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

/**
 * Número argentino de 10 dígitos (área + abonado): sin +54, sin 9, sin 0 y
 * sin 15. Devuelve null si no se puede interpretar.
 *   "+54 9 11 3250-7516" → "1132507516"
 *   "011 15 3250-7516"   → "1132507516"
 */
function numeroNacionalArgentino(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // El 15 del celular va después del código de área, que tiene 2 a 4 dígitos.
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === "15") {
        d = d.slice(0, largoArea) + d.slice(largoArea + 2);
        break;
      }
    }
  }
  return d.length === 10 ? d : null;
}

/**
 * Formato para la API de Meta: 54 + número, SIN el 9.
 * Con el número de prueba de Meta, un celular argentino con el 9 falla con
 * "Recipient phone number not in allowed list" (131030): la lista de
 * destinatarios lo guarda sin el 9. En producción Meta acepta los dos
 * formatos, así que sin el 9 sirve siempre.
 */
function numeroParaMeta(phone) {
  const nacional = numeroNacionalArgentino(phone);
  return nacional ? `54${nacional}` : null;
}

/** Link para abrir el chat: wa.me sí lleva el 9. */
function linkDeChat(phone) {
  const nacional = numeroNacionalArgentino(phone);
  return nacional ? `wa.me/549${nacional}` : "";
}

/** Manda cualquier mensaje a Meta. Nunca tira: devuelve { ok, error }. */
async function enviarAMeta(mensaje) {
  const cred = credenciales();
  if (!cred) return { ok: false, error: "WhatsApp no configurado" };
  try {
    const res = await fetch(`${GRAPH_API}/${cred.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...mensaje }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: data?.messages?.[0]?.id || null };
    const e = data?.error || {};
    return {
      ok: false,
      code: e.code,
      error: [e.code || res.status, e.message, e.error_data?.details].filter(Boolean).join(" · "),
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Los valores de una plantilla no pueden tener saltos de línea, tabs ni más
 * de 4 espacios seguidos: Meta rechaza el mensaje entero. Tampoco pueden ir
 * vacíos.
 */
function valorDePlantilla(texto, max = 600) {
  let t = String(texto ?? "")
    .replace(/\t+/g, " ")
    .replace(/\s*[\r\n]+\s*/g, " · ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!t) return "—";
  if (t.length > max) t = `${t.slice(0, max - 1).trimEnd()}…`;
  return t;
}

async function enviarPlantilla({ to, plantilla, idioma, parametros }) {
  const mensaje = (codigoIdioma) => ({
    to,
    type: "template",
    template: {
      name: plantilla,
      language: { code: codigoIdioma },
      components: [
        { type: "body", parameters: parametros.map((text) => ({ type: "text", text })) },
      ],
    },
  });

  let resultado = await enviarAMeta(mensaje(idioma));
  // 132001: la plantilla no existe en ese idioma. Es el error más fácil de
  // cometer al crearla ("Spanish" en vez de "Spanish (ARG)"), así que se
  // prueba con el otro antes de darlo por perdido.
  if (!resultado.ok && resultado.code === 132001) {
    const otro = idioma === "es_AR" ? "es" : "es_AR";
    resultado = await enviarAMeta(mensaje(otro));
  }
  return resultado;
}

/* ── Aviso de pedido al local ─────────────────────────────────────────── */

const METODOS = {
  card: "tarjeta",
  transfer: "transferencia",
  whatsapp: "efectivo / WhatsApp",
};

function estadoDelPedido(metodo, etapa, origen) {
  if (etapa === "pagado") {
    // La detección de pagos busca en Mercado Pago un pago por el mismo monto
    // (con 1% de tolerancia), no por una referencia: dos clientes que pagan
    // parecido en la misma hora se pueden cruzar. Por eso se pide confirmarlo.
    // Cuando el pago lo confirma Mercado Pago con el código del pedido
    // (tarjeta, webhook), sí es seguro.
    if (origen === "deteccion") {
      return "✅ Se detectó un pago en Mercado Pago por este monto. Confirmalo antes de despachar.";
    }
    return `✅ PAGADO con ${METODOS[metodo] || "tarjeta"}. Ya se puede preparar.`;
  }
  if (metodo === "transfer") {
    return "⏳ Eligió TRANSFERENCIA y todavía NO pagó. No prepararlo hasta que entre la plata.";
  }
  if (metodo === "whatsapp") {
    return "💬 Eligió pagar en EFECTIVO / por WhatsApp. Todavía NO pagó: escribile para cerrar la venta.";
  }
  return "⏳ Pedido nuevo, todavía sin pagar.";
}

function entregaDelPedido(order) {
  const c = order.customer || {};
  const envio = order.summary?.shipping || {};
  if (envio.id === "pickup") return `🏬 Retira en ${c.address || "la sucursal"}`;

  const direccion = [c.address, c.city].filter(Boolean).join(", ") || "sin dirección";
  const entreCalles = c.betweenStreets ? ` (entre ${c.betweenStreets})` : "";
  const dia = envio.otroDia
    ? `pidió OTRO DÍA, no el ${DIA_DE_ENTREGA}: hay que coordinarlo`
    : `el ${DIA_DE_ENTREGA}, día de reparto`;
  const zona = envio.zoneLabel ? ` · ${envio.zoneLabel}` : "";
  return `🚚 Envío a ${direccion}${entreCalles} · ${dia}${zona}`;
}

function productosDelPedido(order) {
  const items = order.summary?.items || [];
  if (!items.length) return "sin detalle, ver el mail del pedido";

  return items
    .map((i) => {
      const partes = [i.medida, i.color].filter(Boolean);
      // El material sólo si no está ya en el nombre o el color: en las
      // cocinas el tipo de gas viaja en el color ("negro gas natural").
      const material = String(i.materialSistema || "").trim();
      const yaDicho = [i.nombre, ...partes].join(" ").toLowerCase();
      if (material && !yaDicho.includes(material.toLowerCase())) partes.push(material);

      const variante = partes.length ? ` (${partes.join(", ")})` : "";
      const accesorio = i.accessoryLabel ? ` + ${i.accessoryLabel}` : "";
      const cantidad = Number(i.quantity || 1);
      const linea = (Number(i.precioVenta || 0) + Number(i.accessoryPrice || 0)) * cantidad;
      return `${cantidad}× ${i.nombre}${variante}${accesorio} ${currencyFmt.format(linea)}`;
    })
    .join(" | ");
}

function totalDelPedido(order) {
  const s = order.summary || {};
  const envio = s.shipping || {};
  const costoEnvio = Number(envio.cost || 0);
  const subtotal = currencyFmt.format(Number(s.subtotal || 0));
  const detalle =
    envio.id === "pickup"
      ? "retira en el local"
      : costoEnvio > 0
        ? `productos ${subtotal} + envío ${currencyFmt.format(costoEnvio)}`
        : `productos ${subtotal}, envío sin cargo`;
  const cuotas = Number(order.installments || 1) > 1 ? ` · en ${order.installments} cuotas` : "";
  return `${currencyFmt.format(Number(s.total || 0))} (${detalle})${cuotas}`;
}

/**
 * Los 8 valores de la plantilla, en el orden de sus {{n}}. Exportado para
 * poder probar el armado sin mandar nada.
 */
export function parametrosAvisoPedido(order, { metodo, etapa, origen }) {
  const c = order.customer || {};
  const chat = linkDeChat(c.phone);
  return [
    valorDePlantilla(order.orderCode, 60),
    valorDePlantilla(estadoDelPedido(metodo, etapa, origen), 200),
    valorDePlantilla([c.fullName, c.email].filter(Boolean).join(" · "), 160),
    valorDePlantilla([c.phone, chat].filter(Boolean).join(" · "), 120),
    valorDePlantilla(entregaDelPedido(order), 300),
    valorDePlantilla(productosDelPedido(order), 700),
    valorDePlantilla(totalDelPedido(order), 200),
    valorDePlantilla(c.notes || "sin notas", 300),
  ];
}

/** A quién avisarle, ya en formato Meta. Vacío si WhatsApp no está configurado. */
export function destinatariosDeAvisos() {
  if (!credenciales()) return [];
  const lista = (process.env.WHATSAPP_AVISOS_A || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "")
    .split(/[,;]/)
    .map(numeroParaMeta)
    .filter(Boolean);
  return [...new Set(lista)];
}

/** Manda el aviso de un pedido a un número. Tira si Meta lo rechaza. */
export async function enviarAvisoPedidoWhatsApp(numero, order, { metodo, etapa, origen }) {
  const resultado = await enviarPlantilla({
    to: numero,
    plantilla: (process.env.WHATSAPP_PLANTILLA_PEDIDO || "aviso_pedido_web").trim(),
    idioma: (process.env.WHATSAPP_PLANTILLA_IDIOMA || "es_AR").trim(),
    parametros: parametrosAvisoPedido(order, { metodo, etapa, origen }),
  });
  if (!resultado.ok) throw new Error(`Meta rechazó el aviso a ${numero}: ${resultado.error}`);
  return resultado;
}

/* ── Mensajes a clientes ──────────────────────────────────────────────── */
// Estos mandan texto libre, y a un cliente que nunca le escribió al número
// de la tienda eso no le llega nunca (131047). Quedan apagados hasta que
// tengan sus propias plantillas aprobadas; prenderlos antes sólo generaría
// errores en cada compra. Se habilitan con WHATSAPP_MENSAJES_A_CLIENTES=1.

function mensajesAClientesHabilitados() {
  return process.env.WHATSAPP_MENSAJES_A_CLIENTES === "1";
}

/** Envía un mensaje de texto libre. Sólo sirve dentro de la ventana de 24 h. */
export async function sendWhatsAppMessage(toPhone, message) {
  if (!mensajesAClientesHabilitados()) return false;
  const to = numeroParaMeta(toPhone);
  if (!to) return false;
  const resultado = await enviarAMeta({ to, type: "text", text: { body: message } });
  if (!resultado.ok) console.error("[whatsapp] No se pudo mandar el mensaje:", resultado.error);
  return resultado.ok;
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
 */
export function sendPurchaseMessage(phone, nombre, orderCode, total, previousPaidOrders = 0) {
  if (!phone) return Promise.resolve(false);

  const primerNombre = (nombre || "").split(" ")[0] || "cliente";
  const totalFmt = currencyFmt.format(total);

  let msg;
  if (previousPaidOrders === 0) {
    msg =
      `¡Hola ${primerNombre}! 🎉 Recibimos tu pedido *${orderCode}* por *${totalFmt}*.\n\n` +
      `Como es tu primera compra, en breve te vamos a agendar para que puedas ver ` +
      `nuestros estados y consultarnos directamente desde WhatsApp.\n\n` +
      `¡Gracias por elegir *Manarey*! 🛋️`;
  } else {
    msg =
      `¡Hola ${primerNombre}! Gracias por volver a elegirnos 🛋️\n\n` +
      `Recibimos tu pedido *${orderCode}* por *${totalFmt}*. ` +
      `En breve nos comunicamos para coordinar la entrega. ¡Hasta pronto!`;
  }

  return sendWhatsAppMessage(phone, msg).catch(() => false);
}

/** Mensaje cuando se crea un pedido por transferencia (aún no pagado). */
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
