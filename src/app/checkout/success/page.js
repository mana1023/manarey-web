import Link from "next/link";

export const metadata = {
  title: "Pago confirmado | Manarey",
};

export default function CheckoutSuccessPage() {
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
        <h1 className="checkout-result-heading">Tu compra fue registrada</h1>
        <p className="checkout-result-body">
          Mercado Pago aprobó el pago. Nos contactaremos para coordinar la entrega o el retiro desde nuestras sucursales.
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
            <span>Recibi tu mueble con envio coordinado</span>
          </div>
        </div>
        <Link href="/" className="checkout-result-cta">
          Seguir comprando
        </Link>
      </div>
    </main>
  );
}
