export const storeSettings = {
  brandName: "Manarey",
  supportEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ventas@manarey.com",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, ""),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "https://manarey.com.ar").replace(/\/$/, ""),
  currency: "ARS",
  cardInstallmentsText:
    process.env.NEXT_PUBLIC_CARD_INSTALLMENTS_TEXT || "Paga con tarjeta de credito o debito",
  transferDiscountText:
    process.env.NEXT_PUBLIC_TRANSFER_DISCOUNT_TEXT || "Consulta descuentos por transferencia",
  shippingBaseCost: Number(process.env.NEXT_PUBLIC_SHIPPING_BASE_COST || 10000),
  shippingCostPerKm: Number(process.env.NEXT_PUBLIC_SHIPPING_COST_PER_KM || 1500),
};

export const storeBranches = [
  {
    id: "cane",
    name: "Cane",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_1 || "Miguel Cane 508 esquina San Ignacio",
  },
  {
    id: "longchamps",
    name: "Longchamps",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_2 || "Av. Hipolito Yrigoyen 19.051 esquina Los Stud",
  },
  {
    id: "glew",
    name: "Glew",
    city: "Buenos Aires",
    address:
      process.env.NEXT_PUBLIC_BRANCH_ADDRESS_3 ||
      "Av. Hipolito Yrigoyen 19.861 entre Constantino Gaito y Julian Aguirre",
  },
  {
    id: "vidriera",
    name: "Vidriera",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_4 || "Av. Hipolito Yrigoyen 21.890 esquina Monroe",
  },
  {
    id: "estacion",
    name: "Estacion",
    city: "Buenos Aires",
    address: process.env.NEXT_PUBLIC_BRANCH_ADDRESS_5 || "Almafuerte 45 entre Andrade y Obligado",
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
    description: "Base de $10.000 mas $1.500 por kilometro desde la sucursal de Longchamps.",
    eta: "Coordinacion segun ruta",
  },
];

export function getShippingModeById(modeId) {
  return shippingModes.find((mode) => mode.id === modeId) || shippingModes[0];
}
