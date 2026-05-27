const nextConfig = {
  serverExternalPackages: ["pdfkit"],
  images: {
    // Vercel Blob storage (imágenes de productos subidas desde el admin)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
    // Formatos modernos para mejor compresión
    formats: ["image/avif", "image/webp"],
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost")
      ? "https://www.manarey.com.ar"
      : (process.env.NEXT_PUBLIC_SITE_URL || "https://www.manarey.com.ar"),
  },
};

export default nextConfig;
