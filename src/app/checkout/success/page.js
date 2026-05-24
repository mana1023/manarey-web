"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { storeBranches } from "@/lib/store-config";

function SuccessContent() {
  const params = useSearchParams();
  const code = params.get("code") || "";
  const branchKey = params.get("branch") || "";

  const branch = branchKey
    ? storeBranches.find(
        (b) =>
          b.dbName.toLowerCase() === branchKey.toLowerCase() ||
          b.name === branchKey ||
          b.shortName === branchKey,
      )
    : null;

  return (
    <main className="checkout-result-shell">
      <div className="checkout-result-card checkout-result-success">
        <div className="checkout-result-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="rgba(69,103,79,0.12)" />
            <path d="M18 28.5L24.5 35L38 22" stroke="#45674f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="checkout-result-eyebrow">Pago confirmado</p>
        <h1 className="checkout-result-heading">¡Tu compra fue registrada!</h1>

        {branch ? (
          /* ── Retiro en sucursal ── */
          <div className="checkout-pickup-block">
            <p className="checkout-pickup-intro">
              Vení a buscar tu producto a
            </p>
            <p className="checkout-pickup-branch">{branch.name}</p>
            <p className="checkout-pickup-address">{branch.address}</p>
            {branch.hours && (
              <div className="checkout-pickup-hours">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {branch.hours}
              </div>
            )}
            <p className="checkout-pickup-welcome">¡Te esperamos! 😊</p>
            {branch.mapsUrl && (
              <a
                href={branch.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="checkout-pickup-map-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Cómo llegar
              </a>
            )}
          </div>
        ) : (
          /* ── Envío a domicilio ── */
          <>
            <p className="checkout-result-body">
              Nos contactaremos para coordinar la entrega en tu domicilio.
            </p>
            <div className="checkout-result-steps">
              <div className="checkout-result-step">
                <span className="step-num">1</span>
                <span>Orden registrada en nuestro sistema</span>
              </div>
              <div className="checkout-result-step">
                <span className="step-num">2</span>
                <span>Te contactamos para coordinar la entrega</span>
              </div>
              <div className="checkout-result-step">
                <span className="step-num">3</span>
                <span>Recibí tu mueble con envío coordinado</span>
              </div>
            </div>
          </>
        )}

        {code && (
          <p className="checkout-result-code">
            Código de pedido: <strong>{code}</strong>
          </p>
        )}

        <div className="checkout-result-actions">
          <Link href="/" className="checkout-result-cta checkout-result-cta--secondary">
            Seguir comprando
          </Link>
          {code && (
            <a
              href={`/api/orders/${encodeURIComponent(code)}/boleta`}
              className="checkout-result-cta checkout-result-cta--primary"
              download={`boleta-${code}.pdf`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar boleta
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <main className="checkout-result-shell">
        <div className="checkout-result-card checkout-result-success" />
      </main>
    }>
      <SuccessContent />
    </Suspense>
  );
}
