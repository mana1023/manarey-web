const nextConfig = {
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost")
      ? "https://www.manarey.com.ar"
      : (process.env.NEXT_PUBLIC_SITE_URL || "https://www.manarey.com.ar"),
  },
};

export default nextConfig;
