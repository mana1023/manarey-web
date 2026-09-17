"use client";

import { useState } from "react";

/**
 * Formulario del botón de arrepentimiento. Va aparte de la página para que la
 * página siga siendo un componente de servidor y se indexe bien.
 */
export function FormularioArrepentimiento({ whatsapp }) {
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");

  async function enviar(evento) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    try {
      const res = await fetch("/api/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(cuerpo?.error || "No pudimos enviar tu pedido. Probá de nuevo o escribinos por WhatsApp.");
        return;
      }
      setListo(true);
    } catch {
      setError("No pudimos enviar tu pedido. Revisá tu conexión o escribinos por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="arrepentimiento-ok">
        <strong>Recibimos tu pedido.</strong>
        <p>
          Te vamos a contestar a la brevedad para coordinar la devolución y el reintegro,
          sin ningún costo para vos. Si preferís que sea ahora,{" "}
          {whatsapp ? (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer noopener">
              escribinos por WhatsApp
            </a>
          ) : (
            "escribinos por WhatsApp"
          )}
          .
        </p>
      </div>
    );
  }

  return (
    <form className="arrepentimiento-form" onSubmit={enviar}>
      <label>
        <span>Tu nombre y apellido *</span>
        <input name="nombre" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        <span>Teléfono o mail donde contestarte *</span>
        <input name="contacto" required maxLength={120} autoComplete="tel" />
      </label>
      <label>
        <span>Número de pedido <em>(si lo tenés a mano)</em></span>
        <input name="pedido" maxLength={60} placeholder="Por ejemplo: MNR-1234" />
      </label>
      <label>
        <span>¿Querés contarnos algo más? <em>(no es obligatorio)</em></span>
        <textarea name="detalle" rows={4} maxLength={1500} />
      </label>

      {error && <p className="arrepentimiento-error">{error}</p>}

      <button className="primary-button" type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar pedido de arrepentimiento"}
      </button>
      <p className="arrepentimiento-nota">
        No hace falta que expliques por qué. Es un derecho tuyo y ejercerlo no tiene ningún costo.
      </p>
    </form>
  );
}
