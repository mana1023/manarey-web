import crypto from "crypto";
import { query } from "@/lib/db";
import { buildCheckoutSummary, sanitizeCheckoutItems } from "@/lib/shipping";
import { getShippingSettings } from "@/lib/settings-db";
import { getBranchByDisplayName } from "@/lib/store-config";
import { getCatalogProducts } from "@/lib/products";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/**
 * Error del checkout pensado para mostrarle al cliente tal cual, con su
 * status HTTP y datos extra para que la pantalla pueda reaccionar.
 */
export class CheckoutError extends Error {
  constructor(message, { status = 400, extra = {} } = {}) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
    this.extra = extra;
  }
}

/** Convierte un error del checkout en { status, body } para responder. */
export function respuestaDeErrorDeCheckout(error, mensajePorDefecto, statusPorDefecto = 400) {
  if (error instanceof CheckoutError) {
    return { status: error.status, body: { error: error.message, ...error.extra } };
  }
  return {
    status: statusPorDefecto,
    body: { error: error instanceof Error && error.message ? error.message : mensajePorDefecto },
  };
}

const esManija = (p) =>
  String(p.categoria || "").toLowerCase() === "accesorios" &&
  String(p.nombre || "").toLowerCase().includes("manija");

/**
 * Precio, nombre y variante de cada producto, sacados del catálogo y no del
 * navegador.
 *
 * El carrito vive en el navegador del cliente (localStorage), y hasta acá el
 * servidor cobraba el precio que venía en él. Eso dejaba dos agujeros:
 *   - cualquiera podía editar el carrito desde la consola y pagar $1 con
 *     tarjeta por una cocina de $365.000, y el pedido quedaba PAGADO;
 *   - sin mala intención, alguien que armó el carrito antes de un aumento
 *     compraba al precio viejo.
 * Se usa getCatalogProducts, la misma función que arma la vitrina, así que el
 * precio que se cobra es por construcción el mismo que se muestra.
 *
 * Si un precio cambió no se cobra el nuevo en silencio: se corta con 409 y
 * los precios nuevos, para que la pantalla actualice el carrito y el cliente
 * confirme viendo el total real.
 */
async function resolverItemsConCatalogo(items) {
  const catalogo = await getCatalogProducts();
  const porClave = new Map(catalogo.map((p) => [p.productKey, p]));
  const manijas = catalogo.find(esManija) || null;

  const resueltos = [];
  const cambios = [];

  for (const item of items) {
    const producto = porClave.get(item.productKey);
    // Oculto cuenta como no disponible: el carrito puede venir de antes de que
    // se ocultara, o de alguien que armó el pedido a mano.
    if (!producto || producto.oculto) {
      throw new CheckoutError(
        `"${item.nombre}" ya no está disponible en la web. Sacalo del carrito para seguir con la compra.`,
        { status: 409, extra: { productoNoDisponible: item.lineKey } },
      );
    }

    const conManijas = Number(item.accessoryPrice) > 0 || Boolean(item.accessoryLabel);
    const precioVenta = Number(producto.precioVenta || 0);
    const accessoryPrice = conManijas ? Number(manijas?.precioVenta || 0) : 0;

    if (
      Math.round(precioVenta) !== Math.round(Number(item.precioVenta) || 0) ||
      Math.round(accessoryPrice) !== Math.round(Number(item.accessoryPrice) || 0)
    ) {
      cambios.push({ lineKey: item.lineKey, nombre: producto.nombre, precioVenta, accessoryPrice });
    }

    resueltos.push({
      ...item,
      nombre: producto.nombre,
      medida: producto.medida || "",
      color: producto.color || "",
      materialSistema: producto.materialSistema || "",
      precioVenta,
      accessoryPrice,
      accessoryLabel: conManijas ? manijas?.nombre || item.accessoryLabel || "Manijas" : "",
    });
  }

  if (cambios.length) {
    const detalle = cambios
      .map((c) => `${c.nombre}: ${pesos.format(c.precioVenta + c.accessoryPrice)}`)
      .join(", ");
    throw new CheckoutError(
      `Cambió el precio de ${cambios.length === 1 ? "un producto" : "algunos productos"} de tu carrito ` +
        `(${detalle}). Ya lo actualizamos: revisá el total y volvé a confirmar.`,
      { status: 409, extra: { preciosActualizados: cambios } },
    );
  }

  return resueltos;
}

let ordersReadyPromise;

function buildOrderCode() {
  return `MAN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function ensureOrdersTables() {
  if (!ordersReadyPromise) {
    ordersReadyPromise = (async () => {
      await query(`
        create table if not exists public.web_orders (
          id bigserial primary key,
          order_code text not null unique,
          status text not null default 'pending',
          payment_method text not null,
          payment_status text not null default 'pending',
          customer_name text not null,
          customer_email text not null,
          customer_phone text not null,
          customer_address text not null,
          customer_city text not null,
          customer_notes text,
          shipping_zone_id text not null,
          shipping_zone_label text not null,
          shipping_distance_km numeric not null default 0,
          shipping_cost numeric not null default 0,
          subtotal numeric not null default 0,
          total numeric not null default 0,
          external_reference text,
          payment_reference text,
          preference_id text,
          raw_payload jsonb,
          created_at timestamp without time zone default now(),
          updated_at timestamp without time zone default now()
        )
      `);

      await query(`
        alter table public.web_orders
        add column if not exists shipping_distance_km numeric not null default 0
      `);

      // Recargo por cuotas (card surcharge)
      await query(`
        alter table public.web_orders
        add column if not exists surcharge_amount numeric not null default 0
      `).catch(() => {});
      await query(`
        alter table public.web_orders
        add column if not exists installments integer not null default 1
      `).catch(() => {});
      // La respuesta de Mercado Pago va acá y no en raw_payload (ver markOrderPayment).
      await query(`
        alter table public.web_orders
        add column if not exists payment_payload jsonb
      `).catch(() => {});

      await query(`
        create table if not exists public.web_order_items (
          id bigserial primary key,
          order_id bigint not null references public.web_orders(id) on delete cascade,
          line_key text not null,
          product_key text,
          name text not null,
          quantity integer not null,
          unit_price numeric not null,
          accessory_price numeric not null default 0,
          accessory_label text,
          line_total numeric not null
        )
      `);
    })().catch((error) => {
      ordersReadyPromise = undefined;
      throw error;
    });
  }

  await ordersReadyPromise;
}

function normalizeCustomer(payload = {}) {
  return {
    fullName: String(payload.fullName || "").trim(),
    email: String(payload.email || "").trim(),
    phone: String(payload.phone || "").trim(),
    address: String(payload.address || "").trim(),
    city: String(payload.city || "").trim(),
    distanceKm: String(payload.distanceKm || "").trim(),
    notes: String(payload.notes || "").trim(),
    betweenStreets: String(payload.betweenStreets || "").trim(),
  };
}

export async function validateCheckoutPayload(payload = {}) {
  const customer = normalizeCustomer(payload.customer);
  let settings = null;
  try { settings = await getShippingSettings(); } catch { /* usar defaults */ }
  const items = await resolverItemsConCatalogo(sanitizeCheckoutItems(payload.items));
  const summary = buildCheckoutSummary({
    items,
    shippingModeId: payload.shippingModeId,
    distanceKm: customer.distanceKm,
    settings,
    otroDia: payload.shippingModeId === "delivery" && Boolean(payload.entregaOtroDia),
  });

  if (!summary.items.length) {
    throw new Error("El carrito esta vacio.");
  }

  if (!customer.fullName || !customer.email || !customer.phone || !customer.address || !customer.city) {
    throw new Error("Faltan datos del comprador.");
  }

  if (!customer.email.includes("@")) {
    throw new Error("El correo no es valido.");
  }

  if (summary.shipping.id === "delivery" && summary.shipping.distanceKm <= 0) {
    throw new Error("Ingresa los kilometros estimados para calcular el envio.");
  }

  return { customer, summary };
}

export async function createOrder({ paymentMethod, payload, surchargeAmount = 0, installments = 1 }) {
  await ensureOrdersTables();

  const { customer, summary } = await validateCheckoutPayload(payload);
  const orderCode = buildOrderCode();
  const surcharge = Math.max(0, Math.round(Number(surchargeAmount) || 0));
  const totalCharged = summary.total + surcharge;

  const result = await query(
    `
      insert into public.web_orders (
        order_code,
        payment_method,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        customer_city,
        customer_notes,
        shipping_zone_id,
        shipping_zone_label,
        shipping_distance_km,
        shipping_cost,
        subtotal,
        total,
        surcharge_amount,
        installments,
        raw_payload
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      returning id, order_code
    `,
    [
      orderCode,
      paymentMethod,
      customer.fullName,
      customer.email,
      customer.phone,
      customer.address,
      customer.city,
      customer.notes || null,
      summary.shipping.id,
      summary.shipping.label,
      summary.shipping.distanceKm || 0,
      summary.shipping.cost,
      summary.subtotal,
      summary.total,       // precio base sin recargo
      surcharge,           // recargo por cuotas
      installments,
      JSON.stringify({ customer, summary, surchargeAmount: surcharge, installments }),
    ],
  );

  const order = result.rows[0];

  for (const item of summary.items) {
    await query(
      `
        insert into public.web_order_items (
          order_id,
          line_key,
          product_key,
          name,
          quantity,
          unit_price,
          accessory_price,
          accessory_label,
          line_total
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        order.id,
        item.lineKey,
        item.productKey || null,
        item.nombre,
        item.quantity,
        item.precioVenta,
        item.accessoryPrice,
        item.accessoryLabel || null,
        item.quantity * (item.precioVenta + item.accessoryPrice),
      ],
    );
  }

  return {
    id: order.id,
    orderCode: order.order_code,
    customer,
    summary,
    surchargeAmount: surcharge,
    installments,
    totalCharged,  // total + recargo = lo que se cobra realmente
  };
}

export async function attachPaymentReference({
  orderCode,
  externalReference,
  preferenceId,
  paymentReference,
}) {
  await ensureOrdersTables();

  await query(
    `
      update public.web_orders
      set
        external_reference = coalesce($2, external_reference),
        preference_id = coalesce($3, preference_id),
        payment_reference = coalesce($4, payment_reference),
        updated_at = now()
      where order_code = $1
    `,
    [orderCode, externalReference || null, preferenceId || null, paymentReference || null],
  );
}

export async function markOrderPayment({
  externalReference,
  paymentReference,
  paymentStatus,
  status,
  rawPayload,
}) {
  await ensureOrdersTables();

  // La respuesta de Mercado Pago se guarda en payment_payload. Antes pisaba
  // raw_payload, que es donde está el pedido (cliente, productos, entre
  // calles, notas, día de entrega). Cada pedido pagado perdía esos datos, y
  // como la sincronización de abajo corre después y no repite ventas, las
  // ventas con tarjeta llegaban al sistema de escritorio con 0 productos.
  await query(
    `
      update public.web_orders
      set
        payment_reference = coalesce($2, payment_reference),
        payment_status = coalesce($3, payment_status),
        status = coalesce($4, status),
        payment_payload = coalesce($5::jsonb, payment_payload),
        updated_at = now()
      where external_reference = $1 or order_code = $1
    `,
    [externalReference, paymentReference || null, paymentStatus || null, status || null, rawPayload || null],
  );

  // Si el pago fue aprobado, sincronizar a la tabla de ventas del sistema de escritorio
  if (status === "paid" || paymentStatus === "approved") {
    try {
      const result = await query(
        `select * from public.web_orders where external_reference = $1 or order_code = $1 limit 1`,
        [externalReference],
      );
      if (result.rows.length > 0) {
        await syncOrderToVentas(result.rows[0]);
      }
    } catch {
      // No bloquear el flujo si falla la sincronizacion
    }
  }
}

/**
 * Cuenta cuántas compras pagadas/aprobadas tiene un número de teléfono,
 * excluyendo el pedido actual. Sirve para saber si es cliente nuevo o recurrente.
 * @param {string} phone - Teléfono del cliente
 * @param {string} excludeOrderCode - Código del pedido actual (no contarlo)
 * @returns {Promise<number>}
 */
export async function countPreviousPaidOrders(phone, excludeOrderCode) {
  if (!phone) return 0;
  try {
    const result = await query(
      `select count(*) as cnt
       from public.web_orders
       where customer_phone = $1
         and order_code != $2
         and (status = 'paid' or payment_status = 'approved')`,
      [phone, excludeOrderCode || ""],
    );
    return Number(result.rows[0]?.cnt || 0);
  } catch {
    return 0;
  }
}

/**
 * Sincroniza una web_order aprobada a la tabla ventas del sistema de escritorio.
 * Esto hace que el envio aparezca automaticamente en la vista de Envios del desktop.
 */
export async function syncOrderToVentas(order) {
  const orderCode = order.order_code;
  const alreadySynced = await query(
    `select 1 from public.ventas where numero_venta = $1 limit 1`,
    [orderCode],
  ).catch(() => ({ rows: [] }));

  if (alreadySynced.rows.length > 0) return;

  const rawPayload = typeof order.raw_payload === "string"
    ? JSON.parse(order.raw_payload || "{}")
    : (order.raw_payload || {});

  const customer = rawPayload.customer || {};
  const summary = rawPayload.summary || {};

  const formaMapping = {
    card: "tarjeta",
    transfer: "transferencia",
    whatsapp: "efectivo",
  };
  const formaPago = formaMapping[order.payment_method] || "tarjeta";
  const incluyeEnvio = order.shipping_zone_id === "delivery" ? 1 : 0;

  const isPickup = order.shipping_zone_id === "pickup";

  // Para retiro: local = sucursal real, cliente_nombre = "Pagina Web" (para el historial)
  // Para envío: local = "Pagina Web", cliente_nombre = nombre real del cliente
  const branchFromAddress = isPickup ? getBranchByDisplayName(order.customer_address || customer.address || "") : null;
  const localName = isPickup ? (branchFromAddress?.dbName || "Pagina Web") : "Pagina Web";
  const clienteNombreVenta = isPickup ? "Pagina Web" : (order.customer_name || customer.fullName || "");

  // Para retiro: guardar datos reales en notas para que aparezcan en la boleta
  const realClientInfo = isPickup
    ? `WEB | Cliente: ${order.customer_name || customer.fullName || ""} | Tel: ${order.customer_phone || customer.phone || ""}`
    : "";

  // Extraer calle y numero de la direccion
  const rawAddress = isPickup ? "" : (order.customer_address || "");
  const addressParts = rawAddress.match(/^(.*?)\s*(\d+)\s*$/);
  const clienteCalle = addressParts ? addressParts[1].trim() : rawAddress;
  const clienteNumero = addressParts ? addressParts[2] : "";
  const entreCalles = customer.betweenStreets || "";
  const houseNotes = realClientInfo
    ? `${realClientInfo}${order.customer_notes || customer.notes ? " | " + (order.customer_notes || customer.notes) : ""}`
    : (order.customer_notes || customer.notes || "");

  const ventaResult = await query(
    `
      insert into public.ventas (
        numero_venta,
        local,
        fecha,
        fecha_venta_original,
        vendedor,
        cliente_nombre,
        cliente_telefono,
        cliente_calle,
        cliente_numero,
        cliente_localidad,
        subtotal_productos,
        precio_envio,
        incluye_envio,
        entre_calles,
        total,
        forma_pago,
        tipo_pago,
        tipo_pago_origen,
        forma_pago_origen,
        monto_pagado,
        monto_pendiente,
        notas,
        estado,
        pdf_generado,
        descuento_valor,
        descuento_aplicado
      )
      values (
        $1,$2,(now() AT TIME ZONE 'America/Argentina/Buenos_Aires'),(now() AT TIME ZONE 'America/Argentina/Buenos_Aires'),$3,$4,$5,$6,$7,$8,$9,$10,$11,$17,$12,$13,'completo','completo',$14,$15,0,$16,'completada',0,0,0
      )
      returning id
    `,
    [
      orderCode,
      localName,
      "Tienda Online",
      clienteNombreVenta,
      order.customer_phone || customer.phone || "",
      clienteCalle,
      clienteNumero,
      order.customer_city || customer.city || "",
      Number(order.subtotal || 0),
      Number(order.shipping_cost || 0),
      incluyeEnvio,
      Number(order.total || 0),
      formaPago,
      formaPago,
      Number(order.total || 0),
      houseNotes,
      entreCalles,
    ],
  );

  const ventaId = ventaResult.rows[0]?.id;
  if (!ventaId) return;

  // Insertar items en detalle_ventas
  const items = (summary.items || []);
  for (const item of items) {
    // Intentar encontrar producto_id real en la tabla productos
    let productoId = 0;
    try {
      const pResult = await query(
        `
          select id from public.productos
          where lower(trim(nombre)) = lower($1)
          limit 1
        `,
        [item.nombre || ""],
      );
      productoId = pResult.rows[0]?.id || 0;
    } catch {
      productoId = 0;
    }

    const unitPrice = Number(item.precioVenta || 0) + Number(item.accessoryPrice || 0);
    const qty = Number(item.quantity || 1);
    const subtotal = unitPrice * qty;
    const productNombre = item.accessoryLabel
      ? `${item.nombre} + ${item.accessoryLabel}`
      : item.nombre;

    await query(
      `
        insert into public.detalle_ventas (
          venta_id,
          producto_id,
          producto_nombre,
          producto_categoria,
          cantidad,
          precio_unitario,
          subtotal,
          stock_local,
          entrega_local_entregado
        ) values ($1,$2,$3,$4,$5,$6,$7,'WEB',0)
      `,
      [ventaId, productoId || null, productNombre, item.categoria || "", qty, unitPrice, subtotal],
    ).catch(() => {});
  }
}
