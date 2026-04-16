import Link from "next/link";

export const metadata = {
  title: "Pago en revision | Manarey",
};

export default function CheckoutPendingPage() {
  return (
    <main className="checkout-result-shell">
      <div className="checkout-result-card checkout-result-pending">
        <div className="checkout-result-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="rgba(210,162,62,0.12)" />
            <path d="M28 18V28L34 34" stroke="#d2a23e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="checkout-result-eyebrow">Pago en revision</p>
        <h1 className="checkout-result-heading">Tu pago esta siendo procesado</h1>
        <p className="checkout-result-body">
          El medio de pago esta verificando la transaccion. Cuando sea confirmado, la orden se actualizara automaticamente y nos contactaremos para coordinar la entrega.
        </p>
        <div className="checkout-result-steps">
          <div className="checkout-result-step">
            <span className="step-num step-pending">~</span>
            <span>Esperando confirmacion del medio de pago</span>
          </div>
          <div className="checkout-result-step">
            <span className="step-num">2</span>
            <span>Al aprobarse, coordinamos la entrega</span>
          </div>
        </div>
        <Link href="/" className="checkout-result-cta">
          Volver al catalogo
        </Link>
      </div>
    </main>
  );
}
