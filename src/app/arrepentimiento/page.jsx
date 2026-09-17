import Link from "next/link";
import { FormularioArrepentimiento } from "./FormularioArrepentimiento";

export const metadata = {
  // El layout ya agrega "| Manarey" al final (template de metadata).
  title: "Botón de arrepentimiento",
  description:
    "Si compraste online en Manarey y te arrepentiste, tenés 10 días corridos para cancelar la compra sin costo. Pedilo desde acá.",
  robots: { index: true, follow: true },
};

const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");

/**
 * Botón de arrepentimiento: lo exige la Resolución 424/2020 de la Secretaría de
 * Comercio Interior a toda tienda online, junto con el enlace a Defensa del
 * Consumidor. Tiene que estar a la vista y permitir pedir la cancelación desde
 * la web, sin tener que llamar ni explicar por qué.
 */
export default function BotonDeArrepentimiento() {
  return (
    <div style={{ minHeight: "100vh", padding: "0 0 60px" }}>
      <div
        style={{
          background: "var(--surface-dark)",
          color: "#f5e8d0",
          padding: "32px 24px 28px",
          textAlign: "center",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-block",
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "#e8c547",
            textDecoration: "none",
            letterSpacing: "0.05em",
            marginBottom: "12px",
          }}
        >
          MANAREY
        </Link>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>Botón de arrepentimiento</h1>
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.75 }}>
          Cancelá una compra hecha por internet, sin costo
        </p>
      </div>

      <div
        style={{
          maxWidth: 680,
          margin: "36px auto",
          padding: "0 24px",
          lineHeight: 1.75,
          color: "var(--text)",
        }}
      >
        <p style={{ fontSize: "0.98rem" }}>
          Si compraste por la web o por WhatsApp y te arrepentiste, tenés{" "}
          <strong>10 días corridos</strong> desde que recibís el producto (o desde la compra, lo que pase
          después) para dejarla sin efecto. <strong>No tenés que explicar por qué</strong> y no te podemos
          cobrar nada por eso: la devolución del dinero y el retiro del producto corren por nuestra cuenta.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--muted, #6b5744)" }}>
          Lo único que pedimos es que el producto esté sin uso y en las mismas condiciones en que lo
          recibiste. Completá el formulario y te contestamos para coordinar el retiro y el reintegro.
        </p>

        <FormularioArrepentimiento whatsapp={WHATSAPP} />

        <div
          style={{
            marginTop: 40,
            padding: "18px 20px",
            borderRadius: 12,
            background: "rgba(250, 245, 236, 0.75)",
            border: "1px solid rgba(120, 85, 60, 0.2)",
            fontSize: "0.86rem",
          }}
        >
          <p style={{ margin: "0 0 8px" }}>
            <strong>¿Cómo sigue?</strong> Te escribimos para acordar el día del retiro. Cuando el
            producto vuelve, te devolvemos el dinero por el mismo medio con el que pagaste.
          </p>
          <p style={{ margin: 0 }}>
            Este derecho está en el <strong>artículo 34 de la Ley 24.240</strong> de Defensa del Consumidor
            y en la Resolución 424/2020. Si algo no se resuelve, podés hacer un reclamo en{" "}
            <a
              href="https://autogestion.produccion.gob.ar/consumidores"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--gold-strong)" }}
            >
              Defensa del Consumidor
            </a>
            .
          </p>
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/" style={{ color: "var(--gold-strong)", fontSize: "0.9rem" }}>
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
