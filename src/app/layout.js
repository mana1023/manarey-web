import "./globals.css";
import { storeSettings } from "@/lib/store-config";

export const metadata = {
  metadataBase: new URL(storeSettings.siteUrl),
  title: {
    default: "Manarey | Muebles y soluciones para tu hogar",
    template: "%s | Manarey",
  },
  description:
    "Catalogo online de Manarey con compra por WhatsApp o tarjeta, retiro en local y envios por zona.",
  openGraph: {
    title: "Manarey | Muebles y soluciones para tu hogar",
    description:
      "Explora el catalogo, calcula envio por zona y compra con tarjeta o por WhatsApp.",
    url: storeSettings.siteUrl,
    siteName: "Manarey",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
