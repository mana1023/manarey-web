export function BrandLogo({ compact = false }) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"}>
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 420 230" role="img">
          <g fill="currentColor">
            <circle cx="86" cy="54" r="8" />
            <circle cx="144" cy="69" r="8" />
            <circle cx="210" cy="24" r="10" />
            <circle cx="276" cy="69" r="8" />
            <circle cx="334" cy="54" r="8" />
          </g>
          <path
            d="M84 68l36 93h180l35-93-18 8c-8 4-16 1-20-6l-18-32c-3-6-12-6-15 0l-20 42c-10 20-38 20-48 0l-22-59c-3-8-15-8-18 0l-22 59c-10 20-38 20-48 0l-20-42c-3-6-12-6-15 0l-18 32c-4 7-12 10-20 6l-17-8Z"
            fill="currentColor"
          />
          <path
            d="M118 177c59-8 125-8 184 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="square"
          />
          <path
            d="M116 198c63-7 127-7 188 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="square"
          />
        </svg>
      </div>
      <div className="brand-wording">
        <span>MANAREY</span>
      </div>
    </div>
  );
}
