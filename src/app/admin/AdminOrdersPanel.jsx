"use client";

import { useCallback, useEffect, useState } from "react";

const STATUS_LABELS = {
  all:       { label: "Todos",       color: "#6f5a46" },
  pending:   { label: "Pendiente",   color: "#b5800a" },
  paid:      { label: "Pagado",      color: "#45674f" },
  shipped:   { label: "En camino",   color: "#3a6ea5" },
  delivered: { label: "Entregado",   color: "#45674f" },
  cancelled: { label: "Cancelado",   color: "#ab5443" },
};

const PAYMENT_LABELS = {
  card:      "💳 Tarjeta",
  transfer:  "🏦 Transferencia",
  whatsapp:  "💬 WhatsApp",
};

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminOrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // pedido expandido
  const [updating, setUpdating] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, page, ...(search ? { q: search } : {}) });
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [status, page, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Buscar con debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function updateStatus(orderCode, newStatus) {
    setUpdating(orderCode);
    try {
      await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode, status: newStatus }),
      });
      await fetchOrders();
      if (selected?.order_code === orderCode) {
        setSelected((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="aop-shell">
      {/* Header */}
      <div className="aop-header">
        <div>
          <p className="aop-eyebrow">Panel de administración</p>
          <h1 className="aop-title">Pedidos</h1>
        </div>
        <a href="/" className="aop-back-btn">← Volver a la tienda</a>
      </div>

      {/* Filtros */}
      <div className="aop-toolbar">
        <div className="aop-status-tabs">
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              className={`aop-tab${status === key ? " active" : ""}`}
              onClick={() => { setStatus(key); setPage(1); }}
              type="button"
            >
              {label}
              {key === "all" && total > 0 && <span className="aop-tab-count">{total}</span>}
            </button>
          ))}
        </div>
        <input
          className="aop-search"
          placeholder="Buscar por código, nombre o teléfono..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div className="aop-content">
        {loading ? (
          <div className="aop-skeletons">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aop-skeleton-row" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="aop-empty">
            <p>No hay pedidos{search ? ` para "${search}"` : ""}.</p>
          </div>
        ) : (
          <div className="aop-table-wrap">
            <table className="aop-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
                  return (
                    <tr
                      key={order.id}
                      className={`aop-row${selected?.id === order.id ? " aop-row--selected" : ""}`}
                      onClick={() => setSelected(selected?.id === order.id ? null : order)}
                    >
                      <td className="aop-code">{order.order_code}</td>
                      <td className="aop-date">{fmtDate(order.created_at)}</td>
                      <td className="aop-customer">
                        <span className="aop-customer-name">{order.customer_name}</span>
                        <span className="aop-customer-phone">{order.customer_phone}</span>
                      </td>
                      <td>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</td>
                      <td className="aop-total">{fmt.format(order.total)}</td>
                      <td>
                        <span className="aop-status-badge" style={{ color: st.color, borderColor: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="aop-chevron">{selected?.id === order.id ? "▲" : "▼"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detalle expandido */}
        {selected && (
          <div className="aop-detail">
            <div className="aop-detail-header">
              <div>
                <p className="aop-detail-code">{selected.order_code}</p>
                <p className="aop-detail-date">{fmtDate(selected.created_at)}</p>
              </div>
              <button className="aop-detail-close" onClick={() => setSelected(null)} type="button">✕</button>
            </div>

            <div className="aop-detail-body">
              {/* Cliente */}
              <div className="aop-detail-section">
                <p className="aop-detail-section-title">Cliente</p>
                <p><strong>{selected.customer_name}</strong></p>
                <p>{selected.customer_phone}{selected.customer_email ? ` · ${selected.customer_email}` : ""}</p>
                {selected.customer_address && (
                  <p>{selected.customer_address}{selected.customer_city ? `, ${selected.customer_city}` : ""}</p>
                )}
                {selected.customer_notes && <p className="aop-notes">📝 {selected.customer_notes}</p>}
              </div>

              {/* Productos */}
              <div className="aop-detail-section">
                <p className="aop-detail-section-title">Productos</p>
                {(selected.items || []).map((item, i) => (
                  <div key={i} className="aop-item-row">
                    <span>{item.quantity}× {item.name}{item.accessory_label ? ` (${item.accessory_label})` : ""}</span>
                    <span>{fmt.format(item.line_total)}</span>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="aop-detail-section">
                <p className="aop-detail-section-title">Totales</p>
                <div className="aop-item-row"><span>Subtotal</span><span>{fmt.format(selected.subtotal)}</span></div>
                <div className="aop-item-row"><span>{selected.shipping_zone_label}</span><span>{selected.shipping_cost > 0 ? fmt.format(selected.shipping_cost) : "Bonificado"}</span></div>
                {selected.surcharge_amount > 0 && (
                  <div className="aop-item-row">
                    <span>Recargo {selected.installments} cuotas</span>
                    <span>+{fmt.format(selected.surcharge_amount)}</span>
                  </div>
                )}
                <div className="aop-item-row aop-item-row--total">
                  <span>Total cobrado</span>
                  <strong>{fmt.format(selected.total + (selected.surcharge_amount || 0))}</strong>
                </div>
              </div>

              {/* Pago */}
              <div className="aop-detail-section">
                <p className="aop-detail-section-title">Pago</p>
                <p>{PAYMENT_LABELS[selected.payment_method] || selected.payment_method}</p>
                {selected.payment_reference && <p className="aop-muted">Ref. MP: {selected.payment_reference}</p>}
              </div>

              {/* Cambiar estado */}
              <div className="aop-detail-section">
                <p className="aop-detail-section-title">Cambiar estado</p>
                <div className="aop-status-actions">
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== "all").map(([key, { label, color }]) => (
                    <button
                      key={key}
                      className={`aop-status-action${selected.status === key ? " active" : ""}`}
                      style={{ "--st-color": color }}
                      onClick={() => updateStatus(selected.order_code, key)}
                      disabled={updating === selected.order_code || selected.status === key}
                      type="button"
                    >
                      {updating === selected.order_code && selected.status !== key ? "..." : label}
                    </button>
                  ))}
                </div>
              </div>

              {/* WhatsApp rápido */}
              <a
                className="aop-wa-btn"
                href={`https://wa.me/${selected.customer_phone?.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${selected.customer_name?.split(" ")[0]}, te escribimos de Manarey sobre tu pedido ${selected.order_code}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 Contactar al cliente por WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Paginación */}
        {pages > 1 && (
          <div className="aop-pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">← Anterior</button>
            <span>Página {page} de {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} type="button">Siguiente →</button>
          </div>
        )}
      </div>
    </div>
  );
}
