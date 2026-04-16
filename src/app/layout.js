import "./globals.css";
import { storeSettings } from "@/lib/store-config";

export const metadata = {
  metadataBase: new URL("https://www.manarey.com.ar"),
  title: {
    default: "Manarey | Muebles y articulos del hogar",
    template: "%s | Manarey",
  },
  description:
    "Muebleria Manarey — muebles, dormitorios, cocina y mas. Compra online con envio o retiro en nuestras sucursales en el sur del Gran Buenos Aires.",
  keywords: ["muebles", "muebleria", "hogar", "dormitorio", "cocina", "Buenos Aires", "Longchamps", "Glew", "Cane"],
  openGraph: {
    title: "Manarey | Muebles y articulos del hogar",
    description:
      "Muebleria Manarey — muebles, dormitorios, cocina y mas. Compra con tarjeta, transferencia o WhatsApp.",
    url: "https://www.manarey.com.ar",
    siteName: "Manarey",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Manarey | Muebles y articulos del hogar",
    description: "Muebleria con sucursales en el sur del Gran Buenos Aires. Compra online.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
