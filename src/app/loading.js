/**
 * Next.js loading.js — se muestra automáticamente mientras page.js está
 * resolviendo datos en el servidor (Suspense boundary automático).
 */
export default function Loading() {
  return (
    <div className="loading-page-shell">
      {/* Navbar placeholder */}
      <div className="loading-navbar">
        <div className="skeleton loading-nav-logo" />
        <div className="loading-nav-links">
          <div className="skeleton loading-nav-link" />
          <div className="skeleton loading-nav-link" />
          <div className="skeleton loading-nav-link" />
        </div>
        <div className="skeleton loading-nav-icon" />
      </div>

      {/* Hero placeholder */}
      <div className="loading-hero skeleton" />

      {/* Grid de productos skeleton */}
      <div className="loading-catalog">
        <div className="loading-catalog-header">
          <div>
            <div className="skeleton loading-eyebrow" />
            <div className="skeleton loading-title" />
          </div>
        </div>

        <div className="loading-product-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="product-skeleton" key={i}>
              <div className="skeleton skeleton-thumb sk-img" />
              <div className="loading-sk-body">
                <div className="skeleton sk-tag" />
                <div className="skeleton sk-name" />
                <div className="skeleton sk-price" />
                <div className="skeleton sk-btn" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
