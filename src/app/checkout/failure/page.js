import Link from "next/link";

export const metadata = {
  title: "Pago no completado | Manarey",
};

export default function CheckoutFailurePage() {
  return (
    <main className="checkout-result-shell">
      <div className="checkout-result-card checkout-result-failure">
        <div className="checkout-result-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="rgba(171,84,67,0.1)" />
            <path d="M20 20L36 36M36 20L20 36" stroke="#ab5443" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="checkout-result-eyebrow">Pago no completado</p>
        <h1 className="checkout-result-heading">No se pudo finalizar el pago</h1>
        <p className="checkout-result-body">
          El medio de pago rechazo la transaccion. Podes volver e intentarlo de nuevo, elegir otro metodo, o cerrar la compra por WhatsApp.
        </p>
        <div className="checkout-result-actions-row">
          <Link href="/" className="checkout-result-cta">
            Volver al catalogo
          </Link>
        </div>
      </div>
    </main>
  );
}
