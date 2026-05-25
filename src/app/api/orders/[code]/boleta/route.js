import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Colores ──────────────────────────────────────────────────────────────────
const GOLD = "#C9A040";
const DARK = "#2B1D13";
const LIGHT_BG = "#F7F0E1";
const MUTED = "#7A6A56";
const BORDER = "#D4B87A";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(val) {
  const n = Math.round(Number(val) || 0);
  return "$ " + n.toLocaleString("es-AR");
}

function fmtDate(val) {
  if (!val) return "";
  try {
    const s = String(val).replace("T", " ").split(".")[0];
    const d = new Date(s.includes(" ") ? s.replace(" ", "T") + "Z" : s);
    if (isNaN(d.getTime())) return String(val).split("T")[0];
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Argentina/Buenos_Aires",
    }) + "  " + d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch {
    return String(val).split("T")[0];
  }
}

const PAYMENT_LABELS = {
  card: "Tarjeta / MercadoPago",
  transfer: "Transferencia bancaria",
  whatsapp: "Efectivo / A coordinar",
};

// ── Dibujar una mitad de la boleta ────────────────────────────────────────────
function drawHalf(doc, order, items, rawCustomer, startY, isCopy) {
  const pageW = doc.page.width;
  const M = 32;
  const W = pageW - M * 2;
  let y = startY;

  // Header band
  doc.rect(M, y, W, 50).fillColor(DARK).fill();
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(22)
    .text("MANAREY", M + 12, y + 10, { lineBreak: false });
  doc.fillColor("#B8924A").font("Helvetica").fontSize(8)
    .text("Mueblería", M + 12, y + 33, { lineBreak: false });
  doc.fillColor(isCopy ? "#B8924A" : GOLD).font("Helvetica-Bold").fontSize(8)
    .text(isCopy ? "DUPLICADO" : "ORIGINAL", M, y + 19, {
      width: W - 12, align: "right", lineBreak: false,
    });
  y += 58;

  // Order info
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(8.5)
    .text(`Nro: ${order.order_code}`, M, y, { lineBreak: false });
  doc.fillColor(MUTED).font("Helvetica").fontSize(8)
    .text(`Fecha: ${fmtDate(order.created_at)}`, M, y, {
      width: W, align: "right", lineBreak: false,
    });
  y += 13;

  const isPickup = order.shipping_zone_id === "pickup";
  const localLabel = isPickup
    ? `Retiro en sucursal: ${order.shipping_zone_label || order.customer_address || ""}`
    : `Envío a domicilio · ${order.shipping_zone_label || ""}`;
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
    .text(localLabel, M, y, { lineBreak: false });
  y += 14;

  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
  y += 9;

  // Cliente
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5)
    .text("DATOS DEL CLIENTE", M, y, { lineBreak: false });
  y += 12;

  const lW = 72;
  const vX = M + lW + 4;
  const vW = W - lW - 4;

  function clientRow(label, value) {
    if (!value) return;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5)
      .text(label, M, y, { width: lW, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica").fontSize(7.5)
      .text(value, vX, y, { width: vW, lineBreak: false });
    y += 11;
  }

  clientRow("Nombre:", order.customer_name || "");
  clientRow("Teléfono:", order.customer_phone || "");
  if (!isPickup) {
    const addr = [order.customer_address, order.customer_city].filter(Boolean).join(", ");
    clientRow("Dirección:", addr);
    if (rawCustomer?.betweenStreets) clientRow("Entre calles:", rawCustomer.betweenStreets);
  }
  const notasRaw = order.customer_notes || rawCustomer?.notes || "";
  const notasClean = notasRaw.startsWith("WEB | Cliente:")
    ? notasRaw.split("|")
        .filter((p) => {
          const t = p.trim();
          return t && !t.startsWith("WEB") && !t.startsWith("Cliente:") && !t.startsWith("Tel:");
        })
        .join(" | ").trim()
    : notasRaw;
  if (notasClean) clientRow("Notas:", notasClean);

  y += 5;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
  y += 9;

  // Detalle
  doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5)
    .text("DETALLE", M, y, { lineBreak: false });
  y += 11;

  const cQty = M;
  const cQtyW = 28;
  const cName = M + cQtyW + 4;
  const cNameW = W - cQtyW - 4 - 74 - 70;
  const cUnit = cName + cNameW + 4;
  const cUnitW = 70;
  const cSub = cUnit + cUnitW + 4;
  const cSubW = W - (cSub - M);

  // Header fila
  doc.rect(M, y - 1, W, 14).fillColor(LIGHT_BG).fill();
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(7);
  doc.text("Cant.", cQty, y + 1, { width: cQtyW, align: "center", lineBreak: false });
  doc.text("Producto / Descripción", cName, y + 1, { width: cNameW, lineBreak: false });
  doc.text("P. Unitario", cUnit, y + 1, { width: cUnitW, align: "right", lineBreak: false });
  doc.text("Subtotal", cSub, y + 1, { width: cSubW, align: "right", lineBreak: false });
  y += 15;

  let rowAlt = false;
  for (const item of items) {
    if (rowAlt) doc.rect(M, y - 1, W, 13).fillColor("#FDFAF4").fill();
    rowAlt = !rowAlt;
    const unitPrice = Number(item.unit_price || 0) + Number(item.accessory_price || 0);
    const lineTotal = Number(item.line_total || unitPrice * item.quantity || 0);
    const productName = item.name + (item.accessory_label ? ` + ${item.accessory_label}` : "");
    doc.fillColor(DARK).font("Helvetica").fontSize(7.5);
    doc.text(String(item.quantity), cQty, y + 1, { width: cQtyW, align: "center", lineBreak: false });
    doc.text(productName, cName, y + 1, { width: cNameW, lineBreak: false });
    doc.text(fmtMoney(unitPrice), cUnit, y + 1, { width: cUnitW, align: "right", lineBreak: false });
    doc.text(fmtMoney(lineTotal), cSub, y + 1, { width: cSubW, align: "right", lineBreak: false });
    y += 13;
  }

  y += 4;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
  y += 8;

  // Totales
  const tLabelX = M + W - 200;
  const tLabelW = 130;
  const tValX = tLabelX + tLabelW + 4;
  const tValW = 66;

  function totalRow(label, value, bold) {
    doc.fillColor(MUTED).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8)
      .text(label, tLabelX, y, { width: tLabelW, align: "right", lineBreak: false });
    doc.fillColor(DARK).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9 : 8)
      .text(value, tValX, y, { width: tValW, align: "right", lineBreak: false });
    y += bold ? 13 : 11;
  }

  totalRow("Subtotal productos:", fmtMoney(order.subtotal));
  if (Number(order.shipping_cost) > 0) totalRow("Envío:", fmtMoney(order.shipping_cost));

  doc.rect(tLabelX - 6, y - 2, 206, 17).fillColor(LIGHT_BG).fill();
  totalRow("TOTAL:", fmtMoney(order.total), true);

  y += 4;
  const payLabel = PAYMENT_LABELS[order.payment_method] || order.payment_method || "";
  doc.fillColor(MUTED).font("Helvetica").fontSize(7.5)
    .text(`Forma de pago: ${payLabel}`, M, y, { lineBreak: false });
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(_request, { params }) {
  const { code } = await params;
  if (!code) {
    return new NextResponse("Falta el código de orden", { status: 400 });
  }

  try {
    // Fetch order
    const orderRes = await query(
      `SELECT * FROM public.web_orders WHERE order_code = $1 LIMIT 1`,
      [code],
    );
    if (!orderRes.rows.length) {
      return new NextResponse("Orden no encontrada", { status: 404 });
    }
    const order = orderRes.rows[0];

    // Solo permitir boleta de órdenes pagadas
    const isPaid = order.status === "paid" || order.payment_status === "approved";
    if (!isPaid) {
      return new NextResponse("La boleta solo está disponible una vez confirmado el pago", { status: 403 });
    }

    // Fetch items
    const itemsRes = await query(
      `SELECT * FROM public.web_order_items WHERE order_id = $1 ORDER BY id`,
      [order.id],
    );
    const items = itemsRes.rows;

    // Parse raw_payload
    let rawCustomer = {};
    try {
      const rp = typeof order.raw_payload === "string"
        ? JSON.parse(order.raw_payload || "{}")
        : (order.raw_payload || {});
      rawCustomer = rp.customer || {};
    } catch { /* ignorar */ }

    // Generar PDF
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageH = doc.page.height;
      const pageW = doc.page.width;
      const midY = pageH / 2;

      drawHalf(doc, order, items, rawCustomer, 28, false);

      // Línea de corte
      doc.save()
        .strokeColor("#BBBBBB").lineWidth(0.6)
        .dash(5, { space: 4 })
        .moveTo(28, midY).lineTo(pageW - 28, midY)
        .stroke()
        .restore();
      doc.fillColor("#AAAAAA").font("Helvetica").fontSize(7)
        .text("✂   Cortar aquí", 0, midY - 9, { align: "center", width: pageW, lineBreak: false });

      drawHalf(doc, order, items, rawCustomer, midY + 16, true);

      doc.end();
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="boleta-${code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[boleta] Error generando PDF:", err?.message || err);
    return new NextResponse("Error generando la boleta", { status: 500 });
  }
}
