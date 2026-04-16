export default function sitemap() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/checkout/success`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/checkout/failure`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ];
}
