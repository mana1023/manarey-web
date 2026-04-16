"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { storeBranches, storeSettings } from "@/lib/store-config";

const currencyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

// ─── Utilidades ─────────────────────────────────────────────────────────────

function calcSubtotal(items = []) {
  return items.reduce((sum, i) => sum + i.quantity * (i.precioVenta + i.accessoryPrice), 0);
}

function calcShipping(mode, distanceKm = 0) {
  if (mode !== "delivery") return 0;
  const km = Math.max(0, Number(distanceKm) || 0);
  return storeSettings.shippingBaseCost + km * storeSettings.shippingCostPerKm;
}

// Sucursales legibles (mismo orden que storeBranches)
const BRANCH_LABELS = {
  cane: "Cané – Miguel Cané 508",
  longchamps: "Longchamps – Av. Yrigoyen 19.051",
  glew: "Glew – Av. Yrigoyen 19.861",
  vidriera: "Vidriera – Av. Yrigoyen 21.890",
  estacion: "Estación – Almafuerte 45",
};

function getBranchLabel(localName) {
  // Intentar matchear con los ids conocidos
  const normalized = (localName || "").toLowerCase();
  for (const [key, label] of Object.entries(BRANCH_LABELS)) {
    if (normalized.includes(key) || key.includes(normalized)) return label;
  }
  return localName || "Sucursal";
}

// ─── Componente MP Bricks ────────────────────────────────────────────────────

function MercadoPagoBrick({ amount, email, onSuccess, onError }) {
  const containerRef = useRef(null);
  const brickRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
    if (!publicKey || !containerRef.current) return;

    let destroyed = false;

    function initBrick() {
      if (destroyed || !window.MercadoPago) return;
      const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
      mp.bricks()
        .create("cardPayment", "mp-card-brick", {
          initialization: { amount, payer: { email: email || "" } },
          callbacks: {
            onReady: () => setReady(true),
            onSubmit: async (formData) => {
              try {
                await onSuccess(formData);
              } catch (err) {
                onError(err instanceof Error ? err.message : "Error al procesar el pago.");
                return Promise.reject(err);
              }
            },
            onError: (err) => onError(err?.message || "Error en el formulario de pago."),
          },
          customization: {
            paymentMethods: { creditCard: "all", debitCard: "all" },
            visual: {
              style: { theme: "default", customVariables: { formPadding: "0px" } },
              hideFormTitle: true,
              hidePaymentButton: false,
              defaultPaymentOption: { creditCardForm: true },
            },
          },
        })
        .then((brick) => {
          brickRef.current = brick;
        })
        .catch(() => {});
    }

    if (window.MercadoPago) {
      initBrick();
    } else {
      const existing = document.getElementById("mp-sdk-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "mp-sdk-script";
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.onload = initBrick;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", initBrick);
      }
    }

    return () => {
      destroyed = true;
      try { brickRef.current?.unmount?.(); } catch { /* ignore */ }
    };
  }, [amount, email, onSuccess, onError]);

  return (
    <div>
      {!ready && (
        <div className="cf-brick-loading">
          <span>Cargando formulario seguro...</span>
        </div>
      )}
      <div id="mp-card-brick" ref={containerRef} />
    </div>
  );
}

// ─── Formulario de Transferencia ─────────────────────────────────────────────

function TransferInfo({ total, order, onWhatsApp }) {
  const cbu = process.env.NEXT_PUBLIC_TRANSFER_CBU || "";
  const alias = process.env.NEXT_PUBLIC_TRANSFER_ALIAS || "";
  const cuentaDni = process.env.NEXT_PUBLIC_TRANSFER_CUENTA_DNI || "";

  return (
    <div className="cf-transfer-panel">
      <p className="cf-transfer-title">Transferi el importe a cualquiera de estas opciones:</p>
      <div className="cf-transfer-grid">
        <div className="cf-transfer-method">
          <span className="cf-transfer-icon">🏦</span>
          <div>
            <strong>Transferencia bancaria (CBU / CVU)</strong>
            <p>Desde cualquier banco: BBVA, Santander, Galicia, Naranja, MODO, etc.</p>
            {cbu ? (
              <code className="cf-transfer-code">{cbu}</code>
            ) : (
              <p className="cf-transfer-note">Pedinos el CBU por WhatsApp</p>
            )}
            {alias && <p className="cf-transfer-alias">Alias: <strong>{alias}</strong></p>}
          </div>
        </div>

        <div className="cf-transfer-method">
          <span className="cf-transfer-icon">📱</span>
          <div>
            <strong>Cuenta DNI (Banco Provincia)</strong>
            <p>Abrí la app Cuenta DNI y transferí al alias o CBU indicado arriba.</p>
            {cuentaDni && <code className="cf-transfer-code">{cuentaDni}</code>}
          </div>
        </div>

        <div className="cf-transfer-method">
          <span className="cf-transfer-icon">💙</span>
          <div>
            <strong>Mercado Pago</strong>
            <p>Transferí desde tu billetera de MP al mismo alias o CBU.</p>
          </div>
        </div>
      </div>

      <div className="cf-transfer-total">
        <span>Total a transferir:</span>
        <strong>{currencyFmt.format(total)}</strong>
      </div>

      <div className="cf-transfer-confirm-note">
        <span>✅</span>
        <p>Una vez que realices la transferencia, la app detectará el pago automáticamente. No necesitás enviar comprobante.</p>
      </div>

      {order && (
        <p className="cf-transfer-order">Código de pedido: <strong>{order}</strong></p>
      )}
    </div>
  );
}

// ─── Resumen del Carrito ──────────────────────────────────────────────────────

function CartSummary({ items, shippingMode, distanceKm, selectedBranch }) {
  const subtotal = calcSubtotal(items);
  const shippingCost = calcShipping(shippingMode, distanceKm);
  const total = subtotal + shippingCost;

  return (
    <aside className="cf-summary">
      <p className="cf-summary-eyebrow">Resumen del pedido</p>
      <div className="cf-summary-items">
        {items.map((item) => (
          <div className="cf-summary-item" key={item.lineKey}>
            <div className="cf-summary-item-info">
              <span>{item.nombre}</span>
              {item.accessoryLabel && <small>+ {item.accessoryLabel}</small>}
              <small>x{item.quantity}</small>
            </div>
            <span>{currencyFmt.format(item.quantity * (item.precioVenta + item.accessoryPrice))}</span>
          </div>
        ))}
      </div>
      <div className="cf-summary-line">
        <span>Subtotal</span>
        <span>{currencyFmt.format(subtotal)}</span>
      </div>
      <div className="cf-summary-line">
        <span>{shippingMode === "delivery" ? "Envío estimado" : "Retiro en local"}</span>
        <span>{shippingMode === "delivery" ? currencyFmt.format(shippingCost) : "Sin cargo"}</span>
      </div>
      {selectedBranch && shippingMode === "pickup" && (
        <div className="cf-summary-line">
          <span>Sucursal</span>
          <span>{getBranchLabel(selectedBranch)}</span>
        </div>
      )}
      <div className="cf-summary-total">
        <span>Total</span>
        <strong>{currencyFmt.format(total)}</strong>
      </div>
      <p className="cf-summary-note">Precio en pesos argentinos.</p>
    </aside>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function CheckoutFlow({ initialCustomer }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(initialCustomer || null);

  // Auth form state
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authData, setAuthData] = useState({ email: "", password: "", nombre: "", apellido: "", telefono: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  // Personal data (editable after login)
  const [personalData, setPersonalData] = useState({ nombre: "", apellido: "", telefono: "" });
  const [personalEdited, setPersonalEdited] = useState(false);

  // Shipping
  const [shippingMode, setShippingMode] = useState("pickup"); // pickup | delivery
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({ street: "", number: "", city: "", notes: "" });
  const [distanceKm, setDistanceKm] = useState("");
  const [shippingQuoting, setShippingQuoting] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingFallback, setShippingFallback] = useState(null); // null | "address" | "city"

  // Payment
  const [paymentMethod, setPaymentMethod] = useState(""); // card | transfer | whatsapp
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [completedOrder, setCompletedOrder] = useState(null);

  // Transfer payment polling
  const [pollingActive, setPollingActive] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const pollingRef = useRef(null);
  const pollingStartRef = useRef(null);

  // Transfer sub-method (mp | bank | "")
  const [transferInitPoint, setTransferInitPoint] = useState(null);
  const [transferSubMethod, setTransferSubMethod] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Step tracking
  const [step, setStep] = useState(initialCustomer ? "shipping" : "auth");

  // Load cart from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("manarey-cart");
      if (stored) setCart(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  // Device detection
  useEffect(() => {
    const check = () => {
      setIsMobile(
        window.innerWidth < 768 ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      );
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Pre-fill personal data from customer
  useEffect(() => {
    if (customer && !personalEdited) {
      setPersonalData({
        nombre: customer.nombre || "",
        apellido: customer.apellido || "",
        telefono: customer.telefono || "",
      });
    }
  }, [customer, personalEdited]);

  // Load branches when shipping mode is pickup and we have cart items
  useEffect(() => {
    if (shippingMode !== "pickup" || !cart.length) {
      setBranches([]);
      return;
    }

    // Use the first cart item's productKey for branch stock lookup
    const firstProductKey = cart[0]?.productKey;
    if (!firstProductKey) return;

    setBranchesLoading(true);
    fetch(`/api/products/branch-stock?productKey=${encodeURIComponent(firstProductKey)}`)
      .then((r) => r.json())
      .then(({ branches: rawBranches }) => {
        if (!rawBranches?.length) {
          // If no stock info, show all branches
          setBranches(storeBranches.map((b) => ({ local: b.name, stock: 0 })));
          return;
        }

        // Filter: prefer >2, fallback to >=1
        const moreThanTwo = rawBranches.filter((b) => b.stock > 2);
        const atLeastOne = rawBranches.filter((b) => b.stock >= 1);
        const shown = moreThanTwo.length > 0 ? moreThanTwo : atLeastOne;

        // Always include Longchamps if not already there and has stock
        const longchamps = rawBranches.find((b) =>
          b.local.toLowerCase().includes("longchamps"),
        );
        if (longchamps && !shown.find((b) => b.local === longchamps.local)) {
          shown.push(longchamps);
        }

        setBranches(shown);
        if (shown.length === 1) setSelectedBranch(shown[0].local);
      })
      .catch(() => {
        setBranches(storeBranches.map((b) => ({ local: b.name, stock: 0 })));
      })
      .finally(() => setBranchesLoading(false));
  }, [shippingMode, cart]);

  // Auto-calculate shipping distance
  useEffect(() => {
    if (shippingMode !== "delivery") return;
    const { street, city } = deliveryAddress;
    if (!street.trim() || !city.trim()) return;

    const tid = window.setTimeout(async () => {
      setShippingQuoting(true);
      setShippingError("");
      setShippingFallback(null);
      try {
        const res = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: `${street} ${deliveryAddress.number}`.trim(), city }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setDistanceKm(String(data.distanceKm || ""));
        setShippingFallback(data.isFallback ? (data.fallbackReason || "address") : null);
      } catch {
        setShippingError("No pudimos calcular el envío automáticamente.");
      } finally {
        setShippingQuoting(false);
      }
    }, 800);

    return () => window.clearTimeout(tid);
  }, [deliveryAddress.street, deliveryAddress.number, deliveryAddress.city, shippingMode]);

  // ── Transfer payment polling ──────────────────────────────────────────────

  useEffect(() => {
    if (!completedOrder || paymentMethod !== "transfer") {
      setPollingActive(false);
      setPollingTimedOut(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    setPollingActive(true);
    pollingStartRef.current = Date.now();

    async function checkPayment() {
      // Timeout after 20 minutes
      if (Date.now() - pollingStartRef.current > 20 * 60 * 1000) {
        clearInterval(pollingRef.current);
        setPollingActive(false);
        setPollingTimedOut(true);
        return;
      }

      try {
        const res = await fetch(`/api/payments/check-incoming?code=${encodeURIComponent(completedOrder)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.isPaid) {
          clearInterval(pollingRef.current);
          setPollingActive(false);
          window.localStorage.removeItem("manarey-cart");
          window.location.href = "/checkout/success";
        }
      } catch {
        // silently retry next interval
      }
    }

    // Check immediately, then every 5 seconds
    checkPayment();
    pollingRef.current = setInterval(checkPayment, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [completedOrder, paymentMethod]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const endpoint =
        authMode === "register"
          ? "/api/auth/customer/register"
          : "/api/auth/customer/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de autenticación.");
      setCustomer(data.customer);
      setStep("shipping");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    setCustomer(null);
    setStep("auth");
  }

  // ── Personal data save ────────────────────────────────────────────────────

  function handlePersonalChange(field, value) {
    setPersonalData((p) => ({ ...p, [field]: value }));
    setPersonalEdited(true);
  }

  function handleContinueToPayment() {
    if (!personalData.nombre || !personalData.apellido || !personalData.telefono) {
      setPaymentError("Completá nombre, apellido y teléfono.");
      return;
    }
    if (shippingMode === "pickup" && !selectedBranch) {
      setPaymentError("Elegí la sucursal de retiro.");
      return;
    }
    if (shippingMode === "delivery" && (!deliveryAddress.street || !deliveryAddress.city)) {
      setPaymentError("Completá la dirección de entrega.");
      return;
    }
    setPaymentError("");
    setStep("payment");
  }

  // ── Build cart payload for APIs ───────────────────────────────────────────

  function buildCustomerPayload() {
    const fullAddress =
      shippingMode === "delivery"
        ? `${deliveryAddress.street} ${deliveryAddress.number}`.trim()
        : selectedBranch;

    return {
      nombre: personalData.nombre,
      apellido: personalData.apellido,
      fullName: `${personalData.nombre} ${personalData.apellido}`.trim(),
      email: customer?.email || "",
      telefono: personalData.telefono,
      phone: personalData.telefono,
      address: fullAddress,
      city: shippingMode === "delivery" ? deliveryAddress.city : "Retiro en sucursal",
      distanceKm: shippingMode === "delivery" ? distanceKm : "",
      notes: deliveryAddress.notes || "",
    };
  }

  // ── Payment: Card via MP Bricks ───────────────────────────────────────────

  const handleCardSubmit = useCallback(
    async (formData) => {
      setPaymentBusy(true);
      setPaymentError("");
      try {
        const res = await fetch("/api/checkout/card-direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardToken: formData.token,
            paymentMethodId: formData.payment_method_id,
            installments: formData.installments,
            issuerId: formData.issuer_id,
            items: cart,
            shippingModeId: shippingMode,
            customer: buildCustomerPayload(),
            selectedBranch,
          }),
        });
        const data = await res.json();
        if (data.status === "approved") {
          window.localStorage.removeItem("manarey-cart");
          window.location.href = "/checkout/success";
        } else if (data.status === "in_process" || data.status === "pending") {
          window.localStorage.removeItem("manarey-cart");
          window.location.href = "/checkout/pending";
        } else {
          throw new Error(data.error || "El pago fue rechazado.");
        }
      } catch (err) {
        setPaymentError(err.message);
      } finally {
        setPaymentBusy(false);
      }
    },
    [cart, shippingMode, selectedBranch, personalData, distanceKm, deliveryAddress],
  );

  // ── Payment: WhatsApp ─────────────────────────────────────────────────────

  async function handleWhatsAppCheckout() {
    if (!storeSettings.whatsappNumber) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const res = await fetch("/api/checkout/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          shippingModeId: shippingMode,
          customer: buildCustomerPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.localStorage.removeItem("manarey-cart");
      if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      window.location.href = "/checkout/success";
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  // ── Payment: Transfer ─────────────────────────────────────────────────────

  async function handleTransferOrder(subMethod) {
    setPaymentBusy(true);
    setPaymentError("");
    setTransferSubMethod(subMethod);
    try {
      const res = await fetch("/api/checkout/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          shippingModeId: shippingMode,
          customer: buildCustomerPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCompletedOrder(data.orderCode);
      setTransferInitPoint(data.initPoint || data.sandboxInitPoint || null);
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  function handleTransferWhatsApp() {
    if (!storeSettings.whatsappNumber || !completedOrder) return;
    const msg = `Hola Manarey, realicé la transferencia para el pedido ${completedOrder}. Adjunto el comprobante.`;
    window.open(
      `https://wa.me/${storeSettings.whatsappNumber}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const subtotal = calcSubtotal(cart);
  const shippingCost = calcShipping(shippingMode, distanceKm);
  const total = subtotal + shippingCost;

  // ── Empty cart ────────────────────────────────────────────────────────────

  if (cart.length === 0 && step !== "auth") {
    return (
      <div className="cf-shell cf-empty">
        <div className="cf-empty-card">
          <p className="cf-eyebrow">Carrito vacío</p>
          <h2>No hay productos en tu carrito</h2>
          <p>Volvé al catálogo para agregar productos.</p>
          <a href="/" className="cf-btn-primary">Ver catálogo</a>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="cf-shell">
      {/* Header */}
      <header className="cf-header">
        <a href="/" className="cf-logo-link">
          <BrandLogo compact />
        </a>
        <div className="cf-header-right">
          {customer ? (
            <>
              <span className="cf-user-name">Hola, {customer.nombre || customer.email}</span>
              <button className="cf-link-btn" onClick={handleLogout} type="button">Cerrar sesión</button>
            </>
          ) : null}
          <a href="/" className="cf-link-btn">← Volver al catálogo</a>
        </div>
      </header>

      <div className="cf-layout">
        {/* ── Columna principal ───────────────────────────────────────────── */}
        <main className="cf-main">
          {/* STEP 1: Auth */}
          {step === "auth" && (
            <section className="cf-section">
              <p className="cf-eyebrow">Paso 1 de 3</p>
              <h1 className="cf-heading">Ingresá para continuar</h1>

              {/* Google */}
              <a href="/api/auth/google" className="cf-google-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.39a4.61 4.61 0 01-2 3.03v2.52h3.24c1.9-1.75 3-4.32 3-7.34z" fill="#4285F4"/>
                  <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.6A10 10 0 0010 20z" fill="#34A853"/>
                  <path d="M4.41 11.89A6.01 6.01 0 014.1 10c0-.66.11-1.3.31-1.89V5.51H1.07A10 10 0 000 10c0 1.61.39 3.13 1.07 4.49l3.34-2.6z" fill="#FBBC05"/>
                  <path d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.69 0 10 0A10 10 0 001.07 5.51l3.34 2.6C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/>
                </svg>
                Continuar con Google
              </a>

              <div className="cf-divider"><span>o con tu cuenta</span></div>

              {/* Tabs */}
              <div className="cf-auth-tabs">
                <button
                  className={`cf-auth-tab${authMode === "login" ? " active" : ""}`}
                  onClick={() => { setAuthMode("login"); setAuthError(""); }}
                  type="button"
                >
                  Ya tengo cuenta
                </button>
                <button
                  className={`cf-auth-tab${authMode === "register" ? " active" : ""}`}
                  onClick={() => { setAuthMode("register"); setAuthError(""); }}
                  type="button"
                >
                  Crear cuenta
                </button>
              </div>

              <form className="cf-form" onSubmit={handleAuthSubmit}>
                {authMode === "register" && (
                  <>
                    <div className="cf-input-row">
                      <div className="cf-input-group">
                        <label>Nombre</label>
                        <input
                          className="cf-input"
                          placeholder="Ej: María"
                          value={authData.nombre}
                          onChange={(e) => setAuthData((d) => ({ ...d, nombre: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="cf-input-group">
                        <label>Apellido</label>
                        <input
                          className="cf-input"
                          placeholder="Ej: García"
                          value={authData.apellido}
                          onChange={(e) => setAuthData((d) => ({ ...d, apellido: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="cf-input-group">
                      <label>Teléfono</label>
                      <input
                        className="cf-input"
                        type="tel"
                        placeholder="Ej: 11 1234-5678"
                        value={authData.telefono}
                        onChange={(e) => setAuthData((d) => ({ ...d, telefono: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                <div className="cf-input-group">
                  <label>Correo electrónico</label>
                  <input
                    className="cf-input"
                    type="email"
                    placeholder="tu@correo.com"
                    value={authData.email}
                    onChange={(e) => setAuthData((d) => ({ ...d, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="cf-input-group">
                  <label>Contraseña</label>
                  <input
                    className="cf-input"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={authData.password}
                    onChange={(e) => setAuthData((d) => ({ ...d, password: e.target.value }))}
                    required
                  />
                </div>
                {authError && <p className="cf-error">{authError}</p>}
                <button className="cf-btn-primary" disabled={authBusy} type="submit">
                  {authBusy ? "Procesando..." : authMode === "register" ? "Crear cuenta y continuar" : "Ingresar y continuar"}
                </button>
              </form>
            </section>
          )}

          {/* STEP 2: Shipping */}
          {step === "shipping" && (
            <section className="cf-section">
              <p className="cf-eyebrow">Paso 2 de 3</p>
              <h1 className="cf-heading">Datos de entrega</h1>

              {/* Personal data */}
              <div className="cf-card">
                <p className="cf-card-title">Tus datos</p>
                <div className="cf-input-row">
                  <div className="cf-input-group">
                    <label>Nombre</label>
                    <input
                      className="cf-input"
                      placeholder="Nombre"
                      value={personalData.nombre}
                      onChange={(e) => handlePersonalChange("nombre", e.target.value)}
                    />
                  </div>
                  <div className="cf-input-group">
                    <label>Apellido</label>
                    <input
                      className="cf-input"
                      placeholder="Apellido"
                      value={personalData.apellido}
                      onChange={(e) => handlePersonalChange("apellido", e.target.value)}
                    />
                  </div>
                </div>
                <div className="cf-input-group">
                  <label>Teléfono</label>
                  <input
                    className="cf-input"
                    type="tel"
                    placeholder="Ej: 11 1234-5678"
                    value={personalData.telefono}
                    onChange={(e) => handlePersonalChange("telefono", e.target.value)}
                  />
                </div>
              </div>

              {/* Shipping mode */}
              <div className="cf-shipping-modes">
                <button
                  className={`cf-mode-btn${shippingMode === "pickup" ? " active" : ""}`}
                  onClick={() => setShippingMode("pickup")}
                  type="button"
                >
                  <span className="cf-mode-icon">🏪</span>
                  <div>
                    <strong>Retiro en local</strong>
                    <span>Sin costo de envío</span>
                  </div>
                </button>
                <button
                  className={`cf-mode-btn${shippingMode === "delivery" ? " active" : ""}`}
                  onClick={() => setShippingMode("delivery")}
                  type="button"
                >
                  <span className="cf-mode-icon">🚚</span>
                  <div>
                    <strong>Envío a domicilio</strong>
                    <span>Cotizado por distancia</span>
                  </div>
                </button>
              </div>

              {/* Pickup branch selector */}
              {shippingMode === "pickup" && (
                <div className="cf-card">
                  <p className="cf-card-title">Elegí la sucursal de retiro</p>
                  {branchesLoading ? (
                    <p className="cf-muted">Buscando sucursales con stock...</p>
                  ) : branches.length === 0 ? (
                    <p className="cf-muted">No encontramos stock disponible. Consultanos por WhatsApp.</p>
                  ) : (
                    <div className="cf-branch-list">
                      {branches.map((b) => (
                        <button
                          key={b.local}
                          className={`cf-branch-btn${selectedBranch === b.local ? " active" : ""}`}
                          onClick={() => setSelectedBranch(b.local)}
                          type="button"
                        >
                          <span className="cf-branch-name">{getBranchLabel(b.local)}</span>
                          {b.stock > 0 && (
                            <span className="cf-branch-stock">
                              {b.stock > 2 ? `${b.stock} en stock` : b.stock === 1 ? "Último" : `${b.stock} disponibles`}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Delivery address */}
              {shippingMode === "delivery" && (
                <div className="cf-card">
                  <p className="cf-card-title">Dirección de entrega</p>
                  <div className="cf-input-row">
                    <div className="cf-input-group" style={{ flex: 3 }}>
                      <label>Calle</label>
                      <input
                        className="cf-input"
                        placeholder="Nombre de la calle"
                        value={deliveryAddress.street}
                        onChange={(e) => setDeliveryAddress((a) => ({ ...a, street: e.target.value }))}
                      />
                    </div>
                    <div className="cf-input-group" style={{ flex: 1 }}>
                      <label>Número</label>
                      <input
                        className="cf-input"
                        placeholder="1234"
                        value={deliveryAddress.number}
                        onChange={(e) => setDeliveryAddress((a) => ({ ...a, number: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="cf-input-group">
                    <label>Ciudad / Localidad</label>
                    <input
                      className="cf-input"
                      placeholder="Ej: Lomas de Zamora"
                      value={deliveryAddress.city}
                      onChange={(e) => setDeliveryAddress((a) => ({ ...a, city: e.target.value }))}
                    />
                  </div>
                  <div className="cf-input-group">
                    <label>Notas de entrega (opcional)</label>
                    <input
                      className="cf-input"
                      placeholder="Piso, timbre, referencias..."
                      value={deliveryAddress.notes}
                      onChange={(e) => setDeliveryAddress((a) => ({ ...a, notes: e.target.value }))}
                    />
                  </div>
                  {shippingQuoting && <p className="cf-muted">Calculando costo de envío...</p>}
                  {shippingError && <p className="cf-error">{shippingError}</p>}
                  {distanceKm && !shippingQuoting && !shippingFallback && (
                    <p className="cf-muted">
                      {distanceKm} km desde Longchamps → Envío estimado: {currencyFmt.format(calcShipping("delivery", distanceKm))}
                    </p>
                  )}
                  {distanceKm && !shippingQuoting && shippingFallback && (
                    <div className="cf-shipping-fallback">
                      <span className="cf-shipping-fallback-icon">⚠️</span>
                      <div>
                        <p className="cf-shipping-fallback-title">
                          {shippingFallback === "city"
                            ? "No encontramos tu localidad en el mapa"
                            : "No encontramos la dirección exacta"}
                        </p>
                        <p className="cf-shipping-fallback-sub">
                          Se cotizó el punto más lejano de <strong>{deliveryAddress.city}</strong>:{" "}
                          {distanceKm} km → {currencyFmt.format(calcShipping("delivery", distanceKm))}.
                          Si tu domicilio está más cerca, podemos ajustarlo al coordinar la entrega.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {paymentError && <p className="cf-error">{paymentError}</p>}

              <button
                className="cf-btn-primary"
                onClick={handleContinueToPayment}
                type="button"
              >
                Continuar al pago →
              </button>
            </section>
          )}

          {/* STEP 3: Payment */}
          {step === "payment" && (
            <section className="cf-section">
              <p className="cf-eyebrow">Paso 3 de 3</p>
              <h1 className="cf-heading">Elegí cómo pagar</h1>

              <button
                className="cf-back-btn"
                onClick={() => { setPaymentMethod(""); setStep("shipping"); }}
                type="button"
              >
                ← Modificar datos de entrega
              </button>

              {/* Payment method selector */}
              {!paymentMethod && (
                <div className="cf-payment-methods">
                  <button
                    className="cf-payment-btn"
                    onClick={() => setPaymentMethod("card")}
                    type="button"
                  >
                    <span className="cf-payment-icon">💳</span>
                    <div>
                      <strong>Tarjeta de crédito o débito</strong>
                      <span>Formulario seguro con Mercado Pago. Todas las tarjetas.</span>
                    </div>
                  </button>
                  <button
                    className="cf-payment-btn"
                    onClick={() => setPaymentMethod("transfer")}
                    type="button"
                    disabled={paymentBusy}
                  >
                    <span className="cf-payment-icon">🏦</span>
                    <div>
                      <strong>Transferencia bancaria</strong>
                      <span>MercadoPago, Cuenta DNI, CBU / CVU, cualquier banco.</span>
                    </div>
                  </button>
                  {storeSettings.whatsappNumber && (
                    <button
                      className="cf-payment-btn"
                      onClick={handleWhatsAppCheckout}
                      type="button"
                      disabled={paymentBusy}
                    >
                      <span className="cf-payment-icon">💬</span>
                      <div>
                        <strong>Coordinar por WhatsApp</strong>
                        <span>Te enviamos todos los datos del pedido para cerrarlo en chat.</span>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Card form */}
              {paymentMethod === "card" && (
                <div className="cf-card">
                  <div className="cf-card-header">
                    <p className="cf-card-title">Pago con tarjeta</p>
                    <button
                      className="cf-link-btn"
                      onClick={() => setPaymentMethod("")}
                      type="button"
                    >
                      Cambiar método
                    </button>
                  </div>
                  {paymentBusy ? (
                    <p className="cf-muted">Procesando pago...</p>
                  ) : (
                    <MercadoPagoBrick
                      amount={total}
                      email={customer?.email || ""}
                      onSuccess={handleCardSubmit}
                      onError={(msg) => setPaymentError(msg)}
                    />
                  )}
                  {paymentError && <p className="cf-error">{paymentError}</p>}
                </div>
              )}

              {/* Transfer – selector de sub-método + UI dinámica */}
              {paymentMethod === "transfer" && (
                <div className="cf-card">
                  <div className="cf-card-header">
                    <p className="cf-card-title">Transferencia bancaria</p>
                    {!pollingActive && (
                      <button
                        className="cf-link-btn"
                        onClick={() => {
                          setPaymentMethod("");
                          setCompletedOrder(null);
                          setTransferSubMethod("");
                          setTransferInitPoint(null);
                          setPollingTimedOut(false);
                        }}
                        type="button"
                      >
                        Cambiar método
                      </button>
                    )}
                  </div>

                  {/* PASO A: elegir con qué billetera/banco van a pagar */}
                  {!transferSubMethod && !paymentBusy && (
                    <div className="cf-transfer-submethods">
                      <p className="cf-transfer-subtitle">¿Con qué vas a pagar?</p>
                      <button
                        className="cf-transfer-submethod-btn"
                        type="button"
                        onClick={() => handleTransferOrder("mp")}
                      >
                        <span className="cf-transfer-submethod-icon">💙</span>
                        <div>
                          <strong>MercadoPago</strong>
                          <span>{isMobile ? "Abrí la app y pagá directo" : "Escaneá el QR con tu celular"}</span>
                        </div>
                        <span className="cf-transfer-submethod-arrow">›</span>
                      </button>
                      <button
                        className="cf-transfer-submethod-btn"
                        type="button"
                        onClick={() => handleTransferOrder("bank")}
                      >
                        <span className="cf-transfer-submethod-icon">🏦</span>
                        <div>
                          <strong>Otro banco o billetera</strong>
                          <span>Transferí con CBU / CVU desde Cuenta DNI, BBVA, Santander, MODO, etc.</span>
                        </div>
                        <span className="cf-transfer-submethod-arrow">›</span>
                      </button>
                    </div>
                  )}

                  {paymentBusy && (
                    <p className="cf-muted">Generando orden de pago...</p>
                  )}

                  {/* PASO B: UI según sub-método elegido */}
                  {completedOrder && !paymentBusy && (
                    <>
                      {/* Sub-método: MercadoPago */}
                      {transferSubMethod === "mp" && transferInitPoint && (
                        <div className="cf-mp-pay-panel">
                          {isMobile ? (
                            /* MÓVIL: botón grande para abrir la app */
                            <div className="cf-mp-mobile">
                              <p className="cf-mp-instruction">
                                Tocá el botón para abrir MercadoPago y completar el pago de{" "}
                                <strong>{currencyFmt.format(total)}</strong>
                              </p>
                              <a
                                href={transferInitPoint}
                                className="cf-mp-open-btn"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <span>💙</span> Abrir MercadoPago
                              </a>
                              <p className="cf-mp-note">
                                Si tenés más de una cuenta de MercadoPago, la app te preguntará con cuál pagar.
                              </p>
                            </div>
                          ) : (
                            /* ESCRITORIO: QR para escanear con el celular */
                            <div className="cf-mp-desktop">
                              <p className="cf-mp-instruction">
                                Escaneá el QR con la cámara o la app de MercadoPago para pagar{" "}
                                <strong>{currencyFmt.format(total)}</strong>
                              </p>
                              <div className="cf-qr-wrapper">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(transferInitPoint)}&size=240x240&format=png&margin=10`}
                                  alt="QR MercadoPago"
                                  width={240}
                                  height={240}
                                  className="cf-qr-img"
                                />
                              </div>
                              <p className="cf-mp-note">
                                Si tenés más de una cuenta de MercadoPago, la app te va a preguntar con cuál pagar.
                              </p>
                              <a
                                href={transferInitPoint}
                                className="cf-mp-browser-link"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                También podés pagar desde el navegador →
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sub-método: banco manual */}
                      {transferSubMethod === "bank" && (
                        <TransferInfo
                          total={total}
                          order={completedOrder}
                          onWhatsApp={handleTransferWhatsApp}
                        />
                      )}

                      <p className="cf-transfer-order">
                        Pedido <strong>{completedOrder}</strong>
                      </p>

                      {/* Polling status */}
                      {pollingActive && !pollingTimedOut && (
                        <div className="cf-polling-status">
                          <div className="cf-polling-spinner" />
                          <div>
                            <p className="cf-polling-title">Esperando confirmación de pago...</p>
                            <p className="cf-polling-sub">
                              La app detectará tu pago automáticamente. No cierres esta página.
                            </p>
                          </div>
                        </div>
                      )}

                      {pollingTimedOut && (
                        <div className="cf-polling-timeout">
                          <p className="cf-polling-title">¿Ya pagaste?</p>
                          <p className="cf-polling-sub">
                            Si realizaste el pago y no fue detectado aún, envianos el comprobante por WhatsApp
                            con el código <strong>{completedOrder}</strong>.
                          </p>
                          <button className="cf-whatsapp-btn" type="button" onClick={handleTransferWhatsApp}>
                            Enviar comprobante por WhatsApp
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {paymentError && <p className="cf-error">{paymentError}</p>}
                </div>
              )}

              {/* WhatsApp (loading state) */}
              {paymentMethod === "whatsapp" && paymentBusy && (
                <p className="cf-muted">Generando pedido...</p>
              )}
            </section>
          )}
        </main>

        {/* ── Resumen lateral ─────────────────────────────────────────────── */}
        {cart.length > 0 && (
          <CartSummary
            items={cart}
            shippingMode={shippingMode}
            distanceKm={distanceKm}
            selectedBranch={selectedBranch}
          />
        )}
      </div>
    </div>
  );
}
