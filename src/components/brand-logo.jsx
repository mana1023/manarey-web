export function BrandLogo({ compact = false }) {
  // En el navbar (compact) usamos la foto del logo real
  if (compact) {
    return (
      <img
        src="/logo-manarey.png"
        alt="Manarey Mueblería"
        className="brand-logo-img compact"
        draggable={false}
      />
    );
  }

  // En la sección de bienvenida (oscura) usamos el logo SVG dorado
  return (
    <div className="brand-logo">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 420 240" role="img" aria-label="Manarey logo">
          <g fill="currentColor">
            <circle cx="86"  cy="50" r="9" />
            <circle cx="148" cy="68" r="7" />
            <circle cx="210" cy="18" r="11" />
            <circle cx="272" cy="68" r="7" />
            <circle cx="334" cy="50" r="9" />
            <path d="
              M80 205
              L86 50
              L118 125
              L148 68
              L179 108
              L210 18
              L241 108
              L272 68
              L302 125
              L334 50
              L340 205
              Z
            " />
            <rect x="76" y="178" width="268" height="18" rx="3" />
            <rect x="80" y="200" width="260" height="10" rx="2" />
          </g>
        </svg>
      </div>
      <div className="brand-wording">
        <span>MANAREY</span>
      </div>
    </div>
  );
}
