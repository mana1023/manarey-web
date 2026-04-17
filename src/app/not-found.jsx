"use client";
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      textAlign: "center",
      gap: "16px",
    }}>
      <div style={{ fontSize: "5rem", lineHeight: 1 }}>🪑</div>
      <h1 style={{
        fontSize: "clamp(2.5rem, 8vw, 5rem)",
        fontWeight: 800,
        color: "var(--gold)",
        margin: 0,
        lineHeight: 1,
      }}>404</h1>
      <p style={{
        fontSize: "1.2rem",
        fontWeight: 600,
        color: "var(--text)",
        margin: 0,
      }}>Esta página no existe</p>
      <p style={{
        fontSize: "0.95rem",
        color: "var(--muted)",
        maxWidth: 380,
        margin: 0,
        lineHeight: 1.5,
      }}>
        Puede que el link esté roto o que la página haya sido movida.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
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
            transition: "opacity 0.15s",
          }}
        >
          ← Volver al inicio
        </Link>
        <Link
          href="/?tab=catalogo"
          style={{
            display: "inline-block",
            background: "var(--surface)",
            border: "1.5px solid var(--line)",
            color: "var(--text)",
            fontWeight: 600,
            fontSize: "0.95rem",
            padding: "12px 28px",
            borderRadius: "10px",
            textDecoration: "none",
          }}
        >
          Ver catálogo
        </Link>
      </div>
    </div>
  );
}
