/**
 * Notificaciones push de la propia web al celular de quien atiende los
 * pedidos. Se activan una vez desde /admin en ese celular.
 *
 * Por qué esto y no otra cosa:
 *   - WhatsApp necesita Meta: portfolio comercial, número verificado,
 *     plantilla aprobada y token. Se trabó en la verificación del celular.
 *   - Los servicios gratis de avisos (ntfy.sh) limitan por IP, y la web corre
 *     en Vercel, que comparte IPs con miles de sitios: los avisos podían dejar
 *     de llegar sin razón aparente.
 *   - Push es un estándar del navegador: no tiene costo ni cuentas, y el
 *     contenido viaja cifrado de punta a punta (el servicio de push de Google o
 *     Apple no puede leer el pedido).
 *
 * Las claves VAPID se generan la primera vez y se guardan en la base, así no
 * hace falta cargar nada en Vercel. Si algún día se quieren fijar por entorno,
 * VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY tienen prioridad.
 */

import crypto from "crypto";
import webpush from "web-push";
import { query } from "@/lib/db";
import { storeSettings } from "@/lib/store-config";
import { parametrosAvisoPedido } from "@/lib/whatsapp-sender";

const g = globalThis;

async function asegurarTablas() {
  if (g._manareyPushTablas) return;
  await query(`
    create table if not exists public.web_push_config (
      clave text primary key,
      valor text not null,
      creado_at timestamp without time zone default now()
    )
  `);
  await query(`
    create table if not exists public.web_push_suscripciones (
      endpoint text primary key,
      p256dh text not null,
      auth text not null,
      etiqueta text,
      user_agent text,
      creado_at timestamp without time zone default now(),
      ultimo_envio_at timestamp without time zone
    )
  `);
  g._manareyPushTablas = true;
}

/**
 * Claves VAPID: identifican a la web ante el servicio de push. Las
 * suscripciones quedan atadas a la clave pública, así que tiene que ser
 * siempre la misma: se crean una sola vez y, si dos servidores las generan a
 * la vez, gana la primera que se guardó.
 */
export async function clavesVapid() {
  if (g._manareyVapid) return g._manareyVapid;

  const publicaEnv = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const privadaEnv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (publicaEnv && privadaEnv) {
    g._manareyVapid = { publicKey: publicaEnv, privateKey: privadaEnv };
    return g._manareyVapid;
  }

  await asegurarTablas();
  const leer = async () => {
    const r = await query(
      `select clave, valor from public.web_push_config where clave in ('vapid_public', 'vapid_private')`,
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.clave, x.valor]));
    return m.vapid_public && m.vapid_private ? { publicKey: m.vapid_public, privateKey: m.vapid_private } : null;
  };

  let claves = await leer();
  if (!claves) {
    const nuevas = webpush.generateVAPIDKeys();
    await query(
      `insert into public.web_push_config (clave, valor)
       values ('vapid_public', $1), ('vapid_private', $2)
       on conflict (clave) do nothing`,
      [nuevas.publicKey, nuevas.privateKey],
    );
    claves = await leer();
  }
  g._manareyVapid = claves;
  return claves;
}

export async function guardarSuscripcion(suscripcion, { etiqueta = "", userAgent = "" } = {}) {
  const endpoint = String(suscripcion?.endpoint || "");
  const p256dh = String(suscripcion?.keys?.p256dh || "");
  const auth = String(suscripcion?.keys?.auth || "");
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) {
    throw new Error("La suscripción del navegador vino incompleta.");
  }
  await asegurarTablas();
  await query(
    `insert into public.web_push_suscripciones (endpoint, p256dh, auth, etiqueta, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
       set p256dh = excluded.p256dh, auth = excluded.auth,
           etiqueta = excluded.etiqueta, user_agent = excluded.user_agent`,
    [endpoint, p256dh, auth, etiqueta.slice(0, 80), userAgent.slice(0, 300)],
  );
}

export async function borrarSuscripcion(endpoint) {
  await asegurarTablas();
  await query(`delete from public.web_push_suscripciones where endpoint = $1`, [String(endpoint || "")]);
}

export async function listarSuscripciones() {
  await asegurarTablas();
  const r = await query(
    `select endpoint, p256dh, auth, etiqueta from public.web_push_suscripciones order by creado_at`,
  );
  return r.rows;
}

/** Identificador corto y estable de un celular, para el control de "una vez". */
export function idDeSuscripcion(endpoint) {
  return crypto.createHash("sha1").update(String(endpoint)).digest("hex").slice(0, 16);
}

/**
 * Manda un push a un celular. Si el servicio dice que la suscripción ya no
 * existe (se desinstaló, se borraron los datos, se revocó el permiso), se
 * borra y no se considera un error: reintentar no la va a revivir.
 * Cualquier otro rechazo tira, para que el reintento lo pueda volver a mandar.
 */
export async function enviarPush(suscripcion, contenido) {
  const { publicKey, privateKey } = await clavesVapid();
  try {
    await webpush.sendNotification(
      { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
      JSON.stringify(contenido),
      {
        vapidDetails: { subject: storeSettings.siteUrl, publicKey, privateKey },
        TTL: 60 * 60 * 24, // si el celular está apagado, el aviso espera hasta un día
        urgency: "high",
      },
    );
    await query(
      `update public.web_push_suscripciones set ultimo_envio_at = now() where endpoint = $1`,
      [suscripcion.endpoint],
    ).catch(() => {});
    return { ok: true };
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await borrarSuscripcion(suscripcion.endpoint).catch(() => {});
      return { ok: false, vencida: true };
    }
    throw new Error(`El servicio de push rechazó el aviso (${err?.statusCode || "sin respuesta"}): ${err?.body || err?.message || err}`);
  }
}

/**
 * Título y texto del aviso. Reusa el mismo armado que el mensaje de WhatsApp
 * para que los dos digan exactamente lo mismo.
 */
export function contenidoPushDelPedido(order, { metodo, etapa, origen }) {
  const [codigo, estado, cliente, telefono, entrega, productos, total, notas] =
    parametrosAvisoPedido(order, { metodo, etapa, origen });

  const titulo =
    etapa === "pagado"
      ? origen === "deteccion"
        ? `💸 Posible pago · ${total.split(" (")[0]}`
        : `💰 Venta pagada · ${total.split(" (")[0]}`
      : `🔔 Pedido nuevo · ${total.split(" (")[0]}`;

  const lineas = [
    estado,
    `👤 ${cliente}`,
    `📞 ${telefono}`,
    entrega,
    `🛋️ ${productos}`,
    `💵 ${total}`,
    notas && notas !== "sin notas" ? `📝 ${notas}` : "",
    `Pedido ${codigo}`,
  ].filter(Boolean);

  let texto = lineas.join("\n");
  // Un push admite ~4 KB cifrados; los emojis pesan 4 bytes cada uno.
  if (texto.length > 1500) texto = `${texto.slice(0, 1499)}…`;

  const chat = telefono.match(/wa\.me\/(\d+)/)?.[1];
  return {
    title: titulo,
    body: texto,
    tag: `pedido-${codigo}-${etapa}`,
    url: `/admin?pedido=${encodeURIComponent(codigo)}`,
    whatsapp: chat ? `https://wa.me/${chat}` : null,
  };
}
