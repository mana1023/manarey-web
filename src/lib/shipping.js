import { getShippingModeById, shippingModes, storeSettings } from "@/lib/store-config";

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

export function calculateShippingCost(modeId, distanceKm = 0, overrideSettings = null) {
  const mode = getShippingModeById(modeId);

  if (mode.id === "pickup") {
    return { ...mode, distanceKm: 0, cost: 0, waived: true };
  }

  const settings = overrideSettings || storeSettings;
  const normalizedDistanceKm = normalizeDistanceKm(distanceKm);
  const cost = settings.shippingBaseCost + normalizedDistanceKm * settings.shippingCostPerKm;

  return {
    ...mode,
    distanceKm: normalizedDistanceKm,
    cost,
    waived: false,
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
  const shipping = calculateShippingCost(shippingModeId, distanceKm, settings || storeSettings);
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
