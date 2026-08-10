import {
  getShippingModeById,
  getShippingZoneByDistance,
  MAX_DELIVERY_KM,
  shippingModes,
} from "@/lib/store-config";

export function sanitizeCheckoutItems(items = []) {
  return items
    .map((item) => ({
      lineKey: String(item.lineKey || ""),
      productKey: String(item.productKey || ""),
      nombre: String(item.nombre || "").trim(),
      quantity: Math.max(1, Number(item.quantity || 1)),
      precioVenta: Number(item.precioVenta || 0),
      accessoryPrice: Number(item.accessoryPrice || 0),
      accessoryLabel: String(item.accessoryLabel || "").trim(),
    }))
    .filter((item) => item.nombre && Number.isFinite(item.precioVenta));
}

export function calculateItemsSubtotal(items = []) {
  return sanitizeCheckoutItems(items).reduce(
    (total, item) => total + item.quantity * (item.precioVenta + item.accessoryPrice),
    0,
  );
}

function normalizeDistanceKm(distanceKm) {
  const parsed = Number(String(distanceKm ?? 0).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Costo de envío por zona.
 *
 * Antes era una fórmula lineal (base + km × tarifa) que crecía sin techo: a
 * 26 km daba $36.000 y a Capital $50.000, más que el margen de varios
 * productos. Ahora es un precio fijo por zona, que además se bonifica a
 * partir de cierto monto de compra — que es la forma de competir contra las
 * fábricas que publican "envío gratis".
 *
 * @param {number} subtotal - Total de los productos, para decidir la
 *   bonificación. Si no se pasa, se cobra el envío completo.
 */
export function calculateShippingCost(modeId, distanceKm = 0, overrideSettings = null, subtotal = 0, otroDia = false) {
  const mode = getShippingModeById(modeId);

  if (mode.id === "pickup") {
    return { ...mode, distanceKm: 0, cost: 0, waived: true };
  }

  const normalizedDistanceKm = normalizeDistanceKm(distanceKm);
  const zone = getShippingZoneByDistance(normalizedDistanceKm);

  // Fuera del área de cobertura: no se cotiza, se deriva a retiro o WhatsApp.
  if (!zone) {
    return {
      ...mode,
      distanceKm: normalizedDistanceKm,
      cost: 0,
      waived: false,
      outOfRange: true,
      zoneLabel: null,
      message: `Por ahora entregamos hasta ${MAX_DELIVERY_KM} km. Escribinos por WhatsApp y lo coordinamos.`,
    };
  }

  // La bonificación aplica el día de reparto. Si el cliente pide otro día, el
  // viaje se hace sólo para él, así que paga el flete igual que quien vive
  // más lejos. Sin esto, la web daba a entender que sólo se puede comprar los
  // lunes, que es justo lo contrario de lo que se quiere.
  const freeShipping = !otroDia && Number(subtotal) >= zone.freeFrom;

  return {
    ...mode,
    distanceKm: normalizedDistanceKm,
    cost: freeShipping ? 0 : zone.cost,
    waived: freeShipping,
    otroDia: Boolean(otroDia),
    outOfRange: false,
    zoneId: zone.id,
    zoneLabel: zone.label,
    zoneFreeFrom: zone.freeFrom,
    zoneCost: zone.cost,
    // Cuánto falta para que el envío salga gratis (0 si ya está bonificado).
    missingForFree: freeShipping ? 0 : Math.max(0, zone.freeFrom - Number(subtotal || 0)),
  };
}

/**
 * buildCheckoutSummary — NO accede a la DB.
 * Los settings deben venir del caller (server-side) vía getShippingSettings().
 * Así shipping.js queda libre de pg/dns y puede bundlearse para el cliente.
 */
export function buildCheckoutSummary({ items, shippingModeId, distanceKm, settings = null }) {
  const normalizedItems = sanitizeCheckoutItems(items);
  const subtotal = calculateItemsSubtotal(normalizedItems);
  // El subtotal va al cálculo del envío: de él depende la bonificación.
  const shipping = calculateShippingCost(shippingModeId, distanceKm, settings, subtotal);
  const total = subtotal + shipping.cost;

  return {
    items: normalizedItems,
    subtotal,
    shipping,
    total,
  };
}

export function getDefaultShippingModeId() {
  return shippingModes[0]?.id || "pickup";
}
