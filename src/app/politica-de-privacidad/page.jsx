import Link from "next/link";

export const metadata = {
  title: "Política de privacidad | Manarey",
  description: "Conocé cómo Manarey protege y usa tus datos personales al comprar en nuestra tienda online.",
  robots: { index: true, follow: true },
};

export default function PoliticaDePrivacidad() {
  const lastUpdate = "Abril 2025";

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{
        background: "var(--surface-dark)",
        color: "#f5e8d0",
        padding: "32px 24px 28px",
        textAlign: "center",
      }}>
        <Link href="/" style={{
          display: "inline-block",
          fontSize: "1.5rem",
          fontWeight: 800,
          color: "#e8c547",
          textDecoration: "none",
          letterSpacing: "0.05em",
          marginBottom: "12px",
        }}>
          MANAREY
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>
          Política de Privacidad
        </h1>
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.65 }}>
          Última actualización: {lastUpdate}
        </p>
      </div>

      {/* Contenido */}
      <div style={{
        maxWidth: 760,
        margin: "40px auto",
        padding: "0 24px",
        lineHeight: 1.75,
        color: "var(--text)",
      }}>
        <Section title="1. Responsable del tratamiento de datos">
          <p>
            <strong>Manarey Mueblería</strong> (en adelante, "Manarey", "nosotros" o "la empresa") es responsable del
            tratamiento de los datos personales que se recopilan a través del sitio web{" "}
            <a href="https://www.manarey.com.ar" style={{ color: "var(--gold-strong)" }}>www.manarey.com.ar</a>.
          </p>
          <p>
            Podés contactarnos en cualquier momento a través de WhatsApp al{" "}
            <strong>+54 9 11 6428-2270</strong> o por email a{" "}
            <strong>ventas@manarey.com</strong>.
          </p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p>Cuando realizás una compra o nos contactás, recopilamos los siguientes datos:</p>
          <ul>
            <li><strong>Datos de contacto:</strong> nombre completo, teléfono, correo electrónico.</li>
            <li><strong>Datos de entrega:</strong> dirección, ciudad, notas adicionales.</li>
            <li><strong>Datos de pago:</strong> método de pago elegido. Los datos de tarjeta son procesados directamente por MercadoPago y nunca son almacenados en nuestros servidores.</li>
            <li><strong>Datos de navegación:</strong> dirección IP, tipo de dispositivo, páginas visitadas (con fines de análisis y mejora del sitio).</li>
          </ul>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          <p>Usamos tus datos para:</p>
          <ul>
            <li>Procesar y gestionar tu pedido.</li>
            <li>Coordinar el envío o retiro de los productos.</li>
            <li>Enviarte comunicaciones relacionadas con tu compra (confirmación, estado del pedido).</li>
            <li>Mejorar nuestros productos, servicios y la experiencia en el sitio.</li>
            <li>Cumplir con obligaciones legales y fiscales.</li>
          </ul>
          <p>
            <strong>No vendemos, alquilamos ni cedemos</strong> tus datos personales a terceros con fines comerciales.
          </p>
        </Section>

        <Section title="4. Base legal del tratamiento">
          <p>
            El tratamiento de tus datos se basa en:
          </p>
          <ul>
            <li>La <strong>ejecución del contrato</strong> de compraventa que surge al realizar un pedido.</li>
            <li>El <strong>consentimiento</strong> que otorgás al completar el formulario de compra.</li>
            <li>El cumplimiento de <strong>obligaciones legales</strong> aplicables a la actividad comercial.</li>
          </ul>
        </Section>

        <Section title="5. Compartir datos con terceros">
          <p>Para prestar nuestros servicios, podemos compartir tus datos con:</p>
          <ul>
            <li>
              <strong>MercadoPago</strong>: procesamiento de pagos con tarjeta y transferencia. Sus políticas de
              privacidad están disponibles en{" "}
              <a href="https://www.mercadopago.com.ar/privacidad" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--gold-strong)" }}>
                mercadopago.com.ar/privacidad
              </a>.
            </li>
            <li>
              <strong>Proveedores de hosting y base de datos</strong>: Vercel y Supabase, para alojar la plataforma.
              Solo tienen acceso técnico a los datos necesarios para el funcionamiento del servicio.
            </li>
          </ul>
        </Section>

        <Section title="6. Conservación de los datos">
          <p>
            Conservamos tus datos personales durante el tiempo necesario para cumplir con la finalidad para la que
            fueron recopilados y para cumplir con las obligaciones legales aplicables (facturación, registros
            comerciales, etc.), que en Argentina pueden extenderse hasta <strong>10 años</strong>.
          </p>
        </Section>

        <Section title="7. Tus derechos">
          <p>
            De acuerdo con la <strong>Ley N° 25.326 de Protección de Datos Personales</strong> de Argentina,
            tenés derecho a:
          </p>
          <ul>
            <li><strong>Acceder</strong> a los datos personales que tengamos sobre vos.</li>
            <li><strong>Rectificar</strong> datos inexactos o desactualizados.</li>
            <li><strong>Cancelar</strong> tus datos cuando ya no sean necesarios.</li>
            <li><strong>Oponerte</strong> al tratamiento en determinadas circunstancias.</li>
          </ul>
          <p>
            Para ejercer estos derechos, contactanos por WhatsApp al{" "}
            <strong>+54 9 11 6428-2270</strong>. Responderemos dentro de los 30 días hábiles.
          </p>
          <p>
            La Dirección Nacional de Protección de Datos Personales es el órgano de control en Argentina.
            Podés presentar reclamos en{" "}
            <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--gold-strong)" }}>
              www.argentina.gob.ar/aaip
            </a>.
          </p>
        </Section>

        <Section title="8. Seguridad">
          <p>
            Adoptamos medidas técnicas y organizativas razonables para proteger tus datos contra acceso no
            autorizado, pérdida, alteración o divulgación. Las transmisiones de datos en nuestro sitio se
            realizan mediante protocolo HTTPS.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            Nuestro sitio puede utilizar cookies de sesión necesarias para el funcionamiento del carrito y la
            autenticación. No usamos cookies de seguimiento publicitario de terceros.
          </p>
        </Section>

        <Section title="10. Cambios a esta política">
          <p>
            Podemos actualizar esta política periódicamente. Cuando lo hagamos, publicaremos la nueva versión en
            esta misma página con la fecha de actualización. Te recomendamos revisarla ocasionalmente.
          </p>
        </Section>

        {/* Volver */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--line)", textAlign: "center" }}>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #d4a017, #e8c547)",
              color: "#4a2e00",
              fontWeight: 700,
              fontSize: "0.95rem",
              padding: "12px 28px",
              borderRadius: "10px",
              textDecoration: "none",
            }}
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: "1.1rem",
        fontWeight: 700,
        color: "var(--text)",
        borderBottom: "2px solid var(--gold-soft)",
        paddingBottom: 8,
        marginBottom: 14,
      }}>
        {title}
      </h2>
      <div style={{ fontSize: "0.93rem" }}>{children}</div>
    </div>
  );
}
