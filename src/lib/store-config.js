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
    name: "En el barrio Kanmar",
    shortName: "Kanmar",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_1 || "Miguel Cane 508 esquina San Ignacio, Glew",
    mapsUrl: "https://maps.google.com/?q=Miguel+Cane+508+Glew+Buenos+Aires",
  },
  {
    id: "longchamps",
    name: "Central — al lado del vivero Kan Sei",
    shortName: "Central",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_2 || "Av. Hipolito Yrigoyen 19.051, Longchamps",
    mapsUrl: "https://maps.google.com/?q=Av+Hipolito+Yrigoyen+19051+Longchamps+Buenos+Aires",
  },
  {
    id: "glew",
    name: "Frente a las canchas Corta la Bocha",
    shortName: "Corta la Bocha",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_3 || "Av. Hipolito Yrigoyen 19.861, Glew",
    mapsUrl: "https://maps.google.com/?q=Av+Hipolito+Yrigoyen+19861+Glew+Buenos+Aires",
  },
  {
    id: "vidriera",
    name: "En la entrada de la UOCRA",
    shortName: "UOCRA",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_4 || "Av. Hipolito Yrigoyen 21.890 esquina Monroe, Glew",
    mapsUrl: "https://maps.google.com/?q=Av+Hipolito+Yrigoyen+21890+Glew+Buenos+Aires",
  },
  {
    id: "estacion",
    name: "En la estación de Glew",
    shortName: "Estación",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_5 || "Almafuerte 45 entre Andrade y Obligado, Glew",
    mapsUrl: "https://maps.google.com/?q=Almafuerte+45+Glew+Buenos+Aires",
  },
];

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
