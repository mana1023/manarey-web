/**
 * Los íconos de la tienda.
 *
 * Reemplazan a los emojis que había sueltos por el código. Un emoji lo dibuja
 * el sistema operativo, así que el mismo 💳 se ve distinto en un iPhone, en un
 * Android y en Windows, y nunca combina con la tipografía ni con el dorado de
 * la marca. Estos son del mismo trazo que los del banner de arriba: 24×24,
 * `currentColor`, trazo 1.6. Heredan el color de donde estén, así que un
 * ícono dentro de un botón dorado sale dorado sin tocar nada.
 *
 * Todos llevan `aria-hidden`: son decoración al lado de un texto que ya dice
 * lo mismo. Si alguno queda solo, sin texto, hay que ponerle un aria-label al
 * elemento que lo contiene.
 */

function Svg({ children, size = 20, trazo = 1.6, ...resto }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  );
}

/* ── Pago ──────────────────────────────────────────────────────────────── */

export function IconoTarjeta(props) {
  return (
    <Svg {...props}>
      <rect x="1" y="4" width="22" height="16" rx="2.5" />
      <line x1="1" y1="10" x2="23" y2="10" />
      <line x1="5" y1="15" x2="9" y2="15" />
    </Svg>
  );
}

export function IconoBanco(props) {
  return (
    <Svg {...props}>
      <path d="M3 10h18" />
      <path d="M12 3 2.5 8.5h19L12 3Z" />
      <path d="M5.5 10v7M9.5 10v7M14.5 10v7M18.5 10v7" />
      <path d="M2.5 20.5h19" />
    </Svg>
  );
}

export function IconoEfectivo(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </Svg>
  );
}

/* ── Contacto ──────────────────────────────────────────────────────────── */

export function IconoChat(props) {
  return (
    <Svg {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function IconoTelefono(props) {
  return (
    <Svg {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
    </Svg>
  );
}

export function IconoSobre(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2.5 6 9.5 7 9.5-7" />
    </Svg>
  );
}

/* ── Entrega ───────────────────────────────────────────────────────────── */

export function IconoCamion(props) {
  return (
    <Svg {...props}>
      <rect x="1" y="3" width="15" height="13" rx="1.5" />
      <path d="M16 8h4l3 3v5h-7z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </Svg>
  );
}

export function IconoLocal(props) {
  return (
    <Svg {...props}>
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M4.5 11.5V20h15v-8.5" />
      <path d="M9.5 20v-5h5v5" />
    </Svg>
  );
}

export function IconoPin(props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function IconoMapa(props) {
  return (
    <Svg {...props}>
      <path d="m2 6 6.5-2.5L15.5 6 22 3.5v14L15.5 20 8.5 17.5 2 20z" />
      <path d="M8.5 3.5v14M15.5 6v14" />
    </Svg>
  );
}

/* ── Tienda ────────────────────────────────────────────────────────────── */

export function IconoCarrito(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
      <path d="M2.5 3h2.6l2.4 11.4a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.8-1.4L21 7H6" />
    </Svg>
  );
}

export function IconoSillon(props) {
  return (
    <Svg {...props}>
      <path d="M4 11V8a2.5 2.5 0 0 1 5 0v3" />
      <path d="M15 11V8a2.5 2.5 0 0 1 5 0v3" />
      <path d="M4 11h16a2 2 0 0 1 2 2v4H2v-4a2 2 0 0 1 2-2Z" />
      <path d="M5 17v2M19 17v2" />
    </Svg>
  );
}

export function IconoEstrella(props) {
  return (
    <Svg {...props}>
      <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z" />
    </Svg>
  );
}

export function IconoEstrellaLlena(props) {
  return (
    <Svg fill="currentColor" {...props}>
      <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z" />
    </Svg>
  );
}

/* ── Estados ───────────────────────────────────────────────────────────── */

export function IconoTilde(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8 12.4 2.7 2.6L16 9.6" />
    </Svg>
  );
}

export function IconoAtencion(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function IconoDato(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconoRegalo(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <path d="M2 9h20" />
      <path d="M12 9v12" />
      <path d="M12 9S9.5 3 7 4.5 9 9 12 9Z" />
      <path d="M12 9s2.5-6 5-4.5S15 9 12 9Z" />
    </Svg>
  );
}

export function IconoCruz(props) {
  return (
    <Svg trazo={1.9} {...props}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </Svg>
  );
}

export function IconoNota(props) {
  return (
    <Svg {...props}>
      <path d="M19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5Z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </Svg>
  );
}

export function IconoPersona(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}
