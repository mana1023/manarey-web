const nextConfig = {
  serverExternalPackages: ["pdfkit"],
  images: {
    // De dónde se pueden traer las fotos de los productos: Vercel Blob (las
    // viejas) y Supabase Storage (las nuevas). Cloudinary no está porque sirve
    // las suyas ya optimizadas, sin pasar por acá.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Formatos modernos para mejor compresión
    formats: ["image/avif", "image/webp"],
    // Un año de caché en Vercel. El plan gratis de Supabase da 5 GB de tráfico
    // por mes y, si se pasa, limita todo el proyecto (la base de datos
    // incluida): así Vercel le pide cada foto una sola vez y no una por visita.
    // Es seguro porque cada foto se sube con un nombre distinto y nunca cambia.
    minimumCacheTTL: 31536000,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost")
      ? "https://www.manarey.com.ar"
      : (process.env.NEXT_PUBLIC_SITE_URL || "https://www.manarey.com.ar"),
  },
};

export default nextConfig;
