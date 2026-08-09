export const storeSettings = {
  brandName: "Manarey",
  supportEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ventas@manarey.com",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, ""),
  siteUrl: (() => {
    const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
    if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) {
      return "https://www.manarey.com.ar";
    }
    return raw;
  })(),
  currency: "ARS",
  cardInstallmentsText:
    process.env.NEXT_PUBLIC_CARD_INSTALLMENTS_TEXT || "Paga con tarjeta de credito o debito",
  transferDiscountText:
    process.env.NEXT_PUBLIC_TRANSFER_DISCOUNT_TEXT || "Consulta descuentos por transferencia",
  shippingBaseCost: Number(process.env.NEXT_PUBLIC_SHIPPING_BASE_COST || 10000),
  shippingCostPerKm: Number(process.env.NEXT_PUBLIC_SHIPPING_COST_PER_KM || 1500),
  instagramUrl: "https://www.instagram.com/manareymuebleria",
  facebookUrl: "https://www.facebook.com/manarey.glew",
};

export const storeBranches = [
  {
    id: "cane",
    dbName: "Cane",
    name: "Manarey Kanmar",
    shortName: "Kanmar",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_1 || "Miguel Cané 508 esq. San Ignacio, Glew",
    mapsUrl: "https://maps.google.com/?q=Miguel+Cane+508+Glew+Buenos+Aires",
    hours: "Lun a Vie: 9-13 y 16-20 hs · Sáb: 9-20 hs (corrido)",
    phone: process.env.BRANCH_PHONE_CANE || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  },
  {
    id: "longchamps",
    dbName: "Longchamps",
    name: "Manarey Central",
    shortName: "Central",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_2 || "Av. Hipólito Yrigoyen 19.051, Longchamps",
    mapsUrl: "https://maps.google.com/?q=Av+Hipolito+Yrigoyen+19051+Longchamps+Buenos+Aires",
    hours: "Lunes a sábado: 9-18 hs",
    phone: process.env.BRANCH_PHONE_LONGCHAMPS || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  },
  // "Manarey Glew" (Av. H. Yrigoyen 19.861) CERRÓ. Se saca de acá para que no
  // aparezca en el inicio, en Sobre nosotros, en el pie ni —lo más importante—
  // como opción de retiro en el checkout: un cliente podía pagar y viajar a un
  // local que ya no existe. El conteo de "N sucursales" sale de este array, así
  // que se actualiza solo.
  //
  // Queda pendiente en el sistema de escritorio: la sucursal todavía tiene 26
  // unidades sueltas cargadas (colchones, respaldos, una estufa). Al no estar
  // en este array, el panel web ya no las puede editar — hay que moverlas o
  // darlas de baja desde el sistema.
  {
    id: "vidriera",
    dbName: "Vidriera",
    name: "Manarey Vidriera",
    shortName: "Vidriera",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_4 || "Av. Hipólito Yrigoyen 21.890 esq. Monroe, Glew",
    mapsUrl: "https://maps.google.com/?q=Av+Hipolito+Yrigoyen+21890+Glew+Buenos+Aires",
    hours: "Lunes a sábado: 9-18 hs",
    phone: process.env.BRANCH_PHONE_VIDRIERA || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  },
  {
    id: "estacion",
    dbName: "Estacion",
    name: "Manarey Estación",
    shortName: "Estación",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_5 || "Almafuerte 45 entre Andrade y Obligado, Glew",
    mapsUrl: "https://maps.google.com/?q=Almafuerte+45+Glew+Buenos+Aires",
    hours: "Lun a Sáb: 9-13 y 16-20 hs",
    phone: process.env.BRANCH_PHONE_ESTACION || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  },
];

/**
 * Dado el nombre de display de una sucursal (como viene del checkout)
 * devuelve el dbName para usar en la tabla ventas.
 */
export function getBranchByDisplayName(displayName) {
  if (!displayName) return null;
  return storeBranches.find(
    (b) => b.name === displayName || b.dbName === displayName || b.shortName === displayName,
  ) || null;
}

export const shippingModes = [
  {
    id: "pickup",
    label: "Retiro en local",
    description: "Retiras sin cargo desde cualquiera de las sucursales.",
    eta: "Coordinacion inmediata",
  },
  {
    id: "delivery",
    label: "Envio a domicilio",
    description: "Base de $10.000 mas $1.500 por kilometro desde la sucursal mas cercana (Longchamps o Glew).",
    eta: "Coordinacion segun ruta",
  },
];

export function getShippingModeById(modeId) {
  return shippingModes.find((mode) => mode.id === modeId) || shippingModes[0];
}
