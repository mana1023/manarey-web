import "./globals.css";
import { storeSettings } from "@/lib/store-config";
import Script from "next/script";

export const metadata = {
  metadataBase: new URL("https://www.manarey.com.ar"),
  verification: {
    google: "j5aX1E1eVmoZ2lK5bnpCYBYZSLcgwBMYZAKcIdjahfI",
  },
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

// ID de Google Analytics 4 — configurar en Vercel como NEXT_PUBLIC_GA_ID (ej: G-XXXXXXXXXX)
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  name: "Manarey",
  url: "https://www.manarey.com.ar",
  description: "Mueblería familiar con más de 8 años de trayectoria. Muebles y artículos del hogar con envío a domicilio o retiro en sucursales en el sur del Gran Buenos Aires.",
  telephone: "+5491164282270",
  priceRange: "$$",
  servesCuisine: undefined,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Hipólito Yrigoyen 19.051",
    addressLocality: "Longchamps",
    addressRegion: "Buenos Aires",
    addressCountry: "AR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -34.8727,
    longitude: -58.4058,
  },
  openingHours: "Mo-Sa 09:00-19:00",
  sameAs: [
    "https://www.instagram.com/manareymuebleria",
    "https://www.facebook.com/manarey.glew",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        {children}

        {/* Google Analytics 4 — solo carga si está configurado NEXT_PUBLIC_GA_ID */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
