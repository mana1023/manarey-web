"use client";

import { shippingModes, storeBranches, storeSettings } from "@/lib/store-config";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function CartCheckoutPanel({
  customer,
  onCustomerChange,
  shippingQuotePending,
  shippingQuoteError,
  onRecalculateShipping,
  shipping,
  subtotal,
  total,
  checkoutBusy,
  checkoutError,
  onPayByCard,
  onPayByQr,
  onPayByTransfer,
  onCheckoutWhatsApp,
}) {
  return (
    <div className="checkout-panel">
      <div className="checkout-panel-copy">
        <p className="eyebrow">Finalizar compra</p>
        <h4>Completa los datos para envio y pago.</h4>
        <p className="availability">
          Paga con tarjeta, transferencia bancaria o QR via Mercado Pago, o cerrá por WhatsApp.{" "}
          {storeSettings.transferDiscountText}
        </p>
      </div>

      <div className="checkout-form-grid">
        <input
          className="editor-input"
          placeholder="Nombre y apellido"
          value={customer.fullName}
          onChange={(event) => onCustomerChange("fullName", event.target.value)}
        />
        <input
          className="editor-input"
          placeholder="Correo"
          type="email"
          value={customer.email}
          onChange={(event) => onCustomerChange("email", event.target.value)}
        />
        <input
          className="editor-input"
          placeholder="Telefono"
          value={customer.phone}
          onChange={(event) => onCustomerChange("phone", event.target.value)}
        />
        <input
          className="editor-input"
          placeholder="Ciudad / localidad"
          value={customer.city}
          onChange={(event) => onCustomerChange("city", event.target.value)}
        />
        <input
          className="editor-input checkout-address"
          placeholder="Direccion de entrega"
          value={customer.address}
          onChange={(event) => onCustomerChange("address", event.target.value)}
        />
        <select
          className="sort-select"
          value={customer.shippingModeId}
          onChange={(event) => onCustomerChange("shippingModeId", event.target.value)}
        >
          {shippingModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      {customer.shippingModeId === "delivery" ? (
        <div className="shipping-auto-box">
          <div>
            <strong>Calculo automatico desde Longchamps</strong>
            <p>
              {customer.distanceKm
                ? `${customer.distanceKm} km calculados por ruta para ${customer.address}, ${customer.city}.`
                : "Carga direccion y ciudad para cotizar el envio automaticamente."}
            </p>
            {shippingQuoteError ? <p className="error-text">{shippingQuoteError}</p> : null}
          </div>
          <button
            className="secondary-button"
            disabled={shippingQuotePending}
            onClick={onRecalculateShipping}
            type="button"
          >
            {shippingQuotePending ? "Calculando..." : "Recalcular envio"}
          </button>
        </div>
      ) : null}

      <textarea
        className="editor-textarea"
        placeholder="Notas de entrega, piso, color deseado o aclaraciones"
        value={customer.notes}
        onChange={(event) => onCustomerChange("notes", event.target.value)}
      />

      <div className="shipping-note">
        <strong>{shipping.label}</strong>
        <p>{shipping.description}</p>
        {shipping.distanceKm ? <p>Distancia cargada: {shipping.distanceKm} km desde Longchamps.</p> : null}
        <p>
          Entrega estimada: {shipping.eta}. Costo:{" "}
          {shipping.waived ? "Bonificado" : currencyFormatter.format(shipping.cost)}
        </p>
      </div>

      <div className="branch-list">
        {storeBranches.map((branch) => (
          <div className="branch-card" key={branch.id}>
            <strong>{branch.name}</strong>
            <p>{branch.address}</p>
            <span>{branch.city}</span>
          </div>
        ))}
      </div>

      <div className="checkout-totals">
        <div>
          <span>Subtotal</span>
          <strong>{currencyFormatter.format(subtotal)}</strong>
        </div>
        <div>
          <span>Envio</span>
          <strong>{shipping.waived ? "Bonificado" : currencyFormatter.format(shipping.cost)}</strong>
        </div>
        <div className="checkout-total-strong">
          <span>Total final</span>
          <strong>{currencyFormatter.format(total)}</strong>
        </div>
      </div>

      {checkoutError ? <p className="error-text">{checkoutError}</p> : null}

      <div className="checkout-actions">
        <button className="primary-button" disabled={checkoutBusy} onClick={onPayByCard} type="button">
          {checkoutBusy ? "Procesando..." : "Pagar con tarjeta"}
        </button>
        <button className="transfer-button" disabled={checkoutBusy} onClick={onPayByTransfer} type="button">
          {checkoutBusy ? "Procesando..." : "Transferencia bancaria"}
        </button>
        <button className="secondary-button" disabled={checkoutBusy} onClick={onPayByQr} type="button">
          {checkoutBusy ? "Procesando..." : "Pagar con QR"}
        </button>
        <button className="ghost-button" disabled={checkoutBusy} onClick={onCheckoutWhatsApp} type="button">
          {storeSettings.whatsappNumber ? "Cerrar por WhatsApp" : "Generar pedido"}
        </button>
      </div>

      <p className="availability">
        {storeSettings.cardInstallmentsText}. Envio calculado desde la sucursal Longchamps. Tus datos son procesados de forma segura por Mercado Pago.
      </p>
    </div>
  );
}
